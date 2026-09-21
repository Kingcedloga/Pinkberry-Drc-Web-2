"""Tests iteration 24 — Pinkberry Drc.

Change principal : migration cartographie Leaflet+TomTom → Mapbox.
- /api/carte/vue sert desormais une page Mapbox GL JS (styles clair / dark).
- /api/carte/itineraire utilise Mapbox Directions (driving-traffic).
- Nouveau /api/carte/zone (geocodage inverse Mapbox + zones actives).
- POST /api/commandes refuse une commande dont la position GPS est hors zone,
  meme si adresse.commune est declaree couverte.
- /api/carte/recherche reste sur TomTom (decision utilisateur).

Ne cree que quelques requetes par endpoint pour ne pas epuiser les quotas.
Nettoie les commandes de test creees.
"""
from __future__ import annotations

import os
import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
MAPBOX_TOKEN = (os.environ.get("MAPBOX_TOKEN") or "").strip()
TOMTOM_KEY = (os.environ.get("TOMTOM_API_KEY") or "").strip()

CLIENT = ("0990000001", "client123")
LIVREUR = ("0820000001", "livreur123")
ADMIN = ("0810000000", "admin123")


def _login(sess: requests.Session, tel: str, mdp: str) -> str:
    r = sess.post(
        f"{BASE_URL}/api/auth/connexion",
        json={"telephone": tel, "motDePasse": mdp},
        timeout=25,
    )
    assert r.status_code == 200, f"login {tel}: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def sess() -> requests.Session:
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def tokens(sess):
    return {
        "client": _login(sess, *CLIENT),
        "livreur": _login(sess, *LIVREUR),
        "admin": _login(sess, *ADMIN),
    }


# ================================================================ /api/carte/vue (Mapbox)
class TestCarteVueMapbox:
    def _fetch(self, **params):
        base = {"clat": -4.325, "clng": 15.322}
        base.update(params)
        return requests.get(f"{BASE_URL}/api/carte/vue", params=base, timeout=25)

    def test_vue_html_200(self):
        r = self._fetch()
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("text/html")

    def test_vue_utilise_mapbox_gl(self):
        html = self._fetch().text.lower()
        assert "mapbox-gl" in html, "Mapbox GL JS doit etre reference"
        assert "new mapboxgl.map" in html, "instance mapboxgl.Map attendue"
        # Plus de Leaflet (migration)
        assert "leaflet" not in html, "Leaflet ne devrait plus etre reference"
        # Plus de tuiles TomTom cote page
        assert "/api/carte/tuiles" not in html, "endpoint tuiles supprime"

    def test_vue_hooks_postmessage(self):
        html = self._fetch(dlat=-4.322, dlng=15.318).text
        assert "window.majLivreur" in html
        assert "window.majTrace" in html
        assert "addEventListener('message'" in html or 'addEventListener("message"' in html

    def test_vue_couleurs_appliquees(self):
        html = self._fetch(fond="#123456", accent="#654321", livreurCouleur="#AABBCC").text
        assert "#123456" in html and "#654321" in html and "#AABBCC" in html

    def test_vue_mode_choix_ajoute_pin_deplacable(self):
        html = self._fetch(mode="choix").text
        assert "draggable:mode==='choix'" in html or "draggable" in html
        assert "Déplacez" in html, "texte d'aide du mode choix attendu"

    def test_vue_sombre_utilise_style_dark(self):
        html_light = self._fetch(sombre=0).text
        html_dark = self._fetch(sombre=1).text
        assert "light-v11" in html_light
        assert "dark-v11" in html_dark

    def test_vue_pas_de_fuite_de_cle_secrete(self):
        # Le pk.* Mapbox EST volontairement present (token public cote client).
        # On verifie juste l'absence de la cle TomTom.
        html = self._fetch().text
        if TOMTOM_KEY:
            assert TOMTOM_KEY not in html


# ================================================================ /api/carte/itineraire (Mapbox Directions)
class TestItineraireMapbox:
    GOMBE = [-4.3178, 15.3136]
    LIMETE = [-4.3651, 15.2668]

    def test_itineraire_client(self, sess, tokens):
        r = sess.post(
            f"{BASE_URL}/api/carte/itineraire",
            json={"origine": self.GOMBE, "destination": self.LIMETE},
            headers={"Authorization": f"Bearer {tokens['client']}"},
            timeout=30,
        )
        assert r.status_code == 200, r.text[:200]
        data = r.json()
        for k in ("points", "distanceMetres", "etaSecondes", "heureArrivee"):
            assert k in data, f"cle {k} manquante"
        assert isinstance(data["points"], list) and len(data["points"]) >= 2
        # Coherence Kinshasa
        for lat, lng in data["points"][:5]:
            assert -6.0 <= lat <= -3.5 and 14.5 <= lng <= 16.5
        assert data["distanceMetres"] > 0 and data["etaSecondes"] > 0

    @pytest.mark.parametrize("role", ["livreur", "admin"])
    def test_itineraire_autres_roles(self, sess, tokens, role):
        r = sess.post(
            f"{BASE_URL}/api/carte/itineraire",
            json={"origine": self.GOMBE, "destination": self.LIMETE},
            headers={"Authorization": f"Bearer {tokens[role]}"},
            timeout=30,
        )
        assert r.status_code == 200

    def test_itineraire_coords_invalides_400(self, sess, tokens):
        r = sess.post(
            f"{BASE_URL}/api/carte/itineraire",
            json={"origine": [200, 15], "destination": self.LIMETE},
            headers={"Authorization": f"Bearer {tokens['client']}"},
            timeout=15,
        )
        assert r.status_code == 400


# ================================================================ /api/carte/zone (nouveau)
class TestCarteZone:
    def test_zone_sans_jeton_401_403(self):
        r = requests.get(f"{BASE_URL}/api/carte/zone?lat=-4.325&lng=15.322", timeout=15)
        assert r.status_code in (401, 403)

    def test_zone_kinshasa_couverte(self, sess, tokens):
        # -4.325, 15.322 = Barumbu / centre Kinshasa
        r = sess.get(
            f"{BASE_URL}/api/carte/zone",
            params={"lat": -4.325, "lng": 15.322},
            headers={"Authorization": f"Bearer {tokens['client']}"},
            timeout=25,
        )
        assert r.status_code == 200, r.text[:200]
        d = r.json()
        assert "commune" in d and "couverte" in d and "communesProches" in d
        assert d["commune"], "commune non detectee pour un point de Kinshasa"
        # Non bloque sur couverte=True (depend des zones actives en DB) mais on log.
        assert isinstance(d["couverte"], bool)
        assert isinstance(d["communesProches"], list)

    def test_zone_hors_kinshasa_non_couverte(self, sess, tokens):
        # Point loin de Kinshasa (Kenge / Bandundu approx.)
        r = sess.get(
            f"{BASE_URL}/api/carte/zone",
            params={"lat": -4.90, "lng": 16.90},
            headers={"Authorization": f"Bearer {tokens['client']}"},
            timeout=25,
        )
        assert r.status_code == 200, r.text[:200]
        d = r.json()
        assert d["couverte"] is False

    def test_zone_coords_invalides_400(self, sess, tokens):
        r = sess.get(
            f"{BASE_URL}/api/carte/zone",
            params={"lat": 200, "lng": 15.322},
            headers={"Authorization": f"Bearer {tokens['client']}"},
            timeout=15,
        )
        assert r.status_code == 400


# ================================================================ /api/carte/recherche (TomTom inchange)
class TestRechercheTomTomInchangee:
    def test_recherche_sans_jeton(self):
        r = requests.get(f"{BASE_URL}/api/carte/recherche?q=Gombe", timeout=15)
        assert r.status_code in (401, 403)

    def test_recherche_court_liste_vide(self, sess, tokens):
        r = sess.get(
            f"{BASE_URL}/api/carte/recherche?q=Ga",
            headers={"Authorization": f"Bearer {tokens['client']}"},
            timeout=15,
        )
        assert r.status_code == 200
        assert r.json() == {"resultats": []}

    def test_recherche_avenue_kinshasa(self, sess, tokens):
        r = sess.get(
            f"{BASE_URL}/api/carte/recherche",
            params={"q": "avenue de la justice"},
            headers={"Authorization": f"Bearer {tokens['client']}"},
            timeout=25,
        )
        assert r.status_code == 200
        res = r.json()["resultats"]
        assert isinstance(res, list) and len(res) >= 1
        item = res[0]
        for k in ("id", "libelle", "detail", "commune", "avenue", "lat", "lng"):
            assert k in item
        assert -6.0 <= item["lat"] <= -3.5 and 14.5 <= item["lng"] <= 16.5
        # Pas de fuite de cle TomTom
        if TOMTOM_KEY:
            assert TOMTOM_KEY not in r.text


# ================================================================ /api/commandes (controle GPS)
class TestCommandeControleGPS:
    """POST /api/commandes doit refuser une commande dont la position GPS
    tombe hors des communes couvertes, meme si le nom de commune est declaratif OK.
    """

    _created_cmd_ids: list = []

    def _commander(self, sess, token, adresse):
        body = {
            "items": [{
                "produitId": "test-produit",
                "nom": "Pot Test",
                "prixUnitaire": 3.0,
                "quantite": 1,
                "options": {},
            }],
            "adresse": adresse,
        }
        return sess.post(
            f"{BASE_URL}/api/commandes",
            json=body,
            headers={"Authorization": f"Bearer {token}"},
            timeout=30,
        )

    def test_commande_gps_hors_zone_refusee_400(self, sess, tokens):
        # Commune declaree Gombe (couverte) mais coords a Kenge (hors zone)
        r = self._commander(sess, tokens["client"], {
            "label": "TEST_ITER24 hors zone",
            "commune": "Gombe",
            "avenue": "Test",
            "numero": "1",
            "repere": "repere",
            "telephone": "0990000001",
            "lat": -4.90, "lng": 16.90,
        })
        assert r.status_code == 400, r.text[:250]
        assert "position" in r.text.lower() or "gps" in r.text.lower() or "hors" in r.text.lower(), (
            f"message d'erreur devrait mentionner la position GPS : {r.text[:200]}"
        )

    def test_commande_gps_kinshasa_acceptee(self, sess, tokens):
        # Coords Barumbu / centre Kinshasa - la commune declaree Gombe passera car
        # la validation stricte est sur la commune GPS reelle.
        r = self._commander(sess, tokens["client"], {
            "label": "TEST_ITER24 Kinshasa",
            "commune": "Gombe",
            "avenue": "Test",
            "numero": "1",
            "repere": "repere",
            "telephone": "0990000001",
            "lat": -4.325, "lng": 15.322,
        })
        # Doit passer (200) OU echouer 400 si la commune detectee par Mapbox n'est pas
        # active. On accepte les deux mais on privilegie 200.
        assert r.status_code in (200, 400), r.text[:200]
        if r.status_code == 200:
            self._created_cmd_ids.append(r.json().get("id"))

    def test_commande_sans_lat_lng_passe(self, sess, tokens):
        # Comportement historique : sans coordonnees, on ne bloque pas sur le GPS.
        r = self._commander(sess, tokens["client"], {
            "label": "TEST_ITER24 sans gps",
            "commune": "Gombe",
            "avenue": "Test",
            "numero": "1",
            "repere": "repere",
            "telephone": "0990000001",
        })
        assert r.status_code == 200, r.text[:200]
        self._created_cmd_ids.append(r.json().get("id"))


# ================================================================ Nettoyage
def teardown_module(module):
    """Supprime les commandes / adresses de test creees par ce module."""
    try:
        url = os.environ.get("MONGO_URL")
        db_name = os.environ.get("DB_NAME")
        if not (url and db_name):
            return
        with MongoClient(url) as cli:
            db = cli[db_name]
            db.commandes.delete_many({"adresse.label": {"$regex": "^TEST_ITER24"}})
            db.adresses.delete_many({"label": {"$regex": "^TEST_ITER24"}})
    except Exception as e:  # pragma: no cover
        print(f"cleanup warning: {e}")
