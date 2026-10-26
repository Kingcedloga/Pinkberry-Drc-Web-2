"""
Iteration 21 — Route/permission guards.

Vérifie côté backend :
  - Endpoints admin/superadmin/livreur refusent un token client (401/403).
  - Endpoints superadmin refusent un token admin (401/403).
"""

import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://pinkberry-kin.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


def _login(telephone: str, mdp: str) -> str:
    r = requests.post(f"{API}/auth/connexion", json={"telephone": telephone, "motDePasse": mdp}, timeout=15)
    assert r.status_code == 200, f"login {telephone} failed: {r.status_code} {r.text[:150]}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def token_client():
    return _login("0990000001", "client123")


@pytest.fixture(scope="module")
def token_admin():
    return _login("0810000000", "admin123")


@pytest.fixture(scope="module")
def token_livreur():
    return _login("0820000001", "livreur123")


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ---------- Client ne doit pas atteindre les endpoints privilégiés ----------
ENDPOINTS_ADMIN = [
    ("GET", "/admin/commandes"),
    ("GET", "/admin/livreurs"),
    ("GET", "/admin/categories"),
    ("GET", "/admin/rapport"),
    ("GET", "/admin/stats"),
    ("GET", "/admin/ventes"),
]
ENDPOINTS_SUPER = [
    ("GET", "/superadmin/comptes"),
]
ENDPOINTS_LIVREUR = [
    ("GET", "/livreur/courses"),
    ("GET", "/livreur/rapport"),
]


@pytest.mark.parametrize("method,path", ENDPOINTS_ADMIN)
def test_client_bloque_sur_admin(token_client, method, path):
    r = requests.request(method, f"{API}{path}", headers=_auth(token_client), timeout=15)
    assert r.status_code in (401, 403), f"{method} {path} => {r.status_code} pour client"


@pytest.mark.parametrize("method,path", ENDPOINTS_SUPER)
def test_client_bloque_sur_super(token_client, method, path):
    r = requests.request(method, f"{API}{path}", headers=_auth(token_client), timeout=15)
    assert r.status_code in (401, 403), f"{method} {path} => {r.status_code} pour client"


@pytest.mark.parametrize("method,path", ENDPOINTS_LIVREUR)
def test_client_bloque_sur_livreur(token_client, method, path):
    r = requests.request(method, f"{API}{path}", headers=_auth(token_client), timeout=15)
    assert r.status_code in (401, 403), f"{method} {path} => {r.status_code} pour client"


# ---------- Admin ne doit pas atteindre les endpoints superadmin ----------
@pytest.mark.parametrize("method,path", ENDPOINTS_SUPER)
def test_admin_bloque_sur_super(token_admin, method, path):
    r = requests.request(method, f"{API}{path}", headers=_auth(token_admin), timeout=15)
    assert r.status_code in (401, 403), f"{method} {path} => {r.status_code} pour admin"


# ---------- Livreur ne doit pas atteindre admin/superadmin ----------
@pytest.mark.parametrize("method,path", ENDPOINTS_ADMIN + ENDPOINTS_SUPER)
def test_livreur_bloque_sur_admin(token_livreur, method, path):
    r = requests.request(method, f"{API}{path}", headers=_auth(token_livreur), timeout=15)
    assert r.status_code in (401, 403), f"{method} {path} => {r.status_code} pour livreur"


# ---------- Sans token : 401 attendu ----------
@pytest.mark.parametrize("method,path", ENDPOINTS_ADMIN + ENDPOINTS_SUPER + ENDPOINTS_LIVREUR)
def test_sans_token_bloque(method, path):
    r = requests.request(method, f"{API}{path}", timeout=15)
    assert r.status_code in (401, 403), f"{method} {path} => {r.status_code} sans token"


# ---------- Accès légitime ok ----------
def test_admin_peut_lister_commandes(token_admin):
    r = requests.get(f"{API}/admin/commandes", headers=_auth(token_admin), timeout=15)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_livreur_peut_lister_ses_courses(token_livreur):
    r = requests.get(f"{API}/livreur/courses", headers=_auth(token_livreur), timeout=15)
    assert r.status_code == 200
