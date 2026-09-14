"""Backend tests for Pinkberry Drc API - covers auth, catalogue, commandes, admin, livreur."""
import os
import time
import uuid

import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://commande-rose.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

CLIENT_TEL = "0990000001"
CLIENT_PWD = "client123"
LIVREUR_TEL = "0820000001"
LIVREUR_PWD = "livreur123"
ADMIN_TEL = "0810000000"
ADMIN_PWD = "admin123"


def _login(tel, pwd):
    r = requests.post(f"{API}/auth/connexion", json={"telephone": tel, "motDePasse": pwd}, timeout=30)
    assert r.status_code == 200, f"login {tel} failed: {r.status_code} {r.text}"
    return r.json()["token"], r.json()["user"]


def _h(tok):
    return {"Authorization": f"Bearer {tok}"}


# ------------------------------------------------------------ catalogue & config
def test_root():
    r = requests.get(f"{API}/", timeout=10)
    assert r.status_code == 200 and r.json().get("ok") is True


def test_produits_10():
    r = requests.get(f"{API}/produits", timeout=15)
    assert r.status_code == 200
    prods = r.json()
    assert len(prods) >= 10, f"expected >=10 products, got {len(prods)}"
    assert all("id" in p and "prix" in p and "categorie" in p for p in prods)


def test_zones_actives():
    r = requests.get(f"{API}/zones", timeout=10)
    assert r.status_code == 200
    zones = r.json()
    actives = {z["commune"] for z in zones if z.get("active")}
    for c in ("Gombe", "Limete", "Ngaliema", "Lingwala"):
        assert c in actives, f"{c} devrait être active"


def test_config():
    r = requests.get(f"{API}/config", timeout=10)
    assert r.status_code == 200
    j = r.json()
    assert j["tauxFC"] == 2800 and j["fraisLivraison"] == 2.5


# ------------------------------------------------------------------------ auth
def test_inscription_returns_code_demo():
    tel = f"099{int(time.time())%1_000_000:06d}"
    r = requests.post(f"{API}/auth/inscription",
                      json={"nom": "TEST User", "telephone": tel, "motDePasse": "test123"}, timeout=15)
    assert r.status_code == 200
    j = r.json()
    assert j["ok"] and len(j["codeDemo"]) == 4
    # verifier-otp
    r2 = requests.post(f"{API}/auth/verifier-otp", json={"telephone": tel, "code": j["codeDemo"]}, timeout=15)
    assert r2.status_code == 200
    assert "token" in r2.json() and r2.json()["user"]["verifie"] is True


def test_inscription_bad_password():
    r = requests.post(f"{API}/auth/inscription",
                      json={"nom": "X", "telephone": "099" + str(uuid.uuid4().int)[:7], "motDePasse": "12"}, timeout=10)
    assert r.status_code == 400


def test_connexion_and_moi():
    tok, user = _login(CLIENT_TEL, CLIENT_PWD)
    assert user["role"] == "client"
    r = requests.get(f"{API}/auth/moi", headers=_h(tok), timeout=10)
    assert r.status_code == 200 and r.json()["telephone"] == CLIENT_TEL


def test_connexion_bad():
    r = requests.post(f"{API}/auth/connexion", json={"telephone": CLIENT_TEL, "motDePasse": "wrong"}, timeout=10)
    assert r.status_code == 401


def test_renvoyer_otp():
    r = requests.post(f"{API}/auth/renvoyer-otp",
                      json={"telephone": CLIENT_TEL, "motDePasse": "x"}, timeout=10)
    assert r.status_code == 200 and "codeDemo" in r.json()


# ---------------------------------------------------------------- commandes flow
@pytest.fixture(scope="module")
def client_ctx():
    tok, user = _login(CLIENT_TEL, CLIENT_PWD)
    prods = requests.get(f"{API}/produits", timeout=15).json()
    return {"tok": tok, "user": user, "prods": prods}


def _cmd_payload(prods, commune="Gombe"):
    p = prods[0]
    return {
        "adresse": {"label": "TEST", "commune": commune, "avenue": "Av Test", "numero": "12",
                    "repere": "près marché", "telephone": CLIENT_TEL},
        "items": [{"produitId": p["id"], "nom": p["nom"], "taille": "Petit",
                   "garnitures": [], "quantite": 2, "prixUnitaire": p["prix"], "emoji": p.get("emoji")}],
    }


def test_commande_refus_zone_non_couverte(client_ctx):
    body = _cmd_payload(client_ctx["prods"], commune="Masina")
    r = requests.post(f"{API}/commandes", json=body, headers=_h(client_ctx["tok"]), timeout=15)
    assert r.status_code == 400
    assert "Masina" in r.text


def test_commande_gombe_success(client_ctx):
    body = _cmd_payload(client_ctx["prods"], commune="Gombe")
    r = requests.post(f"{API}/commandes", json=body, headers=_h(client_ctx["tok"]), timeout=15)
    assert r.status_code == 200, r.text
    cmd = r.json()
    assert cmd["statut"] == "recue"
    assert cmd["fraisLivraison"] == 2.5
    assert cmd["total"] == round(cmd["sousTotal"] + 2.5, 2)
    client_ctx["cmd_id"] = cmd["id"]
    # GET verify persistence
    r2 = requests.get(f"{API}/commandes/{cmd['id']}", headers=_h(client_ctx["tok"]), timeout=10)
    assert r2.status_code == 200 and r2.json()["id"] == cmd["id"]


def test_mes_commandes(client_ctx):
    r = requests.get(f"{API}/commandes/mes", headers=_h(client_ctx["tok"]), timeout=10)
    assert r.status_code == 200 and isinstance(r.json(), list) and len(r.json()) >= 1


def test_annuler_ok_then_forbidden(client_ctx):
    # create fresh
    body = _cmd_payload(client_ctx["prods"])
    cmd = requests.post(f"{API}/commandes", json=body, headers=_h(client_ctx["tok"]), timeout=15).json()
    r = requests.post(f"{API}/commandes/{cmd['id']}/annuler", headers=_h(client_ctx["tok"]), timeout=10)
    assert r.status_code == 200 and r.json()["statut"] == "annulee"
    # re-cancel forbidden
    r2 = requests.post(f"{API}/commandes/{cmd['id']}/annuler", headers=_h(client_ctx["tok"]), timeout=10)
    assert r2.status_code == 400


# ------------------------------------------------------------------ admin flow
@pytest.fixture(scope="module")
def admin_ctx():
    tok, user = _login(ADMIN_TEL, ADMIN_PWD)
    return {"tok": tok, "user": user}


def test_admin_403_for_client(client_ctx):
    r = requests.get(f"{API}/admin/commandes", headers=_h(client_ctx["tok"]), timeout=10)
    assert r.status_code == 403


def test_admin_commandes_and_stats(admin_ctx):
    r = requests.get(f"{API}/admin/commandes", headers=_h(admin_ctx["tok"]), timeout=15)
    assert r.status_code == 200 and isinstance(r.json(), list)
    r2 = requests.get(f"{API}/admin/stats", headers=_h(admin_ctx["tok"]), timeout=10)
    assert r2.status_code == 200 and "total" in r2.json()


def test_admin_produit_crud(admin_ctx):
    payload = {"nom": "TEST Sorbet", "categorie": "Pots de crème", "prix": 3.5,
               "emoji": "🍧", "description": "test", "tailles": [], "garnitures": []}
    r = requests.post(f"{API}/admin/produits", json=payload, headers=_h(admin_ctx["tok"]), timeout=15)
    assert r.status_code == 200, r.text
    pid = r.json()["id"]
    payload["prix"] = 4.0
    r2 = requests.put(f"{API}/admin/produits/{pid}", json=payload, headers=_h(admin_ctx["tok"]), timeout=10)
    assert r2.status_code == 200 and r2.json()["prix"] == 4.0
    r3 = requests.delete(f"{API}/admin/produits/{pid}", headers=_h(admin_ctx["tok"]), timeout=10)
    assert r3.status_code == 200


def test_admin_zone_toggle(admin_ctx):
    zones = requests.get(f"{API}/zones", timeout=10).json()
    masina = next(z for z in zones if z["commune"] == "Masina")
    r = requests.put(f"{API}/admin/zones/{masina['id']}", json={"active": True},
                     headers=_h(admin_ctx["tok"]), timeout=10)
    assert r.status_code == 200 and r.json()["active"] is True
    # revert
    r2 = requests.put(f"{API}/admin/zones/{masina['id']}", json={"active": False},
                      headers=_h(admin_ctx["tok"]), timeout=10)
    assert r2.status_code == 200 and r2.json()["active"] is False


def test_admin_livreurs_and_assign(admin_ctx, client_ctx):
    # list livreurs
    r = requests.get(f"{API}/admin/livreurs", headers=_h(admin_ctx["tok"]), timeout=10)
    assert r.status_code == 200
    livreurs = r.json()
    assert len(livreurs) >= 2
    jonas = next(lv for lv in livreurs if lv["telephone"] == LIVREUR_TEL)
    # create a fresh order, assign, then set en_preparation
    body = _cmd_payload(client_ctx["prods"])
    cmd = requests.post(f"{API}/commandes", json=body, headers=_h(client_ctx["tok"]), timeout=15).json()
    client_ctx["assigned_cmd_id"] = cmd["id"]
    ra = requests.post(f"{API}/admin/commandes/{cmd['id']}/assigner",
                       json={"livreurId": jonas["id"]}, headers=_h(admin_ctx["tok"]), timeout=10)
    assert ra.status_code == 200 and ra.json()["livreurId"] == jonas["id"]
    rs = requests.patch(f"{API}/admin/commandes/{cmd['id']}/statut",
                        json={"statut": "en_preparation"}, headers=_h(admin_ctx["tok"]), timeout=10)
    assert rs.status_code == 200 and rs.json()["statut"] == "en_preparation"


def test_admin_livreur_create_update(admin_ctx):
    tel = f"082{int(time.time())%1_000_000:06d}"
    payload = {"nom": "TEST Coursier", "telephone": tel, "vehicule": "Vélo",
               "plaque": "TEST-1", "note": 5.0, "actif": True, "motDePasse": "test123"}
    r = requests.post(f"{API}/admin/livreurs", json=payload, headers=_h(admin_ctx["tok"]), timeout=15)
    assert r.status_code == 200
    lv_id = r.json()["id"]
    payload["vehicule"] = "Moto"
    r2 = requests.put(f"{API}/admin/livreurs/{lv_id}", json=payload, headers=_h(admin_ctx["tok"]), timeout=10)
    assert r2.status_code == 200 and r2.json()["vehicule"] == "Moto"


# --------------------------------------------------------------- livreur flow
def test_livreur_flow_position_and_encaisser(client_ctx, admin_ctx):
    tok_lv, user_lv = _login(LIVREUR_TEL, LIVREUR_PWD)
    # ensure an assigned order exists
    cmd_id = client_ctx.get("assigned_cmd_id")
    assert cmd_id, "assigned order missing from earlier test"
    # livreur: get courses
    r = requests.get(f"{API}/livreur/courses", headers=_h(tok_lv), timeout=10)
    assert r.status_code == 200
    assert any(c["id"] == cmd_id for c in r.json())
    # status transitions: en_preparation->recuperee->en_route
    for st in ("recuperee", "en_route"):
        rs = requests.patch(f"{API}/livreur/courses/{cmd_id}/statut",
                            json={"statut": st}, headers=_h(tok_lv), timeout=10)
        assert rs.status_code == 200 and rs.json()["statut"] == st
    # position update -> distanceKm + etaMinutes on the order
    rp = requests.post(f"{API}/livreur/position", json={"lat": -4.320, "lng": 15.320},
                       headers=_h(tok_lv), timeout=10)
    assert rp.status_code == 200 and rp.json()["ok"]
    rd = requests.get(f"{API}/commandes/{cmd_id}", headers=_h(client_ctx["tok"]), timeout=10)
    assert rd.status_code == 200
    dj = rd.json()
    assert dj.get("positionLivreur"), "positionLivreur missing after position update"
    assert dj.get("etaMinutes") is not None, "etaMinutes missing after position update"
    # encaisser -> livree
    re_ = requests.post(f"{API}/livreur/courses/{cmd_id}/encaisser", headers=_h(tok_lv), timeout=10)
    assert re_.status_code == 200
    fin = re_.json()
    assert fin["statut"] == "livree" and fin["cashEncaisse"] is True


def test_livreur_role_required():
    tok_cli, _ = _login(CLIENT_TEL, CLIENT_PWD)
    r = requests.get(f"{API}/livreur/courses", headers=_h(tok_cli), timeout=10)
    assert r.status_code == 403


def test_paiement_client_note(client_ctx):
    # crée une nouvelle commande et confirme paiement + note
    body = _cmd_payload(client_ctx["prods"])
    cmd = requests.post(f"{API}/commandes", json=body, headers=_h(client_ctx["tok"]), timeout=15).json()
    r = requests.post(f"{API}/commandes/{cmd['id']}/paiement",
                      json={"note": 5}, headers=_h(client_ctx["tok"]), timeout=10)
    assert r.status_code == 200 and r.json()["note"] == 5
