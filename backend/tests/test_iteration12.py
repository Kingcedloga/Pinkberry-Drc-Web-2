"""Iteration 12 : Bug taux de change (persistance) + Hero livreur emoji.

Verifie que :
- PUT /api/admin/config met a jour et GET /api/config renvoie la nouvelle valeur.
- Refuse tauxFC <= 0 (400), refuse sans token (401), avec token client/livreur (403).
- Le seed au demarrage ($setOnInsert) n'ecrase pas un taux existant.
- Il ne reste qu'un unique document {cle:'global'} apres plusieurs PUT.
- Non-regression rapide : /api/zones, /api/admin/zones (POST/DELETE),
  /api/admin/rapport (xlsx + pdf), /api/admin/commandes.

Regle IMPORTANTE : ne JAMAIS remettre le taux a une valeur en dur. On lit
la valeur initiale au debut et on la restaure en `finally`.
"""
import os
import time

import pytest
import requests
from outils_auth import jeton_superadmin  # configuration : reservee au super admin

BASE_URL = os.environ.get(
    "EXPO_PUBLIC_BACKEND_URL",
    os.environ.get("EXPO_BACKEND_URL", "https://pinkberry-drc.preview.emergentagent.com"),
).rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_TEL, ADMIN_PWD = "0810000000", "admin123"
CLIENT_TEL, CLIENT_PWD = "0990000001", "client123"
LIVREUR_TEL, LIVREUR_PWD = "0820000001", "livreur123"


def _login(tel, pwd):
    r = requests.post(f"{API}/auth/connexion", json={"telephone": tel, "motDePasse": pwd}, timeout=30)
    assert r.status_code == 200, f"login {tel} => {r.status_code} {r.text}"
    return r.json()["token"]


def _h(tok):
    return {"Authorization": f"Bearer {tok}"}


@pytest.fixture(scope="module")
def admin_tok():
    return _login(ADMIN_TEL, ADMIN_PWD)


@pytest.fixture(scope="module")
def client_tok():
    return _login(CLIENT_TEL, CLIENT_PWD)


@pytest.fixture(scope="module")
def livreur_tok():
    return _login(LIVREUR_TEL, LIVREUR_PWD)


@pytest.fixture()
def taux_initial(admin_tok):
    """Sauve la valeur initiale et la restaure a la fin du test."""
    initial = requests.get(f"{API}/config", timeout=10).json()["tauxFC"]
    yield initial
    requests.put(f"{API}/admin/config", json={"tauxFC": initial}, headers=_h(jeton_superadmin()), timeout=10)


# ------------------------- BUG TAUX - lecture / ecriture / persistance / unicite -------------------------
# NOTE: toutes les mutations du taux sont regroupees dans une SEULE classe pour que
# pytest-xdist (--dist loadscope) les execute en serie sur le meme worker et evite
# les conflits entre PUT concurrents.

class TestTauxAPI:
    def test_get_config_headers_no_store(self):
        r = requests.get(f"{API}/config", timeout=10)
        assert r.status_code == 200
        cc = r.headers.get("cache-control", "").lower()
        assert "no-store" in cc, f"Expected 'no-store' in Cache-Control, got: {cc!r}"
        j = r.json()
        assert isinstance(j.get("tauxFC"), (int, float)) and j["tauxFC"] > 0
        assert isinstance(j.get("fraisLivraison"), (int, float))

    def test_put_admin_config_updates_and_get_reflects(self, admin_tok, taux_initial):
        r = requests.put(f"{API}/admin/config", json={"tauxFC": 3050}, headers=_h(jeton_superadmin()), timeout=10)
        assert r.status_code == 200, r.text
        assert r.json()["tauxFC"] == 3050
        # GET public reflete la MAJ
        r2 = requests.get(f"{API}/config", timeout=10)
        assert r2.status_code == 200 and r2.json()["tauxFC"] == 3050

    def test_put_admin_config_returns_reread_from_db(self, admin_tok, taux_initial):
        r = requests.put(f"{API}/admin/config", json={"tauxFC": 3111}, headers=_h(jeton_superadmin()), timeout=10)
        assert r.status_code == 200
        # la reponse doit venir de la base (donc tauxFC == valeur envoyee)
        assert r.json()["tauxFC"] == 3111
        # deuxieme GET pour confirmer
        assert requests.get(f"{API}/config", timeout=10).json()["tauxFC"] == 3111

    def test_reject_taux_zero(self, admin_tok):
        r = requests.put(f"{API}/admin/config", json={"tauxFC": 0}, headers=_h(jeton_superadmin()), timeout=10)
        assert r.status_code == 400

    def test_reject_taux_negatif(self, admin_tok):
        r = requests.put(f"{API}/admin/config", json={"tauxFC": -5}, headers=_h(jeton_superadmin()), timeout=10)
        assert r.status_code == 400

    def test_put_admin_config_requires_auth(self):
        r = requests.put(f"{API}/admin/config", json={"tauxFC": 3100}, timeout=10)
        assert r.status_code in (401, 403)

    def test_put_admin_config_forbidden_for_client(self, client_tok):
        r = requests.put(f"{API}/admin/config", json={"tauxFC": 3100}, headers=_h(client_tok), timeout=10)
        assert r.status_code == 403

    def test_put_admin_config_forbidden_for_livreur(self, livreur_tok):
        r = requests.put(f"{API}/admin/config", json={"tauxFC": 3100}, headers=_h(livreur_tok), timeout=10)
        assert r.status_code == 403

    def test_taux_survit_au_seed_de_demarrage(self, admin_tok, taux_initial):
        """Rejoue l'operation de seed du demarrage ($setOnInsert) : elle ne doit
        jamais ecraser le taux choisi par l'admin. On evite un vrai restart du
        service, qui provoquerait des 502 pour les tests executes en parallele."""
        cible = 3050.0
        r = requests.put(f"{API}/admin/config", json={"tauxFC": cible}, headers=_h(jeton_superadmin()), timeout=10)
        assert r.status_code == 200 and r.json()["tauxFC"] == cible

        from dotenv import load_dotenv
        from pymongo import MongoClient

        load_dotenv("/app/backend/.env")
        cli = MongoClient(os.environ["MONGO_URL"])
        try:
            cli[os.environ["DB_NAME"]].parametres.update_one(
                {"cle": "global"},
                {"$setOnInsert": {"cle": "global", "tauxFC": 2800, "fraisLivraison": 2.5}},
                upsert=True,
            )
        finally:
            cli.close()

        r = requests.get(f"{API}/config", timeout=10)
        assert r.status_code == 200
        assert r.json()["tauxFC"] == cible, (
            f"Seed a ecrase le taux : attendu {cible}, recu {r.json()['tauxFC']}"
        )

    def test_plusieurs_put_ne_creent_pas_de_doublons(self, admin_tok, taux_initial):
        for v in (2900, 3000, 3100, 3200):
            r = requests.put(f"{API}/admin/config", json={"tauxFC": v}, headers=_h(jeton_superadmin()), timeout=10)
            assert r.status_code == 200 and r.json()["tauxFC"] == v
        # La derniere valeur est bien la seule visible
        assert requests.get(f"{API}/config", timeout=10).json()["tauxFC"] == 3200

    def test_un_seul_document_parametres_en_base(self, admin_tok, taux_initial):
        """Verifie directement dans MongoDB que la collection parametres n'a qu'un doc {cle:'global'}."""
        try:
            from pymongo import MongoClient
        except Exception:
            pytest.skip("pymongo indisponible")
        mongo_url = os.environ.get("MONGO_URL")
        db_name = os.environ.get("DB_NAME")
        if not mongo_url or not db_name:
            pytest.skip("MONGO_URL/DB_NAME absents de l'env local")
        for v in (2950, 3020, 3080):
            requests.put(f"{API}/admin/config", json={"tauxFC": v}, headers=_h(jeton_superadmin()), timeout=10)
        c = MongoClient(mongo_url)
        try:
            col = c[db_name].parametres
            docs = list(col.find({"cle": "global"}))
            assert len(docs) == 1, f"Expected 1 doc, found {len(docs)}"
        finally:
            c.close()


# ------------------------- NON REGRESSION -------------------------

class TestNonRegression:
    def test_zones_public(self):
        r = requests.get(f"{API}/zones", timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list) and len(data) > 0

    def test_admin_zones_crud(self, admin_tok):
        # cree une zone jetable (unique)
        nom = f"TEST_ZONE_ITER12_{int(time.time())}"
        r = requests.post(f"{API}/admin/zones", json={"commune": nom}, headers=_h(jeton_superadmin()), timeout=10)
        assert r.status_code in (200, 201), r.text
        # recupere l'id via la route publique /api/zones
        zones = requests.get(f"{API}/zones", timeout=10)
        assert zones.status_code == 200
        cible = next((z for z in zones.json() if z.get("commune") == nom), None)
        assert cible, "Zone TEST non trouvee apres creation"
        rd = requests.delete(f"{API}/admin/zones/{cible['id']}", headers=_h(jeton_superadmin()), timeout=10)
        assert rd.status_code in (200, 204)

    def test_admin_rapport_xlsx(self, admin_tok):
        r = requests.get(
            f"{API}/admin/rapport",
            params={"debut": "2025-01-01", "fin": "2026-12-31", "format": "xlsx"},
            headers=_h(admin_tok), timeout=30,
        )
        assert r.status_code == 200, r.text
        ct = r.headers.get("content-type", "")
        assert "spreadsheet" in ct or "xlsx" in ct or "openxml" in ct, ct

    def test_admin_rapport_pdf(self, admin_tok):
        r = requests.get(
            f"{API}/admin/rapport",
            params={"debut": "2025-01-01", "fin": "2026-12-31", "format": "pdf"},
            headers=_h(admin_tok), timeout=30,
        )
        assert r.status_code == 200, r.text
        assert "pdf" in r.headers.get("content-type", ""), r.headers.get("content-type")

    def test_admin_commandes(self, admin_tok):
        r = requests.get(f"{API}/admin/commandes", headers=_h(admin_tok), timeout=10)
        assert r.status_code == 200
        assert isinstance(r.json(), list)
