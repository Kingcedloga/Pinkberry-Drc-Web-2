"""Changement rapide de l'etat des produits (disponible / recommande) depuis la liste admin."""
import os
import uuid

import pytest
import requests
from outils_auth import entetes_superadmin

BASE = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
API = f"{BASE}/api"


def _h(tel: str, pwd: str):
    r = requests.post(f"{API}/auth/connexion", json={"telephone": tel, "motDePasse": pwd}, timeout=15)
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


@pytest.fixture(scope="module")
def admin():
    # Ecritures de configuration : reservees au super admin.
    return entetes_superadmin()


@pytest.fixture(scope="module")
def produits(admin):
    """Categorie jetable avec un produit a 7 000 FC et un a 0 FC (prix a saisir)."""
    r = requests.post(f"{API}/admin/categories", json={"nom": f"TEST_Etat {uuid.uuid4().hex[:6]}", "nomEn": "TEST"},
                      headers=admin, timeout=60)
    assert r.status_code == 200, r.text
    cat = r.json()
    creer = lambda nom, prix: requests.post(  # noqa: E731
        f"{API}/admin/produits", headers=admin, timeout=60,
        json={"nom": nom, "nomEn": nom, "categorie": cat["nom"], "prix": prix, "disponible": False},
    ).json()
    yield {"payant": creer("TEST_Payant", 7000), "gratuit": creer("TEST_Gratuit", 0)}
    requests.delete(f"{API}/admin/categories/{cat['id']}", headers=admin, timeout=15)


def _etat(pid):
    return next(p for p in requests.get(f"{API}/produits", timeout=15).json() if p["id"] == pid)


def test_bascule_unitaire(admin, produits):
    pid = produits["payant"]["id"]
    r = requests.patch(f"{API}/admin/produits/{pid}/etat", json={"disponible": True}, headers=admin, timeout=15)
    assert r.status_code == 200, r.text
    r = requests.patch(f"{API}/admin/produits/{pid}/etat", json={"enAvant": True}, headers=admin, timeout=15)
    assert r.status_code == 200, r.text
    assert (_etat(pid)["disponible"], _etat(pid)["enAvant"]) == (True, True)  # champ absent inchange


def test_produit_a_zero_fc_reste_en_rupture(admin, produits):
    pid = produits["gratuit"]["id"]
    r = requests.patch(f"{API}/admin/produits/{pid}/etat", json={"disponible": True}, headers=admin, timeout=15)
    assert r.status_code == 400
    assert _etat(pid)["disponible"] is False
    # Meme regle a l'enregistrement du formulaire.
    p = produits["gratuit"]
    r = requests.put(f"{API}/admin/produits/{pid}", headers=admin, timeout=60,
                     json={"nom": p["nom"], "categorie": p["categorie"], "prix": 0, "disponible": True})
    assert r.status_code == 400


def test_bascule_groupee_ignore_les_produits_a_zero_fc(admin, produits):
    ids = [produits["payant"]["id"], produits["gratuit"]["id"]]
    r = requests.post(f"{API}/admin/produits/bulk/etat", json={"ids": ids, "disponible": False}, headers=admin, timeout=15)
    assert r.status_code == 200, r.text
    assert r.json()["updated_count"] == 2

    r = requests.post(f"{API}/admin/produits/bulk/etat", json={"ids": ids, "disponible": True}, headers=admin, timeout=15)
    assert r.status_code == 200, r.text
    assert r.json()["updated_count"] == 1
    assert r.json()["ignores"] == ["TEST_Gratuit"]
    assert _etat(ids[0])["disponible"] is True and _etat(ids[1])["disponible"] is False


def test_requete_sans_changement_ou_non_admin(admin, produits):
    pid = produits["payant"]["id"]
    assert requests.patch(f"{API}/admin/produits/{pid}/etat", json={}, headers=admin, timeout=15).status_code == 400
    client = _h("0990000001", "client123")
    r = requests.patch(f"{API}/admin/produits/{pid}/etat", json={"enAvant": False}, headers=client, timeout=15)
    assert r.status_code in (401, 403)
