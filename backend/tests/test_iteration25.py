"""Tests iteration 25 — Pinkberry Drc / paiements en ligne Flexpaie (mobile money + carte).

Verifie :
- GET /api/paiements/modes (public) : modes en ligne actifs selon la configuration Flexpaie.
- POST /api/paiements/mobile-money et /api/paiements/carte : validations (numero, devise,
  commande d'un autre compte), 503 sans configuration, initiation si Flexpaie est configure.
- GET /api/paiements/{id} : proprietaire / admin / autre client, statuts publics
  (attente, echoue apres annulation carte, expire).
- POST /api/paiements/flexpaie/callback : non signe, il ne paie jamais une commande par
  son seul contenu (verification check obligatoire) ; JSON invalide / reference absente -> 400.
- GET /api/paiements/carte/{id}/retour : page HTML, issue enregistree sans figer le statut.
- POST /api/paiements/{cmd}/cash : bascule cash, deja paye -> 400, autre user -> 404.
- POST /api/commandes : modePaiement 'cash' / 'mobile' / 'carte'.
- Rapports admin xlsx/pdf : colonnes 'Paiement' et 'Statut paiement', libelle 'Carte bancaire'.

Les tentatives sont inserees directement en base quand Flexpaie n'est pas joignable depuis
les tests (pas de bac a sable Flexpaie). Nettoyage en teardown_module.
"""
from __future__ import annotations

import io
import os
import uuid
from datetime import datetime, timedelta, timezone

import pytest
import requests
from pymongo import MongoClient

from outils_auth import article_commandable

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")

# Prefixe par worker xdist : chaque worker ne nettoie que ses propres commandes.
_WORKER = os.environ.get("PYTEST_XDIST_WORKER", "master")
LABEL_PREFIX = f"TEST_ITER25_{_WORKER}"

CLIENT = ("0990000001", "client123")
CLIENT_ALT = ("0990000002", "client123")  # 2e client demo si existant
ADMIN = ("0810000000", "admin123")


def _login(sess: requests.Session, tel: str, mdp: str) -> str:
    r = sess.post(f"{BASE_URL}/api/auth/connexion", json={"telephone": tel, "motDePasse": mdp}, timeout=25)
    assert r.status_code == 200, f"login {tel}: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def sess() -> requests.Session:
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def tokens(sess):
    d = {"client": _login(sess, *CLIENT), "admin": _login(sess, *ADMIN)}
    try:
        d["client_alt"] = _login(sess, *CLIENT_ALT)
    except AssertionError:
        d["client_alt"] = None
    return d


@pytest.fixture(scope="module")
def modes():
    return requests.get(f"{BASE_URL}/api/paiements/modes", timeout=15).json()


def _h(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _mongo():
    return MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]


def _creer_commande(sess, token, mode_paiement="cash"):
    body = {
        "items": [article_commandable()],
        "adresse": {
            "label": LABEL_PREFIX,
            "commune": "Gombe",
            "avenue": "Test",
            "numero": "1",
            "repere": "repere iter25",
            "telephone": "0990000001",
            "lat": -4.30,
            "lng": 15.30,
        },
        "modePaiement": mode_paiement,
    }
    r = sess.post(f"{BASE_URL}/api/commandes", json=body, headers=_h(token), timeout=30)
    assert r.status_code == 200, f"creer_commande({mode_paiement}): {r.status_code} {r.text[:200]}"
    return r.json()


def _tentative(cmd: dict, mode: str = "mobile", **champs) -> dict:
    """Tentative Flexpaie en attente, rattachee a la commande, comme apres une initiation reussie."""
    db = _mongo()
    doc = db.commandes.find_one({"id": cmd["id"]}, {"_id": 0, "userId": 1, "total": 1})
    reference = "PBT" + uuid.uuid4().hex[:13].upper()
    paiement = {
        "id": reference,
        "reference": reference,
        "mode": mode,
        "commandeId": cmd["id"],
        "userId": doc["userId"],
        "montant": str(int(doc["total"])),
        "devise": "CDF",
        "statut": "attente",
        "orderNumber": f"ORD{uuid.uuid4().hex[:12]}",
        "langue": "fr",
        "createdAt": datetime.now(timezone.utc).isoformat(),
        **champs,
    }
    db.paiements.insert_one(dict(paiement))
    db.commandes.update_one(
        {"id": cmd["id"]},
        {"$set": {"paiement": {"mode": mode, "paiementId": reference, "devise": "CDF",
                               "montant": paiement["montant"], "statut": "attente"}, "paye": False}},
    )
    return paiement


# ===================================================================== modes
class TestModes:
    def test_modes_forme(self, modes):
        assert set(modes) == {"mobile", "carte", "devises"}
        assert isinstance(modes["mobile"], bool) and isinstance(modes["carte"], bool)
        assert modes["devises"] == ["CDF", "USD"]  # le franc congolais est la monnaie de reference

    def test_modes_sans_secret(self):
        r = requests.get(f"{BASE_URL}/api/paiements/modes", timeout=15)
        jeton = (os.environ.get("FLEXPAIE_TOKEN") or "").strip()
        if jeton:
            assert jeton[:12] not in r.text


# ===================================================================== initiation
class TestInitiation:
    def test_telephone_invalide_400(self, sess, tokens):
        cmd = _creer_commande(sess, tokens["client"], "mobile")
        r = sess.post(f"{BASE_URL}/api/paiements/mobile-money",
                      json={"commandeId": cmd["id"], "telephone": "0812"}, headers=_h(tokens["client"]), timeout=15)
        assert r.status_code == 400

    def test_devise_invalide_400(self, sess, tokens):
        cmd = _creer_commande(sess, tokens["client"], "carte")
        r = sess.post(f"{BASE_URL}/api/paiements/carte",
                      json={"commandeId": cmd["id"], "devise": "EUR"}, headers=_h(tokens["client"]), timeout=15)
        assert r.status_code == 400

    def test_commande_inexistante_404(self, sess, tokens):
        r = sess.post(f"{BASE_URL}/api/paiements/carte",
                      json={"commandeId": str(uuid.uuid4())}, headers=_h(tokens["client"]), timeout=15)
        assert r.status_code == 404

    def test_commande_autre_compte_404(self, sess, tokens):
        cmd = _creer_commande(sess, tokens["client"], "mobile")
        r = sess.post(f"{BASE_URL}/api/paiements/mobile-money",
                      json={"commandeId": cmd["id"], "telephone": "0812345678"}, headers=_h(tokens["admin"]), timeout=15)
        assert r.status_code == 404

    def test_sans_configuration_503(self, sess, tokens, modes):
        if modes["mobile"]:
            pytest.skip("Flexpaie configure sur ce backend")
        cmd = _creer_commande(sess, tokens["client"], "mobile")
        r = sess.post(f"{BASE_URL}/api/paiements/mobile-money",
                      json={"commandeId": cmd["id"], "telephone": "0812345678"}, headers=_h(tokens["client"]), timeout=15)
        assert r.status_code == 503
        assert _mongo().paiements.count_documents({"commandeId": cmd["id"]}) == 0

    def test_initiation_carte(self, sess, tokens, modes):
        if not modes["carte"]:
            pytest.skip("Flexpaie non configure sur ce backend")
        cmd = _creer_commande(sess, tokens["client"], "carte")
        r = sess.post(f"{BASE_URL}/api/paiements/carte",
                      json={"commandeId": cmd["id"], "devise": "USD"}, headers=_h(tokens["client"]), timeout=40)
        assert r.status_code == 200, r.text[:200]
        d = r.json()
        assert d["statut"] == "attente" and d["url"].startswith("http")
        assert d["retour"].endswith(f"/api/paiements/carte/{d['paiementId']}/retour")
        assert len(d["montant"].split(".")[1]) == 2  # dollars au centime


# ===================================================================== statut
class TestStatut:
    def test_proprietaire_attente(self, sess, tokens):
        cmd = _creer_commande(sess, tokens["client"], "mobile")
        p = _tentative(cmd)
        r = sess.get(f"{BASE_URL}/api/paiements/{p['id']}", headers=_h(tokens["client"]), timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert d["statut"] == "attente" and d["mode"] == "mobile" and d["commandeId"] == cmd["id"]

    def test_admin_peut_lire(self, sess, tokens):
        cmd = _creer_commande(sess, tokens["client"], "mobile")
        p = _tentative(cmd)
        assert sess.get(f"{BASE_URL}/api/paiements/{p['id']}", headers=_h(tokens["admin"]), timeout=30).status_code == 200

    def test_autre_client_404(self, sess, tokens):
        if not tokens.get("client_alt"):
            pytest.skip("2eme client demo indisponible")
        cmd = _creer_commande(sess, tokens["client"], "mobile")
        p = _tentative(cmd)
        r = sess.get(f"{BASE_URL}/api/paiements/{p['id']}", headers=_h(tokens["client_alt"]), timeout=30)
        assert r.status_code == 404

    def test_expire_apres_delai(self, sess, tokens):
        cmd = _creer_commande(sess, tokens["client"], "mobile")
        vieux = (datetime.now(timezone.utc) - timedelta(minutes=11)).isoformat()
        p = _tentative(cmd, createdAt=vieux)
        r = sess.get(f"{BASE_URL}/api/paiements/{p['id']}", headers=_h(tokens["client"]), timeout=30)
        assert r.json()["statut"] == "expire"


# ===================================================================== callback
class TestCallback:
    def test_callback_falsifie_ne_paie_pas(self, sess, tokens):
        """Le callback n'est pas signe : un code 0 invente ne vaut rien sans confirmation check."""
        cmd = _creer_commande(sess, tokens["client"], "mobile")
        p = _tentative(cmd)
        r = requests.post(f"{BASE_URL}/api/paiements/flexpaie/callback", timeout=30, json={
            "code": "0", "reference": p["reference"], "orderNumber": p["orderNumber"], "amount": p["montant"],
            "currency": "CDF", "provider_reference": "FAUX", "channel": "mpesa",
        })
        assert r.status_code == 200
        db = _mongo()
        assert db.paiements.find_one({"id": p["id"]})["statut"] == "attente"
        assert db.commandes.find_one({"id": cmd["id"]})["paye"] is False

    def test_callback_reference_inconnue_200(self):
        r = requests.post(f"{BASE_URL}/api/paiements/flexpaie/callback",
                          json={"code": "0", "reference": "INCONNUE"}, timeout=15)
        assert r.status_code == 200

    def test_callback_sans_reference_400(self):
        r = requests.post(f"{BASE_URL}/api/paiements/flexpaie/callback", json={"code": "0"}, timeout=15)
        assert r.status_code == 400

    def test_callback_illisible_400(self):
        r = requests.post(f"{BASE_URL}/api/paiements/flexpaie/callback", data="pas du json",
                          headers={"Content-Type": "application/json"}, timeout=15)
        assert r.status_code == 400


# ===================================================================== retour carte
class TestRetourCarte:
    def test_annulation_affichee_sans_figer(self, sess, tokens):
        cmd = _creer_commande(sess, tokens["client"], "carte")
        p = _tentative(cmd, mode="carte")
        r = requests.get(f"{BASE_URL}/api/paiements/carte/{p['id']}/retour", params={"issue": "cancel"}, timeout=30)
        assert r.status_code == 200 and "text/html" in r.headers.get("content-type", "")
        assert "Paiement non abouti" in r.text
        enregistre = _mongo().paiements.find_one({"id": p["id"]})
        assert enregistre["statut"] == "attente" and enregistre["issueRetour"] == "cancel"
        statut = sess.get(f"{BASE_URL}/api/paiements/{p['id']}", headers=_h(tokens["client"]), timeout=30).json()
        assert statut["statut"] == "echoue"

    def test_retour_inconnu_404(self):
        assert requests.get(f"{BASE_URL}/api/paiements/carte/INCONNU/retour", timeout=15).status_code == 404

    def test_retour_reserve_a_la_carte(self, sess, tokens):
        cmd = _creer_commande(sess, tokens["client"], "mobile")
        p = _tentative(cmd)
        assert requests.get(f"{BASE_URL}/api/paiements/carte/{p['id']}/retour", timeout=15).status_code == 404


# ===================================================================== bascule cash
class TestBasculerCash:
    def test_bascule_cash_ok(self, sess, tokens):
        cmd = _creer_commande(sess, tokens["client"], "carte")
        r = sess.post(f"{BASE_URL}/api/paiements/{cmd['id']}/cash", headers=_h(tokens["client"]), timeout=15)
        assert r.status_code == 200 and r.json()["mode"] == "cash"
        doc = _mongo().commandes.find_one({"id": cmd["id"]})
        assert doc["paiement"]["mode"] == "cash" and doc["paiement"]["statut"] == "a_la_livraison"

    def test_bascule_autre_user_404(self, sess, tokens):
        cmd = _creer_commande(sess, tokens["client"], "mobile")
        r = sess.post(f"{BASE_URL}/api/paiements/{cmd['id']}/cash", headers=_h(tokens["admin"]), timeout=15)
        assert r.status_code == 404

    def test_bascule_commande_payee_400(self, sess, tokens):
        cmd = _creer_commande(sess, tokens["client"], "cash")
        _mongo().commandes.update_one(
            {"id": cmd["id"]}, {"$set": {"paye": True, "paiement.statut": "paye", "paiement.mode": "mobile"}}
        )
        r = sess.post(f"{BASE_URL}/api/paiements/{cmd['id']}/cash", headers=_h(tokens["client"]), timeout=15)
        assert r.status_code == 400


# ===================================================================== commandes
class TestCommandeModePaiement:
    def test_commande_cash_par_defaut(self, sess, tokens):
        cmd = _creer_commande(sess, tokens["client"], "cash")
        assert cmd["paiement"]["mode"] == "cash" and cmd["paiement"]["statut"] == "a_la_livraison"
        assert cmd["paye"] is False

    @pytest.mark.parametrize("mode", ["mobile", "carte"])
    def test_commande_en_ligne_en_attente(self, sess, tokens, mode):
        cmd = _creer_commande(sess, tokens["client"], mode)
        assert cmd["paiement"]["mode"] == mode and cmd["paiement"]["statut"] == "attente"
        assert cmd["paye"] is False


# ===================================================================== rapports admin
def _rapport(sess, tokens, format_):
    fin = datetime.now(timezone.utc)
    return sess.get(
        f"{BASE_URL}/api/admin/rapport",
        params={"debut": (fin - timedelta(days=30)).strftime("%Y-%m-%d"), "fin": fin.strftime("%Y-%m-%d"),
                "format": format_},
        headers=_h(tokens["admin"]),
        timeout=30,
    )


class TestRapportsAdmin:
    def test_rapport_xlsx_paiements(self, sess, tokens):
        from openpyxl import load_workbook

        cmd = _creer_commande(sess, tokens["client"], "carte")
        _mongo().commandes.update_one({"id": cmd["id"]}, {"$set": {"paye": True, "paiement.statut": "paye"}})
        r = _rapport(sess, tokens, "xlsx")
        assert r.status_code == 200, r.text[:200]
        assert r.headers.get("content-type", "").startswith("application/vnd.openxmlformats-officedocument")
        lignes = [[str(c) if c is not None else "" for c in row]
                  for row in load_workbook(io.BytesIO(r.content), read_only=True).active.iter_rows(values_only=True)]
        entetes = next((l for l in lignes if "N° commande" in l), None)
        assert entetes, f"entetes non trouvees : {lignes[:5]}"
        assert "Paiement" in entetes and "Statut paiement" in entetes
        ligne = next(l for l in lignes if cmd["numero"] in l)
        assert "Carte bancaire" in ligne and "Payé" in ligne

    def test_rapport_pdf_ok(self, sess, tokens):
        r = _rapport(sess, tokens, "pdf")
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("application/pdf")
        assert len(r.content) > 500


def teardown_module(module):
    try:
        db = _mongo()
        # Ne supprimer QUE les commandes creees par CE worker.
        ids = [c["id"] for c in db.commandes.find({"adresse.label": {"$regex": f"^{LABEL_PREFIX}"}}, {"id": 1})]
        if ids:
            db.paiements.delete_many({"commandeId": {"$in": ids}})
            db.commandes.delete_many({"id": {"$in": ids}})
        db.adresses.delete_many({"label": {"$regex": f"^{LABEL_PREFIX}"}})
    except Exception as e:  # pragma: no cover
        print(f"cleanup warning: {e}")
