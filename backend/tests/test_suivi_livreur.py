"""Suivi de position du livreur : pas de course « en route » sans position GPS
recente ; la derniere position (une par livreur) est lue par le client en direct."""
import os
import re

import pytest
import requests
from dotenv import load_dotenv
from pymongo import MongoClient

BASE = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
API = f"{BASE}/api"
CLIENT_TEL = "0990000001"


def _connexion(tel: str, pwd: str):
    r = requests.post(f"{API}/auth/connexion", json={"telephone": tel, "motDePasse": pwd}, timeout=15)
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


@pytest.fixture(scope="module")
def admin():
    return _connexion("0810000000", "admin123")


@pytest.fixture(scope="module")
def client():
    return _connexion(CLIENT_TEL, "client123")


@pytest.fixture(scope="module")
def db():
    load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
    with MongoClient(os.environ["MONGO_URL"]) as cli:
        yield cli[os.environ["DB_NAME"]]


@pytest.fixture(scope="module")
def livreur():
    r = requests.post(f"{API}/auth/connexion", json={"telephone": "0820000001", "motDePasse": "livreur123"}, timeout=15)
    assert r.status_code == 200, r.text
    return {"id": r.json()["user"]["livreurId"]}, {"Authorization": f"Bearer {r.json()['token']}"}


@pytest.fixture()
def course(client, admin, livreur, db):
    lv, _ = livreur
    produit = next(p for p in requests.get(f"{API}/produits", timeout=15).json()
                   if p.get("disponible") and not p.get("configurable"))
    r = requests.post(f"{API}/commandes", headers=client, timeout=30, json={
        "items": [{"produitId": produit["id"], "nom": produit["nom"], "quantite": 1}],
        "adresse": {"label": "TEST", "commune": "Gombe", "avenue": "TEST", "numero": "1", "repere": "TEST",
                    "telephone": CLIENT_TEL, "lat": -4.30, "lng": 15.30},
    })
    assert r.status_code == 200, r.text
    cmd = r.json()
    assert requests.post(f"{API}/admin/commandes/{cmd['id']}/assigner", headers=admin,
                         json={"livreurId": lv["id"]}, timeout=15).status_code == 200
    yield cmd
    requests.patch(f"{API}/admin/commandes/{cmd['id']}/statut", headers=admin, json={"statut": "annulee"}, timeout=15)
    requests.post(f"{API}/admin/commandes/bulk/archive", headers=admin, json={"ids": [cmd["id"]]}, timeout=15)
    requests.delete(f"{API}/admin/commandes/{cmd['id']}", headers=admin, timeout=15)
    # Notifications de cette commande de test (client, admins, livreur) : retirees.
    db.notifications.delete_many({"$or": [{"lien": {"$regex": re.escape(cmd["id"])}},
                                          {"tag": {"$regex": re.escape(cmd["id"])}},
                                          {"message": {"$regex": re.escape(cmd["numero"])}}]})


def _statut(h, cid, **corps):
    return requests.patch(f"{API}/livreur/courses/{cid}/statut", headers=h, json=corps, timeout=15)


def test_en_route_impossible_sans_position(livreur, course, db):
    lv, lh = livreur
    # Derniere position vieille de 10 minutes : GPS considere comme coupe.
    db.positions_livreurs.update_one({"livreurId": lv["id"]}, {"$set": {"updatedAt": "2020-01-01T00:00:00+00:00"}})
    assert _statut(lh, course["id"], statut="recuperee").status_code == 200
    r = _statut(lh, course["id"], statut="en_route")
    assert r.status_code == 409 and "GPS" in r.json()["detail"]
    r = requests.patch(f"{API}/livreur/courses/{course['id']}/statut", headers={**lh, "Accept-Language": "en"},
                       json={"statut": "en_route"}, timeout=15)
    assert r.json()["detail"].startswith("Turn on location (GPS)")


def test_position_au_depart_puis_suivi_client(client, livreur, course):
    _, lh = livreur
    _statut(lh, course["id"], statut="recuperee")
    r = _statut(lh, course["id"], statut="en_route", lat=-4.32, lng=15.31)
    assert r.status_code == 200, r.text
    assert r.json()["statut"] == "en_route"

    # Envois continus : seule la derniere position est gardee, lue par le client.
    for lat in (-4.315, -4.310):
        assert requests.post(f"{API}/livreur/position", headers=lh, json={"lat": lat, "lng": 15.305},
                             timeout=15).status_code == 200
    vue = requests.get(f"{API}/commandes/{course['id']}", headers=client, timeout=15).json()
    pos = vue["positionLivreur"]
    assert (pos["lat"], pos["lng"]) == (-4.310, 15.305) and pos["updatedAt"]
    assert vue["etaMinutes"] >= 2 and vue["distanceKm"] > 0


def test_coordonnees_invalides_refusees(livreur):
    _, lh = livreur
    r = requests.post(f"{API}/livreur/position", headers=lh, json={"lat": 123, "lng": 15.3}, timeout=15)
    assert r.status_code == 422
