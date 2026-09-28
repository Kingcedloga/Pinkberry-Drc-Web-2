import os

import requests

BASE = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
API = f"{BASE}/api"

CLIENT_TEL = "0990000001"
CLIENT_PWD = "client123"
ADMIN_TEL = "0810000000"
ADMIN_PWD = "admin123"


def _login(tel: str, pwd: str) -> str:
    r = requests.post(f"{API}/auth/connexion", json={"telephone": tel, "motDePasse": pwd}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


def _h(token: str):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def test_admin_bulk_produits_delete():
    admin = _login(ADMIN_TEL, ADMIN_PWD)
    r = requests.get(f"{API}/produits", timeout=15)
    assert r.status_code == 200, r.text
    produits = r.json()
    assert produits, "Aucun produit de test disponible"
    ids = [p["id"] for p in produits[:2]]

    r = requests.delete(f"{API}/admin/produits/bulk", headers=_h(admin), json={"ids": ids}, timeout=15)
    assert r.status_code == 200, r.text
    payload = r.json()
    assert payload["deleted_count"] == len(ids)


def test_admin_bulk_zones_delete():
    admin = _login(ADMIN_TEL, ADMIN_PWD)
    r = requests.get(f"{API}/zones", timeout=15)
    assert r.status_code == 200, r.text
    zones = r.json()
    if len(zones) < 2:
        raise AssertionError("Au moins 2 zones attendues pour le test bulk")
    ids = [z["id"] for z in zones[:2]]

    r = requests.delete(f"{API}/admin/zones/bulk", headers=_h(admin), json={"ids": ids}, timeout=15)
    assert r.status_code == 200, r.text
    assert r.json()["deleted_count"] == len(ids)
