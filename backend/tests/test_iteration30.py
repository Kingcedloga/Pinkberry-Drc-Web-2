"""Tests iteration 30 — Pinkberry Drc / notifications push web (VAPID).

Verifie :
- GET /api/push/web/cle-publique  : public (sans token), renvoie {clePublique, actif: true}.
- PUT /api/push/web/abonnement   : 401 sans token ; 400 clefs manquantes ; 400 endpoint http ;
                                    200 avec un abonnement valide ; IDEMPOTENCE (2 PUT du meme
                                    endpoint => 1 seul document / etat.abonnements == 1).
- DELETE /api/push/web/abonnement : supprime l'abonnement du user connecte ; cloisonnement
                                    (userB ne peut pas supprimer l'abonnement de userA).
- GET /api/push/web/etat          : compte correct (0 apres suppression).
- Declenchement sur evenements    : POST /api/commandes (client) puis assignation + PATCH
                                    /admin/commandes/{id}/statut avec un abonnement pointant
                                    vers un endpoint FCM inexistant -> les endpoints metier
                                    repondent 200 (jamais 5xx a cause du push) et l'abonnement
                                    factice finit supprime (FCM 404/410 -> nettoyage).
- Non regression : parcours metier reste fonctionnel malgre l'absence de EMERGENT_PUSH_KEY reel.

Nettoyage : suppression des commandes et abonnements crees (prefixe TEST_ITER30 sur le label
adresse et endpoint contenant 'faux-test-iter30').
"""
from __future__ import annotations

import base64
import os
import time
import uuid

import pytest
import requests
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.serialization import (
    Encoding,
    PublicFormat,
)
from pymongo import MongoClient

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")

_WORKER = os.environ.get("PYTEST_XDIST_WORKER", "master")
LABEL_PREFIX = f"TEST_ITER30_{_WORKER}"

CLIENT = ("0990000001", "client123")
CLIENT_ALT = ("0990000002", "client123")  # 2e client demo (si existant)
ADMIN = ("0810000000", "admin123")
LIVREUR = ("0820000001", "livreur123")


# ---------------------------------------------------------------------- helpers
def _login(sess: requests.Session, tel: str, mdp: str) -> str:
    r = sess.post(
        f"{BASE_URL}/api/auth/connexion",
        json={"telephone": tel, "motDePasse": mdp},
        timeout=25,
    )
    assert r.status_code == 200, f"login {tel}: {r.status_code} {r.text[:200]}"
    return r.json()["token"]


def _b64url(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()


def _new_p256dh() -> str:
    """Cle publique P-256 valide (uncompressed) en base64url."""
    pk = ec.generate_private_key(ec.SECP256R1()).public_key()
    raw = pk.public_bytes(Encoding.X962, PublicFormat.UncompressedPoint)
    return _b64url(raw)


def _new_auth() -> str:
    return _b64url(os.urandom(16))


def _endpoint_fcm(suffix: str) -> str:
    # Endpoint FCM inexistant -> renvoie 404 quand pywebpush envoie
    return f"https://fcm.googleapis.com/fcm/send/faux-test-iter30-{suffix}-{uuid.uuid4().hex[:8]}"


@pytest.fixture(scope="module")
def sess() -> requests.Session:
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def tokens(sess):
    d = {
        "client": _login(sess, *CLIENT),
        "admin": _login(sess, *ADMIN),
        "livreur": _login(sess, *LIVREUR),
    }
    try:
        d["client_alt"] = _login(sess, *CLIENT_ALT)
    except AssertionError:
        d["client_alt"] = None
    return d


def _mongo():
    return MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]


def _creer_commande(sess, token, label=None):
    if label is None:
        label = LABEL_PREFIX
    body = {
        "items": [
            {
                "produitId": "p",
                "nom": "Pot Test",
                "prixUnitaire": 3.5,
                "quantite": 1,
                "options": {},
            }
        ],
        "adresse": {
            "label": label,
            "commune": "Gombe",
            "avenue": "Test",
            "numero": "1",
            "repere": "iter30",
            "telephone": "0990000001",
            "lat": -4.325,
            "lng": 15.322,
        },
        "modePaiement": "cash",
    }
    r = sess.post(
        f"{BASE_URL}/api/commandes",
        json=body,
        headers={"Authorization": f"Bearer {token}"},
        timeout=30,
    )
    assert r.status_code == 200, f"creer_commande: {r.status_code} {r.text[:250]}"
    return r.json()


# ============================================================ 1. cle publique
class TestClePublique:
    def test_cle_publique_publique_sans_token(self):
        r = requests.get(f"{BASE_URL}/api/push/web/cle-publique", timeout=15)
        assert r.status_code == 200, r.text[:200]
        d = r.json()
        assert "clePublique" in d
        assert isinstance(d["clePublique"], str) and len(d["clePublique"]) > 40
        assert d.get("actif") is True

    def test_cle_publique_pas_de_prive(self):
        r = requests.get(f"{BASE_URL}/api/push/web/cle-publique", timeout=15)
        prive = os.environ.get("VAPID_PRIVATE_KEY", "").strip()
        if prive:
            assert prive not in r.text


# ================================================ 2. PUT /push/web/abonnement
class TestPutAbonnement:
    def test_sans_token_401(self, sess):
        r = sess.put(
            f"{BASE_URL}/api/push/web/abonnement",
            json={
                "endpoint": _endpoint_fcm("noauth"),
                "keys": {"p256dh": _new_p256dh(), "auth": _new_auth()},
            },
            timeout=15,
        )
        assert r.status_code in (401, 403), r.status_code

    def test_cles_incompletes_400(self, sess, tokens):
        r = sess.put(
            f"{BASE_URL}/api/push/web/abonnement",
            json={
                "endpoint": _endpoint_fcm("incomplet"),
                "keys": {"p256dh": _new_p256dh()},  # 'auth' manquant
            },
            headers={"Authorization": f"Bearer {tokens['client']}"},
            timeout=15,
        )
        assert r.status_code == 400, r.text[:200]

    def test_cles_extra_400(self, sess, tokens):
        r = sess.put(
            f"{BASE_URL}/api/push/web/abonnement",
            json={
                "endpoint": _endpoint_fcm("extra"),
                "keys": {
                    "p256dh": _new_p256dh(),
                    "auth": _new_auth(),
                    "bidon": "x",
                },
            },
            headers={"Authorization": f"Bearer {tokens['client']}"},
            timeout=15,
        )
        assert r.status_code == 400, r.text[:200]

    def test_endpoint_http_refuse_400(self, sess, tokens):
        r = sess.put(
            f"{BASE_URL}/api/push/web/abonnement",
            json={
                "endpoint": "http://fcm.googleapis.com/fcm/send/x",  # non https
                "keys": {"p256dh": _new_p256dh(), "auth": _new_auth()},
            },
            headers={"Authorization": f"Bearer {tokens['client']}"},
            timeout=15,
        )
        assert r.status_code == 400, r.text[:200]

    def test_abonnement_valide_200_et_idempotence(self, sess, tokens):
        endpoint = _endpoint_fcm("idem")
        payload = {
            "endpoint": endpoint,
            "keys": {"p256dh": _new_p256dh(), "auth": _new_auth()},
        }
        h = {"Authorization": f"Bearer {tokens['admin']}"}
        mongo = _mongo()

        # Nettoie l'etat initial pour ce endpoint precis (isolation xdist :
        # on n'utilise pas /etat car un autre worker peut manipuler d'autres
        # abonnements du meme user).
        mongo.push_subscriptions.delete_many({"endpoint": endpoint})

        # PUT 1
        r1 = sess.put(
            f"{BASE_URL}/api/push/web/abonnement",
            json=payload,
            headers=h,
            timeout=15,
        )
        assert r1.status_code == 200, r1.text[:200]
        assert r1.json().get("ok") is True
        assert mongo.push_subscriptions.count_documents({"endpoint": endpoint}) == 1

        # /etat doit compter au moins 1 abonnement pour ce user
        e1 = sess.get(
            f"{BASE_URL}/api/push/web/etat", headers=h, timeout=15
        ).json()
        assert e1["abonnements"] >= 1

        # PUT 2 (meme endpoint) -> pas de doublon (verifie en Mongo pour eviter
        # les interferences entre workers xdist)
        r2 = sess.put(
            f"{BASE_URL}/api/push/web/abonnement",
            json=payload,
            headers=h,
            timeout=15,
        )
        assert r2.status_code == 200
        assert (
            mongo.push_subscriptions.count_documents({"endpoint": endpoint}) == 1
        ), "idempotence rompue : le meme endpoint a cree un 2eme document"

        # Cleanup
        mongo.push_subscriptions.delete_many({"endpoint": endpoint})


# ============================================= 3. DELETE + cloisonnement + etat
class TestDeleteEtCloisonnement:
    def test_delete_par_proprietaire(self, sess, tokens):
        endpoint = _endpoint_fcm("del")
        keys = {"p256dh": _new_p256dh(), "auth": _new_auth()}
        h = {"Authorization": f"Bearer {tokens['client']}"}

        # register
        r = sess.put(
            f"{BASE_URL}/api/push/web/abonnement",
            json={"endpoint": endpoint, "keys": keys},
            headers=h,
            timeout=15,
        )
        assert r.status_code == 200
        e0 = sess.get(
            f"{BASE_URL}/api/push/web/etat", headers=h, timeout=15
        ).json()["abonnements"]
        assert e0 >= 1

        # delete
        rd = sess.delete(
            f"{BASE_URL}/api/push/web/abonnement",
            json={"endpoint": endpoint, "keys": keys},
            headers=h,
            timeout=15,
        )
        assert rd.status_code == 200

        # etat descend d'un cran
        e1 = sess.get(
            f"{BASE_URL}/api/push/web/etat", headers=h, timeout=15
        ).json()["abonnements"]
        assert e1 == e0 - 1

        mongo = _mongo()
        assert mongo.push_subscriptions.count_documents({"endpoint": endpoint}) == 0

    def test_delete_cloisonne_entre_users(self, sess, tokens):
        """Un autre user (livreur) ne doit pas pouvoir supprimer l'abonnement du client."""
        endpoint = _endpoint_fcm("cloison")
        keys = {"p256dh": _new_p256dh(), "auth": _new_auth()}
        h_client = {"Authorization": f"Bearer {tokens['client']}"}
        h_autre = {"Authorization": f"Bearer {tokens['livreur']}"}

        # Le client enregistre
        r = sess.put(
            f"{BASE_URL}/api/push/web/abonnement",
            json={"endpoint": endpoint, "keys": keys},
            headers=h_client,
            timeout=15,
        )
        assert r.status_code == 200

        mongo = _mongo()
        assert mongo.push_subscriptions.count_documents({"endpoint": endpoint}) == 1

        # L'autre user tente de supprimer
        rd = sess.delete(
            f"{BASE_URL}/api/push/web/abonnement",
            json={"endpoint": endpoint, "keys": keys},
            headers=h_autre,
            timeout=15,
        )
        # Reponse OK cote API (par defaut) mais le doc doit rester
        assert rd.status_code in (200, 204, 403, 404)
        assert (
            mongo.push_subscriptions.count_documents({"endpoint": endpoint}) == 1
        ), "cloisonnement rompu : l'abonnement de A a ete supprime par B"

        # Le proprietaire supprime bien
        rd2 = sess.delete(
            f"{BASE_URL}/api/push/web/abonnement",
            json={"endpoint": endpoint, "keys": keys},
            headers=h_client,
            timeout=15,
        )
        assert rd2.status_code == 200
        assert mongo.push_subscriptions.count_documents({"endpoint": endpoint}) == 0

    def test_etat_zero_sans_abonnement(self, sess, tokens):
        # Nettoie tout ce que le client aurait pu laisser dans les autres tests
        mongo = _mongo()
        user_id = mongo.users.find_one({"telephone": CLIENT[0]}, {"_id": 0, "id": 1})["id"]
        mongo.push_subscriptions.delete_many({"userId": user_id})

        h = {"Authorization": f"Bearer {tokens['client']}"}
        e = sess.get(f"{BASE_URL}/api/push/web/etat", headers=h, timeout=15).json()
        assert e["abonnements"] == 0


# ============================================= 4. Declenchement sur evenements
class TestDeclenchementSurEvenements:
    """Enregistre un abonnement factice pour le client, cree une commande, assigne un
    livreur puis change le statut. Les endpoints metier doivent repondre 200 et
    l'abonnement factice doit finir supprime (FCM renvoie 404/410 -> cleanup)."""

    def test_flow_complet_avec_cleanup_abonnement_expire(self, sess, tokens):
        mongo = _mongo()
        client_user = mongo.users.find_one({"telephone": CLIENT[0]}, {"_id": 0})
        assert client_user is not None
        # Nettoyage prealable
        mongo.push_subscriptions.delete_many({"userId": client_user["id"]})

        endpoint = _endpoint_fcm("trigger")
        keys = {"p256dh": _new_p256dh(), "auth": _new_auth()}
        h_client = {"Authorization": f"Bearer {tokens['client']}"}
        h_admin = {"Authorization": f"Bearer {tokens['admin']}"}

        # 1. abonnement pour le client
        r = sess.put(
            f"{BASE_URL}/api/push/web/abonnement",
            json={"endpoint": endpoint, "keys": keys},
            headers=h_client,
            timeout=15,
        )
        assert r.status_code == 200, r.text[:200]
        assert mongo.push_subscriptions.count_documents({"endpoint": endpoint}) == 1

        # 2. creation commande client (cash) -> notifier_admins + potentiellement notifier_client
        cmd = _creer_commande(sess, tokens["client"], label=f"{LABEL_PREFIX}_trigger")
        assert cmd.get("id")
        cmd_id = cmd["id"]

        # 3. assignation livreur
        livreurs = sess.get(
            f"{BASE_URL}/api/admin/livreurs", headers=h_admin, timeout=15
        )
        assert livreurs.status_code == 200
        lst = livreurs.json()
        assert isinstance(lst, list) and lst, "aucun livreur seed disponible"
        livreur_id = lst[0]["id"]
        ra = sess.post(
            f"{BASE_URL}/api/admin/commandes/{cmd_id}/assigner",
            json={"livreurId": livreur_id},
            headers=h_admin,
            timeout=30,
        )
        assert ra.status_code == 200, f"assigner: {ra.status_code} {ra.text[:250]}"
        assert ra.status_code < 500

        # 4. changement de statut : en_preparation puis en_route (declenche notifier_client)
        for statut in ("en_preparation", "en_route"):
            rs = sess.patch(
                f"{BASE_URL}/api/admin/commandes/{cmd_id}/statut",
                json={"statut": statut},
                headers=h_admin,
                timeout=30,
            )
            assert rs.status_code == 200, (
                f"statut {statut}: {rs.status_code} {rs.text[:250]}"
            )
            # jamais 5xx a cause du push
            assert rs.status_code < 500

        # 5. Laisser le temps aux envois push (thread) de se declencher et
        # provoquer le nettoyage de l'abonnement factice.
        deadline = time.time() + 25
        restant = None
        while time.time() < deadline:
            restant = mongo.push_subscriptions.count_documents({"endpoint": endpoint})
            if restant == 0:
                break
            time.sleep(1.0)

        # Verif finale via GET /etat = 0 (abonnement factice supprime par le nettoyage)
        e_final = sess.get(
            f"{BASE_URL}/api/push/web/etat", headers=h_client, timeout=15
        ).json()
        assert e_final["abonnements"] == 0, (
            f"L'abonnement factice n'a pas ete nettoye apres 404/410 FCM "
            f"(reste {restant} doc, etat.abonnements={e_final['abonnements']})"
        )

        # Cleanup commande de test
        try:
            sess.delete(
                f"{BASE_URL}/api/admin/commandes/{cmd_id}",
                headers=h_admin,
                timeout=15,
            )
        except Exception:
            pass


# ================================================================ 5. non regression
class TestNonRegressionMetier:
    """Le parcours metier reste fonctionnel meme sans EMERGENT_PUSH_KEY reel."""

    def test_parcours_commande_annulation(self, sess, tokens):
        h_client = {"Authorization": f"Bearer {tokens['client']}"}
        h_admin = {"Authorization": f"Bearer {tokens['admin']}"}
        cmd = _creer_commande(sess, tokens["client"], label=f"{LABEL_PREFIX}_regr")
        cmd_id = cmd["id"]

        # Statut recu
        r = sess.patch(
            f"{BASE_URL}/api/admin/commandes/{cmd_id}/statut",
            json={"statut": "en_preparation"},
            headers=h_admin,
            timeout=20,
        )
        assert r.status_code == 200

        # Annulation par admin
        r2 = sess.patch(
            f"{BASE_URL}/api/admin/commandes/{cmd_id}/statut",
            json={"statut": "annulee"},
            headers=h_admin,
            timeout=20,
        )
        assert r2.status_code == 200
        assert r2.json().get("statut") == "annulee"

        # Cleanup
        try:
            sess.delete(
                f"{BASE_URL}/api/admin/commandes/{cmd_id}",
                headers=h_admin,
                timeout=15,
            )
        except Exception:
            pass


# ---------------------------------------------------------------- teardown module
def teardown_module(_module):
    """Nettoyage global : supprime les commandes TEST_ITER30 et les abonnements
    push factices restants."""
    mongo = _mongo()
    mongo.commandes.delete_many({"adresse.label": {"$regex": f"^{LABEL_PREFIX}"}})
    mongo.push_subscriptions.delete_many({"endpoint": {"$regex": "faux-test-iter30"}})
