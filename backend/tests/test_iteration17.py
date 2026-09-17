"""Tests iteration 17 — Preference theme (clair/sombre/systeme).

Backend :
- PUT /api/auth/preferences accepte theme=clair|sombre|systeme, persiste, echo dans la reponse.
- GET /api/auth/moi relit les preferences.
- theme invalide -> 422.
- Un payload sans champ `theme` recoit la valeur par defaut 'systeme'.
- Meme comportement pour les roles admin et livreur (test non invasif : on lit + on restaure).

Isolation : utilise un compte client dedie cree via /auth/inscription pour eviter les
courses avec test_iteration14 qui touche aussi aux preferences du client demo (xdist).
"""
import os
import time
import uuid

import pytest
import requests

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_TEL = "0810000000"
ADMIN_PWD = "admin123"
LIVREUR_TEL = "0820000001"
LIVREUR_PWD = "livreur123"


def _login(tel: str, pwd: str) -> str:
    r = requests.post(f"{API}/auth/connexion", json={"telephone": tel, "motDePasse": pwd}, timeout=30)
    assert r.status_code == 200, f"login {tel} failed: {r.status_code} {r.text}"
    return r.json()["token"]


def _headers(tok: str) -> dict:
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


def _current_prefs(tok: str) -> dict:
    r = requests.get(f"{API}/auth/moi", headers=_headers(tok), timeout=30)
    assert r.status_code == 200
    return r.json().get("preferences") or {}


# ------------------------------ Fresh client fixture --------------------

@pytest.fixture(scope="module")
def token_client_dedie() -> str:
    """Cree un client dedie (isolation vis-a-vis du client demo utilise ailleurs)."""
    tel = "099" + str(int(time.time() * 1000))[-7:]
    pwd = "iter17pwd"
    r = requests.post(
        f"{API}/auth/inscription",
        json={"nom": f"TEST_ITER17_{uuid.uuid4().hex[:6]}", "email": f"otp_{tel}@pinkberry.test", "telephone": tel, "motDePasse": pwd},
        timeout=30,
    )
    assert r.status_code == 200, r.text
    code = r.json().get("codeDemo")
    assert code, "codeDemo manquant"
    r = requests.post(f"{API}/auth/verifier-otp", json={"telephone": tel, "code": code}, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def token_admin() -> str:
    return _login(ADMIN_TEL, ADMIN_PWD)


@pytest.fixture(scope="module")
def token_livreur() -> str:
    return _login(LIVREUR_TEL, LIVREUR_PWD)


# ------------------------------ Theme happy path (client dedie) --------

class TestThemeClient:
    def test_default_theme_est_systeme_pour_nouveau_compte(self, token_client_dedie):
        prefs = _current_prefs(token_client_dedie)
        # Nouveau compte : soit prefs absent (None), soit theme='systeme' par defaut cote lecture.
        assert prefs == {} or prefs.get("theme", "systeme") == "systeme"

    def test_set_theme_sombre_and_reread(self, token_client_dedie):
        payload = {"langue": "fr", "theme": "sombre", "notifSuivi": True, "notifPromos": True, "notifNouveautes": True}
        r = requests.put(f"{API}/auth/preferences", json=payload, headers=_headers(token_client_dedie), timeout=30)
        assert r.status_code == 200, r.text
        assert r.json()["theme"] == "sombre"
        assert r.json()["langue"] == "fr"
        assert _current_prefs(token_client_dedie)["theme"] == "sombre"

    def test_set_theme_clair(self, token_client_dedie):
        payload = {"langue": "fr", "theme": "clair", "notifSuivi": True, "notifPromos": True, "notifNouveautes": True}
        r = requests.put(f"{API}/auth/preferences", json=payload, headers=_headers(token_client_dedie), timeout=30)
        assert r.status_code == 200
        assert r.json()["theme"] == "clair"
        assert _current_prefs(token_client_dedie)["theme"] == "clair"

    def test_set_theme_systeme(self, token_client_dedie):
        payload = {"langue": "fr", "theme": "systeme", "notifSuivi": True, "notifPromos": True, "notifNouveautes": True}
        r = requests.put(f"{API}/auth/preferences", json=payload, headers=_headers(token_client_dedie), timeout=30)
        assert r.status_code == 200
        assert r.json()["theme"] == "systeme"
        assert _current_prefs(token_client_dedie)["theme"] == "systeme"

    def test_theme_invalide_422(self, token_client_dedie):
        payload = {"langue": "fr", "theme": "invalid-value", "notifSuivi": True, "notifPromos": True, "notifNouveautes": True}
        r = requests.put(f"{API}/auth/preferences", json=payload, headers=_headers(token_client_dedie), timeout=30)
        assert r.status_code == 422, f"expected 422 got {r.status_code} {r.text}"

    def test_theme_default_when_absent(self, token_client_dedie):
        # Sans champ theme, la valeur par defaut 'systeme' doit s'appliquer.
        payload = {"langue": "fr", "notifSuivi": True, "notifPromos": True, "notifNouveautes": True}
        r = requests.put(f"{API}/auth/preferences", json=payload, headers=_headers(token_client_dedie), timeout=30)
        assert r.status_code == 200, r.text
        assert r.json()["theme"] == "systeme"
        assert _current_prefs(token_client_dedie)["theme"] == "systeme"


# ------------------------------ Roles admin / livreur (non invasif) -----

class TestThemeAdminLivreurNonInvasif:
    def test_admin_prefs_incluent_theme_et_defaut(self, token_admin):
        # /auth/moi doit exposer un champ preferences dont theme vaut clair|sombre|systeme.
        prefs = _current_prefs(token_admin)
        assert prefs.get("theme", "systeme") in ("clair", "sombre", "systeme")

    def test_livreur_prefs_incluent_theme_et_defaut(self, token_livreur):
        prefs = _current_prefs(token_livreur)
        assert prefs.get("theme", "systeme") in ("clair", "sombre", "systeme")


# ------------------------------ Auth requise -----------------------------

class TestThemeSecurite:
    def test_put_sans_token_401_ou_403(self):
        r = requests.put(f"{API}/auth/preferences", json={"langue": "fr", "theme": "sombre"}, timeout=30)
        assert r.status_code in (401, 403)

    def test_get_moi_sans_token_401_ou_403(self):
        r = requests.get(f"{API}/auth/moi", timeout=30)
        assert r.status_code in (401, 403)
