import ipaddress
import logging
import math
import os
import random
import re
import uuid
from datetime import datetime, timedelta, timezone
from html import escape
from html.parser import HTMLParser
from pathlib import Path
from typing import Any, Dict, List, Literal, Optional
from urllib.parse import urlparse

import bcrypt
import httpx
import jwt
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, FastAPI, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from starlette.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGO = "HS256"
JWT_DAYS = 30

EMAIL_BASE_URL = "https://integrations.emergentagent.com"
EMAIL_KEY = os.environ.get("EMERGENT_EMAIL_KEY")
EMAIL_FROM_NAME = os.environ.get("EMAIL_FROM_NAME", "Pinkberry Drc")

TAUX_FC = float(os.environ.get("TAUX_FC", "2800"))
FRAIS_LIVRAISON = float(os.environ.get("FRAIS_LIVRAISON", "2.5"))

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI()
api_router = APIRouter(prefix="/api")
security = HTTPBearer(auto_error=False)


# ---------------------------------------------------------------- email (G1-G5)
_SHORTENERS = ("bit.ly", "tinyurl.com", "t.co", "is.gd", "cutt.ly", "goo.gl", "rebrand.ly")
_CRED_ASK = (
    "reply with your password", "reply with the code", "send your password", "cvv",
    "send us your password", "enter your password below", "confirm your card number",
    "your full card number", "seed phrase", "recovery phrase", "verify your card",
    "social security number", "confirm your bank details",
)
_HOSTISH = re.compile(r"\b(?:https?://)?((?:[a-z0-9-]+\.)+[a-z]{2,})", re.I)


def _host_ok(host: str) -> bool:
    if not host or "xn--" in host:
        return False
    try:
        ipaddress.ip_address(host)
        return False
    except ValueError:
        pass
    return not any(host == s or host.endswith("." + s) for s in _SHORTENERS)


def _same_site(shown: str, real: str) -> bool:
    return shown == real or real.endswith("." + shown) or shown.endswith("." + real)


class _EmailScan(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags, self.urls, self.anchors = set(), [], []
        self._href, self._text = None, []

    def handle_starttag(self, tag, attrs):
        self.tags.add(tag.lower())
        self.urls += [v for k, v in attrs if k.lower() in ("href", "src") and v]
        if tag.lower() == "a":
            self._href = dict((k.lower(), v) for k, v in attrs).get("href")
            self._text = []

    def handle_data(self, data):
        if self._href is not None:
            self._text.append(data)

    def handle_endtag(self, tag):
        if tag.lower() == "a" and self._href is not None:
            self.anchors.append((self._href, "".join(self._text)))
            self._href, self._text = None, []


def _assert_safe_email(subject: str, html: str) -> None:
    scan = _EmailScan()
    scan.feed(html)
    if scan.tags & {"form", "input", "textarea", "select"}:
        raise ValueError("No forms or input fields in email (G2)")
    body = f"{subject}\n{html}".lower()
    for p in _CRED_ASK:
        if p in body:
            raise ValueError(f"Email asks the recipient for credentials: {p!r} (G2)")
    for url in scan.urls:
        low = url.strip().lower()
        if low.startswith(("mailto:", "tel:", "cid:", "#")):
            continue
        if not low.startswith("https://"):
            raise ValueError(f"Email links/assets must be absolute https: {url!r} (G3)")
        host = urlparse(low).hostname or ""
        if not _host_ok(host) or urlparse(low).username is not None:
            raise ValueError(f"Shortened, numeric-host or credential-bearing URL: {url!r} (G3)")
    for href, text in scan.anchors:
        real = urlparse(href.strip().lower()).hostname or ""
        if not real:
            continue
        for m in _HOSTISH.finditer(text):
            if not _same_site(m.group(1).lower(), real):
                raise ValueError(f"Anchor text {m.group(1)!r} != real link host {real!r} (G3)")


async def send_email(*, to: str, subject: str, html: str) -> Optional[str]:
    _assert_safe_email(subject, html)
    if not EMAIL_KEY:
        logger.warning("EMERGENT_EMAIL_KEY absent - envoi d'email desactive (mode demo)")
        return None
    payload = {"to": [to], "subject": subject, "html": html, "from_name": EMAIL_FROM_NAME}
    try:
        async with httpx.AsyncClient(timeout=30) as http:
            resp = await http.post(
                f"{EMAIL_BASE_URL}/api/v1/email/send",
                headers={"X-Email-Key": EMAIL_KEY},
                json=payload,
            )
        resp.raise_for_status()
        return resp.json().get("id")
    except Exception as e:  # l'echec d'email ne doit jamais bloquer l'inscription
        logger.error(f"Email send error: {e}")
        return None


def _otp_email_html(nom: str, code: str) -> str:
    return (
        '<table role="presentation" width="100%"><tr><td style="padding:24px;'
        'font-family:Arial,sans-serif;color:#2A1721">'
        f'<h2 style="color:#E6156F;margin:0 0 12px">pinkberry</h2>'
        f'<p>Bonjour {escape(nom)},</p>'
        '<p>Voici votre code de verification pour activer votre compte :</p>'
        f'<p style="font-size:32px;letter-spacing:8px;font-weight:bold;color:#E6156F">{escape(code)}</p>'
        '<p>Ce code expire dans 10 minutes.</p>'
        f'<p style="font-size:12px;color:#9A8E94">Envoye par {escape(EMAIL_FROM_NAME)}. '
        'Nous ne vous demandons jamais votre mot de passe par email.</p>'
        '</td></tr></table>'
    )


# ---------------------------------------------------------------------- helpers
def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat()


def hash_pwd(pwd: str) -> str:
    return bcrypt.hashpw(pwd.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def check_pwd(pwd: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pwd.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def norm_tel(tel: str) -> str:
    return re.sub(r"[^0-9+]", "", tel or "")


def make_token(user_id: str) -> str:
    return jwt.encode(
        {"sub": user_id, "exp": now_utc() + timedelta(days=JWT_DAYS)}, JWT_SECRET, algorithm=JWT_ALGO
    )


async def get_current_user(cred: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> Dict[str, Any]:
    if cred is None:
        raise HTTPException(status_code=401, detail="Non authentifie")
    try:
        data = jwt.decode(cred.credentials, JWT_SECRET, algorithms=[JWT_ALGO])
    except Exception:
        raise HTTPException(status_code=401, detail="Session expiree")
    user = await db.users.find_one({"id": data.get("sub")}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Utilisateur introuvable")
    return user


async def require_admin(user=Depends(get_current_user)) -> Dict[str, Any]:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Acces reserve a l'administrateur")
    return user


async def require_livreur(user=Depends(get_current_user)) -> Dict[str, Any]:
    if user.get("role") != "livreur":
        raise HTTPException(status_code=403, detail="Acces reserve au livreur")
    return user


def public_user(u: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": u["id"],
        "nom": u["nom"],
        "telephone": u["telephone"],
        "email": u.get("email"),
        "role": u.get("role", "client"),
        "verifie": u.get("verifie", False),
        "livreurId": u.get("livreurId"),
    }


def haversine(a_lat: float, a_lng: float, b_lat: float, b_lng: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(a_lat), math.radians(b_lat)
    dp = p2 - p1
    dl = math.radians(b_lng - a_lng)
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


# ----------------------------------------------------------------------- models
class InscriptionIn(BaseModel):
    nom: str
    telephone: str
    email: Optional[str] = None
    motDePasse: str


class OtpIn(BaseModel):
    telephone: str
    code: str


class ConnexionIn(BaseModel):
    telephone: str
    motDePasse: str


class Taille(BaseModel):
    nom: str
    ecart: float = 0


class Garniture(BaseModel):
    nom: str
    prix: float = 0


class ProduitIn(BaseModel):
    nom: str
    categorie: str
    prix: float
    image: Optional[str] = None
    emoji: Optional[str] = None
    description: Optional[str] = None
    disponible: bool = True
    tailles: List[Taille] = Field(default_factory=list)
    garnitures: List[Garniture] = Field(default_factory=list)


class AdresseIn(BaseModel):
    label: str
    commune: str
    avenue: str
    numero: str
    repere: str
    telephone: str
    lat: Optional[float] = None
    lng: Optional[float] = None


class ItemIn(BaseModel):
    produitId: str
    nom: str
    taille: Optional[str] = None
    garnitures: List[Garniture] = Field(default_factory=list)
    quantite: int = 1
    prixUnitaire: float
    emoji: Optional[str] = None
    image: Optional[str] = None


class CommandeIn(BaseModel):
    adresse: AdresseIn
    items: List[ItemIn]


class StatutIn(BaseModel):
    statut: Literal["recue", "en_preparation", "recuperee", "en_route", "livree", "annulee"]


class PositionIn(BaseModel):
    lat: float
    lng: float


class LivreurIn(BaseModel):
    nom: str
    telephone: str
    vehicule: str = "Moto"
    plaque: str = ""
    note: float = 5.0
    actif: bool = True
    motDePasse: Optional[str] = None


class ZoneIn(BaseModel):
    active: bool


class ConfigIn(BaseModel):
    tauxFC: float


class AssignIn(BaseModel):
    livreurId: str


class PaiementIn(BaseModel):
    note: Optional[int] = None


# ------------------------------------------------------------------------- auth
@api_router.post("/auth/inscription")
async def inscription(body: InscriptionIn):
    tel = norm_tel(body.telephone)
    if len(tel) < 9:
        raise HTTPException(status_code=400, detail="Numero de telephone invalide")
    if len(body.motDePasse) < 6:
        raise HTTPException(status_code=400, detail="Mot de passe trop court (6 caracteres minimum)")
    existing = await db.users.find_one({"telephone": tel})
    if existing and existing.get("verifie"):
        raise HTTPException(status_code=400, detail="Ce numero est deja utilise")
    code = f"{random.randint(0, 9999):04d}"
    doc = {
        "id": existing["id"] if existing else str(uuid.uuid4()),
        "nom": body.nom.strip(),
        "telephone": tel,
        "email": (body.email or "").strip() or None,
        "motDePasseHash": hash_pwd(body.motDePasse),
        "role": "client",
        "verifie": False,
        "createdAt": iso(now_utc()),
    }
    await db.users.replace_one({"telephone": tel}, doc, upsert=True)
    await db.otps.replace_one(
        {"telephone": tel},
        {"telephone": tel, "code": code, "expireAt": iso(now_utc() + timedelta(minutes=10))},
        upsert=True,
    )
    envoye = False
    if doc["email"]:
        envoye = bool(
            await send_email(
                to=doc["email"],
                subject=f"Votre code de verification {EMAIL_FROM_NAME}",
                html=_otp_email_html(doc["nom"], code),
            )
        )
    logger.info(f"OTP pour {tel}: {code}")
    return {"ok": True, "telephone": tel, "emailEnvoye": envoye, "codeDemo": code}


@api_router.post("/auth/renvoyer-otp")
async def renvoyer_otp(body: ConnexionIn):
    tel = norm_tel(body.telephone)
    user = await db.users.find_one({"telephone": tel}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Compte introuvable")
    code = f"{random.randint(0, 9999):04d}"
    await db.otps.replace_one(
        {"telephone": tel},
        {"telephone": tel, "code": code, "expireAt": iso(now_utc() + timedelta(minutes=10))},
        upsert=True,
    )
    if user.get("email"):
        await send_email(
            to=user["email"],
            subject=f"Votre code de verification {EMAIL_FROM_NAME}",
            html=_otp_email_html(user["nom"], code),
        )
    return {"ok": True, "codeDemo": code}


@api_router.post("/auth/verifier-otp")
async def verifier_otp(body: OtpIn):
    tel = norm_tel(body.telephone)
    otp = await db.otps.find_one({"telephone": tel}, {"_id": 0})
    if not otp or otp.get("code") != body.code.strip():
        raise HTTPException(status_code=400, detail="Code incorrect")
    if otp.get("expireAt") and otp["expireAt"] < iso(now_utc()):
        raise HTTPException(status_code=400, detail="Code expire, demandez un nouveau code")
    user = await db.users.find_one({"telephone": tel}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Compte introuvable")
    await db.users.update_one({"id": user["id"]}, {"$set": {"verifie": True}})
    await db.otps.delete_one({"telephone": tel})
    user["verifie"] = True
    return {"token": make_token(user["id"]), "user": public_user(user)}


@api_router.post("/auth/connexion")
async def connexion(body: ConnexionIn):
    tel = norm_tel(body.telephone)
    user = await db.users.find_one({"telephone": tel}, {"_id": 0})
    if not user or not check_pwd(body.motDePasse, user.get("motDePasseHash", "")):
        raise HTTPException(status_code=401, detail="Telephone ou mot de passe incorrect")
    if not user.get("verifie"):
        raise HTTPException(status_code=403, detail="Compte non verifie, verifiez votre code")
    return {"token": make_token(user["id"]), "user": public_user(user)}


@api_router.get("/auth/moi")
async def moi(user=Depends(get_current_user)):
    return public_user(user)


# --------------------------------------------------------------------- catalogue
@api_router.get("/produits")
async def liste_produits():
    items = await db.produits.find({}, {"_id": 0}).to_list(500)
    return sorted(items, key=lambda p: (p["categorie"], p["nom"]))


@api_router.get("/categories")
async def liste_categories():
    return ["Tous", "Pots de crème", "Smoothies", "Toppings", "Boissons"]


@api_router.post("/admin/produits")
async def creer_produit(body: ProduitIn, _=Depends(require_admin)):
    doc = body.model_dump()
    doc["id"] = str(uuid.uuid4())
    await db.produits.insert_one(dict(doc))
    return {k: v for k, v in doc.items() if k != "_id"}


@api_router.put("/admin/produits/{produit_id}")
async def modifier_produit(produit_id: str, body: ProduitIn, _=Depends(require_admin)):
    doc = body.model_dump()
    res = await db.produits.update_one({"id": produit_id}, {"$set": doc})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Produit introuvable")
    return await db.produits.find_one({"id": produit_id}, {"_id": 0})


@api_router.delete("/admin/produits/{produit_id}")
async def supprimer_produit(produit_id: str, _=Depends(require_admin)):
    await db.produits.delete_one({"id": produit_id})
    return {"ok": True}


# ------------------------------------------------------------------------ zones
@api_router.get("/zones")
async def liste_zones():
    zones = await db.zones.find({}, {"_id": 0}).to_list(200)
    return sorted(zones, key=lambda z: z["commune"])


@api_router.put("/admin/zones/{zone_id}")
async def modifier_zone(zone_id: str, body: ZoneIn, _=Depends(require_admin)):
    res = await db.zones.update_one({"id": zone_id}, {"$set": {"active": body.active}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Zone introuvable")
    return await db.zones.find_one({"id": zone_id}, {"_id": 0})


# ---------------------------------------------------------------------- livreurs
@api_router.get("/admin/livreurs")
async def admin_livreurs(_=Depends(require_admin)):
    livreurs = await db.livreurs.find({}, {"_id": 0}).to_list(200)
    for lv in livreurs:
        pos = await db.positions_livreurs.find_one({"livreurId": lv["id"]}, {"_id": 0})
        lv["position"] = pos
    return livreurs


@api_router.post("/admin/livreurs")
async def creer_livreur(body: LivreurIn, _=Depends(require_admin)):
    tel = norm_tel(body.telephone)
    doc = body.model_dump(exclude={"motDePasse"})
    doc["id"] = str(uuid.uuid4())
    doc["telephone"] = tel
    await db.livreurs.insert_one(dict(doc))
    mdp = body.motDePasse or "livreur123"
    await db.users.replace_one(
        {"telephone": tel},
        {
            "id": str(uuid.uuid4()),
            "nom": body.nom,
            "telephone": tel,
            "email": None,
            "motDePasseHash": hash_pwd(mdp),
            "role": "livreur",
            "livreurId": doc["id"],
            "verifie": True,
            "createdAt": iso(now_utc()),
        },
        upsert=True,
    )
    return {k: v for k, v in doc.items() if k != "_id"}


@api_router.put("/admin/livreurs/{livreur_id}")
async def modifier_livreur(livreur_id: str, body: LivreurIn, _=Depends(require_admin)):
    doc = body.model_dump(exclude={"motDePasse"})
    doc["telephone"] = norm_tel(body.telephone)
    res = await db.livreurs.update_one({"id": livreur_id}, {"$set": doc})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Livreur introuvable")
    return await db.livreurs.find_one({"id": livreur_id}, {"_id": 0})


@api_router.delete("/admin/livreurs/{livreur_id}")
async def supprimer_livreur(livreur_id: str, _=Depends(require_admin)):
    await db.livreurs.delete_one({"id": livreur_id})
    return {"ok": True}


# --------------------------------------------------------------------- commandes
async def enrichir(cmd: Dict[str, Any]) -> Dict[str, Any]:
    if cmd.get("livreurId"):
        cmd["livreur"] = await db.livreurs.find_one({"id": cmd["livreurId"]}, {"_id": 0})
        pos = await db.positions_livreurs.find_one({"livreurId": cmd["livreurId"]}, {"_id": 0})
        cmd["positionLivreur"] = pos
        adr = cmd.get("adresse") or {}
        if pos and adr.get("lat") and adr.get("lng"):
            km = haversine(pos["lat"], pos["lng"], adr["lat"], adr["lng"])
            cmd["distanceKm"] = round(km, 2)
            cmd["etaMinutes"] = max(2, int(round(km / 18 * 60)))
    else:
        cmd["livreur"] = None
        cmd["positionLivreur"] = None
    return cmd


@api_router.post("/commandes")
async def creer_commande(body: CommandeIn, user=Depends(get_current_user)):
    if not body.items:
        raise HTTPException(status_code=400, detail="Le panier est vide")
    zone = await db.zones.find_one({"commune": body.adresse.commune}, {"_id": 0})
    if not zone or not zone.get("active"):
        raise HTTPException(status_code=400, detail=f"Nous ne livrons pas encore a {body.adresse.commune}")
    adresse = body.adresse.model_dump()
    adresse["id"] = str(uuid.uuid4())
    adresse["userId"] = user["id"]
    if not adresse.get("lat"):
        adresse["lat"], adresse["lng"] = -4.325, 15.322
    await db.adresses.replace_one({"userId": user["id"], "label": adresse["label"]}, dict(adresse), upsert=True)

    items = [i.model_dump() for i in body.items]
    sous_total = sum(i["prixUnitaire"] * i["quantite"] for i in items)
    numero = f"PB-{random.randint(1000, 9999)}"
    cmd = {
        "id": str(uuid.uuid4()),
        "numero": numero,
        "userId": user["id"],
        "clientNom": user["nom"],
        "clientTelephone": user["telephone"],
        "adresseId": adresse["id"],
        "adresse": {k: v for k, v in adresse.items() if k != "userId"},
        "items": items,
        "sousTotal": round(sous_total, 2),
        "fraisLivraison": FRAIS_LIVRAISON,
        "total": round(sous_total + FRAIS_LIVRAISON, 2),
        "statut": "recue",
        "livreurId": None,
        "paiement": "cash",
        "cashEncaisse": False,
        "note": None,
        "createdAt": iso(now_utc()),
        "historique": [{"statut": "recue", "at": iso(now_utc())}],
    }
    await db.commandes.insert_one(dict(cmd))
    cmd.pop("_id", None)
    return await enrichir(cmd)


@api_router.get("/commandes/mes")
async def mes_commandes(user=Depends(get_current_user)):
    cmds = await db.commandes.find({"userId": user["id"]}, {"_id": 0}).to_list(200)
    cmds.sort(key=lambda c: c["createdAt"], reverse=True)
    return [await enrichir(c) for c in cmds]


@api_router.get("/commandes/{cmd_id}")
async def detail_commande(cmd_id: str, user=Depends(get_current_user)):
    cmd = await db.commandes.find_one({"id": cmd_id}, {"_id": 0})
    if not cmd:
        raise HTTPException(status_code=404, detail="Commande introuvable")
    if user.get("role") == "client" and cmd["userId"] != user["id"]:
        raise HTTPException(status_code=403, detail="Acces refuse")
    return await enrichir(cmd)


@api_router.post("/commandes/{cmd_id}/annuler")
async def annuler_commande(cmd_id: str, user=Depends(get_current_user)):
    cmd = await db.commandes.find_one({"id": cmd_id}, {"_id": 0})
    if not cmd or (user.get("role") == "client" and cmd["userId"] != user["id"]):
        raise HTTPException(status_code=404, detail="Commande introuvable")
    if cmd["statut"] in ("en_route", "livree", "annulee"):
        raise HTTPException(status_code=400, detail="Cette commande ne peut plus etre annulee")
    await db.commandes.update_one(
        {"id": cmd_id},
        {"$set": {"statut": "annulee"}, "$push": {"historique": {"statut": "annulee", "at": iso(now_utc())}}},
    )
    return await detail_commande(cmd_id, user)


@api_router.post("/commandes/{cmd_id}/paiement")
async def confirmer_paiement_client(cmd_id: str, body: PaiementIn, user=Depends(get_current_user)):
    cmd = await db.commandes.find_one({"id": cmd_id}, {"_id": 0})
    if not cmd or cmd["userId"] != user["id"]:
        raise HTTPException(status_code=404, detail="Commande introuvable")
    updates: Dict[str, Any] = {"clientAPaye": True}
    if body.note:
        updates["note"] = body.note
    await db.commandes.update_one({"id": cmd_id}, {"$set": updates})
    return await detail_commande(cmd_id, user)


# ------------------------------------------------------------------- admin orders
@api_router.get("/admin/commandes")
async def admin_commandes(_=Depends(require_admin)):
    cmds = await db.commandes.find({}, {"_id": 0}).to_list(500)
    cmds.sort(key=lambda c: c["createdAt"], reverse=True)
    return [await enrichir(c) for c in cmds]


@api_router.get("/admin/stats")
async def admin_stats(_=Depends(require_admin)):
    cmds = await db.commandes.find({}, {"_id": 0}).to_list(1000)
    livrees = [c for c in cmds if c["statut"] == "livree"]
    return {
        "total": len(cmds),
        "enCours": len([c for c in cmds if c["statut"] in ("recue", "en_preparation", "recuperee", "en_route")]),
        "livrees": len(livrees),
        "annulees": len([c for c in cmds if c["statut"] == "annulee"]),
        "revenus": round(sum(c["total"] for c in livrees), 2),
    }


@api_router.post("/admin/commandes/{cmd_id}/assigner")
async def assigner_livreur(cmd_id: str, body: AssignIn, user=Depends(require_admin)):
    livreur = await db.livreurs.find_one({"id": body.livreurId}, {"_id": 0})
    if not livreur:
        raise HTTPException(status_code=404, detail="Livreur introuvable")
    res = await db.commandes.update_one({"id": cmd_id}, {"$set": {"livreurId": body.livreurId}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Commande introuvable")
    return await detail_commande(cmd_id, user)


@api_router.patch("/admin/commandes/{cmd_id}/statut")
async def admin_statut(cmd_id: str, body: StatutIn, user=Depends(require_admin)):
    res = await db.commandes.update_one(
        {"id": cmd_id},
        {"$set": {"statut": body.statut}, "$push": {"historique": {"statut": body.statut, "at": iso(now_utc())}}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Commande introuvable")
    return await detail_commande(cmd_id, user)


# ---------------------------------------------------------------------- livreur
@api_router.get("/livreur/courses")
async def livreur_courses(user=Depends(require_livreur)):
    cmds = await db.commandes.find({"livreurId": user.get("livreurId")}, {"_id": 0}).to_list(200)
    cmds.sort(key=lambda c: c["createdAt"], reverse=True)
    return [await enrichir(c) for c in cmds]


@api_router.patch("/livreur/courses/{cmd_id}/statut")
async def livreur_statut(cmd_id: str, body: StatutIn, user=Depends(require_livreur)):
    cmd = await db.commandes.find_one({"id": cmd_id}, {"_id": 0})
    if not cmd or cmd.get("livreurId") != user.get("livreurId"):
        raise HTTPException(status_code=404, detail="Course introuvable")
    await db.commandes.update_one(
        {"id": cmd_id},
        {"$set": {"statut": body.statut}, "$push": {"historique": {"statut": body.statut, "at": iso(now_utc())}}},
    )
    return await detail_commande(cmd_id, user)


@api_router.post("/livreur/courses/{cmd_id}/encaisser")
async def livreur_encaisser(cmd_id: str, user=Depends(require_livreur)):
    cmd = await db.commandes.find_one({"id": cmd_id}, {"_id": 0})
    if not cmd or cmd.get("livreurId") != user.get("livreurId"):
        raise HTTPException(status_code=404, detail="Course introuvable")
    await db.commandes.update_one(
        {"id": cmd_id},
        {
            "$set": {"cashEncaisse": True, "statut": "livree"},
            "$push": {"historique": {"statut": "livree", "at": iso(now_utc())}},
        },
    )
    return await detail_commande(cmd_id, user)


@api_router.post("/livreur/position")
async def livreur_position(body: PositionIn, user=Depends(require_livreur)):
    await db.positions_livreurs.replace_one(
        {"livreurId": user.get("livreurId")},
        {"livreurId": user.get("livreurId"), "lat": body.lat, "lng": body.lng, "updatedAt": iso(now_utc())},
        upsert=True,
    )
    return {"ok": True}


@api_router.get("/config")
async def config():
    doc = await db.parametres.find_one({"cle": "global"}, {"_id": 0})
    return {
        "tauxFC": (doc or {}).get("tauxFC", TAUX_FC),
        "fraisLivraison": (doc or {}).get("fraisLivraison", FRAIS_LIVRAISON),
    }


@api_router.put("/admin/config")
async def modifier_config(body: ConfigIn, _=Depends(require_admin)):
    if body.tauxFC <= 0:
        raise HTTPException(status_code=400, detail="Le taux doit être supérieur à zéro")
    await db.parametres.update_one(
        {"cle": "global"},
        {"$set": {"tauxFC": body.tauxFC, "majLe": iso(now_utc())}},
        upsert=True,
    )
    return await config()


@api_router.get("/")
async def root():
    return {"app": "Pinkberry Drc API", "ok": True}


# -------------------------------------------------------------------- seed data
COMMUNES = [
    ("Gombe", True), ("Limete", True), ("Ngaliema", True), ("Lingwala", True),
    ("Barumbu", False), ("Kalamu", False), ("Kasa-Vubu", False), ("Kintambo", False),
    ("Bandalungwa", False), ("Matete", False), ("Masina", False), ("N'djili", False),
    ("Lemba", False), ("Ngiri-Ngiri", False),
]

IMG_POT = "https://images.unsplash.com/photo-1669127045641-0ae683639570?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1Mjh8MHwxfHNlYXJjaHwxfHxmcm96ZW4lMjB5b2d1cnQlMjBjdXB8ZW58MHx8fHwxNzg5NDA5NDkyfDA&ixlib=rb-4.1.0&q=85"
IMG_SUNDAE = "https://images.unsplash.com/photo-1556909044-5c0e1da96641?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1Mjh8MHwxfHNlYXJjaHwzfHxmcm96ZW4lMjB5b2d1cnQlMjBjdXB8ZW58MHx8fHwxNzg5NDA5NDkyfDA&ixlib=rb-4.1.0&q=85"
IMG_CONE = "https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjY2NzZ8MHwxfHNlYXJjaHwxfHxpY2UlMjBjcmVhbXxlbnwwfHx8fDE3ODk0MDk1MDl8MA&ixlib=rb-4.1.0&q=85"

TAILLES = [{"nom": "Petit", "ecart": 0}, {"nom": "Moyen", "ecart": 1.5}, {"nom": "Grand", "ecart": 3.0}]
GARNITURES = [
    {"nom": "Fruits frais", "prix": 1.0},
    {"nom": "Granola", "prix": 0.75},
    {"nom": "Coulis fraise", "prix": 0.5},
    {"nom": "Pépites de chocolat", "prix": 0.75},
    {"nom": "Mochi", "prix": 1.25},
]

PRODUITS_DEMO = [
    {"nom": "Pot Original", "categorie": "Pots de crème", "prix": 4.5, "emoji": "🍦", "image": IMG_POT,
     "description": "Le classique pinkberry, yogourt glacé nature et acidulé.", "tailles": TAILLES, "garnitures": GARNITURES},
    {"nom": "Pot Fraise", "categorie": "Pots de crème", "prix": 5.0, "emoji": "🍓", "image": IMG_SUNDAE,
     "description": "Frozen yogurt à la fraise de saison.", "tailles": TAILLES, "garnitures": GARNITURES},
    {"nom": "Pot Mangue", "categorie": "Pots de crème", "prix": 5.0, "emoji": "🥭", "image": IMG_POT,
     "description": "Mangue mûre et yogourt glacé onctueux.", "tailles": TAILLES, "garnitures": GARNITURES},
    {"nom": "Pot Chocolat", "categorie": "Pots de crème", "prix": 5.5, "emoji": "🍫", "image": IMG_CONE,
     "description": "Chocolat noir intense.", "tailles": TAILLES, "garnitures": GARNITURES},
    {"nom": "Smoothie Fraise-Banane", "categorie": "Smoothies", "prix": 6.0, "emoji": "🥤", "image": IMG_SUNDAE,
     "description": "Fraise, banane et yogourt.", "tailles": TAILLES[:2], "garnitures": []},
    {"nom": "Smoothie Tropical", "categorie": "Smoothies", "prix": 6.5, "emoji": "🍹", "image": IMG_SUNDAE,
     "description": "Ananas, mangue, passion.", "tailles": TAILLES[:2], "garnitures": []},
    {"nom": "Granola croustillant", "categorie": "Toppings", "prix": 1.0, "emoji": "🥣", "image": IMG_POT,
     "description": "Portion supplémentaire de granola.", "tailles": [], "garnitures": []},
    {"nom": "Fruits frais coupés", "categorie": "Toppings", "prix": 1.5, "emoji": "🍉", "image": IMG_POT,
     "description": "Assortiment de fruits du jour.", "tailles": [], "garnitures": []},
    {"nom": "Eau minérale 50cl", "categorie": "Boissons", "prix": 1.0, "emoji": "💧", "image": IMG_CONE,
     "description": "Bien fraîche.", "tailles": [], "garnitures": []},
    {"nom": "Jus d'ananas", "categorie": "Boissons", "prix": 2.0, "emoji": "🧃", "image": IMG_CONE,
     "description": "Pressé du jour.", "tailles": [], "garnitures": []},
]


async def seed():
    await db.users.create_index("telephone", unique=True)
    await db.parametres.update_one(
        {"cle": "global"},
        {"$setOnInsert": {"cle": "global", "tauxFC": TAUX_FC, "fraisLivraison": FRAIS_LIVRAISON}},
        upsert=True,
    )
    for commune, active in COMMUNES:
        await db.zones.update_one(
            {"commune": commune},
            {"$setOnInsert": {"id": str(uuid.uuid4()), "commune": commune, "active": active}},
            upsert=True,
        )
    if await db.produits.count_documents({}) == 0:
        for p in PRODUITS_DEMO:
            doc = dict(p)
            doc["id"] = str(uuid.uuid4())
            doc["disponible"] = True
            await db.produits.insert_one(doc)

    # admin
    if not await db.users.find_one({"telephone": "0810000000"}):
        await db.users.insert_one({
            "id": str(uuid.uuid4()), "nom": "Admin Pinkberry", "telephone": "0810000000",
            "email": None, "motDePasseHash": hash_pwd("admin123"), "role": "admin",
            "verifie": True, "createdAt": iso(now_utc()),
        })
    # client demo
    if not await db.users.find_one({"telephone": "0990000001"}):
        await db.users.insert_one({
            "id": str(uuid.uuid4()), "nom": "Client Demo", "telephone": "0990000001",
            "email": None, "motDePasseHash": hash_pwd("client123"), "role": "client",
            "verifie": True, "createdAt": iso(now_utc()),
        })
    # livreurs demo
    demo_livreurs = [
        ("Jonas Mbala", "0820000001", "Moto Yamaha", "KIN 4521", 4.8),
        ("Patricia Luwawu", "0820000002", "Scooter", "KIN 8890", 4.9),
    ]
    for nom, tel, vehicule, plaque, note in demo_livreurs:
        lv = await db.livreurs.find_one({"telephone": tel}, {"_id": 0})
        if not lv:
            lv = {"id": str(uuid.uuid4()), "nom": nom, "telephone": tel, "vehicule": vehicule,
                  "plaque": plaque, "note": note, "actif": True}
            await db.livreurs.insert_one(dict(lv))
        if not await db.users.find_one({"telephone": tel}):
            await db.users.insert_one({
                "id": str(uuid.uuid4()), "nom": nom, "telephone": tel, "email": None,
                "motDePasseHash": hash_pwd("livreur123"), "role": "livreur", "livreurId": lv["id"],
                "verifie": True, "createdAt": iso(now_utc()),
            })
        if not await db.positions_livreurs.find_one({"livreurId": lv["id"]}):
            await db.positions_livreurs.insert_one({
                "livreurId": lv["id"], "lat": -4.3178, "lng": 15.3136, "updatedAt": iso(now_utc()),
            })


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def on_startup():
    await seed()
    logger.info("Pinkberry Drc API prete")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
