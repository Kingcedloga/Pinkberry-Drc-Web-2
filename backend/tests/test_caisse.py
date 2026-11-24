"""Mode caisse (POS ZKTeco sous Windows) : le poste vient chercher les tickets a imprimer.

Droit accorde par le super admin a un admin ; la vente acceptee (statut en_preparation)
entre dans la file, un ticket n'est pris qu'une fois, la reimpression porte « DUPLICATA ».
"""
from __future__ import annotations

import os

import pytest
import requests

from outils_auth import article_commandable, entetes_superadmin

API = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/") + "/api"
LABEL = f"TEST_CAISSE_{os.environ.get('PYTEST_XDIST_WORKER', 'master')}"


def _jeton(tel: str, mdp: str) -> dict:
    r = requests.post(f"{API}/auth/connexion", json={"telephone": tel, "motDePasse": mdp}, timeout=25)
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


@pytest.fixture(scope="module")
def client():
    return _jeton("0990000001", "client123")


@pytest.fixture(scope="module")
def admin():
    return _jeton("0810000000", "admin123")


@pytest.fixture(scope="module")
def admin_id(admin):
    return requests.get(f"{API}/auth/moi", headers=admin, timeout=15).json()["id"]


def _droit_caisse(admin_id: str, actif: bool):
    r = requests.patch(f"{API}/superadmin/comptes/{admin_id}/caisse", headers=entetes_superadmin(),
                       json={"actif": actif}, timeout=15)
    assert r.status_code == 200, r.text
    assert r.json()["modeCaisse"] is actif


@pytest.fixture
def caissier(admin, admin_id):
    _droit_caisse(admin_id, True)
    yield admin
    _droit_caisse(admin_id, False)


def _commande(client) -> dict:
    r = requests.post(f"{API}/commandes", headers=client, timeout=30, json={
        "items": [article_commandable()],
        "modePaiement": "cash",
        "adresse": {"label": LABEL, "commune": "Gombe", "avenue": "Test", "numero": "1", "repere": "caisse",
                    "telephone": "0990000001", "lat": -4.30, "lng": 15.30},
    })
    assert r.status_code == 200, r.text[:200]
    return r.json()


def _ticket_de(entetes: dict, cmd_id: str, largeur: int = 80) -> dict:
    """Vide la file jusqu'au ticket de la commande (d'autres ventes peuvent attendre devant)."""
    for _ in range(50):
        r = requests.post(f"{API}/caisse/tickets/suivant?largeur={largeur}", headers=entetes, timeout=15)
        assert r.status_code == 200, r.text
        ticket = r.json()["ticket"]
        assert ticket, "ticket absent de la file"
        if ticket["commandeId"] == cmd_id:
            return ticket
    raise AssertionError("ticket introuvable")


def test_admin_sans_droit_refuse(admin, admin_id):
    _droit_caisse(admin_id, False)
    r = requests.post(f"{API}/caisse/tickets/suivant", headers=admin, timeout=15)
    assert r.status_code == 403
    assert r.json()["detail"] == "Accès réservé au mode caisse"
    assert requests.post(f"{API}/caisse/commandes/x/imprimer", headers=admin, timeout=15).status_code == 403
    assert requests.get(f"{API}/auth/moi", headers=admin, timeout=15).json()["modeCaisse"] is False


def test_droit_reserve_au_super_admin(admin, admin_id):
    r = requests.patch(f"{API}/superadmin/comptes/{admin_id}/caisse", headers=admin, json={"actif": True}, timeout=15)
    assert r.status_code == 403


def test_vente_acceptee_imprimee_une_fois(client, caissier):
    cmd = _commande(client)
    r = requests.patch(f"{API}/admin/commandes/{cmd['id']}/statut", headers=caissier,
                       json={"statut": "en_preparation"}, timeout=15)
    assert r.status_code == 200, r.text

    ticket = _ticket_de(caissier, cmd["id"])
    assert ticket["impressions"] == 1
    html = ticket["html"]
    assert cmd["numero"] in html and "À ENCAISSER" in html and "DUPLICATA" not in html
    assert "size:80mm" in html

    # Deja pris : un second poste ne le recoit pas.
    r = requests.post(f"{API}/caisse/tickets/suivant", headers=caissier, timeout=15)
    assert (r.json()["ticket"] or {}).get("commandeId") != cmd["id"]

    # Revenir en preparation ne reimprime pas : seule la demande manuelle le fait.
    requests.patch(f"{API}/admin/commandes/{cmd['id']}/statut", headers=caissier,
                   json={"statut": "en_preparation"}, timeout=15)
    r = requests.post(f"{API}/caisse/tickets/suivant", headers=caissier, timeout=15)
    assert (r.json()["ticket"] or {}).get("commandeId") != cmd["id"]


def test_reimpression_duplicata(client, caissier):
    cmd = _commande(client)
    requests.patch(f"{API}/admin/commandes/{cmd['id']}/statut", headers=caissier,
                   json={"statut": "en_preparation"}, timeout=15)
    _ticket_de(caissier, cmd["id"])

    r = requests.post(f"{API}/caisse/commandes/{cmd['id']}/imprimer", headers=caissier, timeout=15)
    assert r.status_code == 200, r.text
    ticket = _ticket_de({**caissier, "Accept-Language": "en"}, cmd["id"], largeur=58)
    assert ticket["impressions"] == 2
    assert "DUPLICATE" in ticket["html"] and "size:58mm" in ticket["html"]


def test_reimpression_commande_inconnue(caissier):
    assert requests.post(f"{API}/caisse/commandes/inconnue/imprimer", headers=caissier, timeout=15).status_code == 404
