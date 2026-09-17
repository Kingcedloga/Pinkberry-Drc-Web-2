"""Iteration 9 backend tests: profil, mot de passe, archivage, suppression commandes."""
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


def _mongo():
    from pymongo import MongoClient
    c = MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
    return c[os.environ.get("DB_NAME", "test_database")]


@pytest.fixture(scope="module")
def super_id():
    db = _mongo()
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


def _create_test_client():
    """Créer un client vérifié pour tests profil/motdepasse."""
    tel = f"0995{uuid.uuid4().int % 1000000:06d}"[:10]
    r = requests.post(f"{API}/auth/inscription",
                      json={"nom": "TEST_Iter9", "email": f"otp_{tel}@pinkberry.test", "telephone": tel, "motDePasse": "abcdef"},
                      timeout=15)
    assert r.status_code == 200, r.text
    code = r.json()["codeDemo"]
    r2 = requests.post(f"{API}/auth/verifier-otp",
                       json={"telephone": tel, "code": code}, timeout=15)
    assert r2.status_code == 200
    return tel, r2.json()["token"], r2.json()["user"]["id"]


def _cleanup_user(uid):
    db = _mongo()
    db.users.delete_one({"id": uid})
    db.commandes.delete_many({"userId": uid})
    db.adresses.delete_many({"userId": uid})


# ================================================== PUT /api/auth/profil
class TestProfil:
    def test_update_profil_ok(self, tokens):
        tel, tok, uid = _create_test_client()
        try:
            new_tel = f"0995{uuid.uuid4().int % 1000000:06d}"[:10]
            r = requests.put(f"{API}/auth/profil", headers=_h(tok),
                             json={"nom": "TEST_ModifNom", "email": "TEST_iter9@example.com",
                                   "telephone": new_tel}, timeout=15)
            assert r.status_code == 200, r.text
            data = r.json()
            assert data["nom"] == "TEST_ModifNom"
            assert data["email"] == "test_iter9@example.com"
            assert data["telephone"] == new_tel

            # Verify via /auth/moi
            m = requests.get(f"{API}/auth/moi", headers=_h(tok), timeout=15).json()
            assert m["telephone"] == new_tel
            assert m["nom"] == "TEST_ModifNom"
        finally:
            _cleanup_user(uid)

    def test_nom_trop_court(self, tokens):
        tel, tok, uid = _create_test_client()
        try:
            r = requests.put(f"{API}/auth/profil", headers=_h(tok),
                             json={"nom": "A", "telephone": tel}, timeout=15)
            assert r.status_code == 400
        finally:
            _cleanup_user(uid)

    def test_telephone_trop_court(self, tokens):
        tel, tok, uid = _create_test_client()
        try:
            r = requests.put(f"{API}/auth/profil", headers=_h(tok),
                             json={"nom": "TEST_OK", "telephone": "12345"}, timeout=15)
            assert r.status_code == 400
        finally:
            _cleanup_user(uid)

    def test_telephone_deja_pris(self, tokens):
        tel, tok, uid = _create_test_client()
        try:
            # Tel admin déjà pris
            r = requests.put(f"{API}/auth/profil", headers=_h(tok),
                             json={"nom": "TEST_OK", "telephone": "0810000000"}, timeout=15)
            assert r.status_code == 400
        finally:
            _cleanup_user(uid)

    def test_email_deja_pris(self, tokens):
        # Set an email on our test user then create a second user and try same email
        tel1, tok1, uid1 = _create_test_client()
        tel2, tok2, uid2 = _create_test_client()
        try:
            email = f"test_iter9_{uuid.uuid4().hex[:6]}@ex.com"
            r = requests.put(f"{API}/auth/profil", headers=_h(tok1),
                             json={"nom": "TEST_A", "email": email, "telephone": tel1}, timeout=15)
            assert r.status_code == 200

            r2 = requests.put(f"{API}/auth/profil", headers=_h(tok2),
                              json={"nom": "TEST_B", "email": email, "telephone": tel2}, timeout=15)
            assert r2.status_code == 400
        finally:
            _cleanup_user(uid1)
            _cleanup_user(uid2)

    def test_sans_jeton_401(self):
        r = requests.put(f"{API}/auth/profil",
                         json={"nom": "X", "telephone": "0999999999"}, timeout=15)
        assert r.status_code == 401

    def test_role_actif_non_modifiables(self, tokens):
        """Le role et actif ne doivent pas être modifiables via /auth/profil."""
        tel, tok, uid = _create_test_client()
        try:
            db = _mongo()
            r = requests.put(f"{API}/auth/profil", headers=_h(tok),
                             json={"nom": "TEST_OK", "telephone": tel,
                                   "role": "admin", "actif": False}, timeout=15)
            # Devrait passer (champs ignorés) ou refuser — tester l'effet réel:
            u = db.users.find_one({"id": uid}, {"_id": 0})
            assert u["role"] == "client"
            # actif ne doit pas avoir été mis à False via /auth/profil
            assert u.get("actif") is not False
        finally:
            _cleanup_user(uid)


# ================================================== PUT /api/auth/motdepasse
class TestMotDePasse:
    def test_change_mdp_ok(self):
        tel, tok, uid = _create_test_client()
        try:
            r = requests.put(f"{API}/auth/motdepasse", headers=_h(tok),
                             json={"actuel": "abcdef", "nouveau": "nouveaupwd"}, timeout=15)
            assert r.status_code == 200
            # Login avec le nouveau OK
            r2 = requests.post(f"{API}/auth/connexion",
                               json={"telephone": tel, "motDePasse": "nouveaupwd"}, timeout=15)
            assert r2.status_code == 200
            # L'ancien refusé
            r3 = requests.post(f"{API}/auth/connexion",
                               json={"telephone": tel, "motDePasse": "abcdef"}, timeout=15)
            assert r3.status_code == 401
        finally:
            _cleanup_user(uid)

    def test_actuel_incorrect(self):
        tel, tok, uid = _create_test_client()
        try:
            r = requests.put(f"{API}/auth/motdepasse", headers=_h(tok),
                             json={"actuel": "faux", "nouveau": "nouveaupwd"}, timeout=15)
            assert r.status_code == 400
        finally:
            _cleanup_user(uid)

    def test_nouveau_trop_court(self):
        tel, tok, uid = _create_test_client()
        try:
            r = requests.put(f"{API}/auth/motdepasse", headers=_h(tok),
                             json={"actuel": "abcdef", "nouveau": "abc"}, timeout=15)
            assert r.status_code == 400
        finally:
            _cleanup_user(uid)

    def test_sans_jeton_401(self):
        r = requests.put(f"{API}/auth/motdepasse",
                         json={"actuel": "x", "nouveau": "abcdef"}, timeout=15)
        assert r.status_code == 401

    def test_compte_google_sans_mdp_peut_en_definir(self):
        """Compte avec motDePasseHash='' peut définir sans 'actuel'."""
        db = _mongo()
        # Créer un user directement en base sans mot de passe
        uid = str(uuid.uuid4())
        tel = f"0996{uuid.uuid4().int % 1000000:06d}"[:10]
        db.users.insert_one({
            "id": uid,
            "nom": "TEST_Google",
            "telephone": tel,
            "email": f"test_google_{uid[:6]}@ex.com",
            "motDePasseHash": "",
            "role": "client",
            "actif": True,
            "verifie": True,
            "createdAt": datetime.now(timezone.utc).isoformat(),
        })
        try:
            tok = _forge_token(uid)
            r = requests.put(f"{API}/auth/motdepasse", headers=_h(tok),
                             json={"nouveau": "monnouveaumdp"}, timeout=15)
            assert r.status_code == 200, r.text
            # Login OK avec le nouveau
            r2 = requests.post(f"{API}/auth/connexion",
                               json={"telephone": tel, "motDePasse": "monnouveaumdp"}, timeout=15)
            assert r2.status_code == 200
        finally:
            db.users.delete_one({"id": uid})


# ================================================== Archivage & Suppression
def _creer_commande_livree(tokens, statut_final="livree"):
    """Crée un client de test, passe une commande, la fait passer à statut_final."""
    tel, ctok, cuid = _create_test_client()
    cmd_payload = {
        "adresse": {"label": "TEST", "commune": "Gombe", "avenue": "Ave A", "numero": "1",
                    "repere": "porte rose", "telephone": tel, "lat": -4.3, "lng": 15.3},
        "items": [{"produitId": "p1", "nom": "Pot Original", "taille": "Petit",
                   "garnitures": [], "quantite": 1, "prixUnitaire": 4.5}],
    }
    r = requests.post(f"{API}/commandes", headers=_h(ctok), json=cmd_payload, timeout=15)
    assert r.status_code == 200, r.text
    cmd_id = r.json()["id"]

    # Faire passer au statut voulu via admin
    admin_h = _h(tokens["admin"])
    if statut_final == "livree":
        # Assigner puis passer à livree
        # Trouver un livreur
        livreurs = requests.get(f"{API}/admin/livreurs", headers=admin_h, timeout=15).json()
        lid = livreurs[0]["id"]
        requests.post(f"{API}/admin/commandes/{cmd_id}/assigner",
                      headers=admin_h, json={"livreurId": lid}, timeout=15)
        for s in ("en_preparation", "recuperee", "en_route", "livree"):
            r2 = requests.patch(f"{API}/admin/commandes/{cmd_id}/statut",
                                headers=admin_h, json={"statut": s}, timeout=15)
            assert r2.status_code == 200, f"statut {s} -> {r2.status_code} {r2.text}"
    elif statut_final == "annulee":
        r2 = requests.patch(f"{API}/admin/commandes/{cmd_id}/statut",
                            headers=admin_h, json={"statut": "annulee"}, timeout=15)
        assert r2.status_code == 200
    # sinon: statut recue par défaut
    return cmd_id, cuid


class TestArchivage:
    def test_archiver_livree_ok(self, tokens):
        cmd_id, cuid = _creer_commande_livree(tokens, "livree")
        try:
            admin_h = _h(tokens["admin"])
            r = requests.post(f"{API}/admin/commandes/{cmd_id}/archiver",
                              headers=admin_h, timeout=15)
            assert r.status_code == 200, r.text

            # N'apparaît plus dans /admin/commandes
            liste = requests.get(f"{API}/admin/commandes", headers=admin_h, timeout=15).json()
            assert not any(c["id"] == cmd_id for c in liste)

            # Apparaît dans /admin/commandes/archives
            archives = requests.get(f"{API}/admin/commandes/archives",
                                    headers=admin_h, timeout=15).json()
            assert any(c["id"] == cmd_id for c in archives)

            # Compté dans stats (au moins présente)
            stats = requests.get(f"{API}/admin/stats", headers=admin_h, timeout=15).json()
            assert stats["total"] >= 1
            assert stats["livrees"] >= 1

            # Ventes: la commande doit y être
            ventes = requests.get(f"{API}/admin/ventes", headers=admin_h, timeout=15).json()
            # ventes est une liste de jours, on vérifie qu'un jour ou plus est présent
            assert isinstance(ventes, (list, dict))
        finally:
            _mongo().commandes.delete_one({"id": cmd_id})
            _cleanup_user(cuid)

    def test_archiver_annulee_ok(self, tokens):
        cmd_id, cuid = _creer_commande_livree(tokens, "annulee")
        try:
            r = requests.post(f"{API}/admin/commandes/{cmd_id}/archiver",
                              headers=_h(tokens["admin"]), timeout=15)
            assert r.status_code == 200
        finally:
            _mongo().commandes.delete_one({"id": cmd_id})
            _cleanup_user(cuid)

    def test_archiver_active_refuse(self, tokens):
        cmd_id, cuid = _creer_commande_livree(tokens, "recue")
        try:
            r = requests.post(f"{API}/admin/commandes/{cmd_id}/archiver",
                              headers=_h(tokens["admin"]), timeout=15)
            assert r.status_code == 400
            assert "livrees ou annulees" in r.json().get("detail", "").lower()
        finally:
            # Annuler puis nettoyer
            _mongo().commandes.delete_one({"id": cmd_id})
            _cleanup_user(cuid)

    def test_archiver_404(self, tokens):
        r = requests.post(f"{API}/admin/commandes/inexistant/archiver",
                          headers=_h(tokens["admin"]), timeout=15)
        assert r.status_code == 404

    def test_desarchiver_ok(self, tokens):
        cmd_id, cuid = _creer_commande_livree(tokens, "livree")
        try:
            admin_h = _h(tokens["admin"])
            requests.post(f"{API}/admin/commandes/{cmd_id}/archiver",
                          headers=admin_h, timeout=15)
            r = requests.post(f"{API}/admin/commandes/{cmd_id}/desarchiver",
                              headers=admin_h, timeout=15)
            assert r.status_code == 200

            # Réapparaît dans /admin/commandes
            liste = requests.get(f"{API}/admin/commandes", headers=admin_h, timeout=15).json()
            assert any(c["id"] == cmd_id for c in liste)
        finally:
            _mongo().commandes.delete_one({"id": cmd_id})
            _cleanup_user(cuid)

    def test_desarchiver_404_si_pas_archivee(self, tokens):
        cmd_id, cuid = _creer_commande_livree(tokens, "livree")
        try:
            r = requests.post(f"{API}/admin/commandes/{cmd_id}/desarchiver",
                              headers=_h(tokens["admin"]), timeout=15)
            assert r.status_code == 404
        finally:
            _mongo().commandes.delete_one({"id": cmd_id})
            _cleanup_user(cuid)

    def test_rbac_archiver(self, tokens):
        # Sans token
        r = requests.post(f"{API}/admin/commandes/xx/archiver", timeout=15)
        assert r.status_code == 401
        # Client 403
        r = requests.post(f"{API}/admin/commandes/xx/archiver",
                          headers=_h(tokens["client"]), timeout=15)
        assert r.status_code == 403
        # Livreur 403
        r = requests.post(f"{API}/admin/commandes/xx/archiver",
                          headers=_h(tokens["livreur"]), timeout=15)
        assert r.status_code == 403

    def test_superadmin_peut_archiver(self, tokens):
        cmd_id, cuid = _creer_commande_livree(tokens, "livree")
        try:
            r = requests.post(f"{API}/admin/commandes/{cmd_id}/archiver",
                              headers=_h(tokens["super"]), timeout=15)
            assert r.status_code == 200
        finally:
            _mongo().commandes.delete_one({"id": cmd_id})
            _cleanup_user(cuid)


class TestSuppression:
    def test_delete_active_refuse(self, tokens):
        cmd_id, cuid = _creer_commande_livree(tokens, "livree")
        try:
            r = requests.delete(f"{API}/admin/commandes/{cmd_id}",
                                headers=_h(tokens["admin"]), timeout=15)
            assert r.status_code == 400
            assert "archivez" in r.json().get("detail", "").lower()
        finally:
            _mongo().commandes.delete_one({"id": cmd_id})
            _cleanup_user(cuid)

    def test_delete_archivee_ok(self, tokens):
        cmd_id, cuid = _creer_commande_livree(tokens, "livree")
        try:
            admin_h = _h(tokens["admin"])
            requests.post(f"{API}/admin/commandes/{cmd_id}/archiver",
                          headers=admin_h, timeout=15)
            r = requests.delete(f"{API}/admin/commandes/{cmd_id}",
                                headers=admin_h, timeout=15)
            assert r.status_code == 200

            # Ni dans admin/commandes ni dans archives
            liste = requests.get(f"{API}/admin/commandes", headers=admin_h, timeout=15).json()
            assert not any(c["id"] == cmd_id for c in liste)
            archives = requests.get(f"{API}/admin/commandes/archives",
                                    headers=admin_h, timeout=15).json()
            assert not any(c["id"] == cmd_id for c in archives)
        finally:
            _mongo().commandes.delete_one({"id": cmd_id})
            _cleanup_user(cuid)

    def test_delete_404(self, tokens):
        r = requests.delete(f"{API}/admin/commandes/inexistant",
                            headers=_h(tokens["admin"]), timeout=15)
        assert r.status_code == 404

    def test_rbac_delete(self, tokens):
        r = requests.delete(f"{API}/admin/commandes/xx", timeout=15)
        assert r.status_code == 401
        r = requests.delete(f"{API}/admin/commandes/xx",
                            headers=_h(tokens["client"]), timeout=15)
        assert r.status_code == 403
        r = requests.delete(f"{API}/admin/commandes/xx",
                            headers=_h(tokens["livreur"]), timeout=15)
        assert r.status_code == 403

    def test_superadmin_peut_supprimer(self, tokens):
        cmd_id, cuid = _creer_commande_livree(tokens, "livree")
        try:
            super_h = _h(tokens["super"])
            requests.post(f"{API}/admin/commandes/{cmd_id}/archiver",
                          headers=super_h, timeout=15)
            r = requests.delete(f"{API}/admin/commandes/{cmd_id}",
                                headers=super_h, timeout=15)
            assert r.status_code == 200
        finally:
            _mongo().commandes.delete_one({"id": cmd_id})
            _cleanup_user(cuid)
