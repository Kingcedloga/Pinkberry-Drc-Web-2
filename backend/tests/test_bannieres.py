"""Bannieres de l'accueil : upload recadre au ratio 3:1, gestion admin, affichage client.

Les bannieres de test sont programmees dans le futur (invisibles des clients),
sauf la verification d'affichage, qui ne dure que le temps d'une requete.
"""
import io
import os
import uuid
from datetime import datetime, timedelta, timezone

import pytest
import requests
from PIL import Image

BASE = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
API = f"{BASE}/api"


def _h(tel: str, pwd: str):
    r = requests.post(f"{API}/auth/connexion", json={"telephone": tel, "motDePasse": pwd}, timeout=15)
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


@pytest.fixture(scope="module")
def admin():
    return _h("0810000000", "admin123")


@pytest.fixture(scope="module")
def client():
    return _h("0990000001", "client123")


def _image(largeur, hauteur, fmt="PNG"):
    tampon = io.BytesIO()
    Image.new("RGB", (largeur, hauteur), (230, 21, 111)).save(tampon, format=fmt)
    return tampon.getvalue()


def _envoyer(entetes, contenu, mime="image/png", **cadre):
    return requests.post(f"{API}/admin/bannieres/image", headers=entetes, timeout=60,
                         files={"file": ("affiche", contenu, mime)}, data={k: str(v) for k, v in cadre.items()})


def _taille(url):
    r = requests.get(f"{BASE}{url}", timeout=30)
    assert r.status_code == 200
    with Image.open(io.BytesIO(r.content)) as img:
        return img.size, img.format


def _futur(heures=48):
    return (datetime.now(timezone.utc) + timedelta(hours=heures)).isoformat()


@pytest.fixture
def bannieres(admin):
    creees = []

    def creer(**champs):
        body = {"titre": "TEST Affiche", "titreEn": "TEST Poster", "dateDebut": _futur(), **champs}
        r = requests.post(f"{API}/admin/bannieres", json=body, headers=admin, timeout=60)
        assert r.status_code == 200, r.text
        creees.append(r.json()["id"])
        return r.json()

    yield creer
    for bid in creees:
        requests.delete(f"{API}/admin/bannieres/{bid}", headers=admin, timeout=15)


def test_seul_l_admin_gere_les_bannieres(client):
    assert requests.get(f"{API}/admin/bannieres", headers=client, timeout=15).status_code in (401, 403)
    assert requests.post(f"{API}/admin/bannieres", headers=client, json={}, timeout=15).status_code in (401, 403)
    assert _envoyer(client, _image(1200, 400)).status_code in (401, 403)


def test_recadrage_au_ratio_exact_et_variantes(admin):
    # Photo 4:3 avec un cadre choisi (et un h fantaisiste) : sortie toujours en 3:1.
    r = _envoyer(admin, _image(2400, 1800, "JPEG"), mime="image/jpeg", x=0, y=300, w=2400, h=999)
    assert r.status_code == 200, r.text
    corps = r.json()
    assert corps["basseResolution"] is False
    assert _taille(corps["imageUrl"]) == ((1800, 600), "WEBP")
    assert _taille(corps["imageMobileUrl"]) == ((1200, 400), "WEBP")

    # Sans cadre : recadrage centre ; image trop petite signalee.
    r = _envoyer(admin, _image(900, 900))
    assert r.status_code == 200 and r.json()["basseResolution"] is True
    assert _taille(r.json()["imageUrl"])[0] == (1800, 600)


def test_formats_refuses(admin):
    assert _envoyer(admin, b"%PDF-1.4", mime="application/pdf").status_code == 400
    assert _envoyer(admin, b"pas une image", mime="image/png").status_code == 400


def test_validations(admin):
    invalides = [
        {"couleurTexte": "rouge"},
        {"lienType": "produit", "lienValeur": "inconnu"},
        {"lienType": "promotion", "lienValeur": "inconnue"},
        {"imageUrl": "https://ailleurs.test/image.png"},
        {"dateDebut": _futur(48), "dateFin": _futur(24)},
    ]
    for body in invalides:
        assert requests.post(f"{API}/admin/bannieres", json=body, headers=admin, timeout=60).status_code == 400, body


def test_visibilite_dates_actif_et_ordre(admin, bannieres):
    publiques = lambda: [b["id"] for b in requests.get(f"{API}/bannieres", timeout=15).json()]  # noqa: E731
    future = bannieres(couleurTexte="#2A1721", positionTexte="centre")
    assert future["statut"] == "programmee" and future["id"] not in publiques()

    seconde = bannieres()
    requests.put(f"{API}/admin/bannieres/ordre", headers=admin, json={"ids": [seconde["id"], future["id"]]}, timeout=15)
    ordre = [b["id"] for b in requests.get(f"{API}/admin/bannieres", headers=admin, timeout=15).json()]
    assert ordre.index(seconde["id"]) < ordre.index(future["id"])

    # Rendue visible le temps d'une verification, puis desactivee.
    r = requests.put(f"{API}/admin/bannieres/{future['id']}", headers=admin, timeout=60,
                     json={"titre": "TEST Affiche", "couleurTexte": "#2A1721", "positionTexte": "centre"})
    assert r.json()["statut"] == "active"
    try:
        assert future["id"] in publiques()
    finally:
        requests.patch(f"{API}/admin/bannieres/{future['id']}/actif", headers=admin, json={"actif": False}, timeout=15)
    assert future["id"] not in publiques()


def test_traduction_et_lien_resolu(admin, bannieres):
    cat = requests.get(f"{API}/admin/categories", headers=admin, timeout=15).json()[0]["nom"]
    b = bannieres(titre="TEST Affiche", titreEn=None, lienType="categorie", lienValeur=cat)
    assert b["titreEn"]  # traduit automatiquement
    assert b["lien"] == {"type": "categorie", "valeur": cat}
