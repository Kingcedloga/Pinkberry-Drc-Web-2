"""Iteration 7 backend tests: superadmin unique, suppression compte client,
CRUD categories (admin)."""
import os
import uuid
from datetime import datetime, timedelta, timezone

import jwt
import pytest
import requests

BASE_URL = (os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get("EXPO_BACKEND_URL", "")).rstrip("/")
API = f"{BASE_URL}/api"
JWT_SECRET = "pinkberry-drc-secret-2026-kinshasa"
SUPERADMIN_EMAIL = "mecedloga@gmail.com"


def _login(tel: str, mdp: str) -> str:
    r = requests.post(f"{API}/auth/connexion", json={"telephone": tel, "motDePasse": mdp}, timeout=15)
    assert r.status_code == 200, f"login {tel} -> {r.status_code} {r.text}"
    return r.json()["token"]


def _h(tok):
    return {"Authorization": f"Bearer {tok}"}


def _forge_token(sub_id: str) -> str:
    return jwt.encode(
        {"sub": sub_id, "exp": datetime.now(timezone.utc) + timedelta(days=1)},
        JWT_SECRET, algorithm="HS256"
    )


@pytest.fixture(scope="module")
def super_id():
    """Retrieve the id of the seeded superadmin via a temporarily-promoted admin."""
    # login admin to hit /auth/moi and find IDs; but we need superadmin id from DB.
    # Use MongoDB directly via a special helper endpoint? We don't have one.
    # Instead: forge a JWT for each candidate admin, or... use motor sync via pymongo.
    from pymongo import MongoClient
    c = MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
    db = c[os.environ.get("DB_NAME", "test_database")]
    u = db.users.find_one({"email": SUPERADMIN_EMAIL, "role": "superadmin"}, {"_id": 0, "id": 1})
    assert u, "Superadmin not seeded"
    return u["id"]


@pytest.fixture(scope="module")
def tokens(super_id):
    return {
        "super": _forge_token(super_id),
        "admin": _login("0810000000", "admin123"),
        "livreur": _login("0820000001", "livreur123"),
        "client": _login("0990000001", "client123"),
    }


# ================================================== SUPER ADMIN UNIQUE
class TestSuperadminUnique:
    def test_ancien_compte_0800000000_absent(self):
        r = requests.post(f"{API}/auth/connexion",
                          json={"telephone": "0800000000", "motDePasse": "super123"}, timeout=15)
        assert r.status_code == 401

    def test_forged_jwt_super_ok(self, tokens):
        r = requests.get(f"{API}/superadmin/comptes", headers=_h(tokens["super"]), timeout=15)
        assert r.status_code == 200

    def test_admin_normal_refuse_superadmin(self, tokens):
        r = requests.get(f"{API}/superadmin/comptes", headers=_h(tokens["admin"]), timeout=15)
        assert r.status_code == 403

    def test_un_seul_superadmin_en_base(self):
        from pymongo import MongoClient
        c = MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
        db = c[os.environ.get("DB_NAME", "test_database")]
        n = db.users.count_documents({"role": "superadmin"})
        assert n == 1
        u = db.users.find_one({"role": "superadmin"}, {"_id": 0})
        assert u["email"] == SUPERADMIN_EMAIL
        assert u.get("actif") is True
        assert u.get("verifie") is True
        assert u.get("telephone") == "+243992113682"


# ================================================== DELETE /api/auth/moi
class TestSuppressionCompte:
    def _create_verified_client(self):
        tel = f"0995{uuid.uuid4().int % 1000000:06d}"[:10]
        r = requests.post(f"{API}/auth/inscription",
                          json={"nom": "TEST_Suppr", "telephone": tel, "motDePasse": "abcdef"},
                          timeout=15)
        assert r.status_code == 200, r.text
        code = r.json()["codeDemo"]
        r2 = requests.post(f"{API}/auth/verifier-otp",
                           json={"telephone": tel, "code": code}, timeout=15)
        assert r2.status_code == 200, r2.text
        return tel, r2.json()["token"], r2.json()["user"]["id"]

    def test_suppression_client_anonymise_commandes(self):
        tel, tok, uid = self._create_verified_client()

        # Passer une commande
        cmd_payload = {
            "adresse": {"label": "TEST", "commune": "Gombe", "avenue": "Ave A", "numero": "1",
                        "repere": "porte rose", "telephone": tel, "lat": -4.3, "lng": 15.3},
            "items": [{"produitId": "p1", "nom": "Pot Original", "taille": "Petit",
                       "garnitures": [], "quantite": 1, "prixUnitaire": 4.5}],
        }
        r = requests.post(f"{API}/commandes", headers=_h(tok), json=cmd_payload, timeout=15)
        assert r.status_code == 200, r.text
        cmd_id = r.json()["id"]

        # DELETE /api/auth/moi
        r2 = requests.delete(f"{API}/auth/moi", headers=_h(tok), timeout=15)
        assert r2.status_code == 200, r2.text

        # User supprimé
        r3 = requests.post(f"{API}/auth/connexion",
                           json={"telephone": tel, "motDePasse": "abcdef"}, timeout=15)
        assert r3.status_code == 401
        r4 = requests.get(f"{API}/auth/moi", headers=_h(tok), timeout=15)
        assert r4.status_code == 401

        # Commande anonymisée
        from pymongo import MongoClient
        c = MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
        db = c[os.environ.get("DB_NAME", "test_database")]
        cmd = db.commandes.find_one({"id": cmd_id}, {"_id": 0})
        assert cmd is not None, "commande supprimée par erreur"
        assert cmd["userId"] == "anonyme"
        assert cmd["clientNom"] == "Client supprime"
        assert cmd.get("clientTelephone") is None
        assert cmd["adresse"].get("telephone") is None
        assert cmd.get("anonymisee") is True

        # Adresses supprimées
        assert db.adresses.count_documents({"userId": uid}) == 0

        # Nettoyage : supprimer la commande de test
        db.commandes.delete_one({"id": cmd_id})

    def test_admin_ne_peut_pas_supprimer_son_compte(self, tokens):
        r = requests.delete(f"{API}/auth/moi", headers=_h(tokens["admin"]), timeout=15)
        assert r.status_code == 403

    def test_livreur_ne_peut_pas_supprimer_son_compte(self, tokens):
        r = requests.delete(f"{API}/auth/moi", headers=_h(tokens["livreur"]), timeout=15)
        assert r.status_code == 403

    def test_superadmin_ne_peut_pas_supprimer_son_compte(self, tokens):
        r = requests.delete(f"{API}/auth/moi", headers=_h(tokens["super"]), timeout=15)
        assert r.status_code == 403

    def test_sans_jeton_401(self):
        r = requests.delete(f"{API}/auth/moi", timeout=15)
        assert r.status_code == 401


# ================================================== CATEGORIES
class TestCategoriesPublic:
    def test_get_categories_public(self):
        r = requests.get(f"{API}/categories", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert data[0] == "Tous"
        assert "Pots de crème" in data
        # Trié après 'Tous'
        assert data[1:] == sorted(data[1:])


class TestCategoriesAdmin:
    def test_get_admin_categories_avec_nb_produits(self, tokens):
        r = requests.get(f"{API}/admin/categories", headers=_h(tokens["admin"]), timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert all("id" in c and "nom" in c and "nbProduits" in c for c in data)
        pots = next(c for c in data if c["nom"] == "Pots de crème")
        assert pots["nbProduits"] > 0

    def test_rbac_admin_categories(self, tokens):
        # Sans token
        r = requests.get(f"{API}/admin/categories", timeout=15)
        assert r.status_code in (401, 403)
        r = requests.post(f"{API}/admin/categories", json={"nom": "X"}, timeout=15)
        assert r.status_code in (401, 403)
        # client 403
        assert requests.get(f"{API}/admin/categories", headers=_h(tokens["client"]),
                            timeout=15).status_code == 403
        assert requests.post(f"{API}/admin/categories", headers=_h(tokens["client"]),
                             json={"nom": "TEST_x"}, timeout=15).status_code == 403
        # livreur 403
        assert requests.get(f"{API}/admin/categories", headers=_h(tokens["livreur"]),
                            timeout=15).status_code == 403

    def test_creer_valide_puis_liste(self, tokens):
        h = _h(tokens["admin"])
        nom = f"TEST_Cat_{uuid.uuid4().hex[:6]}"
        r = requests.post(f"{API}/admin/categories", headers=h, json={"nom": nom}, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["nom"] == nom
        assert data["nbProduits"] == 0
        cat_id = data["id"]
        try:
            # Apparaît dans public /categories
            pub = requests.get(f"{API}/categories", timeout=15).json()
            assert nom in pub
            # Apparaît dans /admin/categories
            adm = requests.get(f"{API}/admin/categories", headers=h, timeout=15).json()
            assert any(c["id"] == cat_id for c in adm)
        finally:
            r = requests.delete(f"{API}/admin/categories/{cat_id}", headers=h, timeout=15)
            assert r.status_code == 200

    def test_creer_validation_erreurs(self, tokens):
        h = _h(tokens["admin"])
        # trop court
        r = requests.post(f"{API}/admin/categories", headers=h, json={"nom": "A"}, timeout=15)
        assert r.status_code == 400
        # "Tous"
        r = requests.post(f"{API}/admin/categories", headers=h, json={"nom": "Tous"}, timeout=15)
        assert r.status_code == 400
        # doublon insensible à la casse
        r = requests.post(f"{API}/admin/categories", headers=h, json={"nom": "boissons"}, timeout=15)
        assert r.status_code == 400

    def test_supprimer_avec_produits(self, tokens):
        h = _h(tokens["admin"])
        # créer cat de test avec produit
        nom = f"TEST_CatSupp_{uuid.uuid4().hex[:6]}"
        r = requests.post(f"{API}/admin/categories", headers=h, json={"nom": nom}, timeout=15)
        assert r.status_code == 200
        cat_id = r.json()["id"]

        p = requests.post(f"{API}/admin/produits", headers=h,
                          json={"nom": "TEST_ProduitCat", "categorie": nom, "prix": 3.0,
                                "emoji": "🧪"}, timeout=15)
        assert p.status_code == 200
        prod_id = p.json()["id"]

        # DELETE
        r2 = requests.delete(f"{API}/admin/categories/{cat_id}", headers=h, timeout=15)
        assert r2.status_code == 200
        assert r2.json()["produitsSupprimes"] == 1

        # produit et cat disparus
        produits = requests.get(f"{API}/produits", timeout=15).json()
        assert not any(p.get("id") == prod_id for p in produits)
        cats = requests.get(f"{API}/admin/categories", headers=h, timeout=15).json()
        assert not any(c["id"] == cat_id for c in cats)

    def test_supprimer_404(self, tokens):
        h = _h(tokens["admin"])
        r = requests.delete(f"{API}/admin/categories/id-inexistant", headers=h, timeout=15)
        assert r.status_code == 404

    def test_supprimer_rbac(self, tokens):
        # sans token
        assert requests.delete(f"{API}/admin/categories/xx", timeout=15).status_code in (401, 403)
        assert requests.delete(f"{API}/admin/categories/xx", headers=_h(tokens["client"]),
                               timeout=15).status_code == 403
        assert requests.delete(f"{API}/admin/categories/xx", headers=_h(tokens["livreur"]),
                               timeout=15).status_code == 403
