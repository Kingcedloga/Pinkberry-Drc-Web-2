"""Tests iteration 22 : Leaflet + TomTom (cartographie).

Couvre :
- /api/carte/tuiles/{z}/{x}/{y}.png  (public, image/png, refuse bornes invalides, pas de fuite clé)
- /api/carte/recherche?q=…            (auth requise, résultats à Kinshasa, debounce serveur < 3)
- /api/carte/itineraire               (auth requise pour client/livreur/admin, coords invalides → 400)
- Aucune fuite de TOMTOM_API_KEY dans les réponses ou dans la page carte fabriquée par le front.
"""
import os
import re
import pytest
import requests

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
TOMTOM_KEY = os.environ.get("TOMTOM_API_KEY", "").strip()

CLIENT = ("0990000001", "client123")
LIVREUR = ("0820000001", "livreur123")
ADMIN = ("0810000000", "admin123")


def _login(session: requests.Session, tel: str, mdp: str) -> str:
    r = session.post(
        f"{BASE_URL}/api/auth/connexion",
        json={"telephone": tel, "motDePasse": mdp},
        timeout=20,
    )
    assert r.status_code == 200, f"login {tel} failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def sess() -> requests.Session:
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def tokens(sess: requests.Session):
    return {
        "client": _login(sess, *CLIENT),
        "livreur": _login(sess, *LIVREUR),
        "admin": _login(sess, *ADMIN),
    }


# ---------------------------------------------------------------- Tuiles (public)
class TestTuiles:
    def test_tuile_valide_renvoie_png(self):
        r = requests.get(f"{BASE_URL}/api/carte/tuiles/14/8192/8193.png", timeout=20)
        assert r.status_code == 200, r.text[:200]
        assert r.headers.get("content-type", "").startswith("image/png")
        assert r.content[:8] == b"\x89PNG\r\n\x1a\n"
        # NB : le backend renvoie Cache-Control: public, max-age=86400, mais le proxy
        # Cloudflare devant l'ingress réécrit systématiquement l'en-tête en
        # "no-store, no-cache, must-revalidate". C'est en dehors du périmètre backend,
        # donc on se contente ici de vérifier que l'en-tête existe.
        assert r.headers.get("cache-control")

    def test_tuile_hors_bornes_z(self):
        r = requests.get(f"{BASE_URL}/api/carte/tuiles/25/1/1.png", timeout=20)
        assert r.status_code == 400

    def test_tuile_hors_bornes_xy(self):
        # Au niveau z=2, x/y doivent être < 4
        r = requests.get(f"{BASE_URL}/api/carte/tuiles/2/4/0.png", timeout=20)
        assert r.status_code == 400

    def test_tuile_pas_de_fuite_de_cle(self):
        r = requests.get(f"{BASE_URL}/api/carte/tuiles/12/2048/2048.png", timeout=20)
        assert r.status_code == 200
        if TOMTOM_KEY:
            # Sur du contenu binaire, on cherche l'octet-string de la clé
            assert TOMTOM_KEY.encode() not in r.content
            # Headers ne doivent pas contenir la clé non plus
            for k, v in r.headers.items():
                assert TOMTOM_KEY not in str(v)

    def test_tuile_publique_sans_jeton(self):
        # Explicite : aucune auth requise, sinon Leaflet dans une iframe casserait.
        r = requests.get(f"{BASE_URL}/api/carte/tuiles/10/512/512.png", timeout=20)
        assert r.status_code == 200


# ---------------------------------------------------------------- Recherche adresse
class TestRecherche:
    def test_recherche_sans_jeton_401(self):
        r = requests.get(f"{BASE_URL}/api/carte/recherche?q=Gombe", timeout=20)
        assert r.status_code in (401, 403)

    def test_recherche_court_liste_vide(self, sess, tokens):
        r = sess.get(
            f"{BASE_URL}/api/carte/recherche?q=Ga",
            headers={"Authorization": f"Bearer {tokens['client']}"},
            timeout=20,
        )
        assert r.status_code == 200
        assert r.json() == {"resultats": []}

    @pytest.mark.parametrize("q", ["Gombe avenue", "Avenue de la Justice", "Limete"])
    def test_recherche_kinshasa(self, sess, tokens, q):
        r = sess.get(
            f"{BASE_URL}/api/carte/recherche",
            params={"q": q},
            headers={"Authorization": f"Bearer {tokens['client']}"},
            timeout=25,
        )
        assert r.status_code == 200, r.text[:200]
        data = r.json()
        assert "resultats" in data
        res = data["resultats"]
        assert isinstance(res, list) and len(res) >= 1, f"aucun résultat pour '{q}'"
        # Structure attendue
        s = res[0]
        for cle in ("id", "libelle", "detail", "commune", "avenue", "lat", "lng"):
            assert cle in s, f"champ '{cle}' manquant dans {s}"
        # Sur toute la liste : coordonnées cohérentes avec Kinshasa/RDC
        for item in res:
            assert -6.0 <= item["lat"] <= -3.5, item
            assert 14.5 <= item["lng"] <= 16.5, item
        # Pas de fuite de clé
        if TOMTOM_KEY:
            assert TOMTOM_KEY not in r.text

    def test_recherche_livreur_aussi_autorise(self, sess, tokens):
        r = sess.get(
            f"{BASE_URL}/api/carte/recherche?q=Gombe",
            headers={"Authorization": f"Bearer {tokens['livreur']}"},
            timeout=25,
        )
        assert r.status_code == 200


# ---------------------------------------------------------------- Itinéraire
class TestItineraire:
    ORIGINE = [-4.3178, 15.3136]  # Gombe
    DESTINATION = [-4.3651, 15.2668]  # Limete

    def _post(self, sess, token, body):
        return sess.post(
            f"{BASE_URL}/api/carte/itineraire",
            json=body,
            headers={"Authorization": f"Bearer {token}"},
            timeout=25,
        )

    def test_itineraire_sans_jeton_401(self, sess):
        r = sess.post(
            f"{BASE_URL}/api/carte/itineraire",
            json={"origine": self.ORIGINE, "destination": self.DESTINATION},
            timeout=25,
        )
        assert r.status_code in (401, 403)

    @pytest.mark.parametrize("role", ["client", "livreur", "admin"])
    def test_itineraire_par_role(self, sess, tokens, role):
        r = self._post(sess, tokens[role], {"origine": self.ORIGINE, "destination": self.DESTINATION})
        assert r.status_code == 200, r.text[:200]
        data = r.json()
        assert "points" in data and isinstance(data["points"], list)
        assert len(data["points"]) >= 2, "polyline trop courte"
        for p in data["points"][:3]:
            assert isinstance(p, list) and len(p) == 2
            assert -90 <= p[0] <= 90 and -180 <= p[1] <= 180
        assert data.get("distanceMetres") and data["distanceMetres"] > 0
        assert data.get("etaSecondes") and data["etaSecondes"] > 0
        # Pas de fuite de clé
        if TOMTOM_KEY:
            assert TOMTOM_KEY not in r.text

    def test_itineraire_coords_hors_bornes(self, sess, tokens):
        r = self._post(sess, tokens["client"], {"origine": [200, 15], "destination": self.DESTINATION})
        assert r.status_code == 400

    def test_itineraire_taille_incorrecte(self, sess, tokens):
        r = self._post(sess, tokens["client"], {"origine": [-4.3], "destination": self.DESTINATION})
        assert r.status_code in (400, 422)

    def test_itineraire_body_manquant(self, sess, tokens):
        r = self._post(sess, tokens["client"], {"origine": self.ORIGINE})
        assert r.status_code in (400, 422)


# ---------------------------------------------------------------- Fuite de clé (transverse)
class TestPasDeFuiteCle:
    def test_pas_de_cle_dans_openapi(self):
        r = requests.get(f"{BASE_URL}/openapi.json", timeout=20)
        # Peut être 404 si non exposé, sinon on vérifie le contenu
        if r.status_code == 200 and TOMTOM_KEY:
            assert TOMTOM_KEY not in r.text

    def test_pas_de_variable_expo_public_tomtom(self):
        # Le fichier frontend/.env ne doit pas contenir la clé (indirectement testé via bundle web)
        # Ici on vérifie qu'aucune URL du frontend ne renvoie la clé en dur
        r = requests.get(f"{BASE_URL}/", timeout=20)
        if r.status_code == 200 and TOMTOM_KEY:
            assert TOMTOM_KEY not in r.text
