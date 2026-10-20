import os
import uuid

import requests
from outils_auth import jeton_superadmin

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


def test_admin_bulk_produits_delete_is_non_destructive():
    admin = jeton_superadmin()  # gestion du menu : reservee au super admin
    ids = [f"missing-{uuid.uuid4()}" for _ in range(2)]

    r = requests.delete(f"{API}/admin/produits/bulk/delete", headers=_h(admin), json={"ids": ids}, timeout=15)
    assert r.status_code == 200, r.text
    assert r.json()["deleted_count"] == 0


def test_admin_bulk_zones_delete_is_non_destructive():
    admin = jeton_superadmin()
    ids = [f"missing-{uuid.uuid4()}" for _ in range(2)]

    r = requests.delete(f"{API}/admin/zones/bulk/delete", headers=_h(admin), json={"ids": ids}, timeout=15)
    assert r.status_code == 200, r.text
    assert r.json()["deleted_count"] == 0
