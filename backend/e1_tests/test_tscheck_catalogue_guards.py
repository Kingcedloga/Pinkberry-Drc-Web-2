import httpx
from conftest import BASE, YOG, hdr


def test_admin_catalogue_write_refused():
    r = httpx.patch(f"{BASE}/admin/produits/{YOG}/etat", json={"disponible": True}, headers=hdr("admin"), timeout=30)
    assert r.status_code == 403, r.text


def test_client_admin_api_refused():
    r = httpx.get(f"{BASE}/admin/commandes", headers=hdr("client"), timeout=30)
    assert r.status_code in (401, 403)


def test_superadmin_toggle_stock_reflected_and_restored():
    sh = hdr("superadmin")
    try:
        r = httpx.patch(f"{BASE}/admin/produits/{YOG}/etat", json={"disponible": False}, headers=sh, timeout=30)
        assert r.status_code == 200, r.text
        p = [x for x in httpx.get(f"{BASE}/produits").json() if x["id"] == YOG]
        assert not p or p[0]["disponible"] is False
    finally:
        httpx.patch(f"{BASE}/admin/produits/{YOG}/etat", json={"disponible": True}, headers=sh, timeout=30)
    p = [x for x in httpx.get(f"{BASE}/produits").json() if x["id"] == YOG]
    assert p and p[0]["disponible"] is True
