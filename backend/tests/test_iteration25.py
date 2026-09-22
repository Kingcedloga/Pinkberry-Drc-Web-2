"""Tests iteration 25 — Pinkberry Drc / paiements mobile money (PawaPay sandbox).

Verifie :
- GET /api/paiements/operateurs (public, sans token secret).
- POST /api/paiements/mobile-money : normalisation MSISDN, decimales par operateur/devise,
  operateur/devise invalides, commande d'un autre user, statut 'attente' post-initiation
  (paye=false), numero masque en base.
- GET /api/paiements/{depositId} : proprietaire/admin, transition sandbox -> 'paye',
  commande.paye=true apres COMPLETED.
- POST /api/paiements/pawapay/callback : securite RFC 9421 (headers manquants -> 401,
  digest falsifie -> 401, keyid inconnu -> 401, JSON invalide -> 400, aucune commande
  modifiee dans ces cas).
- POST /api/paiements/{cmd}/cash : bascule cash, deja paye -> 400, autre user -> 404.
- POST /api/commandes : champ modePaiement ('cash' / 'mobile').
- Rapports admin xlsx/pdf : colonnes 'Paiement' et 'Statut paiement' presentes.

On limite fortement le nombre d'appels PawaPay (quota sandbox).
Nettoyage : suppression des commandes / paiements TEST_ITER25 en teardown_module.
"""
from __future__ import annotations

import base64
import os
import time
import uuid

import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")

# Prefix specifique par worker xdist pour eviter les collisions de teardown
# (chaque worker execute teardown_module a la fin de SA session de tests, mais
# les classes tournent en parallel via loadscope -> un teardown premature d'un
# worker supprimerait les commandes en cours d'un autre worker).
_WORKER = os.environ.get("PYTEST_XDIST_WORKER", "master")
LABEL_PREFIX = f"TEST_ITER25_{_WORKER}"

CLIENT = ("0990000001", "client123")
CLIENT_ALT = ("0990000002", "client123")  # 2e client demo si existant
ADMIN = ("0810000000", "admin123")


def _login(sess: requests.Session, tel: str, mdp: str) -> str:
    r = sess.post(
        f"{BASE_URL}/api/auth/connexion",
        json={"telephone": tel, "motDePasse": mdp},
        timeout=25,
    )
    assert r.status_code == 200, f"login {tel}: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def sess() -> requests.Session:
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def tokens(sess):
    d = {
        "client": _login(sess, *CLIENT),
        "admin": _login(sess, *ADMIN),
    }
    try:
        d["client_alt"] = _login(sess, *CLIENT_ALT)
    except AssertionError:
        d["client_alt"] = None
    return d


def _mongo():
    return MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]


def _creer_commande(sess, token, mode_paiement="cash", label=None):
    if label is None:
        label = LABEL_PREFIX
    else:
        # Normalise pour toujours prefixer par LABEL_PREFIX
        label = label.replace("TEST_ITER25", LABEL_PREFIX)
    body = {
        "items": [{"produitId": "p", "nom": "Pot Test", "prixUnitaire": 3.5, "quantite": 1, "options": {}}],
        "adresse": {
            "label": label,
            "commune": "Gombe",
            "avenue": "Test",
            "numero": "1",
            "repere": "repere iter25",
            "telephone": "0990000001",
            "lat": -4.325,
            "lng": 15.322,
        },
        "modePaiement": mode_paiement,
    }
    r = sess.post(
        f"{BASE_URL}/api/commandes",
        json=body,
        headers={"Authorization": f"Bearer {token}"},
        timeout=30,
    )
    assert r.status_code == 200, f"creer_commande({mode_paiement}): {r.status_code} {r.text[:200]}"
    return r.json()


# ===================================================================== operateurs
class TestOperateurs:
    def test_operateurs_liste(self):
        r = requests.get(f"{BASE_URL}/api/paiements/operateurs", timeout=15)
        assert r.status_code == 200
        d = r.json()
        cles = [o["cle"] for o in d["operateurs"]]
        assert set(cles) == {"mpesa", "airtel", "orange"}
        assert d["devises"] == ["USD", "CDF"]
        assert d["actif"] is True

    def test_operateurs_pas_de_token(self):
        r = requests.get(f"{BASE_URL}/api/paiements/operateurs", timeout=15)
        # Aucune trace du token PawaPay dans la reponse
        pawapay = (os.environ.get("PAWAPAY_TOKEN") or "").strip()
        if pawapay:
            assert pawapay[:20] not in r.text


# ===================================================================== POST /paiements/mobile-money
class TestPaiementMobileMoney:
    def test_operateur_inconnu_400(self, sess, tokens):
        cmd = _creer_commande(sess, tokens["client"], "mobile")
        r = sess.post(
            f"{BASE_URL}/api/paiements/mobile-money",
            json={"commandeId": cmd["id"], "operateur": "xxx", "telephone": "0812345678", "devise": "USD"},
            headers={"Authorization": f"Bearer {tokens['client']}"},
            timeout=15,
        )
        assert r.status_code == 400

    def test_devise_invalide_400(self, sess, tokens):
        cmd = _creer_commande(sess, tokens["client"], "mobile")
        r = sess.post(
            f"{BASE_URL}/api/paiements/mobile-money",
            json={"commandeId": cmd["id"], "operateur": "mpesa", "telephone": "0812345678", "devise": "EUR"},
            headers={"Authorization": f"Bearer {tokens['client']}"},
            timeout=15,
        )
        assert r.status_code == 400

    def test_telephone_trop_court_400(self, sess, tokens):
        cmd = _creer_commande(sess, tokens["client"], "mobile")
        r = sess.post(
            f"{BASE_URL}/api/paiements/mobile-money",
            json={"commandeId": cmd["id"], "operateur": "mpesa", "telephone": "123", "devise": "USD"},
            headers={"Authorization": f"Bearer {tokens['client']}"},
            timeout=15,
        )
        assert r.status_code == 400

    def test_commande_inexistante_404(self, sess, tokens):
        r = sess.post(
            f"{BASE_URL}/api/paiements/mobile-money",
            json={"commandeId": "inexistant", "operateur": "mpesa", "telephone": "0812345678", "devise": "USD"},
            headers={"Authorization": f"Bearer {tokens['client']}"},
            timeout=15,
        )
        assert r.status_code == 404

    def test_initiation_usd_puis_paiement_confirme(self, sess, tokens):
        """Sandbox : dépôt USD 3.50 -> callback COMPLETED -> statut 'paye'."""
        cmd = _creer_commande(sess, tokens["client"], "mobile")
        r = sess.post(
            f"{BASE_URL}/api/paiements/mobile-money",
            json={"commandeId": cmd["id"], "operateur": "mpesa", "telephone": "0812345678", "devise": "USD"},
            headers={"Authorization": f"Bearer {tokens['client']}"},
            timeout=30,
        )
        assert r.status_code == 200, r.text[:250]
        d = r.json()
        assert d["statut"] == "attente"
        assert d["devise"] == "USD"
        assert float(d["montant"]) > 0
        deposit_id = d["depositId"]

        # Immediatement apres initiation : commande NON payee, statut 'attente'
        cmd2 = sess.get(
            f"{BASE_URL}/api/commandes/{cmd['id']}",
            headers={"Authorization": f"Bearer {tokens['client']}"},
            timeout=15,
        ).json()
        assert cmd2["paye"] is False
        assert cmd2["paiement"]["statut"] == "attente"
        assert cmd2["paiement"]["mode"] == "mobile"
        # Numero masque : les 4 derniers chiffres visibles seulement
        tel_stocke = cmd2["paiement"].get("telephone", "")
        assert tel_stocke.endswith("5678")
        assert "*" in tel_stocke

        # Sandbox : le depot se termine automatiquement en COMPLETED en quelques secondes.
        deadline = time.time() + 30
        final = None
        while time.time() < deadline:
            time.sleep(3)
            rr = sess.get(
                f"{BASE_URL}/api/paiements/{deposit_id}",
                headers={"Authorization": f"Bearer {tokens['client']}"},
                timeout=15,
            )
            assert rr.status_code == 200, rr.text[:200]
            final = rr.json()
            if final["statut"] in ("paye", "echoue", "expire"):
                break
        assert final and final["statut"] == "paye", f"statut final inattendu: {final}"

        # Commande maintenant payee
        cmd3 = sess.get(
            f"{BASE_URL}/api/commandes/{cmd['id']}",
            headers={"Authorization": f"Bearer {tokens['client']}"},
            timeout=15,
        ).json()
        assert cmd3["paye"] is True
        assert cmd3["paiement"]["statut"] == "paye"

    def test_normalisation_msisdn_stockee(self, sess, tokens):
        """Les formats +243812345678 / 0812345678 / 243812345678 → même MSISDN stocké."""
        db = _mongo()
        formats = ["+243812345677", "0812345677", "243812345677"]
        commandes_ids = []
        for fmt in formats:
            cmd = _creer_commande(sess, tokens["client"], "mobile", label="TEST_ITER25_norm")
            commandes_ids.append(cmd["id"])
            r = sess.post(
                f"{BASE_URL}/api/paiements/mobile-money",
                json={"commandeId": cmd["id"], "operateur": "airtel", "telephone": fmt, "devise": "USD"},
                headers={"Authorization": f"Bearer {tokens['client']}"},
                timeout=30,
            )
            assert r.status_code == 200, f"{fmt}: {r.text[:200]}"
        # Verifier que tous les paiements portent le meme MSISDN normalise
        paiements = list(db.paiements.find({"commandeId": {"$in": commandes_ids}}))
        assert len(paiements) == 3
        msisdns = {p["telephone"] for p in paiements}
        assert msisdns == {"243812345677"}, f"MSISDN devrait etre 243812345677, got {msisdns}"

    def test_cdf_mpesa_sans_decimales_airtel_avec_decimales(self, sess, tokens):
        """M-Pesa CDF -> montant entier ; Airtel CDF -> 2 decimales."""
        # M-Pesa CDF
        cmd_m = _creer_commande(sess, tokens["client"], "mobile", label="TEST_ITER25_cdf_mp")
        r = sess.post(
            f"{BASE_URL}/api/paiements/mobile-money",
            json={"commandeId": cmd_m["id"], "operateur": "mpesa", "telephone": "0812345678", "devise": "CDF"},
            headers={"Authorization": f"Bearer {tokens['client']}"},
            timeout=30,
        )
        assert r.status_code == 200, r.text[:200]
        montant_mpesa = r.json()["montant"]
        assert "." not in montant_mpesa, f"M-Pesa CDF doit etre entier : {montant_mpesa}"
        assert montant_mpesa.isdigit()

        # Airtel CDF
        cmd_a = _creer_commande(sess, tokens["client"], "mobile", label="TEST_ITER25_cdf_ai")
        r = sess.post(
            f"{BASE_URL}/api/paiements/mobile-money",
            json={"commandeId": cmd_a["id"], "operateur": "airtel", "telephone": "0812345678", "devise": "CDF"},
            headers={"Authorization": f"Bearer {tokens['client']}"},
            timeout=30,
        )
        assert r.status_code == 200, r.text[:200]
        montant_airtel = r.json()["montant"]
        assert "." in montant_airtel, f"Airtel CDF doit avoir 2 decimales : {montant_airtel}"
        assert len(montant_airtel.split(".")[1]) == 2


# ===================================================================== GET /paiements/{id} securite
class TestPaiementStatutAcces:
    def test_autre_client_404(self, sess, tokens):
        if not tokens.get("client_alt"):
            pytest.skip("2eme client demo indisponible")
        cmd = _creer_commande(sess, tokens["client"], "mobile", label="TEST_ITER25_acc")
        r = sess.post(
            f"{BASE_URL}/api/paiements/mobile-money",
            json={"commandeId": cmd["id"], "operateur": "orange", "telephone": "0812345678", "devise": "USD"},
            headers={"Authorization": f"Bearer {tokens['client']}"},
            timeout=30,
        )
        assert r.status_code == 200
        dep = r.json()["depositId"]
        rr = sess.get(
            f"{BASE_URL}/api/paiements/{dep}",
            headers={"Authorization": f"Bearer {tokens['client_alt']}"},
            timeout=15,
        )
        assert rr.status_code == 404

    def test_admin_peut_lire(self, sess, tokens):
        cmd = _creer_commande(sess, tokens["client"], "mobile", label="TEST_ITER25_adm")
        r = sess.post(
            f"{BASE_URL}/api/paiements/mobile-money",
            json={"commandeId": cmd["id"], "operateur": "orange", "telephone": "0812345678", "devise": "USD"},
            headers={"Authorization": f"Bearer {tokens['client']}"},
            timeout=30,
        )
        assert r.status_code == 200
        dep = r.json()["depositId"]
        rr = sess.get(
            f"{BASE_URL}/api/paiements/{dep}",
            headers={"Authorization": f"Bearer {tokens['admin']}"},
            timeout=15,
        )
        assert rr.status_code == 200


# ===================================================================== callback signe
class TestCallbackSecurite:
    URL = None

    @classmethod
    def setup_class(cls):
        cls.URL = f"{BASE_URL}/api/paiements/pawapay/callback"

    def _cmd_avec_depot(self, sess, tokens):
        cmd = _creer_commande(sess, tokens["client"], "mobile", label="TEST_ITER25_cb")
        r = sess.post(
            f"{BASE_URL}/api/paiements/mobile-money",
            json={"commandeId": cmd["id"], "operateur": "airtel", "telephone": "0812349999", "devise": "USD"},
            headers={"Authorization": f"Bearer {tokens['client']}"},
            timeout=30,
        )
        assert r.status_code == 200
        return cmd["id"], r.json()["depositId"]

    def test_sans_entetes_401(self, sess, tokens):
        cmd_id, dep = self._cmd_avec_depot(sess, tokens)
        body = f'{{"depositId":"{dep}","status":"COMPLETED"}}'
        r = requests.post(self.URL, data=body, headers={"Content-Type": "application/json"}, timeout=15)
        assert r.status_code == 401
        # Verifier que la commande n'a PAS ete marquee payee
        cmd = _mongo().commandes.find_one({"id": cmd_id})
        assert cmd["paye"] is False
        assert cmd["paiement"]["statut"] == "attente"

    def test_digest_falsifie_401(self, sess, tokens):
        cmd_id, dep = self._cmd_avec_depot(sess, tokens)
        body = f'{{"depositId":"{dep}","status":"COMPLETED"}}'
        # Faux digest
        faux = base64.b64encode(b"x" * 64).decode()
        headers = {
            "Content-Type": "application/json",
            "content-digest": f"sha-512=:{faux}:",
            "signature": "sig-pp=:AAAA:",
            "signature-input": 'sig-pp=("@method" "@path");alg="ecdsa-p256-sha256";keyid="1";created=1',
            "signature-date": "2026-01-01T00:00:00Z",
        }
        r = requests.post(self.URL, data=body, headers=headers, timeout=15)
        assert r.status_code == 401
        cmd = _mongo().commandes.find_one({"id": cmd_id})
        assert cmd["paye"] is False

    def test_keyid_inconnu_401(self, sess, tokens):
        cmd_id, dep = self._cmd_avec_depot(sess, tokens)
        import hashlib
        body = f'{{"depositId":"{dep}","status":"COMPLETED"}}'.encode()
        digest = base64.b64encode(hashlib.sha512(body).digest()).decode()
        headers = {
            "Content-Type": "application/json",
            "content-digest": f"sha-512=:{digest}:",
            "signature": "sig-pp=:AAAA:",
            "signature-input": 'sig-pp=("@method" "@path");alg="ecdsa-p256-sha256";keyid="unknown-key-xyz";created=1',
            "signature-date": "2026-01-01T00:00:00Z",
        }
        r = requests.post(self.URL, data=body, headers=headers, timeout=15)
        assert r.status_code == 401
        cmd = _mongo().commandes.find_one({"id": cmd_id})
        assert cmd["paye"] is False


# ===================================================================== bascule cash
class TestBasculerCash:
    def test_bascule_cash_ok(self, sess, tokens):
        cmd = _creer_commande(sess, tokens["client"], "mobile", label="TEST_ITER25_bc")
        r = sess.post(
            f"{BASE_URL}/api/paiements/{cmd['id']}/cash",
            headers={"Authorization": f"Bearer {tokens['client']}"},
            timeout=15,
        )
        assert r.status_code == 200
        assert r.json()["mode"] == "cash"
        cmd2 = sess.get(
            f"{BASE_URL}/api/commandes/{cmd['id']}",
            headers={"Authorization": f"Bearer {tokens['client']}"},
            timeout=15,
        ).json()
        assert cmd2["paiement"]["mode"] == "cash"
        assert cmd2["paiement"]["statut"] == "a_la_livraison"
        assert cmd2["paye"] is False

    def test_bascule_autre_user_404(self, sess, tokens):
        if not tokens.get("client_alt"):
            pytest.skip("2eme client demo indisponible")
        cmd = _creer_commande(sess, tokens["client"], "mobile", label="TEST_ITER25_bc2")
        r = sess.post(
            f"{BASE_URL}/api/paiements/{cmd['id']}/cash",
            headers={"Authorization": f"Bearer {tokens['client_alt']}"},
            timeout=15,
        )
        assert r.status_code == 404

    def test_bascule_commande_payee_400(self, sess, tokens):
        """Si commande deja payee, bascule interdite."""
        # On force paye=true dans la base
        db = _mongo()
        cmd = _creer_commande(sess, tokens["client"], "cash", label="TEST_ITER25_bcp")
        db.commandes.update_one(
            {"id": cmd["id"]},
            {"$set": {"paye": True, "paiement.statut": "paye", "paiement.mode": "mobile"}},
        )
        r = sess.post(
            f"{BASE_URL}/api/paiements/{cmd['id']}/cash",
            headers={"Authorization": f"Bearer {tokens['client']}"},
            timeout=15,
        )
        assert r.status_code == 400


# ===================================================================== commandes cash vs mobile
class TestCommandeModePaiement:
    def test_commande_cash_par_defaut(self, sess, tokens):
        cmd = _creer_commande(sess, tokens["client"], "cash", label="TEST_ITER25_mc")
        assert cmd["paiement"]["mode"] == "cash"
        assert cmd["paiement"]["statut"] == "a_la_livraison"
        assert cmd["paye"] is False

    def test_commande_mobile_en_attente(self, sess, tokens):
        cmd = _creer_commande(sess, tokens["client"], "mobile", label="TEST_ITER25_mm")
        assert cmd["paiement"]["mode"] == "mobile"
        assert cmd["paiement"]["statut"] == "attente"
        assert cmd["paye"] is False


# ===================================================================== rapports admin
class TestRapportsAdmin:
    def test_rapport_xlsx_contient_colonnes_paiement(self, sess, tokens):
        from datetime import datetime, timedelta, timezone
        d_fin = datetime.now(timezone.utc)
        d_debut = d_fin - timedelta(days=30)
        r = sess.get(
            f"{BASE_URL}/api/admin/rapport",
            params={
                "debut": d_debut.strftime("%Y-%m-%d"),
                "fin": d_fin.strftime("%Y-%m-%d"),
                "format": "xlsx",
            },
            headers={"Authorization": f"Bearer {tokens['admin']}"},
            timeout=30,
        )
        assert r.status_code == 200, r.text[:200]
        assert r.headers.get("content-type", "").startswith(
            "application/vnd.openxmlformats-officedocument"
        )
        # Ouvre le xlsx et vérifie que les entetes contiennent "Paiement" / "Statut paiement"
        import io
        from openpyxl import load_workbook
        wb = load_workbook(io.BytesIO(r.content), read_only=True)
        ws = wb.active
        entetes: list[str] = []
        for row in ws.iter_rows(values_only=True):
            row_vals = [str(c) if c is not None else "" for c in row]
            if any("N° commande" in v or "N?" in v or "Commande" in v for v in row_vals):
                entetes = row_vals
                break
        assert entetes, f"entetes non trouvees ; premieres lignes: {list(ws.iter_rows(max_row=5, values_only=True))}"
        assert any("Paiement" == v for v in entetes), f"colonne Paiement manquante : {entetes}"
        assert any("Statut paiement" in v for v in entetes), f"colonne Statut paiement manquante : {entetes}"

    def test_rapport_pdf_ok(self, sess, tokens):
        from datetime import datetime, timedelta, timezone
        d_fin = datetime.now(timezone.utc)
        d_debut = d_fin - timedelta(days=30)
        r = sess.get(
            f"{BASE_URL}/api/admin/rapport",
            params={
                "debut": d_debut.strftime("%Y-%m-%d"),
                "fin": d_fin.strftime("%Y-%m-%d"),
                "format": "pdf",
            },
            headers={"Authorization": f"Bearer {tokens['admin']}"},
            timeout=30,
        )
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("application/pdf")
        assert len(r.content) > 500


# ===================================================================== Nettoyage
def teardown_module(module):
    try:
        db = _mongo()
        # Ne supprimer QUE les commandes creees par CE worker.
        cmds = list(db.commandes.find({"adresse.label": {"$regex": f"^{LABEL_PREFIX}"}}, {"id": 1}))
        ids = [c["id"] for c in cmds]
        if ids:
            db.paiements.delete_many({"commandeId": {"$in": ids}})
            db.commandes.delete_many({"id": {"$in": ids}})
        db.adresses.delete_many({"label": {"$regex": f"^{LABEL_PREFIX}"}})
    except Exception as e:  # pragma: no cover
        print(f"cleanup warning: {e}")
