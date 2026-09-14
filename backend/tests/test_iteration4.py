"""Tests iteration 4 : ventes du jour + push notifications (relay preview)."""
import os
import uuid

import pytest
import requests

BASE_URL = os.environ.get(
    "EXPO_PUBLIC_BACKEND_URL", "https://commande-rose.preview.emergentagent.com"
).rstrip("/")
API = f"{BASE_URL}/api"

CLIENT_TEL = "0990000001"
CLIENT_PWD = "client123"
ADMIN_TEL = "0810000000"
ADMIN_PWD = "admin123"
LIVREUR_TEL = "0820000001"
LIVREUR_PWD = "livreur123"


def _login(tel, pwd):
    r = requests.post(
        f"{API}/auth/connexion", json={"telephone": tel, "motDePasse": pwd}, timeout=30
    )
    assert r.status_code == 200, f"{tel} login failed: {r.status_code} {r.text}"
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


@pytest.fixture(scope="module")
def premier_produit():
    r = requests.get(f"{API}/produits", timeout=15)
    assert r.status_code == 200
    prods = r.json()
    assert prods, "aucun produit en catalogue"
    return prods[0]


def _adresse_gombe():
    return {
        "label": "Test iter4",
        "commune": "Gombe",
        "avenue": "Av. de la Testerie",
        "numero": "1",
        "repere": "Immeuble Test",
        "telephone": CLIENT_TEL,
        "lat": -4.32,
        "lng": 15.32,
    }


# ------------------------------------------------------------------ REGISTER PUSH
class TestRegisterPush:
    def test_body_manquant_422(self):
        r = requests.post(f"{API}/register-push", json={}, timeout=10)
        assert r.status_code == 422, f"expected 422 got {r.status_code}"

    def test_body_invalide_422(self):
        r = requests.post(f"{API}/register-push", json={"user_id": "x"}, timeout=10)
        assert r.status_code == 422

    def test_placeholder_key_500(self):
        # EMERGENT_PUSH_KEY='placeholder' en preview -> 500 (ni 404 ni 200)
        payload = {
            "user_id": "test-user-123",
            "platform": "android",
            "device_token": "fake-token-abc",
        }
        r = requests.post(f"{API}/register-push", json=payload, timeout=30)
        assert r.status_code != 404, "endpoint /api/register-push doit exister"
        assert r.status_code in (
            500,
            502,
        ), f"attendu 500/502 avec placeholder, got {r.status_code}: {r.text[:200]}"
        if r.status_code == 500:
            assert "EMERGENT_PUSH_KEY" in r.text or "manquante" in r.text.lower()


# ------------------------------------------------------ NE BLOQUE PAS LES OPERATIONS
class TestPushNonBloquant:
    def test_commande_creation_ok(self, client_tok, premier_produit):
        payload = {
            "items": [
                {
                    "produitId": premier_produit["id"],
                    "nom": premier_produit["nom"],
                    "prixUnitaire": premier_produit["prix"],
                    "quantite": 1,
                }
            ],
            "adresse": _adresse_gombe(),
            "moyenPaiement": "cash",
        }
        r = requests.post(
            f"{API}/commandes", json=payload, headers=_h(client_tok), timeout=30
        )
        assert r.status_code == 200, f"push failure should not block: {r.status_code} {r.text[:200]}"
        cmd = r.json()
        assert cmd.get("statut") == "recue"
        pytest.commande_id = cmd["id"]

    def test_admin_change_statut_ok(self, admin_tok):
        cmd_id = getattr(pytest, "commande_id", None)
        if not cmd_id:
            pytest.skip("pas de commande créée")
        r = requests.patch(
            f"{API}/admin/commandes/{cmd_id}/statut",
            json={"statut": "en_preparation"},
            headers=_h(admin_tok),
            timeout=30,
        )
        assert r.status_code == 200, r.text[:200]

    def test_admin_assigner_livreur_ok(self, admin_tok):
        cmd_id = getattr(pytest, "commande_id", None)
        if not cmd_id:
            pytest.skip("pas de commande")
        # récupérer un livreur
        r = requests.get(f"{API}/admin/livreurs", headers=_h(admin_tok), timeout=10)
        assert r.status_code == 200, r.text[:200]
        livs = r.json()
        assert livs
        r2 = requests.post(
            f"{API}/admin/commandes/{cmd_id}/assigner",
            json={"livreurId": livs[0]["id"]},
            headers=_h(admin_tok),
            timeout=30,
        )
        assert r2.status_code == 200, f"assign should not fail: {r2.status_code} {r2.text[:200]}"

    def test_livreur_encaisser_ok(self, admin_tok, livreur_tok):
        cmd_id = getattr(pytest, "commande_id", None)
        if not cmd_id:
            pytest.skip("pas de commande")
        # passage recuperee -> en_route -> encaisser
        for statut in ("recuperee", "en_route"):
            r = requests.patch(
                f"{API}/livreur/courses/{cmd_id}/statut",
                json={"statut": statut},
                headers=_h(livreur_tok),
                timeout=30,
            )
            assert r.status_code == 200, f"{statut}: {r.text[:200]}"
        r2 = requests.post(
            f"{API}/livreur/courses/{cmd_id}/encaisser",
            headers=_h(livreur_tok),
            timeout=30,
        )
        assert r2.status_code == 200, r2.text[:200]
        assert r2.json().get("statut") == "livree"
        pytest.commande_livree_id = cmd_id
        pytest.commande_livree_total = r2.json().get("total")
        pytest.commande_livree_produit = r2.json().get("items", [{}])[0]

    def test_commande_annulee_ok(self, client_tok, premier_produit):
        payload = {
            "items": [
                {
                    "produitId": premier_produit["id"],
                    "nom": premier_produit["nom"],
                    "prixUnitaire": premier_produit["prix"],
                    "quantite": 1,
                }
            ],
            "adresse": _adresse_gombe(),
            "moyenPaiement": "cash",
        }
        r = requests.post(
            f"{API}/commandes", json=payload, headers=_h(client_tok), timeout=30
        )
        assert r.status_code == 200
        cid = r.json()["id"]
        r2 = requests.post(
            f"{API}/commandes/{cid}/annuler", headers=_h(client_tok), timeout=30
        )
        assert r2.status_code == 200, r2.text[:200]


# --------------------------------------------------------------------- VENTES
class TestVentesJour:
    def test_401_sans_token(self):
        r = requests.get(f"{API}/admin/ventes", timeout=10)
        assert r.status_code in (401, 403)

    def test_403_client(self, client_tok):
        r = requests.get(f"{API}/admin/ventes", headers=_h(client_tok), timeout=10)
        assert r.status_code == 403

    def test_403_livreur(self, livreur_tok):
        r = requests.get(f"{API}/admin/ventes", headers=_h(livreur_tok), timeout=10)
        assert r.status_code == 403

    def test_shape_ventes(self, admin_tok):
        r = requests.get(f"{API}/admin/ventes", headers=_h(admin_tok), timeout=15)
        assert r.status_code == 200, r.text[:200]
        j = r.json()
        for k in ("date", "chiffre", "nbCommandes", "panierMoyen", "topProduits"):
            assert k in j, f"champ manquant: {k}"
        assert isinstance(j["topProduits"], list)
        assert len(j["topProduits"]) <= 5
        # Vérifier tri décroissant par quantité
        qs = [p["quantite"] for p in j["topProduits"]]
        assert qs == sorted(qs, reverse=True), "topProduits non trié"
        # Chaque produit doit avoir nom/quantite/montant
        for p in j["topProduits"]:
            for k in ("nom", "quantite", "montant"):
                assert k in p
        # panierMoyen cohérent
        if j["nbCommandes"] > 0:
            attendu = round(j["chiffre"] / j["nbCommandes"], 2)
            assert abs(j["panierMoyen"] - attendu) < 0.01

    def test_recue_ne_compte_pas(self, admin_tok, client_tok, premier_produit):
        """Une commande statut 'recue' ne doit PAS changer chiffre ni nbCommandes."""
        avant = requests.get(
            f"{API}/admin/ventes", headers=_h(admin_tok), timeout=15
        ).json()
        payload = {
            "items": [
                {
                    "produitId": premier_produit["id"],
                    "nom": premier_produit["nom"],
                    "prixUnitaire": premier_produit["prix"],
                    "quantite": 2,
                }
            ],
            "adresse": _adresse_gombe(),
            "moyenPaiement": "cash",
        }
        r = requests.post(
            f"{API}/commandes", json=payload, headers=_h(client_tok), timeout=30
        )
        assert r.status_code == 200
        cid = r.json()["id"]
        # attendue en 'recue'
        assert r.json()["statut"] == "recue"

        apres = requests.get(
            f"{API}/admin/ventes", headers=_h(admin_tok), timeout=15
        ).json()
        assert (
            apres["chiffre"] == avant["chiffre"]
        ), f"chiffre modifié par une commande non livrée: {avant['chiffre']} -> {apres['chiffre']}"
        assert apres["nbCommandes"] == avant["nbCommandes"]

        # cleanup: annuler
        requests.post(
            f"{API}/commandes/{cid}/annuler", headers=_h(client_tok), timeout=15
        )

    def test_livree_incremente(self, admin_tok, client_tok, livreur_tok, premier_produit):
        """Une commande passée à 'livree' doit incrémenter chiffre, nbCommandes et topProduits."""
        avant = requests.get(
            f"{API}/admin/ventes", headers=_h(admin_tok), timeout=15
        ).json()

        qte = 3
        payload = {
            "items": [
                {
                    "produitId": premier_produit["id"],
                    "nom": premier_produit["nom"],
                    "prixUnitaire": premier_produit["prix"],
                    "quantite": qte,
                }
            ],
            "adresse": _adresse_gombe(),
            "moyenPaiement": "cash",
        }
        r = requests.post(
            f"{API}/commandes", json=payload, headers=_h(client_tok), timeout=30
        )
        assert r.status_code == 200
        cid = r.json()["id"]
        total = r.json()["total"]

        # Assigner livreur puis passer à livree
        livs = requests.get(
            f"{API}/admin/livreurs", headers=_h(admin_tok), timeout=10
        ).json()
        requests.post(
            f"{API}/admin/commandes/{cid}/assigner",
            json={"livreurId": livs[0]["id"]},
            headers=_h(admin_tok),
            timeout=15,
        )
        for s in ("recuperee", "en_route"):
            requests.patch(
                f"{API}/livreur/courses/{cid}/statut",
                json={"statut": s},
                headers=_h(livreur_tok),
                timeout=15,
            )
        rr = requests.post(
            f"{API}/livreur/courses/{cid}/encaisser",
            headers=_h(livreur_tok),
            timeout=15,
        )
        assert rr.status_code == 200
        assert rr.json()["statut"] == "livree"

        apres = requests.get(
            f"{API}/admin/ventes", headers=_h(admin_tok), timeout=15
        ).json()
        assert apres["nbCommandes"] == avant["nbCommandes"] + 1
        assert abs(apres["chiffre"] - (avant["chiffre"] + total)) < 0.02, (
            f"chiffre attendu {avant['chiffre']+total}, obtenu {apres['chiffre']}"
        )
        # Le produit doit apparaître dans topProduits avec au moins qte unités de plus
        nom = premier_produit["nom"]
        q_avant = next(
            (p["quantite"] for p in avant["topProduits"] if p["nom"] == nom), 0
        )
        q_apres = next(
            (p["quantite"] for p in apres["topProduits"] if p["nom"] == nom), 0
        )
        # Attention: topProduits peut être tronqué à 5 ; on vérifie seulement l'incrément si présent
        if q_apres:
            assert q_apres >= q_avant + qte
