"""Notifications : canal interne (centre de notifications) declenche par les
evenements metier, bilingue, filtre par les preferences de chaque role.

Les push systeme partent en tache de fond et ne sont pas verifies ici (ils
dependent des navigateurs abonnes) ; le canal interne recoit les memes evenements.
"""
import os
import time
import uuid

import pytest
import requests

BASE = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
API = f"{BASE}/api"
CLIENT_TEL = "0990000001"


def _connexion(tel: str, pwd: str):
    r = requests.post(f"{API}/auth/connexion", json={"telephone": tel, "motDePasse": pwd}, timeout=15)
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}, r.json()["user"]


@pytest.fixture(scope="module")
def admin():
    return _connexion("0810000000", "admin123")


@pytest.fixture(scope="module")
def client():
    return _connexion(CLIENT_TEL, "client123")


@pytest.fixture(scope="module")
def livreur():
    return _connexion("0820000001", "livreur123")


@pytest.fixture(scope="module")
def produit(admin):
    h, _ = admin
    cat = requests.post(f"{API}/admin/categories", json={"nom": f"TEST_Notif {uuid.uuid4().hex[:6]}", "nomEn": "TEST"},
                        headers=h, timeout=60).json()
    p = requests.post(f"{API}/admin/produits", headers=h, timeout=60, json={
        "nom": "TEST_Produit_Notif", "nomEn": "TEST_Produit_Notif", "categorie": cat["nom"], "prix": 5000, "disponible": True,
    }).json()
    yield p
    requests.delete(f"{API}/admin/categories/{cat['id']}", headers=h, timeout=15)


def _notifs(h):
    r = requests.get(f"{API}/notifications", headers=h, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()


def _apparait(h, predicat, essais=10):
    for _ in range(essais):
        trouvees = [n for n in _notifs(h)["notifications"] if predicat(n)]
        if trouvees:
            return trouvees
        time.sleep(0.5)
    return []


def _commander(client_h, produit):
    r = requests.post(f"{API}/commandes", headers=client_h, timeout=30, json={
        "items": [{"produitId": produit["id"], "nom": produit["nom"], "quantite": 1}],
        "adresse": {"label": "TEST", "commune": "Gombe", "avenue": "TEST", "numero": "1", "repere": "TEST",
                    "telephone": CLIENT_TEL, "lat": -4.3, "lng": 15.3},
    })
    assert r.status_code == 200, r.text
    return r.json()


def _nettoyer(client_h, admin_h, cid):
    requests.post(f"{API}/commandes/{cid}/annuler", headers=client_h, json={}, timeout=15)
    requests.post(f"{API}/admin/commandes/bulk/archive", headers=admin_h, json={"ids": [cid]}, timeout=15)
    requests.delete(f"{API}/admin/commandes/{cid}", headers=admin_h, timeout=15)


def _prefs(h, user, **maj):
    prefs = {"langue": "fr", "theme": "systeme", **(user.get("preferences") or {}), **maj}
    assert requests.put(f"{API}/auth/preferences", headers=h, json=prefs, timeout=15).status_code == 200


def test_centre_reserve_a_l_utilisateur_connecte():
    assert requests.get(f"{API}/notifications", timeout=15).status_code in (401, 403)
    assert requests.post(f"{API}/notifications/lues", json={}, timeout=15).status_code in (401, 403)


def test_commande_previent_client_et_admin_dans_leur_langue(client, admin, produit):
    (ch, cu), (ah, _) = client, admin
    cmd = _commander(ch, produit)
    try:
        attendu = "Order received" if (cu.get("preferences") or {}).get("langue") == "en" else "Commande reçue"
        cote_client = _apparait(ch, lambda n: n["lien"] == f"/suivi/{cmd['id']}")
        assert cote_client and cote_client[0]["titre"] == attendu and cote_client[0]["lu"] is False
        cote_admin = _apparait(ah, lambda n: cmd["numero"] in n["message"] and n["type"] == "admin")
        assert cote_admin and "FC" in cote_admin[0]["message"]  # montants en francs

        # Annulation par le client : l'admin est prevenu.
        requests.post(f"{API}/commandes/{cmd['id']}/annuler", headers=ch, json={}, timeout=15)
        assert _apparait(ah, lambda n: cmd["numero"] in n["message"] and n["tag"].startswith("admin_annulee"))
    finally:
        _nettoyer(ch, ah, cmd["id"])


def test_preferences_appliquees_a_l_envoi(client, admin, produit):
    (ch, _), (ah, au) = client, admin
    _prefs(ah, au, notifCommandes=False)
    cmd = _commander(ch, produit)
    try:
        time.sleep(1.5)
        assert not [n for n in _notifs(ah)["notifications"] if cmd["numero"] in n["message"]]
    finally:
        _prefs(ah, au, notifCommandes=True)
        _nettoyer(ch, ah, cmd["id"])


def test_course_assignee_et_livreur_arrive(client, admin, livreur, produit):
    (ch, _), (ah, _), (lh, lu) = client, admin, livreur
    cmd = _commander(ch, produit)
    try:
        r = requests.post(f"{API}/admin/commandes/{cmd['id']}/assigner", headers=ah,
                          json={"livreurId": lu["livreurId"]}, timeout=15)
        assert r.status_code == 200, r.text
        assert _apparait(lh, lambda n: n["lien"] == f"/livreur/course/{cmd['id']}")

        requests.patch(f"{API}/admin/commandes/{cmd['id']}/statut", headers=ah, json={"statut": "en_route"}, timeout=15)
        for _ in range(2):  # deux positions a l'adresse : une seule notification
            requests.post(f"{API}/livreur/position", headers=lh, json={"lat": -4.3, "lng": 15.3}, timeout=15)
        arrivees = _apparait(ch, lambda n: n["tag"] == f"cmd-{cmd['id']}-arrivee")
        assert len(arrivees) == 1
    finally:
        _nettoyer(ch, ah, cmd["id"])


def test_marquer_comme_lues(client):
    ch, _ = client
    r = requests.post(f"{API}/notifications/lues", headers=ch, json={}, timeout=15)
    assert r.status_code == 200
    assert _notifs(ch)["nonLues"] == 0


def test_abonnement_push_lie_au_compte(client):
    ch, _ = client
    endpoint = f"https://fcm.googleapis.com/fcm/send/TEST-{uuid.uuid4().hex}"
    corps = {"endpoint": endpoint, "keys": {"p256dh": "x", "auth": "y"}, "appareil": "Chrome · Android"}
    assert requests.put(f"{API}/push/web/abonnement", headers=ch, json=corps, timeout=15).status_code == 200
    assert requests.get(f"{API}/push/web/etat", headers=ch, timeout=15).json()["abonnements"] >= 1
    assert requests.delete(f"{API}/push/web/abonnement", headers=ch, json=corps, timeout=15).status_code == 200
    invalide = {**corps, "endpoint": "http://exemple.test/push"}
    assert requests.put(f"{API}/push/web/abonnement", headers=ch, json=invalide, timeout=15).status_code == 400
