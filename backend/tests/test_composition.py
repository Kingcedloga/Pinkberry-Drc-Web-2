"""Frozen yogurt compose : tailles (prix de base + supplement), recipients,
categories de garnitures et regle de selection (exactement 3 garnitures seches
+ 3 fruits, nombre configurable par categorie)."""
import os
import uuid

import pytest
import requests
from outils_auth import entetes_superadmin

BASE = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
API = f"{BASE}/api"
CLIENT_TEL = "0990000001"


def _h(tel: str, pwd: str):
    r = requests.post(f"{API}/auth/connexion", json={"telephone": tel, "motDePasse": pwd}, timeout=15)
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


@pytest.fixture(scope="module")
def admin():
    # Ecritures de configuration : reservees au super admin.
    return entetes_superadmin()


@pytest.fixture(scope="module")
def client():
    return _h(CLIENT_TEL, "client123")


@pytest.fixture(scope="module")
def compo():
    r = requests.get(f"{API}/composition", timeout=15)
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture(scope="module")
def yogourt(admin):
    """Produit compose jetable, dans une categorie jetable."""
    r = requests.post(f"{API}/admin/categories", json={"nom": f"TEST_Yog {uuid.uuid4().hex[:6]}", "nomEn": "TEST"},
                      headers=admin, timeout=60)
    cat = r.json()
    r = requests.post(f"{API}/admin/produits", headers=admin, timeout=60, json={
        "nom": "TEST_Yogourt", "nomEn": "TEST_Yogourt", "categorie": cat["nom"], "prix": 0,
        "configurable": True, "disponible": True, "tailles": [{"nom": "x", "ecart": 5}],
    })
    assert r.status_code == 200, r.text
    p = r.json()
    assert p["configurable"] is True and p["prix"] == 0 and p["tailles"] == []  # options ignorees
    yield p
    requests.delete(f"{API}/admin/categories/{cat['id']}", headers=admin, timeout=15)


def _commander(client, admin, produit, taille, contenant, garnitures):
    r = requests.post(f"{API}/commandes", headers=client, timeout=30, json={
        "items": [{"produitId": produit["id"], "nom": produit["nom"], "taille": taille, "contenant": contenant,
                   "garnitures": [{"id": g["id"], "nom": g["nom"]} for g in garnitures], "quantite": 1}],
        "adresse": {"label": "TEST", "commune": "Gombe", "avenue": "TEST", "numero": "1", "repere": "TEST",
                    "telephone": CLIENT_TEL},
    })
    if r.status_code == 200:  # nettoyage : annuler, archiver, supprimer
        cid = r.json()["id"]
        requests.post(f"{API}/commandes/{cid}/annuler", headers=client, json={}, timeout=15)
        requests.post(f"{API}/admin/commandes/bulk/archive", headers=admin, json={"ids": [cid]}, timeout=15)
        requests.delete(f"{API}/admin/commandes/{cid}", headers=admin, timeout=15)
    return r


def _selection(compo, repartition):
    """repartition = nombre de garnitures prises dans chaque categorie successive."""
    choisies = []
    for cat, n in zip(compo["categories"], repartition):
        assert len(cat["garnitures"]) >= n
        choisies += cat["garnitures"][:n]
    return choisies


def test_composition_publique(compo):
    assert [(c["nom"], c["nomEn"], c["nombre"]) for c in compo["categories"]] == [
        ("Garnitures sèches", "Dry toppings", 3), ("Fruits", "Fruits", 3),
    ]
    assert compo["regle"] == {"total": 6}
    # Noms FR / EN (vue admin : inclut les garnitures momentanement desactivees).
    vue_admin = requests.get(f"{API}/admin/composition", headers=entetes_superadmin(), timeout=15).json()
    seches = {(g["nom"], g["nomEn"]) for g in vue_admin["categories"][0]["garnitures"]}
    assert {("Bouchées de brownie", "Brownie bites"), ("Sauce chocolat", "Chocolate sauce"), ("Miel", "Honey")} <= seches
    assert {g["nomEn"] for g in compo["categories"][1]["garnitures"]} >= {"Pomegranate", "Blackberry"}
    assert {t["nom"] for t in compo["tailles"]} >= {"Régulière", "Moyen", "Grand"}
    assert all(c["disponible"] and c["garnitures"] for c in compo["categories"])  # seules les visibles
    assert all(g["disponible"] for c in compo["categories"] for g in c["garnitures"])


def test_prix_sans_et_avec_garnitures(client, admin, yogourt, compo):
    taille = compo["tailles"][0]
    contenant = compo["contenants"][0]["nom"]

    r = _commander(client, admin, yogourt, taille["nom"], contenant, [])
    assert r.status_code == 200, r.text
    ligne = r.json()["items"][0]
    assert ligne["prixUnitaire"] == taille["prixBase"] and ligne["contenant"] == contenant

    r = _commander(client, admin, yogourt, taille["nom"], contenant, _selection(compo, [3, 3]))
    assert r.status_code == 200, r.text
    ligne = r.json()["items"][0]
    assert ligne["prixUnitaire"] == taille["prixBase"] + taille["supplementGarnitures"]
    assert len(ligne["garnitures"]) == 6 and all(g["prix"] == 0 and g["categorie"] for g in ligne["garnitures"])


@pytest.mark.parametrize("repartition", [[3, 2], [3, 0], [4, 2], [2, 4], [4, 3], [3, 4], [6, 0], [0, 6]])
def test_selections_refusees(client, admin, yogourt, compo, repartition):
    # Il faut exactement 3 seches ET 3 fruits : 6 mal repartis ou 4 dans une categorie sont refuses.
    taille, contenant = compo["tailles"][0]["nom"], compo["contenants"][0]["nom"]
    r = _commander(client, admin, yogourt, taille, contenant, _selection(compo, repartition))
    assert r.status_code == 400, r.text


def test_recipient_et_taille_obligatoires(client, admin, yogourt, compo):
    taille = compo["tailles"][0]["nom"]
    assert _commander(client, admin, yogourt, taille, "Inconnu", []).status_code == 400
    assert _commander(client, admin, yogourt, "Inconnue", compo["contenants"][0]["nom"], []).status_code == 400


def test_regle_configurable(client, admin, yogourt):
    initiale = {c["id"]: c["nombre"] for c in requests.get(f"{API}/composition", timeout=15).json()["categories"]}
    seches, fruits = list(initiale)
    try:
        r = requests.put(f"{API}/admin/regle-garnitures", headers=admin, timeout=15,
                         json={"categories": {seches: 2, fruits: 1}})
        assert r.status_code == 200, r.text
        compo = requests.get(f"{API}/composition", timeout=15).json()
        assert [c["nombre"] for c in compo["categories"]] == [2, 1] and compo["regle"] == {"total": 3}
        taille, contenant = compo["tailles"][0]["nom"], compo["contenants"][0]["nom"]
        assert _commander(client, admin, yogourt, taille, contenant, _selection(compo, [2, 1])).status_code == 200
        assert _commander(client, admin, yogourt, taille, contenant, _selection(compo, [3, 3])).status_code == 400
        for invalide in [{seches: -1}, {seches: 21}, {"inconnue": 3}, {}]:
            r = requests.put(f"{API}/admin/regle-garnitures", headers=admin, json={"categories": invalide}, timeout=15)
            assert r.status_code == 400, invalide
    finally:
        requests.put(f"{API}/admin/regle-garnitures", headers=admin, json={"categories": initiale}, timeout=15)


def test_crud_et_disponibilite(admin):
    vue = lambda: requests.get(f"{API}/composition", timeout=15).json()  # noqa: E731
    cat = vue()["categories"][0]

    r = requests.post(f"{API}/admin/garnitures", headers=admin, timeout=60,
                      json={"categorieId": cat["id"], "nom": "TEST_Garniture", "nomEn": "TEST_Topping"})
    assert r.status_code == 200, r.text
    g = r.json()
    try:
        r = requests.put(f"{API}/admin/garnitures/{g['id']}", headers=admin, timeout=60,
                         json={"categorieId": cat["id"], "nom": "TEST_Garniture", "nomEn": "TEST_Topping", "disponible": False})
        assert r.status_code == 200
        assert all(x["id"] != g["id"] for c in vue()["categories"] for x in c["garnitures"])  # masquee
    finally:
        requests.delete(f"{API}/admin/garnitures/{g['id']}", headers=admin, timeout=15)

    try:
        requests.put(f"{API}/admin/categories-garnitures/{cat['id']}", headers=admin, json={"disponible": False}, timeout=15)
        assert all(c["id"] != cat["id"] for c in vue()["categories"])  # categorie entiere masquee
        admin_vue = requests.get(f"{API}/admin/composition", headers=admin, timeout=15).json()
        assert any(c["id"] == cat["id"] and not c["disponible"] for c in admin_vue["categories"])
    finally:
        requests.put(f"{API}/admin/categories-garnitures/{cat['id']}", headers=admin, json={"disponible": True}, timeout=15)

    r = requests.post(f"{API}/admin/tailles", headers=admin, timeout=60,
                      json={"nom": "TEST_Taille", "nomEn": "TEST_Size", "prixBase": 1000.4, "supplementGarnitures": 500})
    assert r.status_code == 200, r.text
    t = r.json()
    assert (t["prixBase"], t["supplementGarnitures"]) == (1000, 500)
    assert requests.delete(f"{API}/admin/tailles/{t['id']}", headers=admin, timeout=15).status_code == 200

    r = requests.post(f"{API}/admin/contenants", headers=admin, timeout=60,
                      json={"nom": "TEST_Pot", "nomEn": "TEST_Pot", "disponible": False})
    c = r.json()
    try:
        assert all(x["id"] != c["id"] for x in vue()["contenants"])
    finally:
        requests.delete(f"{API}/admin/contenants/{c['id']}", headers=admin, timeout=15)


def test_routes_admin_protegees(client):
    assert requests.get(f"{API}/admin/composition", headers=client, timeout=15).status_code in (401, 403)
    r = requests.put(f"{API}/admin/regle-garnitures", headers=client, timeout=15,
                     json={"categories": {}})
    assert r.status_code in (401, 403)
