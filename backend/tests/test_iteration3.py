"""Tests iteration 3 : upload photo produit, auth Google session, auth/telephone."""
import io
import os

import pytest
import requests
from PIL import Image

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://commande-rose.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

CLIENT_TEL = "0990000001"
CLIENT_PWD = "client123"
ADMIN_TEL = "0810000000"
ADMIN_PWD = "admin123"


def _login(tel, pwd):
    r = requests.post(f"{API}/auth/connexion", json={"telephone": tel, "motDePasse": pwd}, timeout=30)
    assert r.status_code == 200, f"{tel} login failed: {r.status_code} {r.text}"
    return r.json()["token"]


def _h(tok):
    return {"Authorization": f"Bearer {tok}"}


def _png(w=1600, h=1200, color=(240, 90, 130)):
    img = Image.new("RGB", (w, h), color)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


@pytest.fixture(scope="module")
def admin_tok():
    return _login(ADMIN_TEL, ADMIN_PWD)


@pytest.fixture(scope="module")
def client_tok():
    return _login(CLIENT_TEL, CLIENT_PWD)


# --------------------------------------------------------------------- PHOTOS
class TestPhotos:
    def test_upload_sans_token_401(self):
        files = {"file": ("t.png", _png(64, 64), "image/png")}
        r = requests.post(f"{API}/admin/photos", files=files, timeout=30)
        assert r.status_code == 401, r.text

    def test_upload_client_403(self, client_tok):
        files = {"file": ("t.png", _png(64, 64), "image/png")}
        r = requests.post(f"{API}/admin/photos", files=files, headers=_h(client_tok), timeout=30)
        assert r.status_code == 403

    def test_upload_type_refuse(self, admin_tok):
        files = {"file": ("t.txt", b"hello", "text/plain")}
        r = requests.post(f"{API}/admin/photos", files=files, headers=_h(admin_tok), timeout=30)
        assert r.status_code == 400
        files2 = {"file": ("t.pdf", b"%PDF-1.4 test", "application/pdf")}
        r2 = requests.post(f"{API}/admin/photos", files=files2, headers=_h(admin_tok), timeout=30)
        assert r2.status_code == 400

    def test_upload_trop_gros(self, admin_tok):
        # >5 Mo : PNG plein d'entropie (aléatoire) plus difficile — on utilise du bruit
        import secrets
        data = secrets.token_bytes(5 * 1024 * 1024 + 1024)  # 5Mo + 1Ko
        files = {"file": ("big.png", data, "image/png")}
        r = requests.post(f"{API}/admin/photos", files=files, headers=_h(admin_tok), timeout=60)
        assert r.status_code == 400, f"expected 400 but got {r.status_code}: {r.text[:200]}"

    def test_upload_png_ok_et_lecture(self, admin_tok):
        files = {"file": ("photo.png", _png(1600, 1200), "image/png")}
        r = requests.post(f"{API}/admin/photos", files=files, headers=_h(admin_tok), timeout=60)
        assert r.status_code == 200, f"{r.status_code} {r.text[:200]}"
        j = r.json()
        assert "id" in j and j["url"] == f"/api/fichiers/{j['id']}"

        # GET du fichier -> JPEG compressé, redimensionné (<=900px), Cache-Control
        r2 = requests.get(f"{BASE_URL}{j['url']}", timeout=30)
        assert r2.status_code == 200
        ctype = r2.headers.get("Content-Type", "")
        assert "image" in ctype
        assert r2.headers.get("Cache-Control", "") != ""
        # vérifie la taille de l'image
        img = Image.open(io.BytesIO(r2.content))
        assert max(img.size) <= 900, f"image non redimensionnée : {img.size}"
        assert img.format in ("JPEG", "JPG")

        # persistence dans /admin/produits : créer un produit qui référence cette image
        payload = {
            "nom": "TEST Photo Produit",
            "categorie": "Pots de crème",
            "prix": 5.5,
            "emoji": "🍨",
            "description": "test photo",
            "tailles": [],
            "garnitures": [],
            "image": j["url"],
        }
        rp = requests.post(f"{API}/admin/produits", json=payload, headers=_h(admin_tok), timeout=15)
        assert rp.status_code == 200, rp.text
        prod = rp.json()
        # champ image contient une URL courte (pas de base64)
        assert prod.get("image") == j["url"]
        assert "base64" not in (prod.get("image") or "")
        assert len(prod.get("image") or "") < 200

        # cleanup
        requests.delete(f"{API}/admin/produits/{prod['id']}", headers=_h(admin_tok), timeout=10)


# ---------------------------------------------------------------- AUTH SESSION
class TestAuthSession:
    def test_session_invalid_401(self):
        r = requests.post(f"{API}/auth/session", json={"session_id": "faux"}, timeout=30)
        assert r.status_code == 401, f"expected 401 got {r.status_code}: {r.text[:200]}"

    def test_session_body_manquant_422(self):
        r = requests.post(f"{API}/auth/session", json={}, timeout=15)
        assert r.status_code == 422


# ------------------------------------------------------------- AUTH TELEPHONE
class TestAuthTelephone:
    def test_telephone_sans_token_401(self):
        r = requests.put(f"{API}/auth/telephone", json={"telephone": "0999998887"}, timeout=15)
        assert r.status_code in (401, 403)

    def test_telephone_trop_court_400(self, admin_tok):
        r = requests.put(f"{API}/auth/telephone", json={"telephone": "12"},
                         headers=_h(admin_tok), timeout=15)
        assert r.status_code == 400

    def test_telephone_deja_pris_400(self, admin_tok):
        # essayer de prendre le tel du client démo avec le token admin
        r = requests.put(f"{API}/auth/telephone", json={"telephone": CLIENT_TEL},
                         headers=_h(admin_tok), timeout=15)
        assert r.status_code == 400
        assert "utilis" in r.text.lower() or "already" in r.text.lower() or "deja" in r.text.lower()

    def test_telephone_ok_puis_restauration(self, admin_tok):
        # PUT nouveau numéro admin, vérifier 200, puis remettre l'ancien
        nouveau = "0810000099"
        r = requests.put(f"{API}/auth/telephone", json={"telephone": nouveau},
                         headers=_h(admin_tok), timeout=15)
        assert r.status_code == 200, r.text
        assert r.json()["telephone"] == nouveau
        # restore
        r2 = requests.put(f"{API}/auth/telephone", json={"telephone": ADMIN_TEL},
                          headers=_h(admin_tok), timeout=15)
        assert r2.status_code == 200
        assert r2.json()["telephone"] == ADMIN_TEL


# --------------------------------------------------------- NON-REGRESSION LIGHT
def test_non_regression_config():
    r = requests.get(f"{API}/config", timeout=10)
    # Le taux est saisi par l'admin : on verifie qu'il est lu, pas sa valeur.
    assert r.status_code == 200 and r.json()["tauxFC"] > 0


def test_non_regression_produits_sans_base64():
    """Aucun produit ne doit contenir de base64 dans le champ image."""
    r = requests.get(f"{API}/produits", timeout=15)
    assert r.status_code == 200
    for p in r.json():
        img = p.get("image") or ""
        assert "base64" not in img, f"produit {p['nom']} contient du base64 dans image"
        # si image existe, elle doit être une URL courte
        if img:
            assert len(img) < 300
