"""Droits : la configuration (menu, composition, zones, promotions, bannieres,
taux, comptes) n'est modifiable que par le super admin, controle cote serveur.
Un admin normal la consulte et gere l'operationnel (commandes, assignations)."""
import os
import uuid

import pytest
import requests

from outils_auth import entetes_superadmin

BASE = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
API = f"{BASE}/api"

# Toutes les ecritures de configuration (identifiants factices : le refus
# intervient avant toute recherche en base ou validation du corps).
ECRITURES = [
    ("post", "/admin/photos"), ("post", "/admin/traduire"),
    ("post", "/admin/categories"), ("put", "/admin/categories/x"), ("delete", "/admin/categories/x"),
    ("post", "/admin/produits"), ("put", "/admin/produits/x"), ("delete", "/admin/produits/x"),
    ("patch", "/admin/produits/x/etat"), ("post", "/admin/produits/bulk/etat"), ("delete", "/admin/produits/bulk/delete"),
    ("post", "/admin/tailles"), ("put", "/admin/tailles/x"), ("delete", "/admin/tailles/x"),
    ("post", "/admin/contenants"), ("put", "/admin/contenants/x"), ("delete", "/admin/contenants/x"),
    ("put", "/admin/categories-garnitures/x"),
    ("post", "/admin/garnitures"), ("put", "/admin/garnitures/x"), ("delete", "/admin/garnitures/x"),
    ("put", "/admin/regle-garnitures"),
    ("post", "/admin/promotions"), ("put", "/admin/promotions/x"), ("patch", "/admin/promotions/x/actif"),
    ("delete", "/admin/promotions/x"),
    ("post", "/admin/bannieres/image"), ("post", "/admin/bannieres"), ("put", "/admin/bannieres/ordre"),
    ("put", "/admin/bannieres/x"), ("patch", "/admin/bannieres/x/actif"), ("delete", "/admin/bannieres/x"),
    ("post", "/admin/zones"), ("put", "/admin/zones/x"), ("delete", "/admin/zones/x"), ("delete", "/admin/zones/bulk/delete"),
    ("post", "/admin/livreurs"), ("put", "/admin/livreurs/x"), ("delete", "/admin/livreurs/x"),
    ("delete", "/admin/livreurs/bulk/delete"),
    ("post", "/superadmin/admins"), ("patch", "/superadmin/comptes/x/actif"), ("delete", "/superadmin/comptes/x"),
    ("delete", "/superadmin/comptes/bulk/delete"),
    ("put", "/admin/config"),
]


def _connexion(tel: str, pwd: str):
    r = requests.post(f"{API}/auth/connexion", json={"telephone": tel, "motDePasse": pwd}, timeout=15)
    assert r.status_code == 200, r.text
    assert r.json()["user"]["role"] == "admin"
    return {"Authorization": f"Bearer {r.json()['token']}"}


@pytest.fixture(scope="module")
def admin():
    return _connexion("0810000000", "admin123")


@pytest.mark.parametrize("methode,chemin", ECRITURES, ids=[f"{m} {c}" for m, c in ECRITURES])
def test_ecriture_refusee_a_l_admin(admin, methode, chemin):
    r = requests.request(methode, f"{API}{chemin}", headers=admin, json={}, timeout=15)
    assert r.status_code == 403, r.text
    assert r.json()["detail"] == "Action réservée au Super Admin"


def test_message_traduit(admin):
    r = requests.post(f"{API}/admin/zones", headers={**admin, "Accept-Language": "en"}, json={}, timeout=15)
    assert (r.status_code, r.json()["detail"]) == (403, "Action reserved for the Super Admin")


def test_admin_consulte_la_configuration(admin):
    for chemin in ("/admin/categories", "/admin/composition", "/admin/promotions", "/admin/bannieres",
                   "/admin/livreurs", "/admin/commandes", "/admin/stats", "/config"):
        assert requests.get(f"{API}{chemin}", headers=admin, timeout=15).status_code == 200, chemin


def test_super_admin_peut_ecrire():
    sa = entetes_superadmin()
    nom = f"TEST_Droits {uuid.uuid4().hex[:6]}"
    r = requests.post(f"{API}/admin/categories", headers=sa, json={"nom": nom, "nomEn": "TEST"}, timeout=60)
    assert r.status_code == 200, r.text
    assert requests.delete(f"{API}/admin/categories/{r.json()['id']}", headers=sa, timeout=15).status_code == 200
