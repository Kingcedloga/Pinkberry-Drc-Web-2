"""
Iteration 16 — Livreur : archivage/masquage courses + rapport livreur + Admin langue.

Périmètre :
- Backend livreur : POST /livreur/courses/{id}/archiver (400 non terminée, 200 livree/annulee)
- GET /livreur/courses (exclut archivées), /livreur/courses/archives (inclut)
- POST /livreur/courses/{id}/desarchiver (remet dans la liste)
- DELETE /livreur/courses/{id}/masquer (400 non archivée, 200 sinon, retire des deux vues)
- Isolation admin : après masquer, commande reste visible côté admin (/admin/commandes,
  /admin/commandes/archives) ET dans /admin/rapport xlsx, et le nombre en base ne diminue pas.
- Sécurité : autre livreur → 404, client/admin → 403 sur /api/livreur/*.
- GET /livreur/rapport?debut&fin&format=xlsx|pdf : 200 avec Content-Type; 400 dates KO;
  contenu xlsx avec les 5 colonnes + récapitulatif attendu; contient bien SES courses
  (même archivées/masquées).
- Non-régression admin : GET /admin/rapport format=xlsx et pdf toujours OK (8 colonnes).

État initial restauré (archivages du livreur démo dérangés → désarchivés).
Aucun sudo supervisorctl restart backend pendant la suite (interdit par la consigne).
"""
from __future__ import annotations

import os
import uuid
from typing import Any, Dict, List, Optional
from io import BytesIO

import pytest
import requests

BASE = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
API = f"{BASE}/api"

CLIENT_TEL = "0990000001"
CLIENT_PWD = "client123"
ADMIN_TEL = "0810000000"
ADMIN_PWD = "admin123"
LIVREUR1_TEL = "0820000001"  # Jonas Mbala
LIVREUR1_PWD = "livreur123"
LIVREUR2_TEL = "0820000002"  # Patricia Luwawu
LIVREUR2_PWD = "livreur123"


# ---------------------------------------------------------------- Helpers
def _login(tel: str, pwd: str) -> str:
    r = requests.post(f"{API}/auth/connexion", json={"telephone": tel, "motDePasse": pwd}, timeout=15)
    assert r.status_code == 200, f"Login {tel} KO : {r.status_code} {r.text}"
    return r.json()["token"]


def _h(token: str) -> Dict[str, str]:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def _livreurs(admin_token: str) -> List[Dict[str, Any]]:
    r = requests.get(f"{API}/admin/livreurs", headers=_h(admin_token), timeout=10)
    assert r.status_code == 200, r.text
    return r.json()


def _me(token: str) -> Dict[str, Any]:
    r = requests.get(f"{API}/auth/moi", headers=_h(token), timeout=10)
    r.raise_for_status()
    return r.json()


def _creer_commande(client_token: str) -> Dict[str, Any]:
    payload = {
        "items": [{
            "produitId": "test",
            "nom": f"TEST_ITER16_{uuid.uuid4().hex[:6]}",
            "prixUnitaire": 3.5,
            "quantite": 1,
        }],
        "adresse": {
            "label": "Maison",
            "commune": "Gombe",
            "avenue": "Av. TEST",
            "numero": "16",
            "repere": "TEST_ITER16",
            "telephone": CLIENT_TEL,
        },
    }
    r = requests.post(f"{API}/commandes", headers=_h(client_token), json=payload, timeout=15)
    assert r.status_code == 200, f"Création commande KO : {r.status_code} {r.text}"
    return r.json()


def _assigner(admin_token: str, cmd_id: str, livreur_id: str) -> None:
    r = requests.post(
        f"{API}/admin/commandes/{cmd_id}/assigner",
        headers=_h(admin_token),
        json={"livreurId": livreur_id},
        timeout=10,
    )
    assert r.status_code == 200, f"Assignation KO : {r.status_code} {r.text}"


def _statut_livreur(livreur_token: str, cmd_id: str, statut: str) -> None:
    r = requests.patch(
        f"{API}/livreur/courses/{cmd_id}/statut",
        headers=_h(livreur_token),
        json={"statut": statut, "lat": -4.32, "lng": 15.31},
        timeout=10,
    )
    assert r.status_code == 200, f"Statut {statut} KO : {r.status_code} {r.text}"


def _count_commandes(admin_token: str) -> int:
    a = requests.get(f"{API}/admin/commandes", headers=_h(admin_token), timeout=15).json()
    b = requests.get(f"{API}/admin/commandes/archives", headers=_h(admin_token), timeout=15).json()
    return len(a) + len(b)


# ---------------------------------------------------------------- Fixtures
@pytest.fixture(scope="module")
def client_token() -> str:
    return _login(CLIENT_TEL, CLIENT_PWD)


@pytest.fixture(scope="module")
def admin_token() -> str:
    return _login(ADMIN_TEL, ADMIN_PWD)


@pytest.fixture(scope="module")
def livreur_token() -> str:
    return _login(LIVREUR1_TEL, LIVREUR1_PWD)


@pytest.fixture(scope="module")
def livreur2_token() -> str:
    return _login(LIVREUR2_TEL, LIVREUR2_PWD)


@pytest.fixture(scope="module")
def livreur_ids(admin_token) -> Dict[str, str]:
    livreurs = _livreurs(admin_token)
    l1 = next((l for l in livreurs if l.get("telephone") == LIVREUR1_TEL), None)
    l2 = next((l for l in livreurs if l.get("telephone") == LIVREUR2_TEL), None)
    assert l1 and l2, "Livreurs de démo introuvables"
    return {"l1": l1["id"], "l2": l2["id"]}


# Track commandes créées pour rétablir l'état à la fin (désarchivage).
_created_ids: List[str] = []


@pytest.fixture(scope="module", autouse=True)
def cleanup_state(livreur_token):
    yield
    # Restaure : désarchive les courses ITER16 qui pourraient être encore archivées.
    for cid in _created_ids:
        try:
            requests.post(
                f"{API}/livreur/courses/{cid}/desarchiver",
                headers=_h(livreur_token),
                timeout=8,
            )
        except Exception:
            pass


# ---------------------------------------------------------------- Tests
class TestLivreurArchivage:
    """Cycle complet archiver → GET listes → desarchiver → masquer."""

    def test_archiver_refuse_course_non_terminee(self, client_token, admin_token, livreur_token, livreur_ids):
        cmd = _creer_commande(client_token)
        cid = cmd["id"]
        _created_ids.append(cid)
        _assigner(admin_token, cid, livreur_ids["l1"])
        # statut = en_cours (assigner ne le termine pas)
        r = requests.post(f"{API}/livreur/courses/{cid}/archiver", headers=_h(livreur_token), timeout=10)
        assert r.status_code == 400, f"attendu 400, reçu {r.status_code}: {r.text}"

    def test_archiver_accepte_livree(self, client_token, admin_token, livreur_token, livreur_ids):
        cmd = _creer_commande(client_token)
        cid = cmd["id"]
        _created_ids.append(cid)
        _assigner(admin_token, cid, livreur_ids["l1"])
        _statut_livreur(livreur_token, cid, "livree")

        # visible dans /livreur/courses
        courses = requests.get(f"{API}/livreur/courses", headers=_h(livreur_token), timeout=10).json()
        assert any(c["id"] == cid for c in courses), "Course livrée absente de /livreur/courses"

        # archiver
        r = requests.post(f"{API}/livreur/courses/{cid}/archiver", headers=_h(livreur_token), timeout=10)
        assert r.status_code == 200, r.text

        # plus dans /livreur/courses
        courses = requests.get(f"{API}/livreur/courses", headers=_h(livreur_token), timeout=10).json()
        assert not any(c["id"] == cid for c in courses), "Course archivée toujours dans /livreur/courses"

        # présente dans /livreur/courses/archives
        arch = requests.get(f"{API}/livreur/courses/archives", headers=_h(livreur_token), timeout=10).json()
        assert any(c["id"] == cid for c in arch), "Course absente de /livreur/courses/archives"

        # désarchiver → réapparaît dans /livreur/courses
        r = requests.post(f"{API}/livreur/courses/{cid}/desarchiver", headers=_h(livreur_token), timeout=10)
        assert r.status_code == 200, r.text
        courses = requests.get(f"{API}/livreur/courses", headers=_h(livreur_token), timeout=10).json()
        assert any(c["id"] == cid for c in courses), "Course désarchivée absente de /livreur/courses"
        arch = requests.get(f"{API}/livreur/courses/archives", headers=_h(livreur_token), timeout=10).json()
        assert not any(c["id"] == cid for c in arch), "Course désarchivée encore dans /archives"

    def test_masquer_refuse_si_non_archivee(self, client_token, admin_token, livreur_token, livreur_ids):
        cmd = _creer_commande(client_token)
        cid = cmd["id"]
        _created_ids.append(cid)
        _assigner(admin_token, cid, livreur_ids["l1"])
        _statut_livreur(livreur_token, cid, "livree")
        # pas encore archivée → DELETE /masquer doit 400
        r = requests.delete(f"{API}/livreur/courses/{cid}/masquer", headers=_h(livreur_token), timeout=10)
        assert r.status_code == 400, f"attendu 400, reçu {r.status_code}: {r.text}"

    def test_masquer_apres_archivage_et_isolation_admin(
        self, client_token, admin_token, livreur_token, livreur_ids
    ):
        # snapshot du total (list + archives)
        avant = _count_commandes(admin_token)

        cmd = _creer_commande(client_token)
        cid = cmd["id"]
        _created_ids.append(cid)
        numero = cmd["numero"]
        _assigner(admin_token, cid, livreur_ids["l1"])
        _statut_livreur(livreur_token, cid, "livree")

        # archiver puis masquer
        r = requests.post(f"{API}/livreur/courses/{cid}/archiver", headers=_h(livreur_token), timeout=10)
        assert r.status_code == 200
        r = requests.delete(f"{API}/livreur/courses/{cid}/masquer", headers=_h(livreur_token), timeout=10)
        assert r.status_code == 200, r.text

        # absent des deux vues livreur
        courses = requests.get(f"{API}/livreur/courses", headers=_h(livreur_token), timeout=10).json()
        arch = requests.get(f"{API}/livreur/courses/archives", headers=_h(livreur_token), timeout=10).json()
        assert not any(c["id"] == cid for c in courses)
        assert not any(c["id"] == cid for c in arch)

        # ISOLATION ADMIN critique : présent dans /admin/commandes OU /admin/commandes/archives
        adm_list = requests.get(f"{API}/admin/commandes", headers=_h(admin_token), timeout=15).json()
        adm_arch = requests.get(f"{API}/admin/commandes/archives", headers=_h(admin_token), timeout=15).json()
        assert any(c["id"] == cid for c in adm_list) or any(c["id"] == cid for c in adm_arch), (
            "REGRESSION CRITIQUE : après DELETE /livreur/courses/{id}/masquer, la commande a "
            "disparu côté admin — la comptabilité est cassée."
        )

        # aucune suppression physique
        apres = _count_commandes(admin_token)
        assert apres >= avant, f"commandes en base réduites : {avant} -> {apres}"

        # rapport admin (xlsx) contient bien le numéro (large fenêtre pour être sûr)
        today = cmd["createdAt"][:10]
        r = requests.get(
            f"{API}/admin/rapport?debut={today}&fin={today}&format=xlsx",
            headers=_h(admin_token), timeout=20,
        )
        assert r.status_code == 200
        # inspecte le xlsx : le numero doit apparaître comme string quelque part.
        # (openpyxl requis)
        try:
            from openpyxl import load_workbook
            wb = load_workbook(BytesIO(r.content), data_only=True)
            ws = wb.active
            texte = ""
            for row in ws.iter_rows(values_only=True):
                for v in row:
                    if v is not None:
                        texte += str(v) + "|"
            assert numero in texte, f"Numéro {numero} absent du rapport admin xlsx"
        except ImportError:
            pytest.skip("openpyxl absent — inspection xlsx sautée")


class TestSecuriteLivreur:
    def test_autre_livreur_ne_peut_pas_archiver(self, client_token, admin_token, livreur_token, livreur2_token, livreur_ids):
        cmd = _creer_commande(client_token)
        cid = cmd["id"]
        _created_ids.append(cid)
        _assigner(admin_token, cid, livreur_ids["l1"])
        _statut_livreur(livreur_token, cid, "livree")
        # livreur 2 tente d'archiver la course du livreur 1
        r = requests.post(f"{API}/livreur/courses/{cid}/archiver", headers=_h(livreur2_token), timeout=10)
        assert r.status_code == 404, f"attendu 404, reçu {r.status_code}"
        r = requests.post(f"{API}/livreur/courses/{cid}/desarchiver", headers=_h(livreur2_token), timeout=10)
        assert r.status_code == 404
        r = requests.delete(f"{API}/livreur/courses/{cid}/masquer", headers=_h(livreur2_token), timeout=10)
        assert r.status_code == 404

    def test_client_403_sur_livreur_routes(self, client_token):
        r = requests.get(f"{API}/livreur/courses", headers=_h(client_token), timeout=10)
        assert r.status_code == 403
        r = requests.get(f"{API}/livreur/courses/archives", headers=_h(client_token), timeout=10)
        assert r.status_code == 403
        r = requests.get(
            f"{API}/livreur/rapport?debut=2025-01-01&fin=2025-01-31&format=xlsx",
            headers=_h(client_token), timeout=10,
        )
        assert r.status_code == 403

    def test_admin_403_sur_livreur_routes(self, admin_token):
        r = requests.get(f"{API}/livreur/courses", headers=_h(admin_token), timeout=10)
        assert r.status_code == 403


class TestRapportLivreur:
    def test_rapport_xlsx_ok(self, livreur_token):
        r = requests.get(
            f"{API}/livreur/rapport?debut=2020-01-01&fin=2030-12-31&format=xlsx",
            headers=_h(livreur_token), timeout=20,
        )
        assert r.status_code == 200
        assert "spreadsheetml" in r.headers.get("content-type", "")
        assert len(r.content) > 100

        try:
            from openpyxl import load_workbook
            wb = load_workbook(BytesIO(r.content), data_only=True)
            ws = wb.active
            entetes = None
            all_text = ""
            for row in ws.iter_rows(values_only=True):
                if entetes is None:
                    cells = [c for c in row if c]
                    if cells and any(str(c).lower().startswith("n") for c in cells):
                        entetes = [str(c) for c in cells]
                for v in row:
                    if v is not None:
                        all_text += str(v) + "|"
            # colonnes attendues
            for col in ["N° commande", "Date", "Adresse", "Cash", "Statut"]:
                assert col in all_text, f"Colonne '{col}' absente"
            # récapitulatif
            for lib in ["Courses effectuées", "Livraisons réussies", "Courses annulées", "Total cash encaissé"]:
                assert lib in all_text, f"Récapitulatif '{lib}' absent"
        except ImportError:
            pytest.skip("openpyxl absent")

    def test_rapport_pdf_ok(self, livreur_token):
        r = requests.get(
            f"{API}/livreur/rapport?debut=2020-01-01&fin=2030-12-31&format=pdf",
            headers=_h(livreur_token), timeout=20,
        )
        assert r.status_code == 200
        assert "pdf" in r.headers.get("content-type", "").lower()
        assert r.content[:4] == b"%PDF"

    def test_rapport_format_invalide_400(self, livreur_token):
        r = requests.get(
            f"{API}/livreur/rapport?debut=2025-01-01&fin=2025-01-31&format=csv",
            headers=_h(livreur_token), timeout=10,
        )
        assert r.status_code == 400

    def test_rapport_dates_invalides_400(self, livreur_token):
        r = requests.get(
            f"{API}/livreur/rapport?debut=nope&fin=2025-01-31&format=xlsx",
            headers=_h(livreur_token), timeout=10,
        )
        assert r.status_code == 400

    def test_rapport_fin_avant_debut_400(self, livreur_token):
        r = requests.get(
            f"{API}/livreur/rapport?debut=2025-12-31&fin=2025-01-01&format=xlsx",
            headers=_h(livreur_token), timeout=10,
        )
        assert r.status_code == 400

    def test_rapport_sans_token_401_ou_403(self):
        r = requests.get(
            f"{API}/livreur/rapport?debut=2025-01-01&fin=2025-01-31&format=xlsx",
            timeout=10,
        )
        assert r.status_code in (401, 403)

    def test_rapport_isole_par_livreur(self, client_token, admin_token, livreur_token, livreur2_token, livreur_ids):
        """Le rapport livreur ne contient que SES courses (même après masquage)."""
        cmd = _creer_commande(client_token)
        cid = cmd["id"]
        _created_ids.append(cid)
        numero_l1 = cmd["numero"]
        # Cette course sera pour livreur 1
        _assigner(admin_token, cid, livreur_ids["l1"])
        _statut_livreur(livreur_token, cid, "livree")

        today = cmd["createdAt"][:10]
        # Rapport livreur 1 doit contenir numero_l1
        r = requests.get(
            f"{API}/livreur/rapport?debut={today}&fin={today}&format=xlsx",
            headers=_h(livreur_token), timeout=20,
        )
        assert r.status_code == 200
        try:
            from openpyxl import load_workbook
            wb = load_workbook(BytesIO(r.content), data_only=True)
            ws = wb.active
            texte = ""
            for row in ws.iter_rows(values_only=True):
                for v in row:
                    if v is not None:
                        texte += str(v) + "|"
            assert numero_l1 in texte, f"{numero_l1} absent du rapport livreur 1"

            # Rapport livreur 2 ne doit PAS contenir numero_l1
            r2 = requests.get(
                f"{API}/livreur/rapport?debut={today}&fin={today}&format=xlsx",
                headers=_h(livreur2_token), timeout=20,
            )
            wb2 = load_workbook(BytesIO(r2.content), data_only=True)
            ws2 = wb2.active
            texte2 = ""
            for row in ws2.iter_rows(values_only=True):
                for v in row:
                    if v is not None:
                        texte2 += str(v) + "|"
            assert numero_l1 not in texte2, (
                "FUITE : le rapport du livreur 2 contient une course du livreur 1"
            )
        except ImportError:
            pytest.skip("openpyxl absent")

        # Archive + masque la course : elle doit rester dans le rapport livreur 1
        requests.post(f"{API}/livreur/courses/{cid}/archiver", headers=_h(livreur_token), timeout=10)
        requests.delete(f"{API}/livreur/courses/{cid}/masquer", headers=_h(livreur_token), timeout=10)
        r3 = requests.get(
            f"{API}/livreur/rapport?debut={today}&fin={today}&format=xlsx",
            headers=_h(livreur_token), timeout=20,
        )
        assert r3.status_code == 200
        try:
            from openpyxl import load_workbook
            wb3 = load_workbook(BytesIO(r3.content), data_only=True)
            ws3 = wb3.active
            texte3 = ""
            for row in ws3.iter_rows(values_only=True):
                for v in row:
                    if v is not None:
                        texte3 += str(v) + "|"
            assert numero_l1 in texte3, (
                "REGRESSION : après masquage livreur, la course a disparu du RAPPORT du livreur"
            )
        except ImportError:
            pass


class TestNonRegressionAdminRapport:
    """Le refactor de construire_xlsx/pdf (colonnes paramétrables) ne doit pas casser
    le rapport admin (8 colonnes + récap habituel)."""

    def test_admin_rapport_xlsx(self, admin_token):
        r = requests.get(
            f"{API}/admin/rapport?debut=2020-01-01&fin=2030-12-31&format=xlsx",
            headers=_h(admin_token), timeout=30,
        )
        assert r.status_code == 200
        assert "spreadsheetml" in r.headers.get("content-type", "")
        try:
            from openpyxl import load_workbook
            wb = load_workbook(BytesIO(r.content), data_only=True)
            ws = wb.active
            all_text = ""
            for row in ws.iter_rows(values_only=True):
                for v in row:
                    if v is not None:
                        all_text += str(v) + "|"
            for col in ["N° commande", "Date", "Client", "Adresse", "Articles", "Total", "Statut", "Livreur"]:
                assert col in all_text, f"Colonne '{col}' absente du rapport admin"
            for lib in ["Nombre de commandes", "Livraisons réussies", "Commandes annulées"]:
                assert lib in all_text, f"Récap '{lib}' absent"
        except ImportError:
            pytest.skip("openpyxl absent")

    def test_admin_rapport_pdf(self, admin_token):
        r = requests.get(
            f"{API}/admin/rapport?debut=2020-01-01&fin=2030-12-31&format=pdf",
            headers=_h(admin_token), timeout=30,
        )
        assert r.status_code == 200
        assert r.content[:4] == b"%PDF"


class TestAdminLangue:
    """L'admin doit pouvoir enregistrer une préférence de langue et la relire."""

    def test_admin_peut_changer_langue(self, admin_token):
        # snapshot
        moi = _me(admin_token)
        initiale = (moi.get("preferences") or {}).get("langue", "fr")
        try:
            # basculer en anglais
            r = requests.put(
                f"{API}/auth/preferences",
                headers=_h(admin_token),
                json={"langue": "en"},
                timeout=10,
            )
            assert r.status_code == 200, r.text
            moi2 = _me(admin_token)
            assert (moi2.get("preferences") or {}).get("langue") == "en"

            # rebasculer en français
            r = requests.put(
                f"{API}/auth/preferences",
                headers=_h(admin_token),
                json={"langue": "fr"},
                timeout=10,
            )
            assert r.status_code == 200
            moi3 = _me(admin_token)
            assert (moi3.get("preferences") or {}).get("langue") == "fr"
        finally:
            # restauration
            requests.put(
                f"{API}/auth/preferences",
                headers=_h(admin_token),
                json={"langue": initiale},
                timeout=10,
            )
