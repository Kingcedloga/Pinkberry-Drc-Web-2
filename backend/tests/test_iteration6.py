"""Iteration 6 backend tests: super admin RBAC + personnel CRUD.

Iter7 update: superadmin unique via Google (no app password). We forge a JWT
using JWT_SECRET to authenticate as superadmin in these tests."""
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


# -------- helpers auth --------
def _login(tel: str, mdp: str) -> str:
    r = requests.post(f"{API}/auth/connexion", json={"telephone": tel, "motDePasse": mdp}, timeout=15)
    assert r.status_code == 200, f"login {tel} -> {r.status_code} {r.text}"
    return r.json()["token"]


def _h(tok: str) -> dict:
    return {"Authorization": f"Bearer {tok}"}


def _forge_super() -> str:
    from pymongo import MongoClient
    c = MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
    db = c[os.environ.get("DB_NAME", "test_database")]
    u = db.users.find_one({"email": SUPERADMIN_EMAIL, "role": "superadmin"}, {"_id": 0})
    assert u, "Superadmin not seeded"
    return jwt.encode(
        {"sub": u["id"], "exp": datetime.now(timezone.utc) + timedelta(days=1)},
        JWT_SECRET, algorithm="HS256"
    )


@pytest.fixture(scope="module")
def tokens() -> dict:
    return {
        "super": _forge_super(),
        "admin": _login("0810000000", "admin123"),
        "livreur": _login("0820000001", "livreur123"),
        "client": _login("0990000001", "client123"),
    }


# ============================================================ RBAC serveur
class TestRbacSuperAdminRoutes:
    """Toutes les routes /api/superadmin/* + POST/DELETE /api/admin/livreurs."""

    ROUTES_SUPER = [
        ("GET", "/superadmin/comptes"),
        ("PATCH", "/superadmin/comptes/inexistant/actif", {"actif": False}),
        ("DELETE", "/superadmin/comptes/inexistant"),
    ]

    def _call(self, method: str, path: str, token: str, body=None):
        url = f"{API}{path}"
        return requests.request(method, url, headers=_h(token), json=body, timeout=15)

    def test_sans_jeton_401(self):
        r = requests.get(f"{API}/superadmin/comptes", timeout=15)
        assert r.status_code in (401, 403)
        r2 = requests.post(f"{API}/admin/livreurs", json={"nom": "x", "telephone": "0821111111"}, timeout=15)
        assert r2.status_code in (401, 403)

    def test_admin_normal_403_partout(self, tokens):
        assert self._call("GET", "/superadmin/comptes", tokens["admin"]).status_code == 403
        r = self._call("POST", "/superadmin/admins", tokens["admin"],
                       {"nom": "x", "telephone": "0812222222", "motDePasse": "pass123"})
        assert r.status_code == 403
        r = requests.post(f"{API}/admin/livreurs", headers=_h(tokens["admin"]),
                          json={"nom": "x", "telephone": "0821111112", "motDePasse": "livreur123"}, timeout=15)
        assert r.status_code == 403
        r = requests.delete(f"{API}/admin/livreurs/xx", headers=_h(tokens["admin"]), timeout=15)
        assert r.status_code == 403

    def test_livreur_403(self, tokens):
        assert self._call("GET", "/superadmin/comptes", tokens["livreur"]).status_code == 403
        r = requests.post(f"{API}/admin/livreurs", headers=_h(tokens["livreur"]),
                          json={"nom": "x", "telephone": "0821111113", "motDePasse": "abc"}, timeout=15)
        assert r.status_code == 403

    def test_client_403(self, tokens):
        assert self._call("GET", "/superadmin/comptes", tokens["client"]).status_code == 403
        r = requests.get(f"{API}/admin/commandes", headers=_h(tokens["client"]), timeout=15)
        assert r.status_code == 403

    def test_super_admin_200_sur_toutes_les_routes(self, tokens):
        assert self._call("GET", "/superadmin/comptes", tokens["super"]).status_code == 200


# ============================================================ Hiérarchie
class TestHierarchie:
    def test_super_admin_acces_routes_admin(self, tokens):
        h = _h(tokens["super"])
        for path in ("/admin/commandes", "/admin/stats", "/admin/ventes", "/admin/livreurs"):
            r = requests.get(f"{API}{path}", headers=h, timeout=15)
            assert r.status_code == 200, f"super->{path} = {r.status_code}"


# ============================================================ Création admin
class TestCreationAdmin:
    def test_creer_admin_puis_login_et_403_superadmin(self, tokens):
        tel = f"0819{uuid.uuid4().int % 100000:05d}"
        email = f"test_{uuid.uuid4().hex[:6]}@pinkberry.test"
        payload = {"nom": "TEST_Admin_" + uuid.uuid4().hex[:4], "email": email,
                   "telephone": tel, "motDePasse": "abcdef"}
        r = requests.post(f"{API}/superadmin/admins", headers=_h(tokens["super"]), json=payload, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["role"] == "admin" and data["actif"] is True
        assert "motDePasseHash" not in data
        user_id = data["id"]

        # login OK
        tok = _login(tel, "abcdef")
        # accès admin OK
        r2 = requests.get(f"{API}/admin/commandes", headers=_h(tok), timeout=15)
        assert r2.status_code == 200
        # superadmin refusé
        r3 = requests.get(f"{API}/superadmin/comptes", headers=_h(tok), timeout=15)
        assert r3.status_code == 403

        # cleanup
        r4 = requests.delete(f"{API}/superadmin/comptes/{user_id}",
                             headers=_h(tokens["super"]), timeout=15)
        assert r4.status_code == 200

    def test_rejets_validation(self, tokens):
        h = _h(tokens["super"])
        # tel dupliqué (admin seed)
        r = requests.post(f"{API}/superadmin/admins", headers=h,
                          json={"nom": "x", "telephone": "0810000000", "motDePasse": "abcdef"}, timeout=15)
        assert r.status_code == 400
        # tel trop court
        r = requests.post(f"{API}/superadmin/admins", headers=h,
                          json={"nom": "x", "telephone": "12345", "motDePasse": "abcdef"}, timeout=15)
        assert r.status_code == 400
        # mdp trop court
        r = requests.post(f"{API}/superadmin/admins", headers=h,
                          json={"nom": "x", "telephone": "0819999998", "motDePasse": "abc"}, timeout=15)
        assert r.status_code == 400

    def test_email_duplique(self, tokens):
        h = _h(tokens["super"])
        tel1 = f"0819{uuid.uuid4().int % 100000:05d}"
        tel2 = f"0819{uuid.uuid4().int % 100000:05d}"
        while tel2 == tel1:
            tel2 = f"0819{uuid.uuid4().int % 100000:05d}"
        email = f"dup_{uuid.uuid4().hex[:6]}@pinkberry.test"
        r = requests.post(f"{API}/superadmin/admins", headers=h,
                          json={"nom": "TEST_a", "email": email, "telephone": tel1, "motDePasse": "abcdef"},
                          timeout=15)
        assert r.status_code == 200
        uid = r.json()["id"]
        try:
            r2 = requests.post(f"{API}/superadmin/admins", headers=h,
                               json={"nom": "TEST_b", "email": email, "telephone": tel2,
                                     "motDePasse": "abcdef"}, timeout=15)
            assert r2.status_code == 400
        finally:
            requests.delete(f"{API}/superadmin/comptes/{uid}", headers=h, timeout=15)


# ============================================================ Création livreur
class TestCreationLivreur:
    def test_creer_livreur_puis_login_et_courses(self, tokens):
        h = _h(tokens["super"])
        tel = f"0822{uuid.uuid4().int % 1000000:07d}"[:10]
        payload = {"nom": "TEST_Livreur", "telephone": tel, "vehicule": "Moto",
                   "plaque": "TST-01", "motDePasse": "mdplv1"}
        r = requests.post(f"{API}/admin/livreurs", headers=h, json=payload, timeout=15)
        assert r.status_code == 200, r.text
        fiche = r.json()
        fid = fiche["id"]

        tok = _login(tel, "mdplv1")
        r2 = requests.get(f"{API}/livreur/courses", headers=_h(tok), timeout=15)
        assert r2.status_code == 200
        assert isinstance(r2.json(), list)

        # cleanup: DELETE /admin/livreurs (super only)
        r3 = requests.delete(f"{API}/admin/livreurs/{fid}", headers=h, timeout=15)
        assert r3.status_code == 200


# ============================================================ Activer/désactiver
class TestBasculerActif:
    def test_flux_complet(self, tokens):
        h = _h(tokens["super"])
        tel = f"0819{uuid.uuid4().int % 100000:05d}"
        r = requests.post(f"{API}/superadmin/admins", headers=h,
                          json={"nom": "TEST_actif", "telephone": tel, "motDePasse": "abcdef"}, timeout=15)
        assert r.status_code == 200
        uid = r.json()["id"]
        try:
            tok = _login(tel, "abcdef")

            # désactivation
            r2 = requests.patch(f"{API}/superadmin/comptes/{uid}/actif", headers=h,
                                json={"actif": False}, timeout=15)
            assert r2.status_code == 200 and r2.json()["actif"] is False

            # login bloqué (403)
            r3 = requests.post(f"{API}/auth/connexion",
                               json={"telephone": tel, "motDePasse": "abcdef"}, timeout=15)
            assert r3.status_code == 403

            # jeton déjà émis refusé
            r4 = requests.get(f"{API}/auth/moi", headers=_h(tok), timeout=15)
            assert r4.status_code == 403

            # réactivation
            r5 = requests.patch(f"{API}/superadmin/comptes/{uid}/actif", headers=h,
                                json={"actif": True}, timeout=15)
            assert r5.status_code == 200
            _login(tel, "abcdef")
        finally:
            requests.delete(f"{API}/superadmin/comptes/{uid}", headers=h, timeout=15)

    def test_bascule_livreur_suit_fiche(self, tokens):
        h = _h(tokens["super"])
        tel = f"0822{uuid.uuid4().int % 1000000:07d}"[:10]
        r = requests.post(f"{API}/admin/livreurs", headers=h,
                          json={"nom": "TEST_livactif", "telephone": tel, "vehicule": "Moto",
                                "plaque": "TX", "motDePasse": "abcdef"}, timeout=15)
        assert r.status_code == 200
        fid = r.json()["id"]
        # récupérer user_id via /superadmin/comptes
        try:
            comptes = requests.get(f"{API}/superadmin/comptes", headers=h, timeout=15).json()
            u = next(c for c in comptes if c.get("telephone") == tel)
            r2 = requests.patch(f"{API}/superadmin/comptes/{u['id']}/actif", headers=h,
                                json={"actif": False}, timeout=15)
            assert r2.status_code == 200

            # vérifier la fiche livreur
            livreurs = requests.get(f"{API}/admin/livreurs", headers=h, timeout=15).json()
            fiche = next(l for l in livreurs if l["id"] == fid)
            assert fiche["actif"] is False
        finally:
            requests.delete(f"{API}/admin/livreurs/{fid}", headers=h, timeout=15)


# ============================================================ Suppression
class TestSuppression:
    def test_ne_peut_supprimer_soi_meme(self, tokens):
        h = _h(tokens["super"])
        moi = requests.get(f"{API}/auth/moi", headers=h, timeout=15).json()
        r = requests.delete(f"{API}/superadmin/comptes/{moi['id']}", headers=h, timeout=15)
        assert r.status_code == 400

    def test_id_inexistant_404(self, tokens):
        r = requests.delete(f"{API}/superadmin/comptes/id-qui-n-existe-pas",
                            headers=_h(tokens["super"]), timeout=15)
        assert r.status_code == 404

    def test_supprimer_client_404(self, tokens):
        # récupérer un id client
        h = _h(tokens["super"])
        # POST /superadmin/comptes ne liste que admin/livreur, donc on utilise l'id via auth/moi client
        client_moi = requests.get(f"{API}/auth/moi", headers=_h(tokens["client"]), timeout=15).json()
        r = requests.delete(f"{API}/superadmin/comptes/{client_moi['id']}", headers=h, timeout=15)
        assert r.status_code == 404


# ============================================================ Non-régression
class TestNonRegressionRoutesAdmin:
    def test_admin_normal_toujours_admin(self, tokens):
        h = _h(tokens["admin"])
        for path in ("/admin/commandes", "/admin/stats", "/admin/ventes", "/admin/livreurs"):
            r = requests.get(f"{API}{path}", headers=h, timeout=15)
            assert r.status_code == 200
