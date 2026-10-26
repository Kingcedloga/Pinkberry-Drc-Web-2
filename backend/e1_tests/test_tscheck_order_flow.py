import httpx
from conftest import BASE, create_order, hdr


def test_zone_and_totals():
    r = create_order(qty=2)
    assert r.status_code in (200, 201), r.text
    c = r.json()
    assert c["numero"].startswith("PB-") and c["statut"] == "recue"
    assert c["sousTotal"] == 38000 and c["fraisLivraison"] == 2000 and c["total"] == 40000
    r2 = create_order(commune="Barumbu")
    assert r2.status_code >= 400 and "Barumbu" in r2.text


def test_cancel_while_recue():
    c = create_order().json()
    r = httpx.post(f"{BASE}/commandes/{c['id']}/annuler", headers=hdr("client"), timeout=30)
    assert r.status_code == 200, r.text
    g = httpx.get(f"{BASE}/commandes/{c['id']}", headers=hdr("client"), timeout=30).json()
    assert g["statut"] == "annulee"


def test_full_delivery_and_no_cancel_en_route():
    c = create_order().json()
    ah, lh, ch = hdr("admin"), hdr("livreur"), hdr("client")
    lid = [l for l in httpx.get(f"{BASE}/admin/livreurs", headers=ah).json() if l["telephone"] == "0820000001"][0]["id"]
    assert httpx.post(f"{BASE}/admin/commandes/{c['id']}/assigner", json={"livreurId": lid}, headers=ah).status_code == 200
    assert httpx.patch(f"{BASE}/admin/commandes/{c['id']}/statut", json={"statut": "en_preparation"}, headers=ah).status_code == 200
    for st in ["recuperee", "en_route"]:
        r = httpx.patch(f"{BASE}/livreur/courses/{c['id']}/statut", json={"statut": st, "lat": -4.32, "lng": 15.31}, headers=lh)
        assert r.status_code == 200, (st, r.text)
    r = httpx.post(f"{BASE}/commandes/{c['id']}/annuler", headers=ch)
    assert r.status_code >= 400, "cancel accepted while en route"
    r = httpx.patch(f"{BASE}/livreur/courses/{c['id']}/statut", json={"statut": "livree", "lat": -4.32, "lng": 15.31}, headers=lh)
    assert r.status_code == 200, r.text
    r = httpx.post(f"{BASE}/livreur/courses/{c['id']}/encaisser", headers=lh)
    assert r.status_code == 200, r.text
    g = httpx.get(f"{BASE}/commandes/{c['id']}", headers=ch).json()
    assert g["statut"] == "livree" and g["paye"] is True
