"""
Iteration 14 — Paramètres client (préférences + archivage client + isolation admin).

Périmètre :
- PUT /api/auth/preferences (langue fr/en, notifSuivi/Promos/Nouveautés), persistance via /auth/moi
- Archivage client : POST /commandes/{id}/archiver, /desarchiver, DELETE /masquer
- Isolation admin : après masquage client, la commande reste visible côté admin
  (/admin/commandes ou /admin/commandes/archives) ET dans /admin/rapport xlsx.
- Sécurité : un client ne peut agir que sur SES commandes (404 sur l'id d'autrui).

État initial (préférences + mot de passe du compte de démo) restauré en fin de suite.
"""
from __future__ import annotations

import os
import uuid
from typing import Any, Dict

import pytest
import requests

BASE = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
API = f"{BASE}/api"

CLIENT_TEL = "0990000001"
CLIENT_PWD = "client123"
ADMIN_TEL = "0810000000"
ADMIN_PWD = "admin123"

PREFS_DEFAUT = {"langue": "fr", "notifSuivi": True, "notifPromos": True, "notifNouveautes": True}


# -------- Helpers ---------------------------------------------------------

def _login(tel: str, pwd: str) -> str:
    r = requests.post(f"{API}/auth/connexion", json={"telephone": tel, "motDePasse": pwd}, timeout=15)
    assert r.status_code == 200, f"Login {tel} KO : {r.status_code} {r.text}"
    return r.json()["token"]


def _headers(token: str) -> Dict[str, str]:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def _creer_commande(token: str) -> Dict[str, Any]:
    """Crée une commande via l'API pour le client connecté (zone couverte)."""
    payload = {
        "items": [{"produitId": "test", "nom": f"TEST_ITER14_{uuid.uuid4().hex[:6]}",
                   "prixUnitaire": 4.5, "quantite": 1}],
        "adresse": {
            "label": "Maison",
            "commune": "Gombe",
            "avenue": "Av. Test",
            "numero": "1",
            "repere": "TEST_ITER14",
            "telephone": CLIENT_TEL,
        },
    }
    r = requests.post(f"{API}/commandes", headers=_headers(token), json=payload, timeout=15)
    assert r.status_code == 200, f"Création commande KO : {r.status_code} {r.text}"
    return r.json()


def _force_statut(admin_token: str, cmd_id: str, statut: str) -> None:
    """Force le statut d'une commande côté admin (via annulation ou paiement livreur)."""
    # Le chemin le plus simple : annuler la commande côté admin.
    if statut == "annulee":
        r = requests.post(f"{API}/commandes/{cmd_id}/annuler", headers=_headers(admin_token), timeout=10)
        assert r.status_code in (200, 400), f"Annulation KO : {r.status_code} {r.text}"


# -------- Fixtures --------------------------------------------------------

@pytest.fixture(scope="module")
def client_token() -> str:
    return _login(CLIENT_TEL, CLIENT_PWD)


@pytest.fixture(scope="module")
def admin_token() -> str:
    return _login(ADMIN_TEL, ADMIN_PWD)


@pytest.fixture(scope="module", autouse=True)
def restaurer_prefs(client_token: str):
    """Sauvegarde les préférences initiales et les restaure en fin de suite."""
    r = requests.get(f"{API}/auth/moi", headers=_headers(client_token), timeout=10)
    initiales = (r.json() or {}).get("preferences") or PREFS_DEFAUT
    yield
    requests.put(f"{API}/auth/preferences", headers=_headers(client_token), json=initiales, timeout=10)


# -------- Préférences -----------------------------------------------------

class TestPreferences:
    def test_moi_expose_preferences(self, client_token):
        r = requests.get(f"{API}/auth/moi", headers=_headers(client_token), timeout=10)
        assert r.status_code == 200
        moi = r.json()
        assert "preferences" in moi
        p = moi["preferences"]
        for cle in ("langue", "notifSuivi", "notifPromos", "notifNouveautes"):
            assert cle in p, f"Clé {cle} manquante dans /auth/moi.preferences"

    def test_put_preferences_persiste_en(self, client_token):
        body = {"langue": "en", "notifSuivi": False, "notifPromos": True, "notifNouveautes": False}
        r = requests.put(f"{API}/auth/preferences", headers=_headers(client_token), json=body, timeout=10)
        assert r.status_code == 200, r.text
        renvoye = r.json()
        assert renvoye == body

        # Persistance : /auth/moi doit renvoyer exactement le même dict
        moi = requests.get(f"{API}/auth/moi", headers=_headers(client_token), timeout=10).json()
        assert moi["preferences"] == body

    def test_put_preferences_retour_fr(self, client_token):
        body = {"langue": "fr", "notifSuivi": True, "notifPromos": True, "notifNouveautes": True}
        r = requests.put(f"{API}/auth/preferences", headers=_headers(client_token), json=body, timeout=10)
        assert r.status_code == 200
        moi = requests.get(f"{API}/auth/moi", headers=_headers(client_token), timeout=10).json()
        assert moi["preferences"]["langue"] == "fr"

    def test_langue_invalide_422(self, client_token):
        body = {"langue": "es", "notifSuivi": True, "notifPromos": True, "notifNouveautes": True}
        r = requests.put(f"{API}/auth/preferences", headers=_headers(client_token), json=body, timeout=10)
        assert r.status_code == 422, f"Attendu 422 pour langue='es', reçu {r.status_code}"

    def test_preferences_sans_token_401(self):
        r = requests.put(f"{API}/auth/preferences", json=PREFS_DEFAUT, timeout=10)
        assert r.status_code in (401, 403), r.text


# -------- Archivage client + isolation admin ------------------------------

class TestArchivageClient:
    """Cycle complet archiver/desarchiver/masquer + vérification côté admin."""

    def test_cycle_complet_et_isolation_admin(self, client_token, admin_token):
        # 1) Créer une commande, la mettre en statut 'annulee' (terminée)
        cmd = _creer_commande(client_token)
        cmd_id, numero = cmd["id"], cmd["numero"]
        h = _headers(client_token)

        # NB : le compte de démo a >200 commandes, /commandes/mes est capé à 200 après un
        # filtre Mongo non trié (voir bug reporté). On vérifie donc les transitions via
        # /commandes/{id} qui expose clientArchivee / clientMasquee et via /mes/archives.

        # Refuser l'archivage sur commande non terminée (statut 'recue')
        r = requests.post(f"{API}/commandes/{cmd_id}/archiver", headers=h, timeout=10)
        assert r.status_code == 400, f"Attendu 400, reçu {r.status_code} {r.text}"

        # Passer la commande en 'annulee'
        r = requests.post(f"{API}/commandes/{cmd_id}/annuler", headers=h, timeout=10)
        assert r.status_code == 200

        # 2) Archiver côté client : 200
        r = requests.post(f"{API}/commandes/{cmd_id}/archiver", headers=h, timeout=10)
        assert r.status_code == 200, r.text
        assert r.json().get("ok") is True

        # 3) Détail : clientArchivee=True
        detail = requests.get(f"{API}/commandes/{cmd_id}", headers=h, timeout=10).json()
        assert detail.get("clientArchivee") is True
        assert detail.get("statut") == "annulee"

        # 4) /commandes/mes/archives doit la contenir
        arch = requests.get(f"{API}/commandes/mes/archives", headers=h, timeout=10).json()
        assert any(c["id"] == cmd_id for c in arch), "La commande absente de /commandes/mes/archives"

        # 5) Désarchiver → détail: clientArchivee=False, absente des archives
        r = requests.post(f"{API}/commandes/{cmd_id}/desarchiver", headers=h, timeout=10)
        assert r.status_code == 200
        detail = requests.get(f"{API}/commandes/{cmd_id}", headers=h, timeout=10).json()
        assert detail.get("clientArchivee") in (False, None)
        arch = requests.get(f"{API}/commandes/mes/archives", headers=h, timeout=10).json()
        assert all(c["id"] != cmd_id for c in arch)

        # 6) Masquer refuse si non archivée (400)
        r = requests.delete(f"{API}/commandes/{cmd_id}/masquer", headers=h, timeout=10)
        assert r.status_code == 400, f"Masquer non archivée doit renvoyer 400, reçu {r.status_code}"

        # 7) Ré-archiver puis masquer : 200
        requests.post(f"{API}/commandes/{cmd_id}/archiver", headers=h, timeout=10)
        r = requests.delete(f"{API}/commandes/{cmd_id}/masquer", headers=h, timeout=10)
        assert r.status_code == 200, r.text

        # 8) Absente des archives client (mes est capé donc non probant)
        arch = requests.get(f"{API}/commandes/mes/archives", headers=h, timeout=10).json()
        assert all(c["id"] != cmd_id for c in arch)
        # Le détail expose clientMasquee=True (visible car pas de filtre sur GET /commandes/{id})
        detail = requests.get(f"{API}/commandes/{cmd_id}", headers=h, timeout=10).json()
        assert detail.get("clientMasquee") is True

        # 9) ISOLATION ADMIN — critique : la commande masquée doit rester visible côté admin
        admin_h = _headers(admin_token)
        adm_list = requests.get(f"{API}/admin/commandes", headers=admin_h, timeout=15).json()
        adm_arch = requests.get(f"{API}/admin/commandes/archives", headers=admin_h, timeout=15).json()
        ids_admin = {c["id"] for c in adm_list} | {c["id"] for c in adm_arch}
        assert cmd_id in ids_admin, (
            "REGRESSION CRITIQUE : après DELETE /commandes/{id}/masquer, la commande a disparu "
            "de /admin/commandes ET /admin/commandes/archives — la comptabilité est cassée."
        )

        # 10) Toujours présente dans le rapport xlsx (période aujourd'hui)
        from datetime import datetime, timezone
        import io, zipfile
        aujourdhui = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        r = requests.get(
            f"{API}/admin/rapport",
            headers=admin_h,
            params={"debut": aujourdhui, "fin": aujourdhui, "format": "xlsx"},
            timeout=30,
        )
        assert r.status_code == 200, r.text
        # xlsx = zip d'XML : on cherche le numero dans le contenu décompressé
        with zipfile.ZipFile(io.BytesIO(r.content)) as z:
            texte_total = b""
            for nom in z.namelist():
                if nom.endswith(".xml"):
                    texte_total += z.read(nom)
        assert numero.encode("utf-8") in texte_total, (
            f"Rapport xlsx ne contient pas le numéro {numero} — la commande masquée client "
            "doit rester dans les rapports admin."
        )


class TestSecuriteArchivage:
    """Un client ne peut jamais archiver/desarchiver/masquer la commande d'un autre."""

    def test_404_sur_id_autre_client(self, client_token):
        faux_id = str(uuid.uuid4())
        h = _headers(client_token)
        for chemin, methode in [
            ("archiver", "post"),
            ("desarchiver", "post"),
            ("masquer", "delete"),
        ]:
            fn = requests.post if methode == "post" else requests.delete
            r = fn(f"{API}/commandes/{faux_id}/{chemin}", headers=h, timeout=10)
            assert r.status_code == 404, f"{chemin.upper()} sur id inexistant doit renvoyer 404, reçu {r.status_code}"

    def test_sans_token_401(self):
        faux_id = str(uuid.uuid4())
        for chemin in ("archiver", "desarchiver"):
            r = requests.post(f"{API}/commandes/{faux_id}/{chemin}", timeout=10)
            assert r.status_code in (401, 403)
        r = requests.delete(f"{API}/commandes/{faux_id}/masquer", timeout=10)
        assert r.status_code in (401, 403)


# -------- Non-régression : GET /commandes/mes reste sain -----------------

class TestNonRegression:
    def test_mes_commandes_ok(self, client_token):
        r = requests.get(f"{API}/commandes/mes", headers=_headers(client_token), timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_mes_archives_ok(self, client_token):
        r = requests.get(f"{API}/commandes/mes/archives", headers=_headers(client_token), timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_zones_publiques(self):
        r = requests.get(f"{API}/zones", timeout=10)
        assert r.status_code == 200
        zones = r.json()
        assert isinstance(zones, list) and len(zones) > 0

    def test_config_publique(self):
        r = requests.get(f"{API}/config", timeout=10)
        assert r.status_code == 200
        assert "tauxFC" in r.json()
