"""Paiements Flexpaie bloques : bouton admin « Revérifier le paiement » et statut « non confirmé ».

Sans transaction reelle : les tentatives sont inserees en base avec un orderNumber invente ;
la verification n'appelle que check (lecture), qui repond « transaction introuvable ».
La boucle de rattrapage elle-meme se verifie avec un faux Flexpaie (intervalle via
FLEXPAIE_RATTRAPAGE_SECONDES), pas contre le vrai service.
"""
from __future__ import annotations

import os
import uuid
from datetime import datetime, timezone

import pytest
import requests
from pymongo import MongoClient

from outils_auth import article_commandable

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
LABEL = f"TEST_RATTRAPAGE_{os.environ.get('PYTEST_XDIST_WORKER', 'master')}"


def _mongo():
    return MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]


def _jeton(tel: str, mdp: str) -> dict:
    r = requests.post(f"{BASE_URL}/api/auth/connexion", json={"telephone": tel, "motDePasse": mdp}, timeout=25)
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


@pytest.fixture(scope="module")
def client():
    return _jeton("0990000001", "client123")


@pytest.fixture(scope="module")
def admin():
    return _jeton("0810000000", "admin123")


def _commande(client, mode="mobile"):
    r = requests.post(f"{BASE_URL}/api/commandes", headers=client, timeout=30, json={
        "items": [article_commandable()],
        "modePaiement": mode,
        "adresse": {"label": LABEL, "commune": "Gombe", "avenue": "Test", "numero": "1", "repere": "rattrapage",
                    "telephone": "0990000001", "lat": -4.30, "lng": 15.30},
    })
    assert r.status_code == 200, r.text[:200]
    return r.json()


def _tentative_en_attente(cmd) -> str:
    db = _mongo()
    reference = "PBT" + uuid.uuid4().hex[:13].upper()
    db.paiements.insert_one({
        "id": reference, "reference": reference, "mode": "mobile", "commandeId": cmd["id"],
        "userId": db.commandes.find_one({"id": cmd["id"]})["userId"], "montant": "1000", "devise": "CDF",
        "statut": "attente", "orderNumber": f"ORDTEST{uuid.uuid4().hex[:10]}",
        "createdAt": datetime.now(timezone.utc).isoformat(),
    })
    db.commandes.update_one({"id": cmd["id"]}, {"$set": {"paiement.paiementId": reference, "paiement.statut": "attente"}})
    return reference


def test_route_reservee_admin(client):
    cmd = _commande(client)
    _tentative_en_attente(cmd)
    r = requests.post(f"{BASE_URL}/api/admin/paiements/{cmd['id']}/verifier", headers=client, timeout=30)
    assert r.status_code == 403


def test_commande_cash_404(client, admin):
    cmd = _commande(client, "cash")
    r = requests.post(f"{BASE_URL}/api/admin/paiements/{cmd['id']}/verifier", headers=admin, timeout=30)
    assert r.status_code == 404


def test_commande_inconnue_404(admin):
    r = requests.post(f"{BASE_URL}/api/admin/paiements/{uuid.uuid4()}/verifier", headers=admin, timeout=30)
    assert r.status_code == 404


def test_reverification_transaction_introuvable(client, admin):
    """Flexpaie ne connait pas la transaction : la commande reste en attente, la date est notee."""
    if not requests.get(f"{BASE_URL}/api/paiements/modes", timeout=15).json()["mobile"]:
        pytest.skip("Flexpaie non configure sur ce backend")
    cmd = _commande(client)
    _tentative_en_attente(cmd)
    r = requests.post(f"{BASE_URL}/api/admin/paiements/{cmd['id']}/verifier", headers=admin, timeout=40)
    assert r.status_code in (200, 502), r.text[:200]  # 502 : Flexpaie injoignable depuis ce backend
    if r.status_code == 200:
        d = r.json()
        assert d["paye"] is False and d["paiement"]["statut"] == "attente"
        assert d["paiement"]["verifieAt"]


def teardown_module(module):
    db = _mongo()
    ids = [c["id"] for c in db.commandes.find({"adresse.label": LABEL}, {"id": 1})]
    if ids:
        db.paiements.delete_many({"commandeId": {"$in": ids}})
        db.notifications.delete_many({"$or": [{"lien": {"$in": [f"/suivi/{i}" for i in ids]}},
                                              {"tag": {"$regex": "|".join(ids)}}]})
        db.commandes.delete_many({"id": {"$in": ids}})
    db.adresses.delete_many({"label": LABEL})
