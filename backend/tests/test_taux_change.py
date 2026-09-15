"""Tests for taux de change (USD -> FC) admin management (iteration 2)."""
import os
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://commande-rose.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_TEL, ADMIN_PWD = "0810000000", "admin123"
CLIENT_TEL, CLIENT_PWD = "0990000001", "client123"
LIVREUR_TEL, LIVREUR_PWD = "0820000001", "livreur123"


def _login(tel, pwd):
    r = requests.post(f"{API}/auth/connexion", json={"telephone": tel, "motDePasse": pwd}, timeout=30)
    assert r.status_code == 200, f"login {tel} failed: {r.status_code} {r.text}"
    return r.json()["token"]


def _h(tok):
    return {"Authorization": f"Bearer {tok}"}


def test_config_public_has_taux_and_frais():
    r = requests.get(f"{API}/config", timeout=10)
    assert r.status_code == 200
    j = r.json()
    assert "tauxFC" in j and "fraisLivraison" in j
    assert isinstance(j["tauxFC"], (int, float)) and j["tauxFC"] > 0
    assert j["fraisLivraison"] == 2.5


def test_admin_update_taux_persists_via_get_config():
    admin_tok = _login(ADMIN_TEL, ADMIN_PWD)
    # save current
    initial = requests.get(f"{API}/config", timeout=10).json()["tauxFC"]
    try:
        r = requests.put(f"{API}/admin/config", json={"tauxFC": 3100},
                         headers=_h(admin_tok), timeout=10)
        assert r.status_code == 200, r.text
        assert r.json()["tauxFC"] == 3100
        # verify persisted via public config
        r2 = requests.get(f"{API}/config", timeout=10)
        assert r2.status_code == 200 and r2.json()["tauxFC"] == 3100
    finally:
        # revert to initial (should be 2800)
        requests.put(f"{API}/admin/config", json={"tauxFC": initial},
                     headers=_h(admin_tok), timeout=10)


def test_admin_reject_taux_zero_or_negative():
    admin_tok = _login(ADMIN_TEL, ADMIN_PWD)
    r = requests.put(f"{API}/admin/config", json={"tauxFC": 0},
                     headers=_h(admin_tok), timeout=10)
    assert r.status_code == 400
    r2 = requests.put(f"{API}/admin/config", json={"tauxFC": -10},
                      headers=_h(admin_tok), timeout=10)
    assert r2.status_code == 400


def test_admin_config_requires_auth():
    r = requests.put(f"{API}/admin/config", json={"tauxFC": 3100}, timeout=10)
    assert r.status_code == 401


def test_admin_config_forbidden_for_client():
    tok = _login(CLIENT_TEL, CLIENT_PWD)
    r = requests.put(f"{API}/admin/config", json={"tauxFC": 3100},
                     headers=_h(tok), timeout=10)
    assert r.status_code == 403


def test_admin_config_forbidden_for_livreur():
    tok = _login(LIVREUR_TEL, LIVREUR_PWD)
    r = requests.put(f"{API}/admin/config", json={"tauxFC": 3100},
                     headers=_h(tok), timeout=10)
    assert r.status_code == 403


def test_taux_seed_setoninsert_does_not_overwrite():
    """After changing taux and restarting-like effect, seed uses $setOnInsert -> should NOT overwrite.
    Simulated here by writing a value and confirming next GET returns it (seed runs at startup only,
    so we just validate the semantic that a subsequent read still reflects the update)."""
    admin_tok = _login(ADMIN_TEL, ADMIN_PWD)
    initial = requests.get(f"{API}/config", timeout=10).json()["tauxFC"]
    try:
        requests.put(f"{API}/admin/config", json={"tauxFC": 3250},
                     headers=_h(admin_tok), timeout=10)
        j = requests.get(f"{API}/config", timeout=10).json()
        assert j["tauxFC"] == 3250
    finally:
        requests.put(f"{API}/admin/config", json={"tauxFC": initial},
                     headers=_h(admin_tok), timeout=10)


def test_taux_reste_celui_de_ladmin():
    """Les tests ne doivent jamais ecraser durablement le taux choisi par l'admin."""
    admin_tok = _login(ADMIN_TEL, ADMIN_PWD)
    initial = requests.get(f"{API}/config", timeout=10).json()["tauxFC"]
    requests.put(f"{API}/admin/config", json={"tauxFC": 2999},
                 headers=_h(admin_tok), timeout=10)
    assert requests.get(f"{API}/config", timeout=10).json()["tauxFC"] == 2999
    requests.put(f"{API}/admin/config", json={"tauxFC": initial},
                 headers=_h(admin_tok), timeout=10)
    r = requests.get(f"{API}/config", timeout=10)
    assert r.status_code == 200 and r.json()["tauxFC"] == initial
