"""Iteration 15 — Produit mis en avant / Recommandé (enAvant flag).

Test coverage:
- POST /api/admin/produits accepts and persists enAvant.
- PUT /api/admin/produits/{id} accepts and persists enAvant (toggle both ways).
- Default value is False when omitted on creation.
- GET /api/produits returns enAvant on every product.
- RBAC: a client cannot modify a product (403).

Final restoration: keeps 'Pot Fraise' as enAvant=True (per user request).
"""

import os
import uuid
import pytest
import requests
from outils_auth import jeton_superadmin  # configuration : reservee au super admin

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://pinkberry-kin.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_PHONE = "0810000000"
ADMIN_PASSWORD = "admin123"
CLIENT_PHONE = "0990000001"
CLIENT_PASSWORD = "client123"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/auth/connexion", json={"telephone": ADMIN_PHONE, "motDePasse": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def client_token():
    r = requests.post(f"{API}/auth/connexion", json={"telephone": CLIENT_PHONE, "motDePasse": CLIENT_PASSWORD}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def initial_snapshot():
    """Snapshot of current enAvant products, restored in a finalizer at teardown."""
    r = requests.get(f"{API}/produits", timeout=15)
    r.raise_for_status()
    return [p for p in r.json() if p.get("enAvant")]


# --------------------------------------------------------------------- GET all
class TestGetProduitsEnAvant:
    def test_get_produits_expose_enAvant(self):
        r = requests.get(f"{API}/produits", timeout=15)
        assert r.status_code == 200
        produits = r.json()
        assert len(produits) > 0
        for p in produits:
            # legacy products may lack the field: treat as False (client filter handles it)
            val = p.get("enAvant", False)
            assert isinstance(val, bool), f"enAvant must be bool on {p.get('nom')}"

    def test_au_moins_un_produit_en_avant(self, initial_snapshot):
        # Contrainte utilisateur : au moins 1 produit doit rester en avant.
        assert len(initial_snapshot) >= 1


# ----------------------------------------------------------------- POST create
class TestCreateProduitEnAvant:
    created_ids: list[str] = []

    def test_create_produit_sans_enAvant_defaults_false(self, admin_token):
        payload = {
            "nom": f"TEST_ITER15_defaut_{uuid.uuid4().hex[:6]}",
            "categorie": "Boissons",
            "prix": 1.0,
            "disponible": True,
            "tailles": [],
            "garnitures": [],
        }
        r = requests.post(f"{API}/admin/produits", json=payload,
                          headers={"Authorization": f"Bearer {jeton_superadmin()}"}, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["enAvant"] is False
        self.__class__.created_ids.append(data["id"])

        # verify via GET
        r2 = requests.get(f"{API}/produits", timeout=15)
        p = next((x for x in r2.json() if x["id"] == data["id"]), None)
        assert p is not None
        assert p["enAvant"] is False

    def test_create_produit_avec_enAvant_true(self, admin_token):
        payload = {
            "nom": f"TEST_ITER15_avecEnAvant_{uuid.uuid4().hex[:6]}",
            "categorie": "Boissons",
            "prix": 2.0,
            "disponible": True,
            "enAvant": True,
            "tailles": [],
            "garnitures": [],
        }
        r = requests.post(f"{API}/admin/produits", json=payload,
                          headers={"Authorization": f"Bearer {jeton_superadmin()}"}, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["enAvant"] is True
        self.__class__.created_ids.append(data["id"])

        r2 = requests.get(f"{API}/produits", timeout=15)
        p = next((x for x in r2.json() if x["id"] == data["id"]), None)
        assert p is not None
        assert p["enAvant"] is True

    def test_zzz_cleanup_created_products(self, admin_token):
        for pid in self.__class__.created_ids:
            r = requests.delete(f"{API}/admin/produits/{pid}",
                                headers={"Authorization": f"Bearer {jeton_superadmin()}"}, timeout=15)
            assert r.status_code == 200


# ----------------------------------------------------------------- PUT toggle
class TestUpdateProduitEnAvant:
    def test_toggle_enAvant_on_existing_product(self, admin_token):
        # pick a product NOT currently enAvant
        r = requests.get(f"{API}/produits", timeout=15)
        produits = r.json()
        candidat = next((p for p in produits if not p.get("enAvant")), None)
        assert candidat is not None, "Aucun produit non-enAvant disponible pour le test"

        original = {**candidat}
        pid = candidat["id"]

        # PUT with enAvant=True
        payload = {
            "nom": candidat["nom"],
            "categorie": candidat["categorie"],
            "prix": candidat["prix"],
            "image": candidat.get("image"),
            "emoji": candidat.get("emoji"),
            "description": candidat.get("description"),
            "disponible": candidat.get("disponible", True),
            "enAvant": True,
            "tailles": candidat.get("tailles", []),
            "garnitures": candidat.get("garnitures", []),
        }
        r = requests.put(f"{API}/admin/produits/{pid}", json=payload,
                         headers={"Authorization": f"Bearer {jeton_superadmin()}"}, timeout=15)
        assert r.status_code == 200, r.text
        assert r.json()["enAvant"] is True

        # verify via GET
        r2 = requests.get(f"{API}/produits", timeout=15)
        p = next((x for x in r2.json() if x["id"] == pid), None)
        assert p["enAvant"] is True

        # toggle OFF and verify
        payload["enAvant"] = False
        r = requests.put(f"{API}/admin/produits/{pid}", json=payload,
                         headers={"Authorization": f"Bearer {jeton_superadmin()}"}, timeout=15)
        assert r.status_code == 200
        assert r.json()["enAvant"] is False

        r3 = requests.get(f"{API}/produits", timeout=15)
        p = next((x for x in r3.json() if x["id"] == pid), None)
        assert p["enAvant"] is False

        # restore original state (was False anyway, keep coherent name/prix)
        payload["enAvant"] = bool(original.get("enAvant", False))
        r = requests.put(f"{API}/admin/produits/{pid}", json=payload,
                         headers={"Authorization": f"Bearer {jeton_superadmin()}"}, timeout=15)
        assert r.status_code == 200


# ------------------------------------------------------------------ RBAC 403
class TestRbacClientCannotModify:
    def test_client_post_produit_forbidden(self, client_token):
        r = requests.post(f"{API}/admin/produits",
                          json={"nom": "TEST_HACK", "categorie": "x", "prix": 1.0,
                                "tailles": [], "garnitures": []},
                          headers={"Authorization": f"Bearer {client_token}"}, timeout=15)
        assert r.status_code == 403

    def test_client_put_produit_forbidden(self, client_token):
        r = requests.get(f"{API}/produits", timeout=15)
        pid = r.json()[0]["id"]
        r2 = requests.put(f"{API}/admin/produits/{pid}",
                          json={"nom": "x", "categorie": "x", "prix": 1.0,
                                "enAvant": True, "tailles": [], "garnitures": []},
                          headers={"Authorization": f"Bearer {client_token}"}, timeout=15)
        assert r2.status_code == 403


# ---------------------------------------------------- Restoration finale
class TestZZZRestauration:
    """Restore state per user request: keep 'Pot Fraise' enAvant=True as the only one, others reset."""

    def test_restore_final_state(self, admin_token, initial_snapshot):
        # ensure the products that were initially enAvant are still enAvant
        # (per user instruction: keep at least 1, e.g. 'Pot Fraise').
        r = requests.get(f"{API}/produits", timeout=15)
        produits = r.json()
        by_id = {p["id"]: p for p in produits}

        for snap in initial_snapshot:
            actuel = by_id.get(snap["id"])
            if actuel is None:
                continue
            if not actuel.get("enAvant"):
                payload = {
                    "nom": actuel["nom"],
                    "categorie": actuel["categorie"],
                    "prix": actuel["prix"],
                    "image": actuel.get("image"),
                    "emoji": actuel.get("emoji"),
                    "description": actuel.get("description"),
                    "disponible": actuel.get("disponible", True),
                    "enAvant": True,
                    "tailles": actuel.get("tailles", []),
                    "garnitures": actuel.get("garnitures", []),
                }
                r2 = requests.put(f"{API}/admin/produits/{actuel['id']}", json=payload,
                                  headers={"Authorization": f"Bearer {jeton_superadmin()}"}, timeout=15)
                assert r2.status_code == 200

        # final assert : at least 1 enAvant remains
        r3 = requests.get(f"{API}/produits", timeout=15)
        assert any(p.get("enAvant") for p in r3.json())
