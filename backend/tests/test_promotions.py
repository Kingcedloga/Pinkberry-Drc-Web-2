"""Promotions configurables : calcul cote serveur, conditions, cumul, compteurs.

Chaque test cree ses promotions sur un produit jetable et les supprime ensuite.
Les promotions automatiques ciblent ce produit pour ne pas dependre du reste
du catalogue.
"""
import os
import uuid
from datetime import datetime, timedelta, timezone

import pytest
import requests
from outils_auth import entetes_superadmin

BASE = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
API = f"{BASE}/api"
CLIENT_TEL = "0990000001"
PRIX = 10000


def _h(tel: str, pwd: str):
    r = requests.post(f"{API}/auth/connexion", json={"telephone": tel, "motDePasse": pwd}, timeout=15)
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


@pytest.fixture(scope="module")
def admin():
    # Ecritures de configuration : reservees au super admin.
    return entetes_superadmin()


@pytest.fixture(scope="module")
def client():
    return _h(CLIENT_TEL, "client123")


@pytest.fixture(scope="module")
def produit(admin):
    cat = requests.post(f"{API}/admin/categories", json={"nom": f"TEST_Promo {uuid.uuid4().hex[:6]}", "nomEn": "TEST"},
                        headers=admin, timeout=60).json()
    p = requests.post(f"{API}/admin/produits", headers=admin, timeout=60, json={
        "nom": "TEST_Produit_Promo", "nomEn": "TEST_Produit_Promo", "categorie": cat["nom"], "prix": PRIX, "disponible": True,
    }).json()
    yield p
    requests.delete(f"{API}/admin/categories/{cat['id']}", headers=admin, timeout=15)


@pytest.fixture
def promos(admin):
    creees = []

    def creer(**champs):
        # notifierClients=False : un test ne doit jamais prevenir de vrais clients.
        body = {"nom": f"TEST_Promo {uuid.uuid4().hex[:4]}", "nomEn": "TEST", "type": "pourcentage", "valeur": 10,
                "notifierClients": False, **champs}
        r = requests.post(f"{API}/admin/promotions", json=body, headers=admin, timeout=60)
        assert r.status_code == 200, r.text
        creees.append(r.json()["id"])
        return r.json()

    yield creer
    for pid in creees:
        requests.delete(f"{API}/admin/promotions/{pid}", headers=admin, timeout=15)


def _items(produit, quantite=2):
    return [{"produitId": produit["id"], "nom": produit["nom"], "quantite": quantite}]


def _apercu(client, produit, code=None, quantite=2):
    r = requests.post(f"{API}/promotions/apercu", headers=client, timeout=30,
                      json={"items": _items(produit, quantite), "codePromo": code})
    assert r.status_code == 200, r.text
    return r.json()


def _commander(client, produit, code=None):
    return requests.post(f"{API}/commandes", headers=client, timeout=30, json={
        "items": _items(produit), "codePromo": code,
        "adresse": {"label": "TEST", "commune": "Gombe", "avenue": "TEST", "numero": "1", "repere": "TEST",
                    "telephone": CLIENT_TEL},
    })


def _supprimer_commande(client, admin, cid):
    requests.post(f"{API}/commandes/{cid}/annuler", headers=client, json={}, timeout=15)
    requests.post(f"{API}/admin/commandes/bulk/archive", headers=admin, json={"ids": [cid]}, timeout=15)
    requests.delete(f"{API}/admin/commandes/{cid}", headers=admin, timeout=15)


def _iso(delta_h):
    return (datetime.now(timezone.utc) + timedelta(hours=delta_h)).isoformat()


def test_seul_l_admin_gere_les_promotions(client):
    assert requests.get(f"{API}/admin/promotions", headers=client, timeout=15).status_code in (401, 403)
    r = requests.post(f"{API}/admin/promotions", headers=client, timeout=15,
                      json={"nom": "x", "type": "montant", "valeur": 1000})
    assert r.status_code in (401, 403)


def test_validations(admin, promos):
    code = f"TEST{uuid.uuid4().hex[:6].upper()}"
    invalides = [
        {"nom": "x", "type": "pourcentage", "valeur": 150},
        {"nom": "x", "type": "montant", "valeur": 0},
        {"nom": "x", "type": "montant", "valeur": 1000, "automatique": False},  # code manquant
        {"nom": "x", "type": "montant", "valeur": 1000, "dateDebut": _iso(2), "dateFin": _iso(1)},
        {"nom": "x", "type": "montant", "valeur": 1000, "cible": "produit", "cibleValeur": "inconnu"},
    ]
    for body in invalides:
        assert requests.post(f"{API}/admin/promotions", json=body, headers=admin, timeout=60).status_code == 400, body
    promos(type="montant", valeur=1000, automatique=False, code=code.lower())  # normalise en majuscules
    r = requests.post(f"{API}/admin/promotions", headers=admin, timeout=60,
                      json={"nom": "x", "type": "montant", "valeur": 1000, "automatique": False, "code": code})
    assert r.status_code == 400  # code deja pris


def test_promotion_automatique_et_detail_du_calcul(client, produit, promos):
    promos(type="pourcentage", valeur=20, cible="produit", cibleValeur=produit["id"])
    a = _apercu(client, produit)
    assert a["sousTotal"] == 2 * PRIX
    assert a["reduction"] == 4000 and len(a["promotions"]) == 1
    assert a["total"] == a["sousTotal"] - a["reduction"] + a["fraisLivraison"]


def test_statuts_des_codes(client, produit, promos):
    expire = f"TESTEXP{uuid.uuid4().hex[:4].upper()}"
    cher = f"TESTMIN{uuid.uuid4().hex[:4].upper()}"
    futur = f"TESTFUT{uuid.uuid4().hex[:4].upper()}"
    promos(type="montant", valeur=1000, automatique=False, code=expire, dateDebut=_iso(-48), dateFin=_iso(-24))
    promos(type="montant", valeur=1000, automatique=False, code=cher, montantMin=10 * PRIX)
    promos(type="montant", valeur=1000, automatique=False, code=futur, dateDebut=_iso(24))
    assert _apercu(client, produit, "INCONNU-XYZ")["code"]["statut"] == "invalide"
    assert _apercu(client, produit, expire)["code"]["statut"] == "expiree"
    assert _apercu(client, produit, cher)["code"]["statut"] == "montant_min"
    assert _apercu(client, produit, futur)["code"]["statut"] == "programmee"
    # La commande est refusee avec un message clair, sans reduction appliquee.
    assert _commander(client, produit, expire).status_code == 400


def test_une_seule_promotion_la_plus_avantageuse(client, produit, promos):
    gros, petit = f"TESTG{uuid.uuid4().hex[:4].upper()}", f"TESTP{uuid.uuid4().hex[:4].upper()}"
    promos(type="pourcentage", valeur=10, cible="produit", cibleValeur=produit["id"])  # 2 000
    promos(type="montant", valeur=5000, automatique=False, code=gros)
    promos(type="montant", valeur=500, automatique=False, code=petit)
    a = _apercu(client, produit, gros)
    assert a["code"]["statut"] == "applique" and a["reduction"] == 5000 and len(a["promotions"]) == 1
    a = _apercu(client, produit, petit)
    assert a["code"]["statut"] == "moins_avantageux" and a["reduction"] == 2000  # l'automatique est meilleure


def test_cumul_explicite_et_livraison_offerte(client, produit, promos):
    promos(type="pourcentage", valeur=10, cible="produit", cibleValeur=produit["id"], cumulable=True)
    promos(type="montant", valeur=1000, cible="produit", cibleValeur=produit["id"], cumulable=True)
    promos(type="livraison", cible="produit", cibleValeur=produit["id"], cumulable=True)
    promos(type="livraison", cible="produit", cibleValeur=produit["id"], cumulable=True)  # pas de double livraison
    a = _apercu(client, produit)
    assert a["reduction"] == 3000
    assert a["reductionLivraison"] == a["fraisLivraison"]
    assert a["total"] == a["sousTotal"] - 3000


def test_reduction_plafonnee_au_sous_total(client, produit, promos):
    promos(type="montant", valeur=50 * PRIX, cible="produit", cibleValeur=produit["id"])
    a = _apercu(client, produit)
    assert a["reduction"] == a["sousTotal"] and a["total"] == a["fraisLivraison"]


def test_commande_compteurs_limites_et_annulation(client, admin, produit, promos):
    code = f"TESTLIM{uuid.uuid4().hex[:4].upper()}"
    promo = promos(type="montant", valeur=1500, automatique=False, code=code, limiteParClient=1, limiteTotale=5)

    r = _commander(client, produit, code)
    assert r.status_code == 200, r.text
    cmd = r.json()
    try:
        assert cmd["reduction"] == 1500 and cmd["promotions"][0]["id"] == promo["id"]
        assert cmd["total"] == cmd["sousTotal"] - 1500 + cmd["fraisLivraison"]
        compteur = lambda: next(p for p in requests.get(f"{API}/admin/promotions", headers=admin).json()  # noqa: E731
                                if p["id"] == promo["id"])["nombreUtilisations"]
        assert compteur() == 1
        assert _apercu(client, produit, code)["code"]["statut"] == "deja_utilisee"
        assert _commander(client, produit, code).status_code == 400

        requests.post(f"{API}/commandes/{cmd['id']}/annuler", headers=client, json={}, timeout=15)
        assert compteur() == 0  # liberee par l'annulation
        assert _apercu(client, produit, code)["code"]["statut"] == "applique"
    finally:
        _supprimer_commande(client, admin, cmd["id"])


def test_limite_totale_et_interrupteur(client, admin, produit, promos):
    code = f"TESTTOT{uuid.uuid4().hex[:4].upper()}"
    promo = promos(type="montant", valeur=1000, automatique=False, code=code, limiteTotale=1)
    r = _commander(client, produit, code)
    assert r.status_code == 200, r.text
    try:
        assert _apercu(client, produit, code)["code"]["statut"] == "epuisee"
    finally:
        _supprimer_commande(client, admin, r.json()["id"])

    auto = promos(type="montant", valeur=700, cible="produit", cibleValeur=produit["id"])
    requests.patch(f"{API}/admin/promotions/{auto['id']}/actif", json={"actif": False}, headers=admin, timeout=15)
    assert _apercu(client, produit)["reduction"] == 0
    assert all(p["id"] != auto["id"] for p in requests.get(f"{API}/promotions/actives", timeout=15).json())
    requests.patch(f"{API}/admin/promotions/{auto['id']}/actif", json={"actif": True}, headers=admin, timeout=15)
    assert any(p["id"] == auto["id"] for p in requests.get(f"{API}/promotions/actives", timeout=15).json())


def test_premiere_commande_uniquement(client, produit, promos):
    # Le client de demonstration a deja commande : non eligible.
    code = f"TESTNEW{uuid.uuid4().hex[:4].upper()}"
    promos(type="pourcentage", valeur=15, automatique=False, code=code, cible="premiere_commande")
    assert _apercu(client, produit, code)["code"]["statut"] == "premiere_commande"


def test_pas_d_annonce_sans_notifier_clients(client, produit, promos):
    """L'annonce aux clients est un choix explicite de l'admin (`notifierClients`)."""
    promo = promos(type="pourcentage", valeur=5, cible="produit", cibleValeur=produit["id"])  # notifierClients=False
    notifs = requests.get(f"{API}/notifications", headers=client, timeout=15).json()["notifications"]
    assert all(n["tag"] != f"promo-{promo['id']}" for n in notifs)


def test_banniere_codes_publics_et_prives(promos):
    """Un code est visible dans la banniere (avec son code) sauf s'il est prive."""
    public = f"TESTPUB{uuid.uuid4().hex[:4].upper()}"
    prive = f"TESTPRV{uuid.uuid4().hex[:4].upper()}"
    p_public = promos(type="montant", valeur=1000, automatique=False, code=public)
    p_prive = promos(type="montant", valeur=1000, automatique=False, code=prive, afficherBanniere=False)
    actives = {p["id"]: p for p in requests.get(f"{API}/promotions/actives", timeout=15).json()}
    assert actives[p_public["id"]]["code"] == public
    assert p_prive["id"] not in actives
