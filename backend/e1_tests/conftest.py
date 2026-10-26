import uuid
import httpx
import pytest

BASE = "http://localhost:8001/api"
YOG = "ecedcaf2-5108-461f-ae44-9b6767cfcd64"
CREDS = {
    "client": ("0990000001", "client123"),
    "admin": ("0810000000", "admin123"),
    "livreur": ("0820000001", "livreur123"),
    "superadmin": ("+243992113682", "superadmin123"),
}


def login(role):
    tel, pw = CREDS[role]
    r = httpx.post(f"{BASE}/auth/connexion", json={"telephone": tel, "motDePasse": pw}, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()


def hdr(role):
    return {"Authorization": f"Bearer {login(role)['token']}"}


def create_order(commune="Gombe", mode="cash", qty=1):
    suffix = uuid.uuid4().hex[:6]
    body = {
        "adresse": {"label": f"tscheck-{suffix}", "commune": commune, "avenue": f"tscheck-av-{suffix}",
                    "numero": "1", "repere": "tscheck", "telephone": "0990000001"},
        "items": [{"produitId": YOG, "nom": "Yogourt glacé", "taille": "Régulière", "contenant": "Bol",
                   "garnitures": [], "quantite": qty}],
        "modePaiement": mode,
    }
    return httpx.post(f"{BASE}/commandes", json=body, headers=hdr("client"), timeout=30)


@pytest.fixture
def H():
    return hdr
