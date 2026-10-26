import time
import httpx
from conftest import BASE, create_order, hdr


def _pay(tel):
    c = create_order(mode="mobile").json()
    h = hdr("client")
    ops = httpx.get(f"{BASE}/paiements/operateurs", headers=h, timeout=30).json()
    r = httpx.post(f"{BASE}/paiements/mobile-money", json={"commandeId": c["id"], "operateur": "mpesa", "telephone": tel}, headers=h, timeout=60)
    assert r.status_code == 200, r.text
    d = r.json()["depositId"]
    for _ in range(20):
        time.sleep(3)
        if httpx.get(f"{BASE}/paiements/{d}", headers=h).json().get("statut") != "attente":
            break
    return httpx.get(f"{BASE}/commandes/{c['id']}", headers=h).json()


def _op(ops):
    s = str(ops)
    for k in ["VODACOM_MPESA_COD", "MPESA", "mpesa", "vodacom"]:
        if k in s:
            import re
            m = re.search(r"'(\w*" + k + r"\w*)'", s)
            if m:
                return m.group(1)
    return "VODACOM_MPESA_COD"


def test_mpesa_success():
    g = _pay("0813456789")
    assert g["paye"] is True, g["paiement"]


def test_mpesa_failure():
    g = _pay("0813456039")
    assert g["paye"] is False and g["paiement"]["statut"] not in ("paye", "confirme"), g["paiement"]
