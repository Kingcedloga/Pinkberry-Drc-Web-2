"""Traductions anglaises du catalogue saisi par l'admin (champs `nomEn`, ...).

Les assertions n'utilisent que le glossaire (catalogue de demo) ou des
traductions saisies a la main : elles ne dependent pas de la reponse du LLM.
"""
import os
import uuid

import requests
from outils_auth import entetes_superadmin

BASE = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
API = f"{BASE}/api"

CLIENT_TEL = "0990000001"
CLIENT_PWD = "client123"
ADMIN_TEL = "0810000000"
ADMIN_PWD = "admin123"


def _h(tel: str, pwd: str):
    r = requests.post(f"{API}/auth/connexion", json={"telephone": tel, "motDePasse": pwd}, timeout=15)
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


def _produit(admin, **extra):
    categorie = requests.get(f"{API}/admin/categories", headers=admin, timeout=15).json()[0]["nom"]
    body = {
        "nom": f"TEST_Produit {uuid.uuid4().hex[:6]}",
        "nomEn": "TEST English name",
        "categorie": categorie,
        "prix": 3,
        "description": "",
        "tailles": [{"nom": "Régulier", "ecart": 0}],
        "garnitures": [{"nom": "Mochi", "prix": 1, "nomEn": "Mochi bites"}],
        **extra,
    }
    r = requests.post(f"{API}/admin/produits", json=body, headers=admin, timeout=60)
    assert r.status_code == 200, r.text
    return body, r.json()


def test_creation_complete_les_champs_vides_et_garde_la_saisie():
    admin = entetes_superadmin()
    _, p = _produit(admin)
    try:
        assert p["nomEn"] == "TEST English name"
        assert p["tailles"][0]["nomEn"] == "Regular"  # glossaire
        assert p["garnitures"][0]["nomEn"] == "Mochi bites"  # saisie conservee
        assert p["descriptionEn"] is None  # rien a traduire

        catalogue = requests.get(f"{API}/produits", timeout=15).json()
        publie = next(x for x in catalogue if x["id"] == p["id"])
        assert "categorieEn" in publie
    finally:
        requests.delete(f"{API}/admin/produits/{p['id']}", headers=admin, timeout=15)


def test_renommage_fr_invalide_la_traduction_non_modifiee():
    admin = entetes_superadmin()
    body, p = _produit(admin)
    try:
        maj = {
            **body,
            "nom": body["nom"] + " bis",
            "nomEn": p["nomEn"],  # renvoye tel quel : perime
            "tailles": [{"nom": "Grand", "ecart": 0, "nomEn": "Regular"}],  # renommee sans toucher l'EN
            "garnitures": [{"nom": "Mochi", "prix": 1, "nomEn": "Mochi balls"}],  # correction manuelle
        }
        r = requests.put(f"{API}/admin/produits/{p['id']}", json=maj, headers=admin, timeout=60)
        assert r.status_code == 200, r.text
        p2 = r.json()
        assert p2["nomEn"] != "TEST English name"
        assert p2["tailles"][0]["nomEn"] == "Large"
        assert p2["garnitures"][0]["nomEn"] == "Mochi balls"
    finally:
        requests.delete(f"{API}/admin/produits/{p['id']}", headers=admin, timeout=15)


def test_commande_copie_les_libelles_anglais():
    admin = entetes_superadmin()
    client = _h(CLIENT_TEL, CLIENT_PWD)
    _, p = _produit(admin)
    cmd_id = None
    try:
        r = requests.post(
            f"{API}/commandes",
            headers=client,
            timeout=30,
            json={
                "items": [{"produitId": p["id"], "nom": p["nom"], "taille": "Régulier", "garnitures": [{"nom": "Mochi"}],
                           "quantite": 1, "prixUnitaire": 0}],
                "adresse": {"label": "TEST", "commune": "Gombe", "avenue": "TEST", "numero": "1", "repere": "TEST",
                            "telephone": CLIENT_TEL},
            },
        )
        assert r.status_code == 200, r.text
        cmd_id = r.json()["id"]
        ligne = r.json()["items"][0]
        assert ligne["nomEn"] == "TEST English name"
        assert ligne["tailleEn"] == "Regular"
        assert ligne["garnitures"][0]["nomEn"] == "Mochi bites"
    finally:
        if cmd_id:
            requests.post(f"{API}/commandes/{cmd_id}/annuler", headers=client, json={}, timeout=15)
            requests.post(f"{API}/admin/commandes/bulk/archive", headers=admin, json={"ids": [cmd_id]}, timeout=15)
            requests.delete(f"{API}/admin/commandes/{cmd_id}", headers=admin, timeout=15)
        requests.delete(f"{API}/admin/produits/{p['id']}", headers=admin, timeout=15)


def test_categories_details_et_traduction_manuelle():
    admin = entetes_superadmin()
    noms = requests.get(f"{API}/categories", timeout=15).json()
    assert noms[0] == "Tous"  # format historique inchange

    details = requests.get(f"{API}/categories", params={"details": "true"}, timeout=15).json()
    assert all(set(c) == {"nom", "nomEn", "sousCategories"} for c in details)

    r = requests.post(f"{API}/admin/categories", json={"nom": f"TEST_Cat {uuid.uuid4().hex[:6]}", "nomEn": "TEST Cat"},
                      headers=admin, timeout=60)
    assert r.status_code == 200, r.text
    cat = r.json()
    try:
        assert cat["nomEn"] == "TEST Cat"
        r = requests.put(f"{API}/admin/categories/{cat['id']}", json={"nomEn": "TEST Category"}, headers=admin, timeout=60)
        assert r.status_code == 200, r.text
        assert r.json()["nomEn"] == "TEST Category"
    finally:
        requests.delete(f"{API}/admin/categories/{cat['id']}", headers=admin, timeout=15)


def test_sous_categories_et_prix_en_fc():
    admin = entetes_superadmin()
    r = requests.post(f"{API}/admin/categories", json={"nom": f"TEST_Cat {uuid.uuid4().hex[:6]}", "nomEn": "TEST Cat"},
                      headers=admin, timeout=60)
    assert r.status_code == 200, r.text
    cat = r.json()
    p = None
    try:
        r = requests.put(f"{API}/admin/categories/{cat['id']}", headers=admin, timeout=60,
                         json={"sousCategories": [{"nom": "Slush", "nomEn": "Slush"}, {"nom": "slush"}, {"nom": "x"}]})
        assert r.status_code == 200, r.text
        assert r.json()["sousCategories"] == [{"nom": "Slush", "nomEn": "Slush"}]  # doublon et trop court ecartes

        _, p = _produit(admin, categorie=cat["nom"], sousCategorie="Slush", prix=7000.4,
                        tailles=[{"nom": "Moyen", "ecart": 999.6}], garnitures=[])
        assert (p["prix"], p["tailles"][0]["ecart"]) == (7000, 1000)  # FC entiers
        publie = next(x for x in requests.get(f"{API}/produits", timeout=15).json() if x["id"] == p["id"])
        assert publie["sousCategorieEn"] == "Slush"

        r = requests.post(f"{API}/admin/produits", headers=admin, timeout=60,
                          json={"nom": "TEST_x", "categorie": cat["nom"], "prix": 1, "sousCategorie": "Inconnue"})
        assert r.status_code == 400

        # Retirer la sous-categorie laisse le produit dans la categorie, sans section.
        requests.put(f"{API}/admin/categories/{cat['id']}", json={"sousCategories": []}, headers=admin, timeout=60)
        publie = next(x for x in requests.get(f"{API}/produits", timeout=15).json() if x["id"] == p["id"])
        assert publie["sousCategorie"] is None
    finally:
        requests.delete(f"{API}/admin/categories/{cat['id']}", headers=admin, timeout=15)


def test_traduire_exige_un_admin():
    client = _h(CLIENT_TEL, CLIENT_PWD)
    r = requests.post(f"{API}/admin/traduire", json={"textes": ["Régulier"]}, headers=client, timeout=15)
    assert r.status_code in (401, 403)
