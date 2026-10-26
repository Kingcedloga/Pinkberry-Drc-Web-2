import httpx
from conftest import BASE, login


def test_openapi_and_login_roles():
    assert httpx.get(f"{BASE}/openapi.json", timeout=30).status_code == 200
    for role in ["client", "admin", "livreur", "superadmin"]:
        u = login(role)["user"]
        assert u["role"], u


def test_wrong_password_rejected():
    r = httpx.post(f"{BASE}/auth/connexion", json={"telephone": "0990000001", "motDePasse": "bad"}, timeout=30)
    assert r.status_code in (400, 401, 403)
