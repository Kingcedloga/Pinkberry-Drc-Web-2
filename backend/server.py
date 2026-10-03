import asyncio
import base64
import copy
import hashlib
import hmac
import ipaddress
import json
import logging
import math
import os
import random
import re
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from html import escape
from html.parser import HTMLParser
from pathlib import Path
from typing import Any, Dict, List, Literal, Optional, Tuple
from urllib.parse import quote, urlparse

import bcrypt
import httpx
import jwt
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, FastAPI, File, HTTPException, Request, UploadFile
from fastapi.responses import HTMLResponse, JSONResponse, Response, StreamingResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from motor.motor_asyncio import AsyncIOMotorClient
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from PIL import Image
from pydantic import BaseModel, Field
from pymongo import ReturnDocument
from pywebpush import WebPushException, webpush
from starlette.middleware.cors import CORSMiddleware
import io

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
# Domaine public de la web app : sert les images des emails (logo).
SITE_URL = (os.environ.get("SITE_URL") or "").strip().rstrip("/")

# Le franc congolais est la monnaie de reference : prix du catalogue, commandes,
# frais de livraison et rapports sont en FC entiers. Le taux (FC pour 1 USD)
# ne sert qu'a l'equivalent affiche en dollars et aux paiements en USD.
TAUX_FC = float(os.environ.get("TAUX_FC", "2800"))
FRAIS_LIVRAISON = float(os.environ.get("FRAIS_LIVRAISON", "5750"))
MONNAIE = "CDF"
# Valeurs d'un enregistrement de parametres cree a neuf (deja en FC).
PARAMETRES_INITIAUX = {"cle": "global", "tauxFC": TAUX_FC, "fraisLivraison": FRAIS_LIVRAISON, "monnaie": MONNAIE}


def en_fc(montant: Any) -> int:
    return int(round(float(montant or 0)))


def fc_txt(montant: Any) -> str:
    """« 16 800 FC » (espace comme separateur de milliers)."""
    return f"{en_fc(montant):,} FC".replace(",", " ")
SUPERADMIN_EMAIL = (os.environ.get("SUPERADMIN_EMAIL") or "mecedloga@gmail.com").strip().lower()
# Comptes de demonstration (admin / client / livreurs) : uniquement si les mots de
# passe sont fournis par l'environnement, et desactivables d'un coup.
SEED_DEMO = (os.environ.get("SEED_DEMO_ACCOUNTS") or "false").strip().lower() not in ("0", "false", "no")
MDP_ADMIN = os.environ.get("DEMO_ADMIN_PASSWORD") or ""
MDP_CLIENT = os.environ.get("DEMO_CLIENT_PASSWORD") or ""
MDP_LIVREUR = os.environ.get("DEMO_LIVREUR_PASSWORD") or ""

# --- Emergent Object Storage (photos de produits) ---
STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
APP_NAME = "pinkberry-drc"
_storage_key: Optional[str] = None

# --- Emergent Google Auth ---
EMERGENT_AUTH_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"

# --- Emergent Push Notifications ---
PUSH_BASE_URL = "https://integrations.emergentagent.com"
PUSH_KEY = os.environ.get("EMERGENT_PUSH_KEY", "placeholder")
_push_client = httpx.AsyncClient(base_url=PUSH_BASE_URL, headers={"X-Push-Key": PUSH_KEY}, timeout=10.0)

TAILLE_MAX_IMAGE = 5 * 1024 * 1024
TYPES_IMAGE = {"image/jpeg", "image/jpg", "image/png", "image/webp"}

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


def _entete_email() -> str:
    """Logo + nom de marque. Sans SITE_URL (https), le nom seul s'affiche."""
    logo = (
        f'<img src="{SITE_URL}/icones/email-logo.png" width="48" height="48" alt="Pinkberry" '
        'style="display:block;border:0;width:48px;height:48px">'
        if SITE_URL.startswith("https://") else ""
    )
    return (
        '<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 16px"><tr>'
        f'<td style="padding-right:10px;vertical-align:middle">{logo}</td>'
        '<td style="vertical-align:middle;font-size:24px;font-weight:bold;color:#E6156F">pinkberry</td>'
        '</tr></table>'
    )


def _otp_email_html(nom: str, code: str) -> str:
    return (
        '<table role="presentation" width="100%"><tr><td style="padding:24px;'
        'font-family:Arial,sans-serif;color:#2A1721">'
        f'{_entete_email()}'
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
    if user.get("actif") is False:
        raise HTTPException(status_code=403, detail="Compte desactive")
    return user


# Hierarchie des roles : superadmin > admin > livreur > client.
NIVEAUX = {"client": 1, "livreur": 2, "admin": 3, "superadmin": 4}


def niveau(role: Optional[str]) -> int:
    return NIVEAUX.get(role or "client", 0)


async def require_admin(user=Depends(get_current_user)) -> Dict[str, Any]:
    if niveau(user.get("role")) < NIVEAUX["admin"]:
        raise HTTPException(status_code=403, detail="Acces reserve a l'administrateur")
    return user


async def require_superadmin(user=Depends(get_current_user)) -> Dict[str, Any]:
    if user.get("role") != "superadmin":
        raise HTTPException(status_code=403, detail="Acces reserve au super admin")
    return user


async def require_livreur(user=Depends(get_current_user)) -> Dict[str, Any]:
    if user.get("role") != "livreur":
        raise HTTPException(status_code=403, detail="Acces reserve au livreur")
    return user


PREFS_DEFAUT = {
    "langue": "fr",
    "theme": "systeme",
    "notifSuivi": True,  # client : suivi de commande et paiement
    "notifPromos": True,  # client : promotions
    "notifNouveautes": True,
    "notifCommandes": True,  # admin : nouvelles commandes et annulations
    "notifCourses": True,  # livreur : courses assignees
}


def public_user(u: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": u["id"],
        "nom": u["nom"],
        "telephone": u.get("telephone"),
        "email": u.get("email"),
        "role": u.get("role", "client"),
        "verifie": u.get("verifie", False),
        "livreurId": u.get("livreurId"),
        "actif": u.get("actif", True),
        "preferences": {**PREFS_DEFAUT, **(u.get("preferences") or {})},
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


# Les libelles saisis par l'admin sont en francais (`nom`, qui sert aussi
# d'identifiant) ; `nomEn` / `descriptionEn` portent l'anglais, rempli
# automatiquement a l'enregistrement quand l'admin le laisse vide.
class Taille(BaseModel):
    nom: str
    ecart: float = 0
    nomEn: Optional[str] = None


class Garniture(BaseModel):
    nom: str
    prix: float = 0
    nomEn: Optional[str] = None
    # Garniture du frozen yogurt compose : identifiant dans la collection `garnitures`.
    id: Optional[str] = None


class ProduitIn(BaseModel):
    nom: str
    categorie: str
    prix: float
    image: Optional[str] = None
    emoji: Optional[str] = None
    description: Optional[str] = None
    nomEn: Optional[str] = None
    descriptionEn: Optional[str] = None
    # Section de la categorie (ex. « Thés au lait » dans « Boissons »).
    sousCategorie: Optional[str] = None
    # Frozen yogurt compose : taille, recipient et garnitures viennent de la
    # configuration globale (/composition) ; prix, tailles et garnitures du
    # produit sont alors ignores.
    configurable: bool = False
    disponible: bool = True
    enAvant: bool = False
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
    contenant: Optional[str] = None
    garnitures: List[Garniture] = Field(default_factory=list)
    quantite: int = 1
    prixUnitaire: Optional[float] = None  # ignore : recalcule depuis le catalogue
    emoji: Optional[str] = None
    image: Optional[str] = None


class CommandeIn(BaseModel):
    adresse: AdresseIn
    items: List[ItemIn]
    modePaiement: Literal["cash", "mobile"] = "cash"
    codePromo: Optional[str] = None


class ApercuPromoIn(BaseModel):
    items: List[ItemIn]
    codePromo: Optional[str] = None


TypePromo = Literal["pourcentage", "montant", "livraison"]
CiblePromo = Literal["commande", "categorie", "produit", "premiere_commande"]


class PromotionIn(BaseModel):
    nom: str
    nomEn: Optional[str] = None
    type: TypePromo
    valeur: float = 0  # pourcentage (1-100) ou montant en FC ; ignore pour la livraison gratuite
    automatique: bool = True  # sinon le client saisit `code` au checkout
    code: Optional[str] = None
    cible: CiblePromo = "commande"
    cibleValeur: Optional[str] = None  # nom de categorie ou id de produit
    montantMin: float = Field(default=0, ge=0)
    dateDebut: Optional[str] = None
    dateFin: Optional[str] = None
    limiteTotale: Optional[int] = Field(default=None, ge=1)
    limiteParClient: Optional[int] = Field(default=None, ge=1)
    actif: bool = True
    cumulable: bool = False  # cumul avec d'autres promotions cumulables uniquement
    notifierClients: bool = True  # annonce (notification + push) aux clients eligibles a l'activation


class PromotionActifIn(BaseModel):
    actif: bool


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


class AdminIn(BaseModel):
    nom: str
    email: Optional[str] = None
    telephone: str
    motDePasse: str


class ActifIn(BaseModel):
    actif: bool


class ProfilIn(BaseModel):
    nom: str
    email: Optional[str] = None
    telephone: str


class MotDePasseIn(BaseModel):
    actuel: Optional[str] = None
    nouveau: str


class CategorieIn(BaseModel):
    nom: str
    nomEn: Optional[str] = None


class SousCategorie(BaseModel):
    nom: str
    nomEn: Optional[str] = None


class CategorieMajIn(BaseModel):
    """Champs absents = inchanges. `nomEn` vide = retraduit automatiquement."""
    nomEn: Optional[str] = None
    sousCategories: Optional[List[SousCategorie]] = None


class TraductionIn(BaseModel):
    textes: List[str] = Field(default_factory=list, max_length=100)


class ZoneCreationIn(BaseModel):
    commune: str
    active: bool = True


class ZoneIn(BaseModel):
    active: bool


class ConfigIn(BaseModel):
    tauxFC: float


class PreferencesIn(BaseModel):
    langue: Literal["fr", "en"] = "fr"
    theme: Literal["clair", "sombre", "systeme"] = "systeme"
    notifSuivi: bool = True
    notifPromos: bool = True
    notifNouveautes: bool = True
    notifCommandes: bool = True
    notifCourses: bool = True


class AssignIn(BaseModel):
    livreurId: str


class SessionIn(BaseModel):
    session_id: str


class TelephoneIn(BaseModel):
    telephone: str


class RegisterPushBody(BaseModel):
    user_id: Optional[str] = None  # ignore : l'utilisateur vient du token
    platform: str
    device_token: str


class PaiementIn(BaseModel):
    note: Optional[int] = None


class BulkIdsIn(BaseModel):
    ids: List[str]


class TailleYogourtIn(BaseModel):
    nom: str
    nomEn: Optional[str] = None
    prixBase: float = Field(ge=0)
    supplementGarnitures: float = Field(default=0, ge=0)


class ContenantIn(BaseModel):
    nom: str
    nomEn: Optional[str] = None
    disponible: bool = True


class CategorieGarnitureMajIn(BaseModel):
    """Champs absents = inchanges."""
    nom: Optional[str] = None
    nomEn: Optional[str] = None
    disponible: Optional[bool] = None


class GarnitureIn(BaseModel):
    categorieId: str
    nom: str
    nomEn: Optional[str] = None
    disponible: bool = True


class RegleGarnituresIn(BaseModel):
    nombre: int = Field(ge=1, le=30)
    categoriesMin: int = Field(ge=1, le=30)
    categoriesMax: int = Field(ge=1, le=30)


class EtatProduitIn(BaseModel):
    """Changement rapide depuis la liste : champs absents = inchanges."""
    disponible: Optional[bool] = None
    enAvant: Optional[bool] = None


class BulkEtatIn(BulkIdsIn, EtatProduitIn):
    pass


# ------------------------------------------------------------------------- auth
OTP_CHIFFRES = 6
OTP_MINUTES = 10
OTP_ESSAIS_MAX = 5
OTP_DELAI_RENVOI = 60  # secondes entre deux envois pour un meme numero


async def emettre_otp(tel: str) -> str:
    """Nouveau code (compteur d'essais remis a zero). Refuse un renvoi trop rapproche."""
    precedent = await db.otps.find_one({"telephone": tel}, {"_id": 0, "envoyeAt": 1})
    limite = iso(now_utc() - timedelta(seconds=OTP_DELAI_RENVOI))
    if precedent and (precedent.get("envoyeAt") or "") > limite:
        raise HTTPException(status_code=429, detail="Patientez une minute avant de demander un nouveau code")
    code = f"{secrets.randbelow(10 ** OTP_CHIFFRES):0{OTP_CHIFFRES}d}"
    await db.otps.replace_one(
        {"telephone": tel},
        {
            "telephone": tel,
            "code": code,
            "essais": 0,
            "envoyeAt": iso(now_utc()),
            "expireAt": iso(now_utc() + timedelta(minutes=OTP_MINUTES)),
        },
        upsert=True,
    )
    return code


@api_router.post("/auth/inscription")
async def inscription(body: InscriptionIn):
    tel = norm_tel(body.telephone)
    email = (body.email or "").strip().lower()
    if len(tel) < 9:
        raise HTTPException(status_code=400, detail="Numero de telephone invalide")
    if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", email):
        raise HTTPException(status_code=400, detail="Une adresse email valide est requise")
    if len(body.motDePasse) < 6:
        raise HTTPException(status_code=400, detail="Mot de passe trop court (6 caracteres minimum)")
    existing = await db.users.find_one({"telephone": tel})
    if existing and existing.get("verifie"):
        raise HTTPException(status_code=400, detail="Ce numero est deja utilise")
    code = await emettre_otp(tel)
    doc = {
        "id": existing["id"] if existing else str(uuid.uuid4()),
        "nom": body.nom.strip(),
        "telephone": tel,
        "email": email,
        "motDePasseHash": hash_pwd(body.motDePasse),
        "role": "client",
        "verifie": False,
        "createdAt": iso(now_utc()),
    }
    await db.users.replace_one({"telephone": tel}, doc, upsert=True)
    envoye = bool(
        await send_email(
            to=doc["email"],
            subject=f"Votre code de verification {EMAIL_FROM_NAME}",
            html=_otp_email_html(doc["nom"], code),
        )
    )
    reponse = {"ok": True, "telephone": tel, "email": doc["email"], "emailEnvoye": envoye}
    # En production, ne jamais exposer le code OTP dans la reponse API.
    if SEED_DEMO:
        reponse["codeDemo"] = code
    return reponse


def compte_a_activer(user: Optional[Dict[str, Any]]) -> bool:
    """Le code OTP sert uniquement a activer un compte client neuf : jamais de
    session par OTP pour un compte deja verifie ni pour le personnel."""
    return bool(user) and not user.get("verifie") and user.get("role", "client") == "client"


@api_router.post("/auth/renvoyer-otp")
async def renvoyer_otp(body: TelephoneIn):
    tel = norm_tel(body.telephone)
    user = await db.users.find_one({"telephone": tel}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Compte introuvable")
    if not compte_a_activer(user):
        raise HTTPException(status_code=400, detail="Ce compte est deja verifie, connectez-vous")
    code = await emettre_otp(tel)
    envoye = False
    if user.get("email"):
        envoye = bool(
            await send_email(
                to=user["email"],
                subject=f"Votre code de verification {EMAIL_FROM_NAME}",
                html=_otp_email_html(user["nom"], code),
            )
        )
    reponse: Dict[str, Any] = {"ok": True, "emailEnvoye": envoye}
    if SEED_DEMO:
        reponse["codeDemo"] = code
    return reponse


@api_router.post("/auth/verifier-otp")
async def verifier_otp(body: OtpIn):
    tel = norm_tel(body.telephone)
    user = await db.users.find_one({"telephone": tel}, {"_id": 0})
    if not compte_a_activer(user):
        raise HTTPException(status_code=400, detail="Code incorrect")
    # Chaque tentative est comptee avant la comparaison (pas de force brute).
    otp = await db.otps.find_one_and_update(
        {"telephone": tel, "essais": {"$not": {"$gte": OTP_ESSAIS_MAX}}},
        {"$inc": {"essais": 1}},
        projection={"_id": 0},
        return_document=ReturnDocument.AFTER,
    )
    if not otp:
        if await db.otps.find_one({"telephone": tel}):
            await db.otps.delete_one({"telephone": tel})
            raise HTTPException(status_code=429, detail="Trop de tentatives, demandez un nouveau code")
        raise HTTPException(status_code=400, detail="Code incorrect")
    if otp.get("expireAt") and otp["expireAt"] < iso(now_utc()):
        raise HTTPException(status_code=400, detail="Code expire, demandez un nouveau code")
    if not hmac.compare_digest(str(otp.get("code", "")).encode(), body.code.strip().encode()):
        raise HTTPException(status_code=400, detail="Code incorrect")
    if user.get("actif") is False:
        raise HTTPException(status_code=403, detail="Compte desactive, contactez le super admin")
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
    if user.get("actif") is False:
        raise HTTPException(status_code=403, detail="Compte desactive, contactez le super admin")
    if not user.get("verifie"):
        raise HTTPException(status_code=403, detail="Compte non verifie, verifiez votre code")
    return {"token": make_token(user["id"]), "user": public_user(user)}


@api_router.get("/auth/moi")
async def moi(user=Depends(get_current_user)):
    return public_user(user)


@api_router.put("/auth/profil")
async def modifier_profil(body: ProfilIn, user=Depends(get_current_user)):
    tel = norm_tel(body.telephone)
    if len(tel) < 9:
        raise HTTPException(status_code=400, detail="Numero de telephone invalide")
    if len(body.nom.strip()) < 2:
        raise HTTPException(status_code=400, detail="Nom trop court")
    email = (body.email or "").strip().lower() or None
    if await db.users.find_one({"telephone": tel, "id": {"$ne": user["id"]}}):
        raise HTTPException(status_code=400, detail="Ce numero est deja utilise")
    if email and await db.users.find_one({"email": email, "id": {"$ne": user["id"]}}):
        raise HTTPException(status_code=400, detail="Cet email est deja utilise")
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"nom": body.nom.strip(), "email": email, "telephone": tel}},
    )
    return public_user({**user, "nom": body.nom.strip(), "email": email, "telephone": tel})


@api_router.put("/auth/motdepasse")
async def changer_motdepasse(body: MotDePasseIn, user=Depends(get_current_user)):
    if len(body.nouveau) < 6:
        raise HTTPException(status_code=400, detail="Mot de passe : 6 caracteres minimum")
    actuel_hash = user.get("motDePasseHash") or ""
    # Un compte Google sans mot de passe peut en definir un sans ancien mot de passe.
    if actuel_hash and not check_pwd(body.actuel or "", actuel_hash):
        raise HTTPException(status_code=400, detail="Mot de passe actuel incorrect")
    await db.users.update_one({"id": user["id"]}, {"$set": {"motDePasseHash": hash_pwd(body.nouveau)}})
    return {"ok": True}


@api_router.put("/auth/preferences")
async def modifier_preferences(body: PreferencesIn, user=Depends(get_current_user)):
    """Langue et notifications du client, conservees sur son compte."""
    prefs = body.model_dump()
    await db.users.update_one({"id": user["id"]}, {"$set": {"preferences": prefs}})
    return prefs


@api_router.delete("/auth/moi")
async def supprimer_mon_compte(user=Depends(get_current_user)):
    """Suppression du compte client. Les commandes sont conservees mais anonymisees
    (comptabilite), toutes les donnees personnelles sont effacees."""
    if user.get("role") != "client":
        raise HTTPException(
            status_code=403,
            detail="Les comptes du personnel sont geres par le super admin",
        )
    await db.commandes.update_many(
        {"userId": user["id"]},
        {"$set": {
            "userId": "anonyme",
            "clientNom": "Client supprime",
            "clientTelephone": None,
            "adresse.telephone": None,
            "adresse.repere": "",
            "anonymisee": True,
        }},
    )
    await db.adresses.delete_many({"userId": user["id"]})
    await db.otps.delete_many({"telephone": user.get("telephone")})
    await db.user_sessions.delete_many({"user_id": user["id"]})
    await db.users.delete_one({"id": user["id"]})
    return {"ok": True}


# ------------------------------------------------------- Google Auth (Emergent)
@api_router.post("/auth/session")
async def auth_session(body: SessionIn):
    try:
        async with httpx.AsyncClient(timeout=30) as http:
            resp = await http.get(EMERGENT_AUTH_URL, headers={"X-Session-ID": body.session_id})
    except Exception as e:
        logger.error(f"Google auth error: {e}")
        raise HTTPException(status_code=401, detail="Connexion Google impossible")
    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Session Google invalide ou deja utilisee")

    data = resp.json()
    email = (data.get("email") or "").strip().lower()
    if not email:
        raise HTTPException(status_code=401, detail="Email Google introuvable")
    nom = (data.get("name") or email.split("@")[0]).strip()
    session_token = data.get("session_token")

    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user:
        user = {
            "id": str(uuid.uuid4()),
            "nom": nom,
            "email": email,
            "motDePasseHash": "",
            "role": "client",
            "verifie": True,
            "google": True,
            "photo": data.get("picture"),
            "createdAt": iso(now_utc()),
        }
        await db.users.insert_one(dict(user))
    else:
        if user.get("actif") is False:
            raise HTTPException(status_code=403, detail="Compte desactive, contactez le super admin")
        await db.users.update_one({"id": user["id"]}, {"$set": {"verifie": True, "google": True}})
        user["verifie"] = True

    if session_token:
        await db.user_sessions.replace_one(
            {"session_token": session_token},
            {
                "session_token": session_token,
                "user_id": user["id"],
                "created_at": now_utc(),
                "expires_at": now_utc() + timedelta(days=7),
            },
            upsert=True,
        )

    return {"token": make_token(user["id"]), "user": public_user(user)}


@api_router.put("/auth/telephone")
async def definir_telephone(body: TelephoneIn, user=Depends(get_current_user)):
    tel = norm_tel(body.telephone)
    if len(tel) < 9:
        raise HTTPException(status_code=400, detail="Numero de telephone invalide")
    autre = await db.users.find_one({"telephone": tel, "id": {"$ne": user["id"]}})
    if autre:
        raise HTTPException(status_code=400, detail="Ce numero est deja utilise par un autre compte")
    await db.users.update_one({"id": user["id"]}, {"$set": {"telephone": tel}})
    maj = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    return public_user(maj)


# -------------------------------------------------- Photos produits (objstore)
async def storage_key() -> str:
    global _storage_key
    if _storage_key:
        return _storage_key
    async with httpx.AsyncClient(timeout=30) as http:
        resp = await http.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY})
    if resp.status_code != 200:
        raise HTTPException(status_code=503, detail="Stockage d'images indisponible")
    _storage_key = resp.json()["storage_key"]
    return _storage_key


async def put_object(path: str, data: bytes, content_type: str) -> dict:
    global _storage_key
    for essai in range(2):
        cle = await storage_key()
        async with httpx.AsyncClient(timeout=120) as http:
            resp = await http.put(
                f"{STORAGE_URL}/objects/{path}",
                headers={"X-Storage-Key": cle, "Content-Type": content_type},
                content=data,
            )
        if resp.status_code == 503 and essai == 0:
            _storage_key = None
            continue
        if resp.status_code == 402:
            raise HTTPException(status_code=402, detail="Quota de stockage epuise")
        if resp.status_code != 200:
            raise HTTPException(status_code=503, detail="Echec de l'envoi de l'image")
        return resp.json()
    raise HTTPException(status_code=503, detail="Echec de l'envoi de l'image")


async def get_object(path: str) -> tuple[bytes, str]:
    global _storage_key
    for essai in range(2):
        cle = await storage_key()
        async with httpx.AsyncClient(timeout=60) as http:
            resp = await http.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": cle})
        if resp.status_code == 503 and essai == 0:
            _storage_key = None
            continue
        if resp.status_code != 200:
            raise HTTPException(status_code=404, detail="Image introuvable")
        return resp.content, resp.headers.get("Content-Type", "image/jpeg")
    raise HTTPException(status_code=404, detail="Image introuvable")


def compresser(brut: bytes) -> bytes:
    with Image.open(io.BytesIO(brut)) as img:
        img = img.convert("RGB")
        img.thumbnail((900, 900))
        sortie = io.BytesIO()
        img.save(sortie, format="JPEG", quality=82, optimize=True)
        return sortie.getvalue()


@api_router.post("/admin/photos")
async def envoyer_photo(file: UploadFile = File(...), admin=Depends(require_admin)):
    if (file.content_type or "").lower() not in TYPES_IMAGE:
        raise HTTPException(status_code=400, detail="Formats acceptes : JPG, PNG ou WebP")
    brut = await file.read()
    if len(brut) > TAILLE_MAX_IMAGE:
        raise HTTPException(status_code=400, detail="Image trop lourde (5 Mo maximum)")
    try:
        compressee = compresser(brut)
    except Exception:
        raise HTTPException(status_code=400, detail="Fichier image illisible")

    fichier_id = str(uuid.uuid4())
    chemin = f"{APP_NAME}/uploads/{admin['id']}/{fichier_id}.jpg"
    await put_object(chemin, compressee, "image/jpeg")
    await db.fichiers.insert_one(
        {
            "id": fichier_id,
            "path": chemin,
            "contentType": "image/jpeg",
            "ownerId": admin["id"],
            "taille": len(compressee),
            "createdAt": iso(now_utc()),
        }
    )
    return {"id": fichier_id, "url": f"/api/fichiers/{fichier_id}"}


@api_router.get("/fichiers/{fichier_id}")
async def lire_fichier(fichier_id: str):
    doc = await db.fichiers.find_one({"id": fichier_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Image introuvable")
    contenu, ctype = await get_object(doc["path"])
    return Response(content=contenu, media_type=ctype, headers={"Cache-Control": "public, max-age=604800"})


# --------------------------------------------------- cartographie (Mapbox + recherche TomTom)
MAPBOX_TOKEN = (os.environ.get("MAPBOX_TOKEN") or "").strip()
TOMTOM_KEY = (os.environ.get("TOMTOM_API_KEY") or "").strip()
KINSHASA = (-4.325, 15.322)
_tomtom = httpx.AsyncClient(base_url="https://api.tomtom.com", timeout=15)
_mapbox = httpx.AsyncClient(base_url="https://api.mapbox.com", timeout=15)


async def _tomtom_get(chemin: str, params: Dict[str, Any]) -> httpx.Response:
    """Recherche d'adresses : TomTom couvre les avenues de Kinshasa, contrairement a Mapbox."""
    if not TOMTOM_KEY:
        raise HTTPException(status_code=503, detail="Recherche d'adresse non configuree")
    try:
        r = await _tomtom.get(chemin, params={**params, "key": TOMTOM_KEY})
    except httpx.HTTPError as e:
        logger.warning("TomTom %s injoignable : %s", chemin, e)
        raise HTTPException(status_code=502, detail="Service de carte indisponible")
    if r.status_code >= 400:
        logger.warning("TomTom %s -> %s", chemin, r.status_code)
        raise HTTPException(status_code=502, detail="Service de carte indisponible")
    return r


async def _mapbox_get(chemin: str, params: Dict[str, Any]) -> httpx.Response:
    """Appel Mapbox (itineraires, geocodage inverse) depuis le serveur."""
    if not MAPBOX_TOKEN:
        raise HTTPException(status_code=503, detail="Cartographie non configuree")
    try:
        r = await _mapbox.get(chemin, params={**params, "access_token": MAPBOX_TOKEN})
    except httpx.HTTPError as e:
        logger.warning("Mapbox %s injoignable : %s", chemin, e)
        raise HTTPException(status_code=502, detail="Service de carte indisponible")
    if r.status_code >= 400:
        logger.warning("Mapbox %s -> %s", chemin, r.status_code)
        raise HTTPException(status_code=502, detail="Service de carte indisponible")
    return r


MODES_CARTE = {"suivi", "choix"}
COULEUR_HEX = re.compile(r"#[0-9A-Fa-f]{3,8}")


@api_router.get("/carte/vue", response_class=HTMLResponse)
async def carte_vue(
    clat: float,
    clng: float,
    dlat: Optional[float] = None,
    dlng: Optional[float] = None,
    fond: str = "#F7EFF3",
    accent: str = "#E6156F",
    livreurCouleur: str = "#8DC63F",
    mode: str = "suivi",
    sombre: int = 0,
):
    """Page Mapbox GL JS servie par le backend (WebView mobile / iframe web).

    `mode=choix` affiche un pin deplacable et renvoie la position choisie au parent.
    Servir une URL (et non du HTML injecte) evite les blocages de scripts sur Android.
    """
    if not MAPBOX_TOKEN:
        raise HTTPException(status_code=503, detail="Cartographie non configuree")
    # Tout parametre est insere dans le HTML/JS : liste fermee et formats stricts (anti-XSS).
    if mode not in MODES_CARTE:
        raise HTTPException(status_code=400, detail="Mode de carte invalide")
    if not all(COULEUR_HEX.fullmatch(c) for c in (fond, accent, livreurCouleur)):
        raise HTTPException(status_code=400, detail="Couleur invalide")
    _verifier_point([clat, clng])
    if dlat is not None and dlng is not None:
        _verifier_point([dlat, dlng])
    style = "mapbox://styles/mapbox/dark-v11" if sombre else "mapbox://styles/mapbox/light-v11"
    driver = f"[{dlng},{dlat}]" if dlat is not None and dlng is not None else "null"
    page = f"""<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<link href="https://api.mapbox.com/mapbox-gl-js/v3.9.0/mapbox-gl.css" rel="stylesheet" />
<style>html,body,#map{{margin:0;padding:0;height:100%;width:100%;background:{fond}}}
.pin{{width:26px;height:26px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);
border:3px solid #fff;box-shadow:0 4px 12px rgba(42,23,33,.35)}}
.pin-c{{background:{accent}}}.pin-d{{background:{livreurCouleur}}}
.mapboxgl-ctrl-attrib{{font-size:9px}}
#aide{{position:absolute;left:12px;right:12px;bottom:12px;background:rgba(255,255,255,.94);
color:#2A1721;font:600 12px/1.35 system-ui,sans-serif;padding:8px 12px;border-radius:14px;text-align:center}}</style>
</head><body><div id="map"></div>
<script src="https://api.mapbox.com/mapbox-gl-js/v3.9.0/mapbox-gl.js"></script>
<script>
mapboxgl.accessToken='{MAPBOX_TOKEN}';
var mode='{mode}';
var client=[{clng},{clat}];var driver={driver};
var map=new mapboxgl.Map({{container:'map',style:'{style}',center:client,zoom:14,attributionControl:true}});
function elPin(c){{var d=document.createElement('div');d.className='pin pin-'+c;return d;}}
var mc=new mapboxgl.Marker({{element:elPin('c'),draggable:mode==='choix',anchor:'bottom'}}).setLngLat(client).addTo(map);
var md=null;
function envoyer(o){{
  var m=JSON.stringify(o);
  try{{if(window.ReactNativeWebView){{window.ReactNativeWebView.postMessage(m);}}}}catch(e){{}}
  try{{if(window.parent&&window.parent!==window){{window.parent.postMessage(m,'*');}}}}catch(e){{}}
}}
if(mode==='choix'){{
  var aide=document.createElement('div');aide.id='aide';
  aide.textContent='Déplacez le repère sur votre porte exacte';
  document.body.appendChild(aide);
  mc.on('dragend',function(){{var p=mc.getLngLat();envoyer({{type:'position',lat:p.lat,lng:p.lng}});}});
  map.on('click',function(e){{mc.setLngLat(e.lngLat);envoyer({{type:'position',lat:e.lngLat.lat,lng:e.lngLat.lng}});}});
}}
function cadrer(pts){{
  if(!pts||!pts.length){{return;}}
  var b=pts.reduce(function(acc,p){{return acc.extend(p);}},new mapboxgl.LngLatBounds(pts[0],pts[0]));
  map.fitBounds(b,{{padding:60,maxZoom:16,duration:600}});
}}
function majLivreur(lat,lng){{
  var p=[lng,lat];
  if(!md){{md=new mapboxgl.Marker({{element:elPin('d'),anchor:'bottom'}}).setLngLat(p).addTo(map);}}
  else{{md.setLngLat(p);}}
  if(!map.getLayer('route')){{ligne([p,client],true);}}
  cadrer([p,client]);
}}
function ligne(coords,pointille){{
  var data={{type:'Feature',geometry:{{type:'LineString',coordinates:coords}}}};
  if(map.getSource('route')){{map.getSource('route').setData(data);return;}}
  map.addSource('route',{{type:'geojson',data:data}});
  map.addLayer({{id:'route',type:'line',source:'route',
    layout:{{'line-cap':'round','line-join':'round'}},
    paint:{{'line-color':'{accent}','line-width':5,'line-opacity':.9,
      'line-dasharray':pointille?[2,1.6]:[1]}}}});
}}
function majTrace(pts){{
  if(!pts||pts.length<2){{return;}}
  var coords=pts.map(function(p){{return [p[1],p[0]];}});
  if(map.getLayer('route')){{map.setPaintProperty('route','line-dasharray',[1]);}}
  ligne(coords,false);
  cadrer(coords);
}}
window.majLivreur=majLivreur;window.majTrace=majTrace;
var attente=[];
function traiter(d){{
  if(!d){{return;}}
  if(d.livreur){{majLivreur(d.livreur[0],d.livreur[1]);}}
  if(d.trace){{majTrace(d.trace);}}
}}
window.addEventListener('message',function(e){{
  try{{
    var d=typeof e.data==='string'?JSON.parse(e.data):e.data;
    if(!d||d.type==='position'){{return;}}
    if(map.loaded()){{traiter(d);}}else{{attente.push(d);}}
  }}catch(err){{}}
}});
map.on('load',function(){{
  attente.forEach(traiter);attente=[];
  if(driver){{majLivreur(driver[1],driver[0]);}}
  envoyer({{type:'pret'}});
}});
</script></body></html>"""
    return HTMLResponse(content=page, headers={"Cache-Control": "no-store"})


@api_router.get("/carte/recherche")
async def carte_recherche(q: str, user=Depends(get_current_user)):
    """Suggestions d'adresses autour de Kinshasa (autocompletion)."""
    terme = (q or "").strip()
    if len(terme) < 3:
        return {"resultats": []}
    r = await _tomtom_get(
        f"/search/2/search/{quote(terme, safe='')}.json",
        {
            "countrySet": "CD",
            "language": "fr-FR",
            "limit": 6,
            "typeahead": "true",
            "lat": KINSHASA[0],
            "lon": KINSHASA[1],
            "radius": 80000,
        },
    )
    resultats = []
    for res in r.json().get("results", []):
        adresse = res.get("address") or {}
        position = res.get("position") or {}
        poi = res.get("poi") or {}
        libelle = poi.get("name") or adresse.get("freeformAddress")
        if not libelle or position.get("lat") is None:
            continue
        resultats.append(
            {
                "id": res.get("id"),
                "libelle": libelle,
                "detail": adresse.get("freeformAddress"),
                "commune": adresse.get("municipalitySubdivision") or adresse.get("municipality"),
                "avenue": adresse.get("streetName"),
                "lat": position["lat"],
                "lng": position["lon"],
            }
        )
    return {"resultats": resultats}


class ItineraireIn(BaseModel):
    origine: List[float]
    destination: List[float]


def _verifier_point(p: List[float]) -> str:
    if len(p) != 2 or not (-90 <= p[0] <= 90) or not (-180 <= p[1] <= 180):
        raise HTTPException(status_code=400, detail="Coordonnees invalides")
    return f"{p[1]},{p[0]}"  # Mapbox attend lng,lat


@api_router.post("/carte/itineraire")
async def carte_itineraire(body: ItineraireIn, user=Depends(get_current_user)):
    """Itineraire routier reel + duree estimee (Mapbox Directions, trafic live)."""
    depart = _verifier_point(body.origine)
    arrivee = _verifier_point(body.destination)
    r = await _mapbox_get(
        f"/directions/v5/mapbox/driving-traffic/{depart};{arrivee}",
        {"geometries": "geojson", "overview": "full", "language": "fr", "steps": "false"},
    )
    routes = r.json().get("routes") or []
    if not routes:
        raise HTTPException(status_code=502, detail="Itineraire introuvable")
    route = routes[0]
    points = [[c[1], c[0]] for c in (route.get("geometry") or {}).get("coordinates", [])]
    duree = route.get("duration")
    arrivee_iso = (
        (now_utc() + timedelta(seconds=float(duree))).isoformat() if duree is not None else None
    )
    return {
        "points": points,
        "distanceMetres": route.get("distance"),
        "etaSecondes": duree,
        "heureArrivee": arrivee_iso,
    }


async def zone_active(commune: str) -> bool:
    zone = await db.zones.find_one(
        {"commune": {"$regex": f"^{re.escape(commune)}$", "$options": "i"}}, {"_id": 0, "active": 1}
    )
    return bool(zone and zone.get("active"))


async def commune_des_coords(lat: float, lng: float) -> Optional[str]:
    """Commune deduite des coordonnees GPS ; None si Mapbox est indisponible."""
    try:
        r = await _mapbox_get(
            f"/geocoding/v5/mapbox.places/{lng},{lat}.json",
            {"language": "fr", "types": "neighborhood,locality,place"},
        )
    except HTTPException:
        return None
    for f in r.json().get("features", []):
        texte = (f.get("text") or "").strip()
        if texte and texte.lower() != "kinshasa":
            return texte
    return None


@api_router.get("/carte/zone")
async def carte_zone(lat: float, lng: float, user=Depends(get_current_user)):
    """Commune deduite des coordonnees GPS (Mapbox) et couverture de livraison."""
    _verifier_point([lat, lng])
    r = await _mapbox_get(
        f"/geocoding/v5/mapbox.places/{lng},{lat}.json",
        {"language": "fr", "types": "neighborhood,locality,place"},
    )
    noms: List[str] = []
    for f in r.json().get("features", []):
        texte = (f.get("text") or "").strip()
        if texte and texte.lower() != "kinshasa":
            noms.append(texte)
    zones = await db.zones.find({"active": True}, {"_id": 0, "commune": 1}).to_list(200)
    communes = {z["commune"].lower(): z["commune"] for z in zones}
    trouvee = next((communes[n.lower()] for n in noms if n.lower() in communes), None)
    return {
        "commune": trouvee or (noms[0] if noms else None),
        "couverte": trouvee is not None,
        "communesProches": noms[:3],
    }


# --------------------------------------------------- paiements mobile money (PawaPay)
PAWAPAY_BASE_URL = (os.environ.get("PAWAPAY_BASE_URL") or "https://api.sandbox.pawapay.io").rstrip("/")
PAWAPAY_TOKEN = (os.environ.get("PAWAPAY_TOKEN") or "").strip()
PAWAPAY_CALLBACK_URL = (os.environ.get("PAWAPAY_CALLBACK_URL") or "").strip()
PAWAPAY_SIGNED_CALLBACKS = (os.environ.get("PAWAPAY_SIGNED_CALLBACKS") or "true").lower() == "true"
PAWAPAY_DELAI_EXPIRATION = 10 * 60  # secondes sans etat final -> "expire" cote app

OPERATEURS = {
    "mpesa": {"provider": "VODACOM_MPESA_COD", "nom": "M-Pesa (Vodacom)", "decimales": {"CDF": 0, "USD": 2}},
    "airtel": {"provider": "AIRTEL_COD", "nom": "Airtel Money", "decimales": {"CDF": 2, "USD": 2}},
    "orange": {"provider": "ORANGE_COD", "nom": "Orange Money", "decimales": {"CDF": 2, "USD": 2}},
}
ETATS_FINAUX = {"COMPLETED", "FAILED"}
_pawapay = httpx.AsyncClient(base_url=PAWAPAY_BASE_URL, timeout=25)
_cles_pawapay: Dict[str, str] = {}


def statut_public(etat: Optional[str]) -> str:
    if etat == "COMPLETED":
        return "paye"
    if etat in {"FAILED", "REJECTED"}:
        return "echoue"
    return "attente"


def normaliser_msisdn(tel: str) -> str:
    """Format international sans '+' ni zero initial : 243XXXXXXXXX."""
    chiffres = re.sub(r"\D", "", tel or "")
    if chiffres.startswith("00"):
        chiffres = chiffres[2:]
    if chiffres.startswith("0"):
        chiffres = "243" + chiffres[1:]
    if not chiffres.startswith("243"):
        chiffres = "243" + chiffres
    if len(chiffres) != 12:
        raise HTTPException(status_code=400, detail="Numero mobile money invalide (ex. 0812345678)")
    return chiffres


async def _pawapay_appel(methode: str, chemin: str, **kw) -> Dict[str, Any]:
    if not PAWAPAY_TOKEN:
        raise HTTPException(status_code=503, detail="Paiement mobile money non configure")
    entetes = {"Authorization": f"Bearer {PAWAPAY_TOKEN}", "Content-Type": "application/json"}
    try:
        r = await _pawapay.request(methode, chemin, headers=entetes, **kw)
    except httpx.HTTPError as e:
        logger.warning("PawaPay %s injoignable : %s", chemin, e)
        raise HTTPException(status_code=502, detail="Service de paiement indisponible")
    if r.status_code >= 400:
        logger.warning("PawaPay %s -> %s %s", chemin, r.status_code, r.text[:200])
        raise HTTPException(status_code=502, detail="Service de paiement indisponible")
    return r.json()


async def charger_cles_pawapay() -> None:
    """Cles publiques utilisees pour verifier la signature des callbacks."""
    if not PAWAPAY_TOKEN:
        return
    try:
        cles = await _pawapay_appel("GET", "/v2/public-key/http")
    except HTTPException:
        return
    for c in cles if isinstance(cles, list) else []:
        if c.get("id") and c.get("key"):
            _cles_pawapay[c["id"]] = c["key"]


def _valeur_b64(entete: str) -> bytes:
    return base64.b64decode(entete.split(":", 2)[1])


def verifier_callback(requete: Request, brut: bytes) -> None:
    """Digest + signature RFC 9187 (ECDSA P-256) fournis par PawaPay."""
    if not PAWAPAY_SIGNED_CALLBACKS:
        return
    digest = requete.headers.get("content-digest", "")
    signature = requete.headers.get("signature", "")
    entree = requete.headers.get("signature-input", "")
    if not digest or not signature or not entree:
        raise HTTPException(status_code=401, detail="Callback non signe")
    algo = digest.split("=", 1)[0].lower()
    attendu = hashlib.sha512(brut).digest() if algo == "sha-512" else hashlib.sha256(brut).digest()
    if not hmac.compare_digest(attendu, _valeur_b64(digest)):
        raise HTTPException(status_code=401, detail="Digest invalide")

    m = re.search(r"sig-pp=\((.*?)\);(.*)$", entree)
    if not m:
        raise HTTPException(status_code=401, detail="Signature-Input invalide")
    composants, parametres = m.group(1), m.group(2)
    keyid = re.search(r'keyid="([^"]+)"', parametres)
    alg = re.search(r'alg="([^"]+)"', parametres)
    if not keyid or not alg or alg.group(1) != "ecdsa-p256-sha256":
        raise HTTPException(status_code=401, detail="Parametres de signature refuses")
    pem = _cles_pawapay.get(keyid.group(1))
    if not pem:
        raise HTTPException(status_code=401, detail="Cle de signature inconnue")

    valeurs = {
        "@method": requete.method,
        "@authority": requete.headers.get("host", ""),
        "@path": requete.url.path,
        "signature-date": requete.headers.get("signature-date", ""),
        "content-digest": digest,
        "content-type": requete.headers.get("content-type", ""),
    }
    noms = [x.strip().strip('"') for x in composants.split()]
    base = "\n".join(f'"{n}": {valeurs[n]}' for n in noms if n in valeurs)
    base += f'\n"@signature-params": ({composants});{parametres}'
    try:
        cle = serialization.load_pem_public_key(pem.encode())
        cle.verify(_valeur_b64(signature), base.encode(), ec.ECDSA(hashes.SHA256()))
    except Exception as e:
        logger.warning("Signature PawaPay invalide : %s", e)
        raise HTTPException(status_code=401, detail="Signature invalide")


async def appliquer_etat_final(donnees: Dict[str, Any]) -> None:
    """Transition atomique : un callback rejoue ne paie jamais deux fois."""
    etat = donnees.get("status")
    depot_id = donnees.get("depositId")
    if not depot_id or etat not in ETATS_FINAUX:
        return
    maj = {
        "statut": etat,
        "raisonEchec": (donnees.get("failureReason") or {}).get("failureMessage")
        if isinstance(donnees.get("failureReason"), dict)
        else donnees.get("failureReason"),
        "transactionOperateur": donnees.get("providerTransactionId"),
        "updatedAt": iso(now_utc()),
    }
    precedent = await db.paiements.find_one_and_update(
        {"depositId": depot_id, "statut": {"$nin": list(ETATS_FINAUX)}}, {"$set": maj}
    )
    if not precedent:
        return
    paye = etat == "COMPLETED"
    await db.commandes.update_one(
        {"id": precedent["commandeId"]},
        {
            "$set": {
                "paiement.statut": "paye" if paye else "echoue",
                "paiement.transactionOperateur": donnees.get("providerTransactionId"),
                "paiement.updatedAt": iso(now_utc()),
                "paye": paye,
            }
        },
    )
    await notifier_paiement(precedent["commandeId"], paye)


async def _synchroniser_depot(depot_id: str) -> Dict[str, Any]:
    """Interrogation de secours (en plus du callback)."""
    reponse = await _pawapay_appel("GET", f"/v2/deposits/{depot_id}")
    donnees = reponse.get("data") or {}
    if reponse.get("status") == "FOUND" and donnees.get("status") in ETATS_FINAUX:
        await appliquer_etat_final({**donnees, "depositId": depot_id})
    return donnees


class PaiementMobileIn(BaseModel):
    commandeId: str
    operateur: str
    telephone: str
    devise: str = "CDF"


@api_router.get("/paiements/operateurs")
async def paiement_operateurs():
    """Operateurs mobile money disponibles pour la RDC."""
    return {
        "operateurs": [{"cle": c, "nom": v["nom"]} for c, v in OPERATEURS.items()],
        "devises": ["CDF", "USD"],
        "actif": bool(PAWAPAY_TOKEN),
    }


@api_router.post("/paiements/mobile-money")
async def paiement_mobile_money(body: PaiementMobileIn, user=Depends(get_current_user)):
    operateur = OPERATEURS.get(body.operateur)
    if not operateur:
        raise HTTPException(status_code=400, detail="Operateur inconnu")
    devise = body.devise.upper()
    if devise not in {"USD", "CDF"}:
        raise HTTPException(status_code=400, detail="Devise non supportee")

    commande = await db.commandes.find_one({"id": body.commandeId}, {"_id": 0})
    if not commande or commande.get("userId") != user["id"]:
        raise HTTPException(status_code=404, detail="Commande introuvable")
    if commande.get("paiement", {}).get("statut") == "paye":
        raise HTTPException(status_code=400, detail="Commande deja payee")

    total_fc = float(commande["total"])
    montant = total_fc if devise == "CDF" else total_fc / float((await lire_config())["tauxFC"])
    decimales = operateur["decimales"][devise]
    montant_txt = f"{round(montant, decimales):.{decimales}f}" if decimales else str(int(round(montant)))

    msisdn = normaliser_msisdn(body.telephone)
    depot_id = str(uuid.uuid4())
    await db.paiements.insert_one(
        {
            "id": depot_id,
            "depositId": depot_id,
            "commandeId": commande["id"],
            "userId": user["id"],
            "operateur": body.operateur,
            "provider": operateur["provider"],
            "telephone": msisdn,
            "montant": montant_txt,
            "devise": devise,
            "statut": "ACCEPTED_PENDING",
            "createdAt": iso(now_utc()),
        }
    )

    charge = {
        "depositId": depot_id,
        "amount": montant_txt,
        "currency": devise,
        "payer": {"type": "MMO", "accountDetails": {"provider": operateur["provider"], "phoneNumber": msisdn}},
        "clientReferenceId": commande["numero"],
        # Uniquement alphanumerique et espaces, 22 caracteres max.
        "customerMessage": re.sub(r"[^A-Za-z0-9 ]", " ", f"Pinkberry {commande['numero']}")[:22],
    }
    try:
        reponse = await _pawapay_appel("POST", "/v2/deposits", json=charge)
    except HTTPException:
        await db.paiements.update_one({"depositId": depot_id}, {"$set": {"statut": "UNKNOWN"}})
        raise

    etat = reponse.get("status")
    await db.paiements.update_one(
        {"depositId": depot_id},
        {"$set": {"statutInitiation": etat, "raisonEchec": reponse.get("failureReason")}},
    )
    await db.commandes.update_one(
        {"id": commande["id"]},
        {
            "$set": {
                "paiement": {
                    "mode": "mobile",
                    "operateur": body.operateur,
                    "operateurNom": operateur["nom"],
                    "devise": devise,
                    "montant": montant_txt,
                    "telephone": msisdn[-4:].rjust(len(msisdn), "*"),
                    "depositId": depot_id,
                    "statut": "echoue" if etat == "REJECTED" else "attente",
                    "updatedAt": iso(now_utc()),
                },
                "paye": False,
            }
        },
    )
    if etat == "REJECTED":
        raise HTTPException(status_code=400, detail="Paiement refuse par l'operateur")
    return {
        "depositId": depot_id,
        "statut": "attente",
        "montant": montant_txt,
        "devise": devise,
        "message": "Validez la demande avec votre code PIN sur votre telephone.",
    }


@api_router.get("/paiements/{depot_id}")
async def paiement_statut(depot_id: str, user=Depends(get_current_user)):
    paiement = await db.paiements.find_one({"depositId": depot_id}, {"_id": 0})
    if not paiement or (paiement["userId"] != user["id"] and user["role"] not in {"admin", "superadmin"}):
        raise HTTPException(status_code=404, detail="Paiement introuvable")
    if paiement["statut"] not in ETATS_FINAUX:
        await _synchroniser_depot(depot_id)
        paiement = await db.paiements.find_one({"depositId": depot_id}, {"_id": 0}) or paiement

    statut = statut_public(paiement["statut"])
    expire = False
    if statut == "attente":
        debut = datetime.fromisoformat(paiement["createdAt"])
        expire = (now_utc() - debut).total_seconds() > PAWAPAY_DELAI_EXPIRATION
    return {
        "depositId": depot_id,
        "statut": "expire" if expire else statut,
        "montant": paiement["montant"],
        "devise": paiement["devise"],
        "raisonEchec": paiement.get("raisonEchec"),
    }


@api_router.post("/paiements/{commande_id}/cash")
async def paiement_basculer_cash(commande_id: str, user=Depends(get_current_user)):
    """Repli demande par le client apres un echec mobile money."""
    commande = await db.commandes.find_one({"id": commande_id}, {"_id": 0})
    if not commande or commande.get("userId") != user["id"]:
        raise HTTPException(status_code=404, detail="Commande introuvable")
    if commande.get("paiement", {}).get("statut") == "paye":
        raise HTTPException(status_code=400, detail="Commande deja payee")
    await db.commandes.update_one(
        {"id": commande_id},
        {"$set": {"paiement": {"mode": "cash", "statut": "a_la_livraison", "updatedAt": iso(now_utc())}, "paye": False}},
    )
    return {"ok": True, "mode": "cash"}


@api_router.post("/paiements/pawapay/callback", status_code=200)
async def pawapay_callback(request: Request):
    brut = await request.body()
    verifier_callback(request, brut)
    try:
        charge = json.loads(brut.decode())
    except Exception:
        raise HTTPException(status_code=400, detail="Callback illisible")
    if not charge.get("depositId") or charge.get("status") not in ETATS_FINAUX:
        raise HTTPException(status_code=400, detail="Callback invalide")
    await appliquer_etat_final(charge)
    return {"ok": True}


# --------------------------------------------------- notifications push (relay)
@api_router.post("/register-push", status_code=201)
async def register_push(body: RegisterPushBody, user=Depends(get_current_user)):
    charge = {"user_id": user["id"], "platform": body.platform, "device_token": body.device_token}
    resp = await _push_client.post("/api/v1/push/users/register", json=charge)
    if resp.status_code == 401:
        raise HTTPException(status_code=500, detail="EMERGENT_PUSH_KEY manquante ou invalide")
    if resp.status_code >= 500:
        raise HTTPException(status_code=502, detail="Service de notifications indisponible")
    resp.raise_for_status()
    return {"status": "registered"}


async def send_push(recipients: List[str], data: Dict[str, Any], idempotency_key: Optional[str] = None) -> None:
    recipients = [r for r in recipients if r]
    if not recipients:
        return
    if len(recipients) > 100:
        raise ValueError("max 100 destinataires par appel")
    if "title" not in data or "message" not in data:
        raise ValueError("data doit contenir title et message")
    payload: Dict[str, Any] = {"recipients": recipients, "data": data}
    if idempotency_key:
        payload["$idempotency_key"] = idempotency_key
    resp = await _push_client.post("/api/v1/push/trigger", json=payload)
    if resp.status_code == 401:
        raise HTTPException(status_code=500, detail="EMERGENT_PUSH_KEY manquante ou invalide")
    if resp.status_code >= 500:
        raise HTTPException(status_code=502, detail="Service de notifications indisponible")
    resp.raise_for_status()


async def ids_admins() -> List[str]:
    admins = await db.users.find({"role": {"$in": ["admin", "superadmin"]}}, {"_id": 0, "id": 1}).to_list(50)
    return [a["id"] for a in admins]


async def id_user_livreur(livreur_id: Optional[str]) -> Optional[str]:
    if not livreur_id:
        return None
    u = await db.users.find_one({"livreurId": livreur_id}, {"_id": 0, "id": 1})
    return u["id"] if u else None


# ---------------------------------------------------------------- notifications
# Deux canaux pour chaque evenement metier :
#  - notification interne (collection `notifications`) : toast quand l'app est
#    ouverte + centre de notifications consultable ;
#  - push systeme (web push VAPID + relais natif) : recu meme app fermee.
# Les preferences de l'utilisateur (type de notification) filtrent les deux, et
# le texte suit sa langue. Les envois ne bloquent jamais la requete metier.
PREF_PAR_TYPE = {
    "commande": "notifSuivi",
    "paiement": "notifSuivi",
    "promotion": "notifPromos",
    "admin": "notifCommandes",
    "course": "notifCourses",
}

MESSAGES_NOTIF: Dict[str, Dict[str, Tuple[str, str]]] = {
    "statut_recue": {
        "fr": ("Commande reçue", "Nous avons bien reçu votre commande {numero}."),
        "en": ("Order received", "We've received your order {numero}."),
    },
    "statut_en_preparation": {
        "fr": ("En préparation", "Votre commande {numero} est en préparation."),
        "en": ("Being prepared", "Your order {numero} is being prepared."),
    },
    "statut_recuperee": {
        "fr": ("Commande récupérée", "Le livreur a récupéré votre commande {numero}."),
        "en": ("Order picked up", "The rider has picked up your order {numero}."),
    },
    "statut_en_route": {
        "fr": ("Livreur en route", "Votre livreur arrive, suivez-le sur la carte."),
        "en": ("Rider on the way", "Your rider is on the way, follow them on the map."),
    },
    "statut_arrivee": {
        "fr": ("Livreur arrivé", "Votre livreur est arrivé à l'adresse de livraison."),
        "en": ("Rider has arrived", "Your rider has arrived at the delivery address."),
    },
    "statut_livree": {
        "fr": ("Commande livrée", "Bon appétit ! Merci pour votre commande {numero}."),
        "en": ("Order delivered", "Enjoy! Thank you for your order {numero}."),
    },
    "statut_annulee": {
        "fr": ("Commande annulée", "Votre commande {numero} a été annulée."),
        "en": ("Order cancelled", "Your order {numero} has been cancelled."),
    },
    "paiement_ok": {
        "fr": ("Paiement confirmé", "Votre paiement de {total} pour {numero} est confirmé."),
        "en": ("Payment confirmed", "Your payment of {total} for {numero} is confirmed."),
    },
    "paiement_ko": {
        "fr": ("Paiement échoué", "Le paiement de {numero} n'a pas abouti, vous pouvez réessayer."),
        "en": ("Payment failed", "The payment for {numero} didn't go through, you can try again."),
    },
    "admin_nouvelle": {
        "fr": ("Nouvelle commande", "{client} · {numero} · {total}"),
        "en": ("New order", "{client} · {numero} · {total}"),
    },
    "admin_annulee": {
        "fr": ("Commande annulée", "{client} a annulé la commande {numero}."),
        "en": ("Order cancelled", "{client} cancelled order {numero}."),
    },
    "course": {
        "fr": ("Nouvelle course", "{numero} · {commune} · {total} à encaisser"),
        "en": ("New delivery", "{numero} · {commune} · {total} to collect"),
    },
    "promotion": {
        "fr": ("Nouvelle promotion", "{nom} : {remise}"),
        "en": ("New offer", "{nom}: {remise}"),
    },
}

_taches_notif: set = set()


def _langue(prefs: Dict[str, Any]) -> str:
    return prefs.get("langue") if prefs.get("langue") in ("fr", "en") else "fr"


async def notifier(
    user_ids: List[str],
    type_notif: str,
    cle: str,
    lien: str,
    tag: str,
    params: Optional[Dict[str, Any]] = None,
    params_par_langue: Optional[Dict[str, Dict[str, Any]]] = None,
) -> int:
    """Cree les notifications internes puis lance les push en tache de fond.
    Renvoie le nombre de destinataires retenus (preferences respectees)."""
    ids = list(dict.fromkeys(u for u in user_ids if u))
    if not ids:
        return 0
    pref = PREF_PAR_TYPE[type_notif]
    users = await db.users.find({"id": {"$in": ids}}, {"_id": 0, "id": 1, "preferences": 1}).to_list(len(ids))
    maintenant = now_utc()
    docs = []
    for u in users:
        prefs = {**PREFS_DEFAUT, **(u.get("preferences") or {})}
        if not prefs.get(pref, True):
            continue
        langue = _langue(prefs)
        titre, modele = MESSAGES_NOTIF[cle][langue]
        valeurs = {**(params or {}), **((params_par_langue or {}).get(langue) or {})}
        docs.append({
            "id": str(uuid.uuid4()),
            "userId": u["id"],
            "type": type_notif,
            "titre": titre,
            "message": modele.format(**valeurs),
            "lien": lien,
            "tag": tag,
            "lu": False,
            "createdAt": iso(maintenant),
            "expireAt": maintenant + timedelta(days=60),  # purge automatique (index TTL)
        })
    if not docs:
        return 0
    await db.notifications.insert_many([dict(d) for d in docs])
    tache = asyncio.create_task(_pousser(docs))
    _taches_notif.add(tache)
    tache.add_done_callback(_taches_notif.discard)
    return len(docs)


async def _pousser(docs: List[Dict[str, Any]]) -> None:
    """Push systeme de chaque notification : web push + relais des apps natives."""
    for d in docs:
        try:
            await envoyer_webpush([d["userId"]], d["titre"], d["message"], d["lien"], tag=d["tag"])
        except Exception as e:
            logger.warning(f"Web push non bloquant: {e!r}")
        try:
            await send_push(
                recipients=[d["userId"]],
                data={"title": d["titre"], "message": d["message"], "action_url": d["lien"]},
                idempotency_key=f"{d['tag']}-{d['userId']}",
            )
        except Exception as e:
            logger.warning(f"Push natif non bloquant: {e!r}")


async def notifier_client(cmd: Dict[str, Any], statut: str) -> None:
    if f"statut_{statut}" not in MESSAGES_NOTIF:
        return
    await notifier([cmd["userId"]], "commande", f"statut_{statut}", f"/suivi/{cmd['id']}",
                   tag=f"cmd-{cmd['id']}-{statut}", params={"numero": cmd.get("numero", "")})


async def notifier_paiement(commande_id: str, paye: bool) -> None:
    """Paiement Mobile Money confirme (ou echoue) : notification au client."""
    cmd = await db.commandes.find_one({"id": commande_id}, {"_id": 0})
    if not cmd:
        return
    await notifier([cmd["userId"]], "paiement", "paiement_ok" if paye else "paiement_ko", f"/suivi/{commande_id}",
                   tag=f"paiement-{commande_id}-{'ok' if paye else 'ko'}",
                   params={"numero": cmd.get("numero", ""), "total": fc_txt(cmd.get("total"))})


async def notifier_admins(cmd: Dict[str, Any], cle: str = "admin_nouvelle") -> None:
    await notifier(await ids_admins(), "admin", cle, "/admin", tag=f"{cle}-{cmd['id']}",
                   params={"client": cmd.get("clientNom") or "—", "numero": cmd.get("numero", ""),
                           "total": fc_txt(cmd.get("total"))})


async def notifier_livreur(cmd: Dict[str, Any]) -> None:
    cible = await id_user_livreur(cmd.get("livreurId"))
    await notifier([cible] if cible else [], "course", "course", f"/livreur/course/{cmd['id']}",
                   tag=f"course-{cmd['id']}-{cmd.get('livreurId')}",
                   params={"numero": cmd.get("numero", ""), "commune": (cmd.get("adresse") or {}).get("commune", ""),
                           "total": fc_txt(cmd.get("total"))})


class NotificationsLuesIn(BaseModel):
    ids: Optional[List[str]] = None  # absent : tout marquer comme lu


@api_router.get("/notifications")
async def mes_notifications(limite: int = 30, user=Depends(get_current_user)):
    """Centre de notifications de l'utilisateur connecte (tous roles)."""
    limite = max(1, min(limite, 100))
    notifs = (
        await db.notifications.find({"userId": user["id"]}, {"_id": 0, "expireAt": 0})
        .sort("createdAt", -1)
        .to_list(limite)
    )
    non_lues = await db.notifications.count_documents({"userId": user["id"], "lu": False})
    return JSONResponse({"notifications": notifs, "nonLues": non_lues}, headers={"Cache-Control": "no-store"})


@api_router.post("/notifications/lues")
async def marquer_notifications_lues(body: NotificationsLuesIn, user=Depends(get_current_user)):
    filtre: Dict[str, Any] = {"userId": user["id"], "lu": False}
    if body.ids is not None:
        filtre["id"] = {"$in": body.ids}
    res = await db.notifications.update_many(filtre, {"$set": {"lu": True}})
    return {"ok": True, "marquees": res.modified_count}

# --------------------------------------------- notifications push web (VAPID)
# Push navigateur (systeme) : recues meme onglet ferme. Les pop-ups internes de
# l'app (toasts) restent independantes.
VAPID_PUBLIC_KEY = os.environ.get("VAPID_PUBLIC_KEY", "")
VAPID_PRIVATE_KEY = os.environ.get("VAPID_PRIVATE_KEY", "")
VAPID_SUBJECT = os.environ.get("VAPID_SUBJECT", "mailto:contact@pinkberrydrc.cd")


class AbonnementWebBody(BaseModel):
    endpoint: str
    keys: Dict[str, str] = Field(default_factory=dict)
    expirationTime: Optional[int] = None
    appareil: Optional[str] = Field(default=None, max_length=120)  # ex. « Chrome · Android »


@api_router.get("/push/web/cle-publique")
async def cle_publique_web():
    """Cle publique VAPID : non secrete, necessaire au navigateur pour s'abonner."""
    return {"clePublique": VAPID_PUBLIC_KEY, "actif": bool(VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY)}


@api_router.put("/push/web/abonnement")
async def enregistrer_abonnement_web(
    body: AbonnementWebBody, user: Dict[str, Any] = Depends(get_current_user)
):
    if set(body.keys) != {"p256dh", "auth"} or not body.endpoint.startswith("https://"):
        raise HTTPException(status_code=400, detail="Abonnement invalide")
    await db.push_subscriptions.update_one(
        {"endpoint": body.endpoint},
        {
            "$set": {
                "userId": user["id"],
                "endpoint": body.endpoint,
                "keys": body.keys,
                "appareil": _texte(body.appareil) or None,
                "expirationTime": body.expirationTime,
                "updatedAt": iso(now_utc()),
            },
            "$setOnInsert": {"createdAt": iso(now_utc())},
        },
        upsert=True,
    )
    return {"ok": True}


@api_router.delete("/push/web/abonnement")
async def supprimer_abonnement_web(
    body: AbonnementWebBody, user: Dict[str, Any] = Depends(get_current_user)
):
    await db.push_subscriptions.delete_one({"endpoint": body.endpoint, "userId": user["id"]})
    return {"ok": True}


@api_router.get("/push/web/etat")
async def etat_abonnement_web(user: Dict[str, Any] = Depends(get_current_user)):
    n = await db.push_subscriptions.count_documents({"userId": user["id"]})
    return {"abonnements": n}


def _envoyer_un_webpush(abonnement: Dict[str, Any], charge: str) -> Optional[int]:
    """Envoi bloquant (execute dans un thread). Renvoie le code HTTP en cas d'echec."""
    try:
        webpush(
            subscription_info={"endpoint": abonnement["endpoint"], "keys": abonnement["keys"]},
            data=charge,
            vapid_private_key=VAPID_PRIVATE_KEY,
            vapid_claims={"sub": VAPID_SUBJECT},
            ttl=86400,
        )
        return None
    except WebPushException as e:
        return getattr(getattr(e, "response", None), "status_code", 0) or 0


async def envoyer_webpush(
    user_ids: List[str], titre: str, message: str, url: str, tag: Optional[str] = None
) -> int:
    """Notification systeme a tous les navigateurs abonnes de ces utilisateurs."""
    cibles = [u for u in user_ids if u]
    if not cibles or not (VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY):
        return 0
    abonnements = await db.push_subscriptions.find({"userId": {"$in": cibles}}, {"_id": 0}).to_list(200)
    if not abonnements:
        return 0
    charge = json.dumps(
        {
            "title": titre,
            "body": message,
            "icon": "/icones/icon-192.png",
            "badge": "/icones/badge-96.png",
            "url": url,
            "tag": tag or "pinkberry",
        }
    )
    envoyes = 0
    for abo in abonnements:
        code = await asyncio.to_thread(_envoyer_un_webpush, abo, charge)
        if code is None:
            envoyes += 1
        elif code in (404, 410):
            # Abonnement expire cote navigateur : on nettoie.
            await db.push_subscriptions.delete_one({"endpoint": abo["endpoint"]})
        else:
            logger.warning(f"Web push echoue ({code})")
    return envoyes


# ------------------------------------------------------- traduction du catalogue
_tache_traductions: Optional[asyncio.Task] = None
LLM_MODELE_TRADUCTION = os.environ.get("LLM_MODELE_TRADUCTION", "claude-haiku-4-5-20251001")



def _texte(v: Any) -> str:
    return v.strip() if isinstance(v, str) else ""


def _champs_traduisibles(p: Dict[str, Any]) -> List[tuple]:
    """(objet, champ FR, champ EN) de tout ce qui s'affiche d'un produit."""
    return [
        (p, "nom", "nomEn"),
        (p, "description", "descriptionEn"),
        *[(o, "nom", "nomEn") for o in (p.get("tailles") or []) + (p.get("garnitures") or [])],
    ]


async def glossaire() -> Dict[str, str]:
    """FR -> EN deja connus : demo, puis catalogue (corrections de l'admin comprises)."""
    connus = dict(TRADUCTIONS_MENU)
    for p in await db.produits.find({}, {"_id": 0}).to_list(500):
        for o, fr, en in _champs_traduisibles(p):
            if _texte(o.get(fr)) and _texte(o.get(en)):
                connus[_texte(o[fr])] = _texte(o[en])
    for c in await db.categories.find({}, {"_id": 0}).to_list(100):
        for o in [c, *(c.get("sousCategories") or [])]:
            if _texte(o.get("nomEn")):
                connus[_texte(o["nom"])] = _texte(o["nomEn"])
    return connus


async def _traduire_llm(textes: List[str], exemples: Dict[str, str]) -> Dict[str, str]:
    from emergentintegrations.llm.chat import LlmChat, UserMessage

    style = "\n".join(f"- {fr} => {en}" for fr, en in list(exemples.items())[:30] if len(fr) <= 40)
    chat = LlmChat(
        api_key=EMERGENT_KEY,
        session_id=f"traduction-{uuid.uuid4()}",
        system_message=(
            "Tu traduis du francais vers l'anglais les libelles du menu d'un bar a frozen yogurt "
            "(produits, descriptions, categories, tailles, garnitures). Chaque entree est independante : "
            "traduis-la fidelement, sans rien y ajouter ni reprendre d'une autre entree. Traduction courte "
            "et naturelle pour une carte ; conserve les noms propres, marques et unites. Reste coherent "
            f"avec les traductions deja en place :\n{style}\n"
            'Reponds uniquement par un objet JSON {"<index>": "<traduction>"} reprenant chaque index '
            "recu, sans autre texte."
        ),
    ).with_model("anthropic", LLM_MODELE_TRADUCTION)
    entree = json.dumps({str(i): t for i, t in enumerate(textes)}, ensure_ascii=False)
    reponse = await asyncio.wait_for(chat.send_message(UserMessage(text=entree)), timeout=20)
    donnees = json.loads(reponse[reponse.find("{"): reponse.rfind("}") + 1])
    return {
        textes[int(k)]: _texte(v)
        for k, v in donnees.items()
        if k.isdigit() and int(k) < len(textes) and _texte(v)
    }


async def traduire_en(textes: List[str]) -> Dict[str, str]:
    """Traductions anglaises de `textes` : glossaire d'abord, un seul appel LLM
    pour le reste. Ne leve jamais : un texte non traduit est absent du resultat
    et le front retombe sur le francais."""
    uniques = list(dict.fromkeys(_texte(t) for t in textes if _texte(t)))
    if not uniques:
        return {}
    connus = await glossaire()
    res = {t: connus[t] for t in uniques if t in connus}
    manquants = [t for t in uniques if t not in res]
    if manquants and EMERGENT_KEY:
        try:
            res.update(await _traduire_llm(manquants, connus))
        except Exception as e:
            logger.warning(f"Traduction EN indisponible : {e!r}")
    return res


def _oublier_traductions_perimees(doc: Dict[str, Any], ancien: Dict[str, Any]) -> None:
    """Un EN renvoye tel quel alors que le FR a change est perime : on le vide
    pour qu'il soit retraduit. Un EN modifie par l'admin est conserve."""
    for fr, en in (("nom", "nomEn"), ("description", "descriptionEn")):
        if _texte(doc.get(fr)) != _texte(ancien.get(fr)) and _texte(doc.get(en)) == _texte(ancien.get(en)):
            doc[en] = None
    for cle in ("tailles", "garnitures"):
        anciennes = ancien.get(cle) or []
        paires = {(_texte(o.get("nom")), _texte(o.get("nomEn"))) for o in anciennes}
        anciens_en = {_texte(o.get("nomEn")) for o in anciennes if _texte(o.get("nomEn"))}
        for o in doc.get(cle) or []:
            en = _texte(o.get("nomEn"))
            if en and (_texte(o.get("nom")), en) not in paires and en in anciens_en:
                o["nomEn"] = None


async def completer_traductions_produit(doc: Dict[str, Any], ancien: Optional[Dict[str, Any]] = None) -> None:
    if ancien:
        _oublier_traductions_perimees(doc, ancien)
    champs = _champs_traduisibles(doc)
    trad = await traduire_en([o.get(fr) for o, fr, en in champs if not _texte(o.get(en))])
    for o, fr, en in champs:
        o[en] = _texte(o.get(en)) or trad.get(_texte(o.get(fr))) or None


async def categories_par_nom() -> Dict[str, Dict[str, Any]]:
    return {c["nom"]: c for c in await db.categories.find({}, {"_id": 0}).to_list(100)}


async def completer_sous_categories(sous: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Noms nettoyes, sans doublon, anglais complete quand il manque."""
    propres: Dict[str, Optional[str]] = {}
    for o in sous:
        nom = _texte(o.get("nom"))
        if len(nom) >= 2 and nom.lower() not in {n.lower() for n in propres}:
            propres[nom] = _texte(o.get("nomEn")) or None
    trad = await traduire_en([n for n, en in propres.items() if not en])
    return [{"nom": n, "nomEn": en or trad.get(n)} for n, en in propres.items()]


PRIX_REQUIS = "Saisissez un prix avant de rendre le produit disponible"


def _vendable(p: Dict[str, Any]) -> bool:
    """Un produit a 0 FC reste en rupture : il serait vendu gratuitement. Un
    frozen yogurt compose est tarife par les tailles de /composition."""
    return bool(p.get("configurable")) or en_fc(p.get("prix")) > 0


async def normaliser_produit(doc: Dict[str, Any]) -> None:
    """Prix en FC entiers ; sous-categorie existante dans la categorie."""
    doc["configurable"] = bool(doc.get("configurable"))
    if doc["configurable"]:
        doc.update({"prix": 0, "tailles": [], "garnitures": []})
    doc["prix"] = en_fc(doc.get("prix"))
    for t in doc.get("tailles") or []:
        t["ecart"] = en_fc(t.get("ecart"))
    for g in doc.get("garnitures") or []:
        g["prix"] = en_fc(g.get("prix"))
    if doc.get("disponible") and not _vendable(doc):
        raise HTTPException(status_code=400, detail=PRIX_REQUIS)
    doc["sousCategorie"] = _texte(doc.get("sousCategorie")) or None
    if doc["sousCategorie"]:
        cat = (await categories_par_nom()).get(doc["categorie"]) or {}
        if doc["sousCategorie"] not in {o["nom"] for o in cat.get("sousCategories") or []}:
            raise HTTPException(status_code=400, detail="Sous-categorie inconnue pour cette categorie")


async def traduire_catalogue_existant() -> None:
    """Complete en tache de fond les traductions manquantes (catalogue saisi
    avant l'ajout des champs EN)."""
    try:
        for p in await db.produits.find({}, {"_id": 0}).to_list(500):
            if all(_texte(o.get(en)) or not _texte(o.get(fr)) for o, fr, en in _champs_traduisibles(p)):
                continue
            await completer_traductions_produit(p)
            await db.produits.update_one({"id": p["id"]}, {"$set": p})
        for c in await db.categories.find({}, {"_id": 0}).to_list(100):
            sous = c.get("sousCategories") or []
            if _texte(c.get("nomEn")) and all(_texte(o.get("nomEn")) for o in sous):
                continue
            en = _texte(c.get("nomEn")) or (await traduire_en([c["nom"]])).get(_texte(c["nom"]))
            maj = {"nomEn": en or None, "sousCategories": await completer_sous_categories(sous)}
            await db.categories.update_one({"id": c["id"]}, {"$set": maj})
        await migrer_traductions_commandes()
    except Exception as e:
        logger.warning(f"Traduction du catalogue existant : {e!r}")


async def migrer_traductions_commandes() -> None:
    """Les commandes anterieures aux champs EN recoivent les traductions connues
    (sans LLM). Idempotent : ne concerne que les lignes sans cle `nomEn`."""
    connus = await glossaire()
    async for cmd in db.commandes.find({"items": {"$elemMatch": {"nomEn": {"$exists": False}}}}, {"_id": 0, "id": 1, "items": 1}):
        for i in cmd["items"]:
            i["nomEn"] = connus.get(_texte(i.get("nom")))
            i["tailleEn"] = connus.get(_texte(i.get("taille")))
            for g in i.get("garnitures") or []:
                g["nomEn"] = connus.get(_texte(g.get("nom")))
        await db.commandes.update_one({"id": cmd["id"]}, {"$set": {"items": cmd["items"]}})


# --------------------------------------------------------------------- catalogue
@api_router.get("/produits")
async def liste_produits():
    items = await db.produits.find({}, {"_id": 0}).to_list(500)
    categories = await categories_par_nom()
    for p in items:
        cat = categories.get(p["categorie"]) or {}
        p["categorieEn"] = cat.get("nomEn")
        sous = {o["nom"]: o.get("nomEn") for o in cat.get("sousCategories") or []}
        p["sousCategorieEn"] = sous.get(p.get("sousCategorie") or "")
    return sorted(items, key=lambda p: (p["categorie"], p.get("sousCategorie") or "", p["nom"]))


@api_router.get("/categories")
async def liste_categories(details: bool = False):
    cats = await db.categories.find({}, {"_id": 0}).to_list(100)
    if details:
        # Libelles des deux langues ; « Tous » reste un filtre traduit par le front.
        return sorted(
            ({"nom": c["nom"], "nomEn": c.get("nomEn"), "sousCategories": c.get("sousCategories") or []} for c in cats),
            key=lambda c: c["nom"],
        )
    noms = sorted({c["nom"] for c in cats})
    return ["Tous", *noms]


@api_router.post("/admin/traduire")
async def traduire(body: TraductionIn, _=Depends(require_admin)):
    """Pre-remplissage des champs EN du formulaire (l'admin relit avant d'enregistrer)."""
    trad = await traduire_en(body.textes)
    return {"traductions": [trad.get(_texte(t)) for t in body.textes]}


@api_router.get("/admin/categories")
async def admin_categories(_=Depends(require_admin)):
    cats = await db.categories.find({}, {"_id": 0}).to_list(100)
    compte = {
        g["_id"]: g["n"]
        for g in await db.produits.aggregate([{"$group": {"_id": "$categorie", "n": {"$sum": 1}}}]).to_list(200)
    }
    for c in cats:
        c["nbProduits"] = compte.get(c["nom"], 0)
    return sorted(cats, key=lambda c: c["nom"].lower())


@api_router.post("/admin/categories")
async def creer_categorie(body: CategorieIn, _=Depends(require_admin)):
    nom = body.nom.strip()
    if len(nom) < 2:
        raise HTTPException(status_code=400, detail="Nom de categorie trop court")
    if nom.lower() == "tous":
        raise HTTPException(status_code=400, detail="« Tous » est un filtre reserve")
    if await db.categories.find_one({"nom": {"$regex": f"^{re.escape(nom)}$", "$options": "i"}}):
        raise HTTPException(status_code=400, detail="Cette categorie existe deja")
    nom_en = _texte(body.nomEn) or (await traduire_en([nom])).get(nom)
    doc = {"id": str(uuid.uuid4()), "nom": nom, "nomEn": nom_en, "sousCategories": []}
    await db.categories.insert_one(dict(doc))
    doc["nbProduits"] = 0
    return doc


@api_router.put("/admin/categories/{categorie_id}")
async def modifier_categorie(categorie_id: str, body: CategorieMajIn, _=Depends(require_admin)):
    """Libelle anglais et sous-categories. Les produits d'une sous-categorie
    retiree restent dans la categorie, sans section."""
    cat = await db.categories.find_one({"id": categorie_id}, {"_id": 0})
    if not cat:
        raise HTTPException(status_code=404, detail="Categorie introuvable")
    maj: Dict[str, Any] = {}
    if "nomEn" in body.model_fields_set:
        maj["nomEn"] = _texte(body.nomEn) or (await traduire_en([cat["nom"]])).get(_texte(cat["nom"]))
    if body.sousCategories is not None:
        maj["sousCategories"] = await completer_sous_categories([o.model_dump() for o in body.sousCategories])
        await db.produits.update_many(
            {"categorie": cat["nom"], "sousCategorie": {"$nin": [None, *(o["nom"] for o in maj["sousCategories"])]}},
            {"$set": {"sousCategorie": None}},
        )
    if maj:
        await db.categories.update_one({"id": categorie_id}, {"$set": maj})
    return {**cat, **maj}


@api_router.delete("/admin/categories/{categorie_id}")
async def supprimer_categorie(categorie_id: str, _=Depends(require_admin)):
    cat = await db.categories.find_one({"id": categorie_id}, {"_id": 0})
    if not cat:
        raise HTTPException(status_code=404, detail="Categorie introuvable")
    res = await db.produits.delete_many({"categorie": cat["nom"]})
    await db.categories.delete_one({"id": categorie_id})
    return {"ok": True, "produitsSupprimes": res.deleted_count}


@api_router.post("/admin/produits")
async def creer_produit(body: ProduitIn, _=Depends(require_admin)):
    doc = body.model_dump()
    await normaliser_produit(doc)
    await completer_traductions_produit(doc)
    doc["id"] = str(uuid.uuid4())
    await db.produits.insert_one(dict(doc))
    return {k: v for k, v in doc.items() if k != "_id"}


@api_router.put("/admin/produits/{produit_id}")
async def modifier_produit(produit_id: str, body: ProduitIn, _=Depends(require_admin)):
    ancien = await db.produits.find_one({"id": produit_id}, {"_id": 0})
    if not ancien:
        raise HTTPException(status_code=404, detail="Produit introuvable")
    doc = body.model_dump()
    # Champs ajoutes apres coup : un client qui ne les connait pas (ancienne
    # version de l'app) ne doit pas les effacer en les omettant.
    for cle in ("sousCategorie", "nomEn", "descriptionEn", "configurable"):
        if cle not in body.model_fields_set:
            doc[cle] = ancien.get(cle)
    await normaliser_produit(doc)
    await completer_traductions_produit(doc, ancien)
    await db.produits.update_one({"id": produit_id}, {"$set": doc})
    return await db.produits.find_one({"id": produit_id}, {"_id": 0})


@api_router.delete("/admin/produits/{produit_id}")
async def supprimer_produit(produit_id: str, _=Depends(require_admin)):
    await db.produits.delete_one({"id": produit_id})
    return {"ok": True}


def _maj_etat(body: EtatProduitIn) -> Dict[str, bool]:
    maj = {k: v for k, v in body.model_dump(include={"disponible", "enAvant"}).items() if v is not None}
    if not maj:
        raise HTTPException(status_code=400, detail="Aucun changement d'etat demande")
    return maj


@api_router.patch("/admin/produits/{produit_id}/etat")
async def modifier_etat_produit(produit_id: str, body: EtatProduitIn, _=Depends(require_admin)):
    maj = _maj_etat(body)
    produit = await db.produits.find_one({"id": produit_id}, {"_id": 0})
    if not produit:
        raise HTTPException(status_code=404, detail="Produit introuvable")
    if maj.get("disponible") and not _vendable(produit):
        raise HTTPException(status_code=400, detail=PRIX_REQUIS)
    await db.produits.update_one({"id": produit_id}, {"$set": maj})
    return {**produit, **maj}


@api_router.post("/admin/produits/bulk/etat")
async def modifier_etat_produits_bulk(body: BulkEtatIn, _=Depends(require_admin)):
    """Les produits a 0 FC sont laisses en rupture et listes dans `ignores`."""
    maj = _maj_etat(body)
    ids = list(dict.fromkeys(i for i in body.ids if i))
    ignores: List[str] = []
    if maj.get("disponible"):
        produits = await db.produits.find({"id": {"$in": ids}}, {"_id": 0, "id": 1, "nom": 1, "prix": 1}).to_list(len(ids))
        ignores = [p["nom"] for p in produits if not _vendable(p)]
        ids = [p["id"] for p in produits if _vendable(p)]
    res = await db.produits.update_many({"id": {"$in": ids}}, {"$set": maj}) if ids else None
    return {"ok": True, "updated_count": res.matched_count if res else 0, "ignores": ignores}


@api_router.delete("/admin/produits/bulk/delete")
async def supprimer_produits_bulk(body: BulkIdsIn, _=Depends(require_admin)):
    ids = [i for i in body.ids if i]
    if not ids:
        return {"ok": True, "deleted_count": 0}
    res = await db.produits.delete_many({"id": {"$in": ids}})
    return {"ok": True, "deleted_count": res.deleted_count}


# ------------------------------------------------- composition du frozen yogurt
# Tailles (prix de base + supplement garnitures), recipients, categories de
# garnitures et garnitures sont des collections gerees par l'admin. La regle de
# selection (nombre de garnitures, categories min/max) est un parametre modifiable.
REGLE_GARNITURES_DEFAUT = {"nombre": 6, "categoriesMin": 2, "categoriesMax": 3}


async def lire_regle_garnitures() -> Dict[str, int]:
    doc = await db.parametres.find_one({"cle": "global"}, {"_id": 0, "regleGarnitures": 1}) or {}
    return {**REGLE_GARNITURES_DEFAUT, **(doc.get("regleGarnitures") or {})}


def _par_ordre(docs: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    return sorted(docs, key=lambda d: (d.get("ordre", 0), d.get("nom", "").lower()))


async def lire_composition(admin: bool = False) -> Dict[str, Any]:
    """Cote client, seuls les elements disponibles sont renvoyes, et une categorie
    sans garniture disponible disparait."""
    tailles = _par_ordre(await db.tailles.find({}, {"_id": 0}).to_list(50))
    contenants = _par_ordre(await db.contenants.find({}, {"_id": 0}).to_list(50))
    categories = _par_ordre(await db.categories_garnitures.find({}, {"_id": 0}).to_list(50))
    garnitures = _par_ordre(await db.garnitures.find({}, {"_id": 0}).to_list(1000))
    if not admin:
        contenants = [c for c in contenants if c.get("disponible", True)]
        categories = [c for c in categories if c.get("disponible", True)]
        garnitures = [g for g in garnitures if g.get("disponible", True)]
    par_categorie: Dict[str, List[Dict[str, Any]]] = {}
    for g in garnitures:
        par_categorie.setdefault(g["categorieId"], []).append(g)
    categories = [{**c, "garnitures": par_categorie.get(c["id"], [])} for c in categories]
    if not admin:
        categories = [c for c in categories if c["garnitures"]]
    return {
        "tailles": tailles,
        "contenants": contenants,
        "categories": categories,
        "regle": await lire_regle_garnitures(),
    }


@api_router.get("/composition")
async def composition():
    return JSONResponse(await lire_composition(), headers={"Cache-Control": "no-store"})


@api_router.get("/admin/composition")
async def admin_composition(_=Depends(require_admin)):
    return await lire_composition(admin=True)


async def _libelles(nom: Any, nom_en: Any, ancien: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Nom FR obligatoire ; anglais saisi, conserve ou traduit automatiquement.
    Un anglais renvoye tel quel alors que le francais a change est retraduit."""
    nom = _texte(nom)
    if not nom:
        raise HTTPException(status_code=400, detail="Le nom est obligatoire")
    en = _texte(nom_en)
    if ancien and nom != ancien.get("nom") and en == _texte(ancien.get("nomEn")):
        en = ""
    return {"nom": nom, "nomEn": en or (await traduire_en([nom])).get(nom)}


async def _ordre_suivant(collection, filtre: Optional[Dict[str, Any]] = None) -> int:
    dernier = await collection.find(filtre or {}, {"_id": 0, "ordre": 1}).sort("ordre", -1).to_list(1)
    return (dernier[0].get("ordre", 0) + 1) if dernier else 0


async def _introuvable(collection, ident: str, libelle: str) -> Dict[str, Any]:
    doc = await collection.find_one({"id": ident}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail=f"{libelle} introuvable")
    return doc


# Tailles
@api_router.post("/admin/tailles")
async def creer_taille(body: TailleYogourtIn, _=Depends(require_admin)):
    doc = {
        "id": str(uuid.uuid4()),
        **await _libelles(body.nom, body.nomEn),
        "prixBase": en_fc(body.prixBase),
        "supplementGarnitures": en_fc(body.supplementGarnitures),
        "ordre": await _ordre_suivant(db.tailles),
    }
    await db.tailles.insert_one(dict(doc))
    return doc


@api_router.put("/admin/tailles/{taille_id}")
async def modifier_taille(taille_id: str, body: TailleYogourtIn, _=Depends(require_admin)):
    ancien = await _introuvable(db.tailles, taille_id, "Taille")
    maj = {
        **await _libelles(body.nom, body.nomEn, ancien),
        "prixBase": en_fc(body.prixBase),
        "supplementGarnitures": en_fc(body.supplementGarnitures),
    }
    await db.tailles.update_one({"id": taille_id}, {"$set": maj})
    return {**ancien, **maj}


@api_router.delete("/admin/tailles/{taille_id}")
async def supprimer_taille(taille_id: str, _=Depends(require_admin)):
    await _introuvable(db.tailles, taille_id, "Taille")
    if await db.tailles.count_documents({}) <= 1:
        raise HTTPException(status_code=400, detail="Gardez au moins une taille")
    await db.tailles.delete_one({"id": taille_id})
    return {"ok": True}


# Recipients
@api_router.post("/admin/contenants")
async def creer_contenant(body: ContenantIn, _=Depends(require_admin)):
    doc = {
        "id": str(uuid.uuid4()),
        **await _libelles(body.nom, body.nomEn),
        "disponible": body.disponible,
        "ordre": await _ordre_suivant(db.contenants),
    }
    await db.contenants.insert_one(dict(doc))
    return doc


@api_router.put("/admin/contenants/{contenant_id}")
async def modifier_contenant(contenant_id: str, body: ContenantIn, _=Depends(require_admin)):
    ancien = await _introuvable(db.contenants, contenant_id, "Recipient")
    maj = {**await _libelles(body.nom, body.nomEn, ancien), "disponible": body.disponible}
    await db.contenants.update_one({"id": contenant_id}, {"$set": maj})
    return {**ancien, **maj}


@api_router.delete("/admin/contenants/{contenant_id}")
async def supprimer_contenant(contenant_id: str, _=Depends(require_admin)):
    await _introuvable(db.contenants, contenant_id, "Recipient")
    await db.contenants.delete_one({"id": contenant_id})
    return {"ok": True}


# Categories de garnitures (liste fixe : on gere leur nom et leur disponibilite)
@api_router.put("/admin/categories-garnitures/{categorie_id}")
async def modifier_categorie_garnitures(categorie_id: str, body: CategorieGarnitureMajIn, _=Depends(require_admin)):
    ancien = await _introuvable(db.categories_garnitures, categorie_id, "Categorie de garnitures")
    maj: Dict[str, Any] = {}
    if body.nom is not None or body.nomEn is not None:
        maj.update(await _libelles(
            body.nom if body.nom is not None else ancien["nom"],
            body.nomEn if body.nomEn is not None else ancien.get("nomEn"),
            ancien,
        ))
    if body.disponible is not None:
        maj["disponible"] = body.disponible
    if maj:
        await db.categories_garnitures.update_one({"id": categorie_id}, {"$set": maj})
    return {**ancien, **maj}


# Garnitures
@api_router.post("/admin/garnitures")
async def creer_garniture(body: GarnitureIn, _=Depends(require_admin)):
    await _introuvable(db.categories_garnitures, body.categorieId, "Categorie de garnitures")
    doc = {
        "id": str(uuid.uuid4()),
        "categorieId": body.categorieId,
        **await _libelles(body.nom, body.nomEn),
        "disponible": body.disponible,
        "ordre": await _ordre_suivant(db.garnitures, {"categorieId": body.categorieId}),
    }
    await db.garnitures.insert_one(dict(doc))
    return doc


@api_router.put("/admin/garnitures/{garniture_id}")
async def modifier_garniture(garniture_id: str, body: GarnitureIn, _=Depends(require_admin)):
    ancien = await _introuvable(db.garnitures, garniture_id, "Garniture")
    await _introuvable(db.categories_garnitures, body.categorieId, "Categorie de garnitures")
    maj = {"categorieId": body.categorieId, **await _libelles(body.nom, body.nomEn, ancien), "disponible": body.disponible}
    await db.garnitures.update_one({"id": garniture_id}, {"$set": maj})
    return {**ancien, **maj}


@api_router.delete("/admin/garnitures/{garniture_id}")
async def supprimer_garniture(garniture_id: str, _=Depends(require_admin)):
    await _introuvable(db.garnitures, garniture_id, "Garniture")
    await db.garnitures.delete_one({"id": garniture_id})
    return {"ok": True}


# Regle de selection
@api_router.put("/admin/regle-garnitures")
async def modifier_regle_garnitures(body: RegleGarnituresIn, _=Depends(require_admin)):
    if body.categoriesMin > body.categoriesMax:
        raise HTTPException(status_code=400, detail="Le minimum de categories depasse le maximum")
    if body.categoriesMin > body.nombre:
        raise HTTPException(
            status_code=400, detail="Impossible de couvrir plus de categories que de garnitures choisies"
        )
    regle = body.model_dump()
    await db.parametres.update_one({"cle": "global"}, {"$set": {"regleGarnitures": regle}})
    return regle


def verifier_regle_garnitures(choisies: List[Dict[str, Any]], regle: Dict[str, int]) -> None:
    """Sans garniture : toujours valide. Avec : exactement `nombre` garnitures
    reparties sur `categoriesMin` a `categoriesMax` categories."""
    if not choisies:
        return
    if len(choisies) != regle["nombre"]:
        raise HTTPException(status_code=400, detail=f"Choisissez exactement {regle['nombre']} garnitures")
    nb = len({g["categorieId"] for g in choisies})
    if not regle["categoriesMin"] <= nb <= regle["categoriesMax"]:
        raise HTTPException(
            status_code=400,
            detail=f"Repartissez vos garnitures sur {regle['categoriesMin']} a {regle['categoriesMax']} categories",
        )


async def ligne_yogourt(p: Dict[str, Any], i: ItemIn, compo: Dict[str, Any]) -> Dict[str, Any]:
    """Ligne d'un frozen yogurt compose, recalculee depuis la composition publique
    (elements disponibles uniquement)."""
    taille = next((t for t in compo["tailles"] if t["nom"] == i.taille), None)
    if not taille:
        raise HTTPException(status_code=400, detail=f"Taille invalide pour {p['nom']}")
    contenant = None
    if compo["contenants"]:
        contenant = next((c for c in compo["contenants"] if c["nom"] == i.contenant), None)
        if not contenant:
            raise HTTPException(status_code=400, detail=f"Recipient indisponible pour {p['nom']}")
    offertes = {g["id"]: {**g, "categorie": c} for c in compo["categories"] for g in c["garnitures"]}
    ids = list(dict.fromkeys(g.id or "" for g in i.garnitures))
    if any(gid not in offertes for gid in ids):
        raise HTTPException(status_code=400, detail=f"Garniture indisponible pour {p['nom']}")
    choisies = [offertes[gid] for gid in ids]
    verifier_regle_garnitures(choisies, compo["regle"])
    prix = taille["prixBase"] + (taille["supplementGarnitures"] if choisies else 0)
    return {
        "taille": taille["nom"],
        "tailleEn": taille.get("nomEn"),
        "contenant": contenant["nom"] if contenant else None,
        "contenantEn": contenant.get("nomEn") if contenant else None,
        "garnitures": [
            {
                "id": g["id"],
                "nom": g["nom"],
                "nomEn": g.get("nomEn"),
                "categorie": g["categorie"]["nom"],
                "categorieEn": g["categorie"].get("nomEn"),
                "prix": 0,  # incluses dans le supplement de la taille
            }
            for g in choisies
        ],
        "prixUnitaire": en_fc(prix),
    }


# ------------------------------------------------------------------ promotions
# Entierement pilotees par l'admin. Le calcul de reduction se fait TOUJOURS ici,
# a partir des lignes recalculees depuis le catalogue : le client n'envoie que
# son panier et, eventuellement, un code. Une seule promotion par commande (la
# plus avantageuse), sauf promotions explicitement cumulables entre elles.
CODE_PROMO = re.compile(r"^[A-Z0-9_-]{3,30}$")


def _date_promo(v: Optional[str], champ: str) -> Optional[str]:
    if not _texte(v):
        return None
    try:
        d = datetime.fromisoformat(_texte(v).replace("Z", "+00:00"))
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Date invalide : {champ}")
    return iso(d if d.tzinfo else d.replace(tzinfo=timezone.utc))


def _instant(v: Optional[str]) -> Optional[datetime]:
    return datetime.fromisoformat(v) if v else None


async def _valider_promotion(body: PromotionIn, ident: Optional[str] = None) -> Dict[str, Any]:
    doc = body.model_dump()
    doc.update(await _libelles(body.nom, body.nomEn))
    if body.type == "pourcentage" and not 0 < body.valeur <= 100:
        raise HTTPException(status_code=400, detail="Le pourcentage doit etre compris entre 1 et 100")
    if body.type == "montant" and body.valeur <= 0:
        raise HTTPException(status_code=400, detail="Le montant de la reduction doit etre positif")
    doc["valeur"] = 0 if body.type == "livraison" else (round(body.valeur, 2) if body.type == "pourcentage" else en_fc(body.valeur))
    doc["montantMin"] = en_fc(body.montantMin)
    code = _texte(body.code).upper() or None
    if body.automatique:
        code = None
    else:
        if not code or not CODE_PROMO.match(code):
            raise HTTPException(status_code=400, detail="Code promo : 3 a 30 lettres, chiffres, - ou _")
        filtre: Dict[str, Any] = {"code": code}
        if ident:
            filtre["id"] = {"$ne": ident}
        if await db.promotions.find_one(filtre):
            raise HTTPException(status_code=400, detail="Ce code promo existe deja")
    doc["code"] = code
    if body.cible == "categorie":
        if not await db.categories.find_one({"nom": _texte(body.cibleValeur)}):
            raise HTTPException(status_code=400, detail="Categorie ciblee introuvable")
    elif body.cible == "produit":
        if not await db.produits.find_one({"id": _texte(body.cibleValeur)}):
            raise HTTPException(status_code=400, detail="Produit cible introuvable")
    else:
        doc["cibleValeur"] = None
    doc["dateDebut"] = _date_promo(body.dateDebut, "debut")
    doc["dateFin"] = _date_promo(body.dateFin, "fin")
    if doc["dateDebut"] and doc["dateFin"] and doc["dateFin"] <= doc["dateDebut"]:
        raise HTTPException(status_code=400, detail="La date de fin doit suivre la date de debut")
    return doc


def statut_promotion(p: Dict[str, Any], maintenant: Optional[datetime] = None) -> str:
    maintenant = maintenant or now_utc()
    if not p.get("actif"):
        return "desactivee"
    if p.get("dateFin") and maintenant > _instant(p["dateFin"]):
        return "expiree"
    if p.get("limiteTotale") and p.get("nombreUtilisations", 0) >= p["limiteTotale"]:
        return "epuisee"
    if p.get("dateDebut") and maintenant < _instant(p["dateDebut"]):
        return "programmee"
    return "active"


@api_router.get("/admin/promotions")
async def admin_promotions(_=Depends(require_admin)):
    promos = await db.promotions.find({}, {"_id": 0}).sort("createdAt", -1).to_list(500)
    return [{**p, **await _libelle_cible(p), "statut": statut_promotion(p)} for p in promos]


@api_router.post("/admin/promotions")
async def creer_promotion(body: PromotionIn, _=Depends(require_admin)):
    doc = {"id": str(uuid.uuid4()), **await _valider_promotion(body), "nombreUtilisations": 0, "createdAt": iso(now_utc())}
    await db.promotions.insert_one(dict(doc))
    await annoncer_promotion(doc)
    return {**doc, "statut": statut_promotion(doc)}


@api_router.put("/admin/promotions/{promo_id}")
async def modifier_promotion(promo_id: str, body: PromotionIn, _=Depends(require_admin)):
    ancien = await _introuvable(db.promotions, promo_id, "Promotion")
    maj = await _valider_promotion(body, promo_id)
    if maj["nom"] != ancien["nom"] and _texte(body.nomEn) == _texte(ancien.get("nomEn")):
        maj.update(await _libelles(maj["nom"], None))
    await db.promotions.update_one({"id": promo_id}, {"$set": maj})
    doc = {**ancien, **maj}
    await annoncer_promotion(doc)
    return {**doc, "statut": statut_promotion(doc)}


@api_router.patch("/admin/promotions/{promo_id}/actif")
async def basculer_promotion(promo_id: str, body: PromotionActifIn, _=Depends(require_admin)):
    ancien = await _introuvable(db.promotions, promo_id, "Promotion")
    await db.promotions.update_one({"id": promo_id}, {"$set": {"actif": body.actif}})
    doc = {**ancien, "actif": body.actif}
    await annoncer_promotion(doc)
    return {**doc, "statut": statut_promotion(doc)}


@api_router.delete("/admin/promotions/{promo_id}")
async def supprimer_promotion(promo_id: str, _=Depends(require_admin)):
    """Les commandes gardent leur copie de la promotion appliquee (historique)."""
    await _introuvable(db.promotions, promo_id, "Promotion")
    await db.promotions.delete_one({"id": promo_id})
    return {"ok": True}


async def _libelle_cible(p: Dict[str, Any]) -> Dict[str, Optional[str]]:
    if p.get("cible") == "categorie":
        c = await db.categories.find_one({"nom": p.get("cibleValeur")}, {"_id": 0}) or {}
        return {"cibleLibelle": c.get("nom"), "cibleLibelleEn": c.get("nomEn")}
    if p.get("cible") == "produit":
        prod = await db.produits.find_one({"id": p.get("cibleValeur")}, {"_id": 0}) or {}
        return {"cibleLibelle": prod.get("nom"), "cibleLibelleEn": prod.get("nomEn")}
    return {"cibleLibelle": None, "cibleLibelleEn": None}


def decrire_promo(p: Dict[str, Any], cible: Dict[str, Optional[str]], langue: str) -> str:
    """« −20 % sur Boissons dès 30 000 FC » / « −20% on Drinks from 30 000 FC »."""
    en = langue == "en"
    v = p.get("valeur") or 0
    v = int(v) if float(v).is_integer() else v
    if p["type"] == "livraison":
        remise = "free delivery" if en else "livraison offerte"
    elif p["type"] == "pourcentage":
        remise = f"−{v}%" if en else f"−{v} %"
    else:
        remise = f"−{fc_txt(v)}"
    libelle = (cible.get("cibleLibelleEn") if en else None) or cible.get("cibleLibelle")
    if p.get("cible") == "premiere_commande":
        remise += " on your first order" if en else " sur votre première commande"
    elif libelle:
        remise += f" on {libelle}" if en else f" sur {libelle}"
    if p.get("montantMin"):
        remise += f" from {fc_txt(p['montantMin'])}" if en else f" dès {fc_txt(p['montantMin'])}"
    return remise


async def annoncer_promotion(p: Dict[str, Any]) -> int:
    """Promotion automatique en cours : prevenir une seule fois les clients
    eligibles (preference « promotions » respectee par `notifier`)."""
    if not p.get("automatique") or not p.get("notifierClients", True) or statut_promotion(p) != "active":
        return 0
    res = await db.promotions.update_one(
        {"id": p["id"], "annonceeAt": {"$exists": False}}, {"$set": {"annonceeAt": iso(now_utc())}}
    )
    if not res.modified_count:
        return 0
    ids = [u["id"] for u in await db.users.find({"role": "client"}, {"_id": 0, "id": 1}).to_list(20000)]
    if p.get("cible") == "premiere_commande":
        deja = set(await db.commandes.distinct("userId", {"statut": {"$ne": "annulee"}}))
        ids = [i for i in ids if i not in deja]
    cible = await _libelle_cible(p)
    return await notifier(
        ids, "promotion", "promotion", "/menu", tag=f"promo-{p['id']}",
        params_par_langue={
            langue: {
                "nom": (p.get("nomEn") if langue == "en" else None) or p["nom"],
                "remise": decrire_promo(p, cible, langue),
            }
            for langue in ("fr", "en")
        },
    )


@api_router.get("/promotions/actives")
async def promotions_actives():
    """Bannière client : promotions automatiques en cours (les codes restent a saisir)."""
    promos = await db.promotions.find({"automatique": True, "actif": True}, {"_id": 0}).to_list(100)
    visibles = []
    for p in promos:
        if statut_promotion(p) != "active":
            continue
        visibles.append({
            **{k: p.get(k) for k in ("id", "nom", "nomEn", "type", "valeur", "cible", "montantMin", "dateFin")},
            **await _libelle_cible(p),
        })
    return JSONResponse(visibles, headers={"Cache-Control": "no-store"})


async def _contexte_client(user_id: str) -> Tuple[bool, Dict[str, int]]:
    """Premiere commande ? et nombre d'utilisations de chaque promotion par ce
    client (commandes annulees exclues)."""
    cmds = await db.commandes.find(
        {"userId": user_id, "statut": {"$ne": "annulee"}}, {"_id": 0, "promotions": 1}
    ).to_list(5000)
    utilisations: Dict[str, int] = {}
    for c in cmds:
        for pr in c.get("promotions") or []:
            utilisations[pr["id"]] = utilisations.get(pr["id"], 0) + 1
    return not cmds, utilisations


def _appliquer(p: Dict[str, Any], lignes: List[Dict[str, Any]], sous_total: int, frais: int,
               premiere: bool, utilisations: Dict[str, int]) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    """Reduction qu'apporterait `p`, ou la raison de son ineligibilite."""
    statut = statut_promotion(p)
    if statut == "desactivee":
        return None, "invalide"
    if statut in ("expiree", "programmee", "epuisee"):
        return None, statut
    if p.get("limiteParClient") and utilisations.get(p["id"], 0) >= p["limiteParClient"]:
        return None, "deja_utilisee"
    if sous_total < p.get("montantMin", 0):
        return None, "montant_min"
    if p.get("cible") == "premiere_commande" and not premiere:
        return None, "premiere_commande"
    if p.get("cible") == "categorie":
        base = sum(l["prixUnitaire"] * l["quantite"] for l in lignes if l.get("categorie") == p.get("cibleValeur"))
    elif p.get("cible") == "produit":
        base = sum(l["prixUnitaire"] * l["quantite"] for l in lignes if l.get("produitId") == p.get("cibleValeur"))
    else:
        base = sous_total
    if base <= 0:
        return None, "cible_absente"
    montant, livraison = 0, 0
    if p["type"] == "livraison":
        livraison = frais
    elif p["type"] == "pourcentage":
        montant = en_fc(base * p["valeur"] / 100)
    else:
        montant = min(en_fc(p["valeur"]), base)
    if montant <= 0 and livraison <= 0:
        return None, "sans_effet"
    return {
        **{k: p.get(k) for k in ("id", "nom", "nomEn", "type", "valeur", "code", "cible")},
        "cumulable": bool(p.get("cumulable")),
        "montant": montant,
        "livraison": livraison,
    }, None


def _choisir(applications: List[Dict[str, Any]], sous_total: int, code: Optional[str]) -> List[Dict[str, Any]]:
    """Une seule promotion (la plus avantageuse ; a egalite, le code saisi), ou
    toutes les cumulables si leur cumul rapporte davantage. Jamais de double
    reduction : la livraison n'est offerte qu'une fois et la remise sur les
    articles ne depasse pas le sous-total."""
    def valeur(lot: List[Dict[str, Any]]) -> int:
        return min(sum(a["montant"] for a in lot), sous_total) + max((a["livraison"] for a in lot), default=0)

    if not applications:
        return []
    seule = max(applications, key=lambda a: (valeur([a]), a.get("code") == code))
    cumul: List[Dict[str, Any]] = []
    livraison_prise = False
    for a in sorted((a for a in applications if a["cumulable"]), key=lambda a: -valeur([a])):
        if a["livraison"] and livraison_prise:
            a = {**a, "livraison": 0}
            if not a["montant"]:
                continue
        livraison_prise = livraison_prise or bool(a["livraison"])
        cumul.append(a)
    lot = cumul if len(cumul) > 1 and valeur(cumul) > valeur([seule]) else [seule]
    # Plafond : la remise sur les articles ne peut pas depasser le sous-total.
    reste = sous_total
    retenues = []
    for a in lot:
        montant = min(a["montant"], reste)
        reste -= montant
        retenues.append({**a, "montant": montant})
    return retenues


async def calculer_promotions(lignes: List[Dict[str, Any]], frais: int, user: Dict[str, Any],
                              code: Optional[str]) -> Dict[str, Any]:
    sous_total = en_fc(sum(l["prixUnitaire"] * l["quantite"] for l in lignes))
    premiere, utilisations = await _contexte_client(user["id"])
    code = _texte(code).upper() or None
    applications, statut_code, promo_code = [], None, None
    for p in await db.promotions.find({"automatique": True, "actif": True}, {"_id": 0}).to_list(200):
        app, _raison = _appliquer(p, lignes, sous_total, frais, premiere, utilisations)
        if app:
            applications.append(app)
    if code:
        promo_code = await db.promotions.find_one({"code": code, "automatique": False}, {"_id": 0})
        if not promo_code:
            statut_code = "invalide"
        else:
            app, raison = _appliquer(promo_code, lignes, sous_total, frais, premiere, utilisations)
            if app:
                applications.append(app)
            else:
                statut_code = raison
    retenues = _choisir(applications, sous_total, code)
    if code and not statut_code:
        statut_code = "applique" if any(r.get("code") == code for r in retenues) else "moins_avantageux"
    reduction = sum(r["montant"] for r in retenues)
    reduction_livraison = max((r["livraison"] for r in retenues), default=0)
    return {
        "sousTotal": sous_total,
        "fraisLivraison": frais,
        "reduction": reduction,
        "reductionLivraison": reduction_livraison,
        "total": max(0, sous_total - reduction + frais - reduction_livraison),
        "promotions": [
            {k: r.get(k) for k in ("id", "nom", "nomEn", "type", "valeur", "code", "cible", "montant", "livraison")}
            for r in retenues
        ],
        "code": {
            "saisi": code,
            "statut": statut_code,
            "montantMin": (promo_code or {}).get("montantMin"),
        } if code else None,
    }


MESSAGES_CODE = {
    "invalide": "Code promo invalide",
    "expiree": "Ce code promo a expire",
    "programmee": "Ce code promo n'est pas encore valable",
    "epuisee": "Ce code promo a atteint sa limite d'utilisation",
    "deja_utilisee": "Vous avez deja utilise ce code promo",
    "montant_min": "Montant minimum de commande non atteint pour ce code",
    "premiere_commande": "Ce code est reserve a la premiere commande",
    "cible_absente": "Votre panier ne contient pas les produits concernes par ce code",
    "sans_effet": "Ce code n'apporte aucune reduction sur ce panier",
}


@api_router.post("/promotions/apercu")
async def apercu_promotions(body: ApercuPromoIn, user=Depends(get_current_user)):
    """Recapitulatif du checkout : memes regles que la commande, sans rien reserver."""
    if not body.items:
        raise HTTPException(status_code=400, detail="Le panier est vide")
    lignes = await lignes_du_catalogue(body.items)
    frais = en_fc((await lire_config())["fraisLivraison"])
    return await calculer_promotions(lignes, frais, user, body.codePromo)


async def reserver_promotions(promotions: List[Dict[str, Any]]) -> List[str]:
    """Incremente les compteurs ; echoue proprement si une limite vient d'etre
    atteinte par une autre commande. Renvoie les ids reserves (pour annulation)."""
    reservees: List[str] = []
    for pr in promotions:
        res = await db.promotions.update_one(
            {
                "id": pr["id"],
                "$or": [
                    {"limiteTotale": None},
                    {"$expr": {"$lt": [{"$ifNull": ["$nombreUtilisations", 0]}, "$limiteTotale"]}},
                ],
            },
            {"$inc": {"nombreUtilisations": 1}},
        )
        if res.modified_count == 0:
            await liberer_compteurs(reservees)
            raise HTTPException(status_code=409, detail=f"La promotion « {pr['nom']} » n'est plus disponible")
        reservees.append(pr["id"])
    return reservees


async def liberer_compteurs(ids: List[str]) -> None:
    for pid in ids:
        await db.promotions.update_one({"id": pid, "nombreUtilisations": {"$gt": 0}}, {"$inc": {"nombreUtilisations": -1}})


async def liberer_promotions(cmd_id: str) -> None:
    """Commande annulee : ses promotions redeviennent disponibles (une seule fois)."""
    cmd = await db.commandes.find_one_and_update(
        {"id": cmd_id, "statut": "annulee", "promotionsLiberees": {"$ne": True}, "promotions.0": {"$exists": True}},
        {"$set": {"promotionsLiberees": True}},
        projection={"_id": 0, "promotions": 1},
    )
    if cmd:
        await liberer_compteurs([pr["id"] for pr in cmd.get("promotions") or []])


# ------------------------------------------------------------------------ zones
@api_router.get("/zones")
async def liste_zones():
    zones = await db.zones.find({}, {"_id": 0}).to_list(200)
    return sorted(zones, key=lambda z: z["commune"])


@api_router.post("/admin/zones")
async def creer_zone(body: ZoneCreationIn, _=Depends(require_admin)):
    commune = body.commune.strip()
    if len(commune) < 2:
        raise HTTPException(status_code=400, detail="Nom de zone trop court")
    if await db.zones.find_one({"commune": {"$regex": f"^{re.escape(commune)}$", "$options": "i"}}):
        raise HTTPException(status_code=400, detail="Cette zone existe deja")
    doc = {"id": str(uuid.uuid4()), "commune": commune, "active": body.active}
    await db.zones.insert_one(dict(doc))
    return doc


@api_router.delete("/admin/zones/{zone_id}")
async def supprimer_zone(zone_id: str, _=Depends(require_admin)):
    res = await db.zones.delete_one({"id": zone_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Zone introuvable")
    return {"ok": True}


@api_router.delete("/admin/zones/bulk/delete")
async def supprimer_zones_bulk(body: BulkIdsIn, _=Depends(require_admin)):
    ids = [i for i in body.ids if i]
    if not ids:
        return {"ok": True, "deleted_count": 0}
    res = await db.zones.delete_many({"id": {"$in": ids}})
    return {"ok": True, "deleted_count": res.deleted_count}


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
    ids = [lv["id"] for lv in livreurs]
    positions = {
        p["livreurId"]: p
        for p in await db.positions_livreurs.find({"livreurId": {"$in": ids}}, {"_id": 0}).to_list(200)
    } if ids else {}
    for lv in livreurs:
        lv["position"] = positions.get(lv["id"])
    return livreurs


@api_router.post("/admin/livreurs")
async def creer_livreur(body: LivreurIn, _=Depends(require_superadmin)):
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
            "actif": True,
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
async def supprimer_livreur(livreur_id: str, _=Depends(require_superadmin)):
    en_cours = await db.commandes.find_one(
        {"livreurId": livreur_id, "statut": {"$nin": ["livree", "annulee"]}}, {"_id": 0, "id": 1}
    )
    if en_cours:
        raise HTTPException(status_code=400, detail="Ce livreur a une course en cours")
    await db.livreurs.delete_one({"id": livreur_id})
    await db.users.delete_one({"livreurId": livreur_id, "role": "livreur"})
    return {"ok": True}


@api_router.delete("/admin/livreurs/bulk/delete")
async def supprimer_livreurs_bulk(body: BulkIdsIn, _=Depends(require_superadmin)):
    ids = list(dict.fromkeys(i for i in body.ids if i))
    if not ids:
        return {"ok": True, "deleted_count": 0}
    en_cours = await db.commandes.find({"livreurId": {"$in": ids}, "statut": {"$nin": ["livree", "annulee"]}}, {"_id": 0}).to_list(200)
    if en_cours:
        raise HTTPException(status_code=400, detail="Un ou plusieurs livreurs ont une course en cours")
    res = await db.livreurs.delete_many({"id": {"$in": ids}})
    await db.users.delete_many({"livreurId": {"$in": ids}, "role": "livreur"})
    await db.positions_livreurs.delete_many({"livreurId": {"$in": ids}})
    return {"ok": True, "deleted_count": res.deleted_count}


# ------------------------------------------------------ super admin : personnel
def compte_public(u: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": u["id"],
        "nom": u.get("nom"),
        "telephone": u.get("telephone"),
        "email": u.get("email"),
        "role": u.get("role"),
        "actif": u.get("actif", True),
        "livreurId": u.get("livreurId"),
        "createdAt": u.get("createdAt"),
    }


@api_router.get("/superadmin/comptes")
async def superadmin_comptes(_=Depends(require_superadmin)):
    users = await db.users.find(
        {"role": {"$in": ["admin", "livreur"]}}, {"_id": 0, "motDePasseHash": 0}
    ).to_list(300)
    fiches = {f["id"]: f for f in await db.livreurs.find({}, {"_id": 0}).to_list(300)}
    comptes = []
    for u in users:
        c = compte_public(u)
        fiche = fiches.get(u.get("livreurId") or "")
        if fiche:
            c["vehicule"] = fiche.get("vehicule")
            c["plaque"] = fiche.get("plaque")
        comptes.append(c)
    comptes.sort(key=lambda c: (c["role"], (c["nom"] or "").lower()))
    return comptes


@api_router.post("/superadmin/admins")
async def creer_admin(body: AdminIn, _=Depends(require_superadmin)):
    tel = norm_tel(body.telephone)
    if len(tel) < 9:
        raise HTTPException(status_code=400, detail="Numero de telephone invalide")
    if len(body.motDePasse) < 6:
        raise HTTPException(status_code=400, detail="Mot de passe : 6 caracteres minimum")
    email = (body.email or "").strip().lower() or None
    if await db.users.find_one({"telephone": tel}):
        raise HTTPException(status_code=400, detail="Ce numero est deja utilise")
    if email and await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Cet email est deja utilise")
    doc = {
        "id": str(uuid.uuid4()),
        "nom": body.nom.strip(),
        "telephone": tel,
        "email": email,
        "motDePasseHash": hash_pwd(body.motDePasse),
        "role": "admin",
        "verifie": True,
        "actif": True,
        "createdAt": iso(now_utc()),
    }
    await db.users.insert_one(dict(doc))
    return compte_public(doc)


@api_router.patch("/superadmin/comptes/{user_id}/actif")
async def basculer_compte(user_id: str, body: ActifIn, _=Depends(require_superadmin)):
    cible = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not cible or cible.get("role") not in ("admin", "livreur"):
        raise HTTPException(status_code=404, detail="Compte introuvable")
    await db.users.update_one({"id": user_id}, {"$set": {"actif": body.actif}})
    if cible.get("livreurId"):
        await db.livreurs.update_one({"id": cible["livreurId"]}, {"$set": {"actif": body.actif}})
    cible["actif"] = body.actif
    return compte_public(cible)


@api_router.delete("/superadmin/comptes/{user_id}")
async def supprimer_compte(user_id: str, moi_meme=Depends(require_superadmin)):
    if user_id == moi_meme["id"]:
        raise HTTPException(status_code=400, detail="Impossible de supprimer votre propre compte")
    cible = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not cible or cible.get("role") not in ("admin", "livreur"):
        raise HTTPException(status_code=404, detail="Compte introuvable")
    await db.users.delete_one({"id": user_id})
    if cible.get("livreurId"):
        await db.livreurs.delete_one({"id": cible["livreurId"]})
        await db.positions_livreurs.delete_one({"livreurId": cible["livreurId"]})
    return {"ok": True}


@api_router.delete("/superadmin/comptes/bulk/delete")
async def supprimer_comptes_bulk(body: BulkIdsIn, moi_meme=Depends(require_superadmin)):
    ids = list(dict.fromkeys(i for i in body.ids if i))
    if not ids:
        return {"ok": True, "deleted_count": 0}
    if moi_meme["id"] in ids:
        raise HTTPException(status_code=400, detail="Impossible de supprimer votre propre compte")
    cibles = await db.users.find({"id": {"$in": ids}, "role": {"$in": ["admin", "livreur"]}}, {"_id": 0}).to_list(len(ids))
    if not cibles:
        return {"ok": True, "deleted_count": 0}
    ids_ok = [c["id"] for c in cibles]
    livreur_ids = [c["livreurId"] for c in cibles if c.get("livreurId")]
    if livreur_ids:
        en_cours = await db.commandes.find_one(
            {"livreurId": {"$in": livreur_ids}, "statut": {"$nin": ["livree", "annulee"]}},
            {"_id": 0, "id": 1},
        )
        if en_cours:
            raise HTTPException(status_code=400, detail="Un ou plusieurs livreurs ont une course en cours")
    await db.users.delete_many({"id": {"$in": ids_ok}})
    if livreur_ids:
        await db.livreurs.delete_many({"id": {"$in": livreur_ids}})
        await db.positions_livreurs.delete_many({"livreurId": {"$in": livreur_ids}})
    return {"ok": True, "deleted_count": len(ids_ok)}


# --------------------------------------------------------------------- commandes
async def enrichir(
    cmd: Dict[str, Any],
    livreurs: Optional[Dict[str, Any]] = None,
    positions: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    lid = cmd.get("livreurId")
    if lid:
        cmd["livreur"] = (
            livreurs.get(lid) if livreurs is not None else await db.livreurs.find_one({"id": lid}, {"_id": 0})
        )
        pos = (
            positions.get(lid)
            if positions is not None
            else await db.positions_livreurs.find_one({"livreurId": lid}, {"_id": 0})
        )
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


async def enrichir_lot(cmds: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Enrichit une liste de commandes avec 2 requetes au total (pas de N+1)."""
    ids = list({c["livreurId"] for c in cmds if c.get("livreurId")})
    livreurs: Dict[str, Any] = {}
    positions: Dict[str, Any] = {}
    if ids:
        livreurs = {
            lv["id"]: lv for lv in await db.livreurs.find({"id": {"$in": ids}}, {"_id": 0}).to_list(len(ids))
        }
        positions = {
            p["livreurId"]: p
            for p in await db.positions_livreurs.find({"livreurId": {"$in": ids}}, {"_id": 0}).to_list(len(ids))
        }
    return [await enrichir(c, livreurs, positions) for c in cmds]


QUANTITE_MAX = 50
LIGNES_MAX = 50


async def lignes_du_catalogue(items: List[ItemIn]) -> List[Dict[str, Any]]:
    """Articles reconstruits depuis le catalogue : prix, tailles et garnitures
    envoyes par le client ne sont jamais crus."""
    ids = list({i.produitId for i in items})
    produits = {
        p["id"]: p for p in await db.produits.find({"id": {"$in": ids}}, {"_id": 0}).to_list(len(ids))
    }
    compo = await lire_composition() if any(p.get("configurable") for p in produits.values()) else None
    lignes = []
    for i in items:
        p = produits.get(i.produitId)
        if not p:
            raise HTTPException(status_code=400, detail=f"Produit introuvable : {i.nom}")
        if not p.get("disponible", True):
            raise HTTPException(status_code=400, detail=f"{p['nom']} est en rupture de stock")
        if not 1 <= i.quantite <= QUANTITE_MAX:
            raise HTTPException(status_code=400, detail=f"Quantite invalide pour {p['nom']}")
        if p.get("configurable"):
            lignes.append({
                "produitId": p["id"],
                "nom": p["nom"],
                "nomEn": p.get("nomEn"),
                "categorie": p.get("categorie"),
                **await ligne_yogourt(p, i, compo),
                "quantite": i.quantite,
                "emoji": p.get("emoji"),
                "image": p.get("image"),
            })
            continue

        tailles = p.get("tailles") or []
        taille = None
        if tailles:
            taille = next((t for t in tailles if t["nom"] == i.taille), None) if i.taille else tailles[0]
        if (i.taille or tailles) and taille is None:
            raise HTTPException(status_code=400, detail=f"Taille invalide pour {p['nom']}")

        offertes = {g["nom"]: g for g in p.get("garnitures") or []}
        noms = list(dict.fromkeys(g.nom for g in i.garnitures))
        if any(n not in offertes for n in noms):
            raise HTTPException(status_code=400, detail=f"Garniture invalide pour {p['nom']}")
        garnitures = [
            {"nom": n, "prix": float(offertes[n].get("prix", 0)), "nomEn": offertes[n].get("nomEn")} for n in noms
        ]

        prix = float(p["prix"]) + float((taille or {}).get("ecart", 0)) + sum(g["prix"] for g in garnitures)
        lignes.append({
            "produitId": p["id"],
            "nom": p["nom"],
            "nomEn": p.get("nomEn"),
            "categorie": p.get("categorie"),
            "taille": taille["nom"] if taille else None,
            "tailleEn": taille.get("nomEn") if taille else None,
            "garnitures": garnitures,
            "quantite": i.quantite,
            "prixUnitaire": en_fc(prix),
            "emoji": p.get("emoji"),
            "image": p.get("image"),
        })
    return lignes


@api_router.post("/commandes")
async def creer_commande(body: CommandeIn, user=Depends(get_current_user)):
    if not body.items:
        raise HTTPException(status_code=400, detail="Le panier est vide")
    if len(body.items) > LIGNES_MAX:
        raise HTTPException(status_code=400, detail="Trop d'articles dans le panier")
    items = await lignes_du_catalogue(body.items)
    zone = await db.zones.find_one({"commune": body.adresse.commune}, {"_id": 0})
    if not zone or not zone.get("active"):
        raise HTTPException(status_code=400, detail=f"Nous ne livrons pas encore a {body.adresse.commune}")
    # Controle supplementaire sur les coordonnees GPS (le nom de commune seul est declaratif).
    if body.adresse.lat is not None and body.adresse.lng is not None:
        detectee = await commune_des_coords(body.adresse.lat, body.adresse.lng)
        if detectee and not await zone_active(detectee):
            raise HTTPException(
                status_code=400,
                detail=f"La position GPS indiquee se trouve a {detectee}, hors de nos zones de livraison",
            )
    adresse = body.adresse.model_dump()
    adresse["id"] = str(uuid.uuid4())
    adresse["userId"] = user["id"]
    if not adresse.get("lat"):
        adresse["lat"], adresse["lng"] = -4.325, 15.322
    await db.adresses.replace_one({"userId": user["id"], "label": adresse["label"]}, dict(adresse), upsert=True)

    frais = en_fc((await lire_config())["fraisLivraison"])
    calcul = await calculer_promotions(items, frais, user, body.codePromo)
    statut_code = (calcul["code"] or {}).get("statut")
    if statut_code and statut_code not in ("applique", "moins_avantageux"):
        raise HTTPException(status_code=400, detail=MESSAGES_CODE.get(statut_code, "Code promo invalide"))
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
        "sousTotal": calcul["sousTotal"],
        "fraisLivraison": frais,
        # Promotions appliquees (copie figee pour l'historique et les rapports).
        "promotions": calcul["promotions"],
        "reduction": calcul["reduction"],
        "reductionLivraison": calcul["reductionLivraison"],
        "codePromo": (calcul["code"] or {}).get("saisi"),
        "total": calcul["total"],
        "devise": MONNAIE,
        "statut": "recue",
        "livreurId": None,
        "paiement": {
            "mode": body.modePaiement,
            "statut": "a_la_livraison" if body.modePaiement == "cash" else "attente",
            "updatedAt": iso(now_utc()),
        },
        "paye": False,
        "cashEncaisse": False,
        "note": None,
        "createdAt": iso(now_utc()),
        "historique": [{"statut": "recue", "at": iso(now_utc())}],
    }
    # Compteurs incrementes seulement pour une commande effectivement enregistree.
    reservees = await reserver_promotions(calcul["promotions"])
    try:
        await db.commandes.insert_one(dict(cmd))
    except Exception:
        await liberer_compteurs(reservees)
        raise
    cmd.pop("_id", None)
    await notifier_client(cmd, "recue")
    await notifier_admins(cmd)
    return await enrichir(cmd)


@api_router.get("/commandes/mes")
async def mes_commandes(user=Depends(get_current_user)):
    cmds = (
        await db.commandes.find(
            {"userId": user["id"], "clientArchivee": {"$ne": True}, "clientMasquee": {"$ne": True}}, {"_id": 0}
        )
        .sort("createdAt", -1)
        .to_list(200)
    )
    return await enrichir_lot(cmds)


@api_router.get("/commandes/mes/archives")
async def mes_commandes_archivees(user=Depends(get_current_user)):
    cmds = (
        await db.commandes.find(
            {"userId": user["id"], "clientArchivee": True, "clientMasquee": {"$ne": True}}, {"_id": 0}
        )
        .sort("clientArchiveeAt", -1)
        .to_list(200)
    )
    return await enrichir_lot(cmds)


async def _commande_du_client(cmd_id: str, user: Dict[str, Any]) -> Dict[str, Any]:
    cmd = await db.commandes.find_one({"id": cmd_id, "userId": user["id"]}, {"_id": 0})
    if not cmd:
        raise HTTPException(status_code=404, detail="Commande introuvable")
    return cmd


@api_router.post("/commandes/{cmd_id}/archiver")
async def client_archiver(cmd_id: str, user=Depends(get_current_user)):
    cmd = await _commande_du_client(cmd_id, user)
    if cmd.get("statut") not in ("livree", "annulee"):
        raise HTTPException(status_code=400, detail="Seule une commande terminee peut etre archivee")
    await db.commandes.update_one(
        {"id": cmd_id}, {"$set": {"clientArchivee": True, "clientArchiveeAt": iso(now_utc())}}
    )
    return {"ok": True}


@api_router.post("/commandes/{cmd_id}/desarchiver")
async def client_desarchiver(cmd_id: str, user=Depends(get_current_user)):
    await _commande_du_client(cmd_id, user)
    await db.commandes.update_one(
        {"id": cmd_id}, {"$set": {"clientArchivee": False}, "$unset": {"clientArchiveeAt": ""}}
    )
    return {"ok": True}


@api_router.delete("/commandes/{cmd_id}/masquer")
async def client_masquer(cmd_id: str, user=Depends(get_current_user)):
    """Retire la commande de la vue du client. Elle reste intacte cote admin
    (rapports et comptabilite)."""
    cmd = await _commande_du_client(cmd_id, user)
    if not cmd.get("clientArchivee"):
        raise HTTPException(status_code=400, detail="Archivez la commande avant de la supprimer")
    await db.commandes.update_one(
        {"id": cmd_id}, {"$set": {"clientMasquee": True, "clientMasqueeAt": iso(now_utc())}}
    )
    return {"ok": True}


def est_admin(user: Dict[str, Any]) -> bool:
    return niveau(user.get("role")) >= NIVEAUX["admin"]


def peut_voir_commande(cmd: Dict[str, Any], user: Dict[str, Any]) -> bool:
    """Admin : tout. Livreur : ses courses assignees. Sinon : ses propres commandes."""
    if est_admin(user):
        return True
    if user.get("role") == "livreur" and user.get("livreurId") and cmd.get("livreurId") == user["livreurId"]:
        return True
    return cmd.get("userId") == user["id"]


@api_router.get("/commandes/{cmd_id}")
async def detail_commande(cmd_id: str, user=Depends(get_current_user)):
    cmd = await db.commandes.find_one({"id": cmd_id}, {"_id": 0})
    if not cmd:
        raise HTTPException(status_code=404, detail="Commande introuvable")
    if not peut_voir_commande(cmd, user):
        raise HTTPException(status_code=403, detail="Acces refuse")
    return await enrichir(cmd)


@api_router.post("/commandes/{cmd_id}/annuler")
async def annuler_commande(cmd_id: str, user=Depends(get_current_user)):
    cmd = await db.commandes.find_one({"id": cmd_id}, {"_id": 0})
    # Annulation : le client proprietaire ou un admin, jamais un livreur.
    if not cmd or not (est_admin(user) or cmd["userId"] == user["id"]):
        raise HTTPException(status_code=404, detail="Commande introuvable")
    if cmd["statut"] in ("en_route", "livree", "annulee"):
        raise HTTPException(status_code=400, detail="Cette commande ne peut plus etre annulee")
    await db.commandes.update_one(
        {"id": cmd_id},
        {
            "$set": {"statut": "annulee", "termineeAt": iso(now_utc())},
            "$push": {"historique": {"statut": "annulee", "at": iso(now_utc())}},
        },
    )
    await liberer_promotions(cmd_id)
    await notifier_client(cmd, "annulee")
    if cmd["userId"] == user["id"] and not est_admin(user):
        await notifier_admins(cmd, "admin_annulee")
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
DELAI_ARCHIVAGE_JOURS = int(os.environ.get("ARCHIVAGE_AUTO_JOURS", "10"))

LIBELLES_STATUT = {
    "recue": "Reçue",
    "en_preparation": "En préparation",
    "recuperee": "Récupérée",
    "en_route": "En route",
    "arrivee": "Arrivée",
    "livree": "Livrée",
    "annulee": "Annulée",
}


async def archiver_anciennes() -> int:
    """Archive automatiquement les commandes livrees depuis plus de N jours."""
    limite = iso(now_utc() - timedelta(days=DELAI_ARCHIVAGE_JOURS))
    res = await db.commandes.update_many(
        {
            "statut": "livree",
            "archivee": {"$ne": True},
            "$or": [
                {"termineeAt": {"$lt": limite}},
                {"termineeAt": {"$exists": False}, "createdAt": {"$lt": limite}},
            ],
        },
        {"$set": {"archivee": True, "archiveeAt": iso(now_utc()), "archivageAuto": True}},
    )
    if res.modified_count:
        logger.info(f"Archivage auto : {res.modified_count} commande(s) livree(s) depuis +{DELAI_ARCHIVAGE_JOURS}j")
    return res.modified_count


@api_router.get("/admin/commandes")
async def admin_commandes(_=Depends(require_admin)):
    await archiver_anciennes()
    cmds = await db.commandes.find({"archivee": {"$ne": True}}, {"_id": 0}).to_list(500)
    cmds.sort(key=lambda c: c["createdAt"], reverse=True)
    return await enrichir_lot(cmds)


@api_router.get("/admin/commandes/archives")
async def admin_commandes_archivees(_=Depends(require_admin)):
    cmds = await db.commandes.find({"archivee": True}, {"_id": 0}).to_list(500)
    cmds.sort(key=lambda c: c.get("archiveeAt") or c["createdAt"], reverse=True)
    return await enrichir_lot(cmds)


@api_router.post("/admin/commandes/{cmd_id}/archiver")
async def archiver_commande(cmd_id: str, _=Depends(require_admin)):
    cmd = await db.commandes.find_one({"id": cmd_id}, {"_id": 0})
    if not cmd:
        raise HTTPException(status_code=404, detail="Commande introuvable")
    if cmd.get("statut") not in ("livree", "annulee"):
        raise HTTPException(status_code=400, detail="Seules les commandes livrees ou annulees peuvent etre archivees")
    await db.commandes.update_one(
        {"id": cmd_id}, {"$set": {"archivee": True, "archiveeAt": iso(now_utc())}}
    )
    return {"ok": True}


@api_router.post("/admin/commandes/{cmd_id}/desarchiver")
async def desarchiver_commande(cmd_id: str, _=Depends(require_admin)):
    res = await db.commandes.update_one(
        {"id": cmd_id, "archivee": True}, {"$set": {"archivee": False}, "$unset": {"archiveeAt": ""}}
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Commande archivee introuvable")
    return {"ok": True}


@api_router.delete("/admin/commandes/{cmd_id}")
async def supprimer_commande(cmd_id: str, _=Depends(require_admin)):
    cmd = await db.commandes.find_one({"id": cmd_id}, {"_id": 0})
    if not cmd:
        raise HTTPException(status_code=404, detail="Commande introuvable")
    if not cmd.get("archivee"):
        raise HTTPException(status_code=400, detail="Archivez la commande avant de la supprimer")
    await db.commandes.delete_one({"id": cmd_id})
    return {"ok": True}


@api_router.post("/admin/commandes/bulk/archive")
async def archiver_commandes_bulk(body: BulkIdsIn, _=Depends(require_admin)):
    ids = list(dict.fromkeys(i for i in body.ids if i))
    if not ids:
        return {"ok": True, "updated_count": 0}
    cmds = await db.commandes.find({"id": {"$in": ids}}, {"_id": 0}).to_list(len(ids))
    if len(cmds) != len(ids):
        raise HTTPException(status_code=404, detail="Une ou plusieurs commandes sont introuvables")
    valid_ids = [c["id"] for c in cmds if c.get("statut") in ("livree", "annulee")]
    if len(valid_ids) != len(cmds):
        raise HTTPException(status_code=400, detail="Seules les commandes livrees ou annulees peuvent etre archivees")
    if not valid_ids:
        return {"ok": True, "updated_count": 0}
    res = await db.commandes.update_many({"id": {"$in": valid_ids}}, {"$set": {"archivee": True, "archiveeAt": iso(now_utc())}})
    return {"ok": True, "updated_count": res.modified_count}


@api_router.delete("/admin/commandes/bulk/delete")
async def supprimer_commandes_bulk(body: BulkIdsIn, _=Depends(require_admin)):
    ids = list(dict.fromkeys(i for i in body.ids if i))
    if not ids:
        return {"ok": True, "deleted_count": 0}
    cmds = await db.commandes.find({"id": {"$in": ids}}, {"_id": 0}).to_list(len(ids))
    if len(cmds) != len(ids):
        raise HTTPException(status_code=404, detail="Une ou plusieurs commandes sont introuvables")
    non_archives = [c["id"] for c in cmds if not c.get("archivee")]
    if non_archives:
        raise HTTPException(status_code=400, detail="Archivez les commandes sélectionnées avant de les supprimer")
    res = await db.commandes.delete_many({"id": {"$in": ids}, "archivee": True})
    return {"ok": True, "deleted_count": res.deleted_count}


@api_router.get("/admin/rapport")
async def rapport_commandes(
    debut: str,
    fin: str,
    format: str = "xlsx",
    _=Depends(require_admin),
):
    """Rapport des commandes d'une periode, archivees incluses, en .xlsx ou .pdf."""
    if format not in ("xlsx", "pdf"):
        raise HTTPException(status_code=400, detail="Format attendu : xlsx ou pdf")
    try:
        d_debut = datetime.strptime(debut, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        d_fin = datetime.strptime(fin, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    except ValueError:
        raise HTTPException(status_code=400, detail="Dates attendues au format AAAA-MM-JJ")
    if d_fin < d_debut:
        raise HTTPException(status_code=400, detail="La date de fin precede la date de debut")

    borne_fin = iso(d_fin + timedelta(days=1))
    cmds = await db.commandes.find(
        {"createdAt": {"$gte": iso(d_debut), "$lt": borne_fin}}, {"_id": 0}
    ).to_list(5000)
    cmds.sort(key=lambda c: c["createdAt"])

    livreurs = {lv["id"]: lv["nom"] for lv in await db.livreurs.find({}, {"_id": 0}).to_list(200)}
    lignes = []
    for c in cmds:
        articles = ", ".join(
            f"{a.get('quantite', 1)}x {a.get('nom', '')}"
            + (f" ({', '.join(x for x in (a.get('taille'), a.get('contenant')) if x)})"
               if a.get("taille") or a.get("contenant") else "")
            for a in c.get("items", [])
        )
        adr = c.get("adresse") or {}
        lignes.append({
            "numero": c.get("numero", ""),
            "date": (c.get("createdAt") or "")[:16].replace("T", " "),
            "client": c.get("clientNom") or "—",
            "adresse": f"{adr.get('commune', '')} — {adr.get('avenue', '')} {adr.get('numero', '')}".strip(" —"),
            "articles": articles,
            "promotion": ", ".join(pr["nom"] for pr in c.get("promotions") or []) or "—",
            "reduction": en_fc((c.get("reduction") or 0) + (c.get("reductionLivraison") or 0)),
            "total": en_fc(c.get("total", 0)),
            "statut": LIBELLES_STATUT.get(c.get("statut", ""), c.get("statut", "")),
            "paiement": resume_paiement(c)[0],
            "statutPaiement": resume_paiement(c)[1],
            "livreur": livreurs.get(c.get("livreurId") or "", "—"),
        })

    livrees = [c for c in cmds if c.get("statut") == "livree"]
    annulees = [c for c in cmds if c.get("statut") == "annulee"]
    resume = {
        "nbCommandes": len(cmds),
        "chiffre": en_fc(sum(float(c.get("total", 0)) for c in livrees)),
        "nbLivrees": len(livrees),
        "nbAnnulees": len(annulees),
    }
    titre = f"Rapport des commandes du {debut} au {fin}"
    nom_fichier = f"pinkberry-rapport-{debut}-{fin}.{format}"

    resume_lignes = [
        ("Nombre de commandes", resume["nbCommandes"]),
        ("Chiffre d'affaires (commandes livrées)", fc_txt(resume["chiffre"])),
        ("Livraisons réussies", resume["nbLivrees"]),
        ("Commandes annulées", resume["nbAnnulees"]),
    ]
    contenu = (
        construire_xlsx(titre, lignes, resume_lignes)
        if format == "xlsx"
        else construire_pdf(titre, lignes, resume_lignes)
    )
    media = (
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        if format == "xlsx"
        else "application/pdf"
    )
    return StreamingResponse(
        io.BytesIO(contenu),
        media_type=media,
        headers={"Content-Disposition": f'attachment; filename="{nom_fichier}"'},
    )


COLONNES_RAPPORT = [
    ("numero", "N° commande", 14),
    ("date", "Date", 17),
    ("client", "Client", 20),
    ("adresse", "Adresse / commune", 30),
    ("articles", "Articles", 40),
    ("promotion", "Promotion", 16),
    ("reduction", "Réduction FC", 12),
    ("total", "Total FC", 12),
    ("statut", "Statut", 14),
    ("paiement", "Paiement", 18),
    ("statutPaiement", "Statut paiement", 16),
    ("livreur", "Livreur", 18),
]


LIBELLES_PAIEMENT = {
    "cash": "A la livraison",
    "mpesa": "M-Pesa (Vodacom)",
    "airtel": "Airtel Money",
    "orange": "Orange Money",
}
LIBELLES_STATUT_PAIEMENT = {
    "a_la_livraison": "A la livraison",
    "attente": "En attente",
    "paye": "Paye",
    "echoue": "Echoue",
}


def resume_paiement(commande: Dict[str, Any]) -> tuple:
    """(mode lisible, statut lisible) pour l'admin et les rapports."""
    p = commande.get("paiement")
    if not isinstance(p, dict):
        return LIBELLES_PAIEMENT["cash"], LIBELLES_STATUT_PAIEMENT["a_la_livraison"]
    mode = p.get("operateur") if p.get("mode") == "mobile" else "cash"
    return (
        LIBELLES_PAIEMENT.get(mode or "cash", "Mobile Money"),
        LIBELLES_STATUT_PAIEMENT.get(p.get("statut", ""), p.get("statut", "")),
    )


def construire_xlsx(
    titre: str,
    lignes: List[Dict[str, Any]],
    resume_lignes: List[tuple],
    colonnes: List[tuple] = COLONNES_RAPPORT,
    feuille: str = "Commandes",
) -> bytes:
    from openpyxl import Workbook
    from openpyxl.styles import Alignment, Font, PatternFill

    wb = Workbook()
    ws = wb.active
    ws.title = feuille

    ws.append([titre])
    ws["A1"].font = Font(bold=True, size=14, color="E6156F")
    ws.append([])

    entetes = [c[1] for c in colonnes]
    ws.append(entetes)
    for cell in ws[3]:
        cell.font = Font(bold=True, color="FFFFFF")
        cell.fill = PatternFill("solid", fgColor="E6156F")
        cell.alignment = Alignment(horizontal="center")

    for lg in lignes:
        ws.append([lg[c[0]] for c in colonnes])

    for i, (_, __, largeur) in enumerate(colonnes, start=1):
        ws.column_dimensions[ws.cell(row=3, column=i).column_letter].width = largeur

    ws.append([])
    ws.append(["Récapitulatif"])
    ws.cell(row=ws.max_row, column=1).font = Font(bold=True, size=12)
    for label, valeur in resume_lignes:
        ws.append([label, valeur])

    flux = io.BytesIO()
    wb.save(flux)
    return flux.getvalue()


def construire_pdf(
    titre: str,
    lignes: List[Dict[str, Any]],
    resume_lignes: List[tuple],
    colonnes: List[tuple] = COLONNES_RAPPORT,
) -> bytes:
    from reportlab.lib import colors as pdfcolors
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.lib.units import mm
    from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

    flux = io.BytesIO()
    doc = SimpleDocTemplate(
        flux, pagesize=landscape(A4), leftMargin=12 * mm, rightMargin=12 * mm,
        topMargin=12 * mm, bottomMargin=12 * mm, title=titre,
    )
    styles = getSampleStyleSheet()
    petit = styles["BodyText"].clone("petit")
    petit.fontSize = 7
    petit.leading = 9

    rose = pdfcolors.HexColor("#E6156F")
    elements: List[Any] = [
        Paragraph(f"<font color='#E6156F'><b>Pinkberry Drc</b></font> — {titre}", styles["Title"]),
        Spacer(1, 6),
    ]

    donnees = [[Paragraph(f"<b>{c[1]}</b>", petit) for c in colonnes]]
    for lg in lignes:
        donnees.append([
            Paragraph(fc_txt(lg[c[0]]) if c[0] in ("total", "cash", "reduction") else str(lg[c[0]]), petit)
            for c in colonnes
        ])

    # Largeur proportionnelle aux largeurs de colonnes Excel, sur la page A4 paysage.
    total_largeur = sum(c[2] for c in colonnes)
    largeurs = [max(18, c[2] / total_largeur * 260) * mm for c in colonnes]
    table = Table(donnees, colWidths=largeurs, repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), rose),
        ("TEXTCOLOR", (0, 0), (-1, 0), pdfcolors.white),
        ("GRID", (0, 0), (-1, -1), 0.3, pdfcolors.HexColor("#E8D7DE")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [pdfcolors.white, pdfcolors.HexColor("#FDF3F7")]),
    ]))
    elements += [table, Spacer(1, 10), Paragraph("<b>Récapitulatif</b>", styles["Heading3"])]

    resume_table = Table(
        [[label, str(valeur)] for label, valeur in resume_lignes],
        colWidths=[80 * mm, 40 * mm],
    )
    resume_table.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.3, pdfcolors.HexColor("#E8D7DE")),
        ("BACKGROUND", (0, 0), (0, -1), pdfcolors.HexColor("#FDF3F7")),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
    ]))
    elements.append(resume_table)

    doc.build(elements)
    return flux.getvalue()


@api_router.get("/admin/stats")
async def admin_stats(_=Depends(require_admin)):
    cmds = await db.commandes.find({}, {"_id": 0}).to_list(1000)
    livrees = [c for c in cmds if c["statut"] == "livree"]
    return {
        "total": len(cmds),
        "enCours": len([c for c in cmds if c["statut"] in ("recue", "en_preparation", "recuperee", "en_route")]),
        "livrees": len(livrees),
        "annulees": len([c for c in cmds if c["statut"] == "annulee"]),
        "revenus": en_fc(sum(c["total"] for c in livrees)),
    }


@api_router.post("/admin/commandes/{cmd_id}/assigner")
async def assigner_livreur(cmd_id: str, body: AssignIn, user=Depends(require_admin)):
    livreur = await db.livreurs.find_one({"id": body.livreurId}, {"_id": 0})
    if not livreur:
        raise HTTPException(status_code=404, detail="Livreur introuvable")
    res = await db.commandes.update_one({"id": cmd_id}, {"$set": {"livreurId": body.livreurId}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Commande introuvable")
    maj = await db.commandes.find_one({"id": cmd_id}, {"_id": 0})
    await notifier_livreur(maj)
    return await detail_commande(cmd_id, user)


@api_router.patch("/admin/commandes/{cmd_id}/statut")
async def admin_statut(cmd_id: str, body: StatutIn, user=Depends(require_admin)):
    res = await db.commandes.update_one(
        {"id": cmd_id},
        {
            "$set": {
                "statut": body.statut,
                **({"termineeAt": iso(now_utc())} if body.statut in ("livree", "annulee") else {}),
            },
            "$push": {"historique": {"statut": body.statut, "at": iso(now_utc())}},
        },
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Commande introuvable")
    if body.statut == "annulee":
        await liberer_promotions(cmd_id)
    maj = await db.commandes.find_one({"id": cmd_id}, {"_id": 0})
    await notifier_client(maj, body.statut)
    return await detail_commande(cmd_id, user)


@api_router.get("/admin/ventes")
async def ventes_du_jour(_=Depends(require_admin)):
    """Chiffre du jour (commandes livrées uniquement) + produits les plus commandés."""
    maintenant = now_utc() + timedelta(hours=1)  # heure de Kinshasa (UTC+1)
    jour = maintenant.strftime("%Y-%m-%d")
    debut = iso(datetime.fromisoformat(f"{jour}T00:00:00+01:00").astimezone(timezone.utc))
    fin = iso(datetime.fromisoformat(f"{jour}T23:59:59+01:00").astimezone(timezone.utc))

    cmds = await db.commandes.find(
        {"statut": "livree", "createdAt": {"$gte": debut, "$lte": fin}}, {"_id": 0}
    ).to_list(1000)

    chiffre = en_fc(sum(c["total"] for c in cmds))
    articles: Dict[str, Dict[str, Any]] = {}
    for c in cmds:
        for i in c.get("items", []):
            e = articles.setdefault(i["nom"], {"nom": i["nom"], "quantite": 0, "montant": 0.0, "image": i.get("image")})
            e["quantite"] += i.get("quantite", 0)
            e["montant"] = en_fc(e["montant"] + i.get("prixUnitaire", 0) * i.get("quantite", 0))

    top = sorted(articles.values(), key=lambda a: (a["quantite"], a["montant"]), reverse=True)[:5]
    return {
        "date": jour,
        "chiffre": chiffre,
        "nbCommandes": len(cmds),
        "panierMoyen": en_fc(chiffre / len(cmds)) if cmds else 0,
        "topProduits": top,
    }


COLONNES_RAPPORT_LIVREUR = [
    ("numero", "N° commande", 14),
    ("date", "Date", 17),
    ("adresse", "Adresse / commune", 34),
    ("cash", "Cash encaissé FC", 16),
    ("statut", "Statut", 14),
]


# ---------------------------------------------------------------------- livreur
@api_router.get("/livreur/courses")
async def livreur_courses(user=Depends(require_livreur)):
    cmds = (
        await db.commandes.find(
            {
                "livreurId": user.get("livreurId"),
                "livreurArchivee": {"$ne": True},
                "livreurMasquee": {"$ne": True},
            },
            {"_id": 0},
        )
        .sort("createdAt", -1)
        .to_list(200)
    )
    return await enrichir_lot(cmds)


@api_router.get("/livreur/courses/archives")
async def livreur_courses_archivees(user=Depends(require_livreur)):
    cmds = (
        await db.commandes.find(
            {"livreurId": user.get("livreurId"), "livreurArchivee": True, "livreurMasquee": {"$ne": True}},
            {"_id": 0},
        )
        .sort("livreurArchiveeAt", -1)
        .to_list(200)
    )
    return await enrichir_lot(cmds)


async def _course_du_livreur(cmd_id: str, user: Dict[str, Any]) -> Dict[str, Any]:
    cmd = await db.commandes.find_one({"id": cmd_id, "livreurId": user.get("livreurId")}, {"_id": 0})
    if not cmd:
        raise HTTPException(status_code=404, detail="Course introuvable")
    return cmd


@api_router.post("/livreur/courses/{cmd_id}/archiver")
async def livreur_archiver(cmd_id: str, user=Depends(require_livreur)):
    cmd = await _course_du_livreur(cmd_id, user)
    if cmd.get("statut") not in ("livree", "annulee"):
        raise HTTPException(status_code=400, detail="Seule une course terminee peut etre archivee")
    await db.commandes.update_one(
        {"id": cmd_id}, {"$set": {"livreurArchivee": True, "livreurArchiveeAt": iso(now_utc())}}
    )
    return {"ok": True}


@api_router.post("/livreur/courses/{cmd_id}/desarchiver")
async def livreur_desarchiver(cmd_id: str, user=Depends(require_livreur)):
    await _course_du_livreur(cmd_id, user)
    await db.commandes.update_one(
        {"id": cmd_id}, {"$set": {"livreurArchivee": False}, "$unset": {"livreurArchiveeAt": ""}}
    )
    return {"ok": True}


@api_router.delete("/livreur/courses/{cmd_id}/masquer")
async def livreur_masquer(cmd_id: str, user=Depends(require_livreur)):
    """Retire la course de la vue du livreur. La commande reste intacte cote
    admin (rapports et comptabilite) : rien n'est supprime en base."""
    cmd = await _course_du_livreur(cmd_id, user)
    if not cmd.get("livreurArchivee"):
        raise HTTPException(status_code=400, detail="Archivez la course avant de la supprimer")
    await db.commandes.update_one(
        {"id": cmd_id}, {"$set": {"livreurMasquee": True, "livreurMasqueeAt": iso(now_utc())}}
    )
    return {"ok": True}


@api_router.post("/livreur/courses/bulk/archive")
async def livreur_archiver_bulk(body: BulkIdsIn, user=Depends(require_livreur)):
    ids = list(dict.fromkeys(i for i in body.ids if i))
    if not ids:
        return {"ok": True, "updated_count": 0}
    cmds = await db.commandes.find({"id": {"$in": ids}, "livreurId": user.get("livreurId")}, {"_id": 0}).to_list(len(ids))
    if len(cmds) != len(ids):
        raise HTTPException(status_code=404, detail="Une ou plusieurs courses sont introuvables")
    valid_ids = [c["id"] for c in cmds if c.get("statut") in ("livree", "annulee")]
    if len(valid_ids) != len(cmds):
        raise HTTPException(status_code=400, detail="Seules les courses terminees peuvent etre archivees")
    if not valid_ids:
        return {"ok": True, "updated_count": 0}
    res = await db.commandes.update_many({"id": {"$in": valid_ids}}, {"$set": {"livreurArchivee": True, "livreurArchiveeAt": iso(now_utc())}})
    return {"ok": True, "updated_count": res.modified_count}


@api_router.delete("/livreur/courses/bulk/hide")
async def livreur_masquer_bulk(body: BulkIdsIn, user=Depends(require_livreur)):
    ids = list(dict.fromkeys(i for i in body.ids if i))
    if not ids:
        return {"ok": True, "deleted_count": 0}
    cmds = await db.commandes.find({"id": {"$in": ids}, "livreurId": user.get("livreurId")}, {"_id": 0}).to_list(len(ids))
    if len(cmds) != len(ids):
        raise HTTPException(status_code=404, detail="Une ou plusieurs courses sont introuvables")
    non_archives = [c["id"] for c in cmds if not c.get("livreurArchivee")]
    if non_archives:
        raise HTTPException(status_code=400, detail="Archivez les courses sélectionnées avant de les supprimer")
    res = await db.commandes.update_many(
        {"id": {"$in": ids}, "livreurId": user.get("livreurId"), "livreurArchivee": True},
        {"$set": {"livreurMasquee": True, "livreurMasqueeAt": iso(now_utc())}},
    )
    return {"ok": True, "deleted_count": res.modified_count}


@api_router.get("/livreur/rapport")
async def rapport_livreur(debut: str, fin: str, format: str = "xlsx", user=Depends(require_livreur)):
    """Rapport des courses du livreur : cash encaisse et livraisons de la periode."""
    if format not in ("xlsx", "pdf"):
        raise HTTPException(status_code=400, detail="Format attendu : xlsx ou pdf")
    try:
        d_debut = datetime.strptime(debut, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        d_fin = datetime.strptime(fin, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    except ValueError:
        raise HTTPException(status_code=400, detail="Dates attendues au format AAAA-MM-JJ")
    if d_fin < d_debut:
        raise HTTPException(status_code=400, detail="La date de fin precede la date de debut")

    cmds = await db.commandes.find(
        {
            "livreurId": user.get("livreurId"),
            "createdAt": {"$gte": iso(d_debut), "$lt": iso(d_fin + timedelta(days=1))},
        },
        {"_id": 0},
    ).to_list(5000)
    cmds.sort(key=lambda c: c["createdAt"])

    lignes = []
    for c in cmds:
        adr = c.get("adresse") or {}
        encaisse = float(c.get("total", 0)) if c.get("cashEncaisse") else 0.0
        lignes.append({
            "numero": c.get("numero", ""),
            "date": (c.get("createdAt") or "")[:16].replace("T", " "),
            "adresse": f"{adr.get('commune', '')} — {adr.get('avenue', '')} {adr.get('numero', '')}".strip(" —"),
            "cash": en_fc(encaisse),
            "statut": LIBELLES_STATUT.get(c.get("statut", ""), c.get("statut", "")),
        })

    nb_livrees = len([c for c in cmds if c.get("statut") == "livree"])
    nb_annulees = len([c for c in cmds if c.get("statut") == "annulee"])
    total_cash = en_fc(sum(lg["cash"] for lg in lignes))
    resume_lignes = [
        ("Courses effectuées", len(cmds)),
        ("Livraisons réussies", nb_livrees),
        ("Courses annulées", nb_annulees),
        ("Total cash encaissé", fc_txt(total_cash)),
    ]

    nom_livreur = (await db.livreurs.find_one({"id": user.get("livreurId")}, {"_id": 0}) or {}).get(
        "nom", user.get("nom", "")
    )
    titre = f"Courses de {nom_livreur} du {debut} au {fin}"
    nom_fichier = f"pinkberry-courses-{debut}-{fin}.{format}"

    contenu = (
        construire_xlsx(titre, lignes, resume_lignes, COLONNES_RAPPORT_LIVREUR, "Courses")
        if format == "xlsx"
        else construire_pdf(titre, lignes, resume_lignes, COLONNES_RAPPORT_LIVREUR)
    )
    media = (
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        if format == "xlsx"
        else "application/pdf"
    )
    return StreamingResponse(
        io.BytesIO(contenu),
        media_type=media,
        headers={"Content-Disposition": f'attachment; filename="{nom_fichier}"'},
    )


@api_router.patch("/livreur/courses/{cmd_id}/statut")
async def livreur_statut(cmd_id: str, body: StatutIn, user=Depends(require_livreur)):
    cmd = await db.commandes.find_one({"id": cmd_id}, {"_id": 0})
    if not cmd or cmd.get("livreurId") != user.get("livreurId"):
        raise HTTPException(status_code=404, detail="Course introuvable")
    await db.commandes.update_one(
        {"id": cmd_id},
        {
            "$set": {
                "statut": body.statut,
                **({"termineeAt": iso(now_utc())} if body.statut in ("livree", "annulee") else {}),
            },
            "$push": {"historique": {"statut": body.statut, "at": iso(now_utc())}},
        },
    )
    if body.statut == "annulee":
        await liberer_promotions(cmd_id)
    maj = await db.commandes.find_one({"id": cmd_id}, {"_id": 0})
    await notifier_client(maj, body.statut)
    return await detail_commande(cmd_id, user)


@api_router.post("/livreur/courses/{cmd_id}/encaisser")
async def livreur_encaisser(cmd_id: str, user=Depends(require_livreur)):
    cmd = await db.commandes.find_one({"id": cmd_id}, {"_id": 0})
    if not cmd or cmd.get("livreurId") != user.get("livreurId"):
        raise HTTPException(status_code=404, detail="Course introuvable")
    await db.commandes.update_one(
        {"id": cmd_id},
        {
            "$set": {"cashEncaisse": True, "statut": "livree", "termineeAt": iso(now_utc())},
            "$push": {"historique": {"statut": "livree", "at": iso(now_utc())}},
        },
    )
    await notifier_client(cmd, "livree")
    return await detail_commande(cmd_id, user)


ARRIVEE_KM = 0.2


@api_router.post("/livreur/position")
async def livreur_position(body: PositionIn, user=Depends(require_livreur)):
    await db.positions_livreurs.replace_one(
        {"livreurId": user.get("livreurId")},
        {"livreurId": user.get("livreurId"), "lat": body.lat, "lng": body.lng, "updatedAt": iso(now_utc())},
        upsert=True,
    )
    # A moins de ARRIVEE_KM de l'adresse : « livreur arrive », une seule fois par commande.
    async for cmd in db.commandes.find(
        {"livreurId": user.get("livreurId"), "statut": "en_route", "arriveeNotifiee": {"$ne": True}}, {"_id": 0}
    ):
        adr = cmd.get("adresse") or {}
        if adr.get("lat") is None or haversine(body.lat, body.lng, adr["lat"], adr.get("lng", 0)) > ARRIVEE_KM:
            continue
        res = await db.commandes.update_one(
            {"id": cmd["id"], "arriveeNotifiee": {"$ne": True}}, {"$set": {"arriveeNotifiee": True}}
        )
        if res.modified_count:
            await notifier_client(cmd, "arrivee")
    return {"ok": True}


async def migrer_monnaie_fc() -> None:
    """Bascule unique des montants USD vers le FC, au taux enregistre. Le marqueur
    `monnaie` des parametres la rend idempotente ; une base neuve est deja en FC."""
    params = await db.parametres.find_one({"cle": "global"}, {"_id": 0})
    if not params or params.get("monnaie") == MONNAIE:
        return
    taux = float(params["tauxFC"])
    conv = lambda v: en_fc(float(v or 0) * taux)  # noqa: E731

    async for p in db.produits.find({}, {"_id": 0}):
        maj = {
            "prix": conv(p.get("prix")),
            "tailles": [{**t, "ecart": conv(t.get("ecart"))} for t in p.get("tailles") or []],
            "garnitures": [{**g, "prix": conv(g.get("prix"))} for g in p.get("garnitures") or []],
        }
        await db.produits.update_one({"id": p["id"]}, {"$set": maj})
    async for c in db.commandes.find({"devise": {"$exists": False}}, {"_id": 0}):
        items = [
            {
                **i,
                "prixUnitaire": conv(i.get("prixUnitaire")),
                "garnitures": [{**g, "prix": conv(g.get("prix"))} for g in i.get("garnitures") or []],
            }
            for i in c.get("items") or []
        ]
        maj = {k: conv(c.get(k)) for k in ("sousTotal", "fraisLivraison", "total")}
        await db.commandes.update_one({"id": c["id"]}, {"$set": {**maj, "items": items, "devise": MONNAIE}})
    await db.parametres.update_one(
        {"cle": "global"},
        {"$set": {"fraisLivraison": conv(params.get("fraisLivraison", 2.5)), "monnaie": MONNAIE}},
    )
    logger.info(f"Montants convertis en FC au taux {taux}")


async def lire_config() -> Dict[str, Any]:
    """Le taux vient TOUJOURS de la base. Les valeurs d'environnement ne servent
    qu'a creer l'enregistrement initial, une seule fois."""
    doc = await db.parametres.find_one({"cle": "global"}, {"_id": 0})
    if not doc:
        await db.parametres.update_one(
            {"cle": "global"},
            {"$setOnInsert": PARAMETRES_INITIAUX},
            upsert=True,
        )
        doc = await db.parametres.find_one({"cle": "global"}, {"_id": 0})
    return {
        "tauxFC": float(doc["tauxFC"]),
        "fraisLivraison": float(doc.get("fraisLivraison", FRAIS_LIVRAISON)),
        # Vrai uniquement hors production : masque le bloc des comptes de demo.
        "demo": SEED_DEMO,
    }


@api_router.get("/config")
async def config():
    # Pas de cache : l'admin doit voir son nouveau taux immediatement partout.
    return JSONResponse(await lire_config(), headers={"Cache-Control": "no-store"})


@api_router.put("/admin/config")
async def modifier_config(body: ConfigIn, _=Depends(require_admin)):
    if body.tauxFC <= 0:
        raise HTTPException(status_code=400, detail="Le taux doit être supérieur à zéro")
    res = await db.parametres.update_one(
        {"cle": "global"},
        {
            "$set": {"tauxFC": float(body.tauxFC), "majLe": iso(now_utc())},
            "$setOnInsert": {k: v for k, v in PARAMETRES_INITIAUX.items() if k != "tauxFC"},
        },
        upsert=True,
    )
    if res.matched_count == 0 and res.upserted_id is None:
        raise HTTPException(status_code=500, detail="Enregistrement du taux impossible")
    return JSONResponse(await lire_config(), headers={"Cache-Control": "no-store"})


@api_router.get("/")
async def root():
    return {"app": "Pinkberry Drc API", "ok": True}


@api_router.get("/health")
async def api_health():
    try:
        await db.command("ping")
    except Exception as exc:
        logger.error("MongoDB health check failed: %s", exc)
        return JSONResponse({"status": "degraded", "database": "unavailable"}, status_code=503)
    return {"status": "ok", "database": "ok", "demo": SEED_DEMO}


# -------------------------------------------------------------------- seed data
COMMUNES = [
    ("Gombe", True), ("Limete", True), ("Ngaliema", True), ("Lingwala", True),
    ("Barumbu", False), ("Kalamu", False), ("Kasa-Vubu", False), ("Kintambo", False),
    ("Bandalungwa", False), ("Matete", False), ("Masina", False), ("N'djili", False),
    ("Lemba", False), ("Ngiri-Ngiri", False),
]

# Carte Pinkberry, prix en FC : catalogue d'une installation neuve. Les prix des
# boissons sont saisis par l'admin ; tant qu'un produit vaut 0 FC, il est cree
# « en rupture », donc non commandable. Le frozen yogurt est un produit compose :
# taille, recipient et garnitures viennent des collections ci-dessous.
YOGOURTS = "Yogourts glacés"
BOISSONS = "Boissons"
CATEGORIES_MENU = [
    {"nom": YOGOURTS, "nomEn": "Frozen yogurt", "sousCategories": []},
    {
        "nom": BOISSONS,
        "nomEn": "Drinks",
        "sousCategories": [
            {"nom": "Thés au lait", "nomEn": "Milk teas"},
            {"nom": "Sodas pétillants", "nomEn": "Sparkling sodas"},
            {"nom": "Thés aux fruits", "nomEn": "Fruit teas"},
            {"nom": "Slush", "nomEn": "Slush"},
        ],
    },
]
TAILLES_MENU = [
    {"nom": "Régulière", "nomEn": "Regular", "prixBase": 19000, "supplementGarnitures": 7000},
    {"nom": "Moyen", "nomEn": "Medium", "prixBase": 21000, "supplementGarnitures": 8000},
    {"nom": "Grand", "nomEn": "Large", "prixBase": 27000, "supplementGarnitures": 10000},
]
CONTENANTS_MENU = [
    {"nom": "Bol", "nomEn": "Cup"},
    {"nom": "Cornet gaufré", "nomEn": "Waffle Cone"},
    {"nom": "Bol gaufré", "nomEn": "Waffle Bowl"},
]


def _cat(nom: str, nom_en: str, *garnitures: str) -> Dict[str, Any]:
    # Les garnitures portent leur nom de carte Pinkberry, identique en FR et en EN
    # (l'admin peut saisir un nom francais dans « Composition »).
    return {"nom": nom, "nomEn": nom_en, "garnitures": [{"nom": g, "nomEn": g} for g in garnitures]}


# Carte des garnitures Pinkberry, dans l'ordre d'affichage.
GARNITURES_MENU = [
    _cat("Produits Boulangers", "Baked goods", "Brownie bites", "Cheesecake bites", "Crispy crepes", "Mochi"),
    _cat("Bonbon", "Candy", "Mini gems", "Fruit bears", "Rainbow sprinkles"),
    _cat("Céréales", "Cereal", "Fruity pebbles", "Cap'n Crunch"),
    _cat("Chocolat", "Chocolate", "Chocolate curls", "Chocolate crisps"),
    _cat("Cookies", "Cookies", "Cookies & cream", "Cookie wafers", "Vanilla wafers",
         "Chocolate hazelnut wafer rolls", "Waffle cookies"),
    _cat("Granola", "Granola", "Honey almond granola"),
    _cat("Noix", "Nuts", "Toasted almonds", "Candied pecans"),
    _cat("Liquide", "Liquid", "Chocolate sauce", "Caramel sauce", "Honey"),
    _cat("Coup de cœur local", "Local favorite", "Coconut", "Yogurt chips", "Dates", "Mini marshmallow"),
]


def _boisson(sous: str, nom: str, nom_en: str) -> Dict[str, Any]:
    return {"nom": nom, "nomEn": nom_en, "categorie": BOISSONS, "sousCategorie": sous, "prix": 0,
            "tailles": [], "garnitures": []}


PRODUITS_DEMO = [
    {"nom": "Yogourt glacé", "nomEn": "Frozen yogurt", "categorie": YOGOURTS, "configurable": True, "prix": 0,
     "tailles": [], "garnitures": []},
    _boisson("Thés au lait", "Matcha à la fraise avec tapioca", "Strawberry Matcha with Tapioca"),
    _boisson("Thés au lait", "Taro au lait avec tapioca", "Taro Milk Tea with Tapioca"),
    _boisson("Thés au lait", "Matcha au lait avec tapioca", "Matcha Milk Tea with Tapioca"),
    _boisson("Thés au lait", "Thé au lait au sucre brun avec tapioca", "Brown Sugar Milk Tea with Tapioca"),
    _boisson("Sodas pétillants", "Soda fraise", "Strawberry Soda"),
    _boisson("Sodas pétillants", "Soda mangue", "Mango Soda"),
    _boisson("Sodas pétillants", "Soda orange", "Orange Soda"),
    _boisson("Sodas pétillants", "Soda grenadille", "Passion Fruit Soda"),
    _boisson("Thés aux fruits", "Grenadille et litchi vert", "Passion Fruit & Green Lychee Tea"),
    _boisson("Thés aux fruits", "Grenadille avec perles de fruit (boba)", "Passion Fruit Tea with Fruit Pearls (Boba)"),
    _boisson("Thés aux fruits", "Fruit tropical avec gelée de litchi", "Tropical Fruit Tea with Lychee Jelly"),
    _boisson("Slush", "Slush à la fraise", "Strawberry Slush"),
    _boisson("Slush", "Slush à la mangue", "Mango Slush"),
    _boisson("Slush", "Slush au taro", "Taro Slush"),
]

# Glossaire FR -> EN amorce par la carte : coherence des traductions automatiques.
TRADUCTIONS_MENU = {
    o["nom"]: o["nomEn"]
    for o in [
        *CATEGORIES_MENU,
        *(s for c in CATEGORIES_MENU for s in c["sousCategories"]),
        *PRODUITS_DEMO,
        *TAILLES_MENU,
        *CONTENANTS_MENU,
        *GARNITURES_MENU,
        *(g for c in GARNITURES_MENU for g in c["garnitures"]),
    ]
}


async def seed_composition() -> None:
    """Carte de depart du frozen yogurt, tout disponible. Non destructif : chaque
    collection n'est amorcee que si elle est vide, et la regle seulement si elle
    n'existe pas. Rien de ce que l'admin a cree ou modifie n'est jamais ecrase."""
    if await db.tailles.count_documents({}) == 0:
        for n, t in enumerate(TAILLES_MENU):
            await db.tailles.insert_one({"id": str(uuid.uuid4()), **t, "ordre": n})
    if await db.contenants.count_documents({}) == 0:
        for n, c in enumerate(CONTENANTS_MENU):
            await db.contenants.insert_one({"id": str(uuid.uuid4()), **c, "disponible": True, "ordre": n})
    if await db.categories_garnitures.count_documents({}) == 0:
        for n, c in enumerate(GARNITURES_MENU):
            cid = str(uuid.uuid4())
            await db.categories_garnitures.insert_one(
                {"id": cid, "nom": c["nom"], "nomEn": c["nomEn"], "disponible": True, "ordre": n}
            )
            for m, g in enumerate(c["garnitures"]):
                await db.garnitures.insert_one(
                    {"id": str(uuid.uuid4()), "categorieId": cid, **g, "disponible": True, "ordre": m}
                )
    await db.parametres.update_one(
        {"cle": "global", "regleGarnitures": {"$exists": False}},
        {"$set": {"regleGarnitures": REGLE_GARNITURES_DEFAUT}},
    )


async def seed():
    # Index unique mais partiel : les comptes Google n'ont pas encore de telephone.
    try:
        noms = await db.users.index_information()
        if "telephone_1" in noms and not noms["telephone_1"].get("partialFilterExpression"):
            await db.users.drop_index("telephone_1")
    except Exception as e:
        logger.warning(f"index telephone: {e}")
    await db.users.create_index(
        "telephone",
        unique=True,
        partialFilterExpression={"telephone": {"$type": "string"}},
    )
    # Abonnements push : anciennement `push_web`, repris une seule fois.
    if "push_web" in await db.list_collection_names():
        async for abo in db.push_web.find({}, {"_id": 0}):
            await db.push_subscriptions.update_one({"endpoint": abo["endpoint"]}, {"$setOnInsert": abo}, upsert=True)
        await db.push_web.drop()
    await db.push_subscriptions.create_index("endpoint", unique=True)
    await db.push_subscriptions.create_index("userId")
    await db.notifications.create_index([("userId", 1), ("createdAt", -1)])
    await db.notifications.create_index("expireAt", expireAfterSeconds=0)

    # Normalise les produits anterieurs a l'ajout de la mise en avant.
    await db.produits.update_many({"enAvant": {"$exists": False}}, {"$set": {"enAvant": False}})

    # Le taux de change appartient a l'admin : on cree l'enregistrement seulement
    # s'il n'existe pas ($setOnInsert), jamais d'ecrasement au demarrage.
    await db.parametres.update_one(
        {"cle": "global"},
        {"$setOnInsert": PARAMETRES_INITIAUX},
        upsert=True,
    )
    await migrer_monnaie_fc()
    await seed_composition()
    for commune, active in COMMUNES:
        await db.zones.update_one(
            {"commune": commune},
            {"$setOnInsert": {"id": str(uuid.uuid4()), "commune": commune, "active": active}},
            upsert=True,
        )
    if await db.produits.count_documents({}) == 0:
        for c in CATEGORIES_MENU:
            await db.categories.update_one(
                {"nom": c["nom"]},
                {"$setOnInsert": {"id": str(uuid.uuid4()), **copy.deepcopy(c)}},
                upsert=True,
            )
        for p in PRODUITS_DEMO:
            doc = {"description": None, "descriptionEn": None, "image": None, "emoji": None, "enAvant": False,
                   "sousCategorie": None, "configurable": False, **copy.deepcopy(p)}
            doc["id"] = str(uuid.uuid4())
            doc["disponible"] = _vendable(doc)
            await db.produits.insert_one(doc)

    # categories : reprises des produits existants puis gerees par l'admin
    for nom in sorted({p["categorie"] for p in await db.produits.find({}, {"_id": 0, "categorie": 1}).to_list(500)}):
        await db.categories.update_one(
            {"nom": nom},
            {"$setOnInsert": {"id": str(uuid.uuid4()), "nom": nom, "nomEn": TRADUCTIONS_MENU.get(nom), "sousCategories": []}},
            upsert=True,
        )
    # Traductions EN manquantes (glossaire puis LLM) : sans bloquer le demarrage.
    # Reference gardee : asyncio ne retient que faiblement les taches.
    global _tache_traductions
    _tache_traductions = asyncio.create_task(traduire_catalogue_existant())

    # super admin unique : le compte Google du proprietaire
    promu = await db.users.update_one(
        {"email": SUPERADMIN_EMAIL},
        {"$set": {"role": "superadmin", "actif": True, "verifie": True}},
    )
    if promu.matched_count == 0:
        logger.warning(f"Super admin {SUPERADMIN_EMAIL} absent de la base")
    await db.users.update_many(
        {"role": "superadmin", "email": {"$ne": SUPERADMIN_EMAIL}},
        {"$set": {"role": "admin"}},
    )
    # comptes existants : actif par defaut
    await db.users.update_many({"actif": {"$exists": False}}, {"$set": {"actif": True}})

    # comptes de demonstration : desactivables et mots de passe pilotes par l'environnement
    if not SEED_DEMO:
        return

    # admin
    if MDP_ADMIN and not await db.users.find_one({"telephone": "0810000000"}):
        await db.users.insert_one({
            "id": str(uuid.uuid4()), "nom": "Admin Pinkberry", "telephone": "0810000000",
            "email": None, "motDePasseHash": hash_pwd(MDP_ADMIN), "role": "admin",
            "verifie": True, "createdAt": iso(now_utc()),
        })
    # client demo
    if MDP_CLIENT and not await db.users.find_one({"telephone": "0990000001"}):
        await db.users.insert_one({
            "id": str(uuid.uuid4()), "nom": "Client Demo", "telephone": "0990000001",
            "email": None, "motDePasseHash": hash_pwd(MDP_CLIENT), "role": "client",
            "verifie": True, "createdAt": iso(now_utc()),
        })
    # livreurs demo
    if not MDP_LIVREUR:
        return
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
                "motDePasseHash": hash_pwd(MDP_LIVREUR), "role": "livreur", "livreurId": lv["id"],
                "verifie": True, "createdAt": iso(now_utc()),
            })
        if not await db.positions_livreurs.find_one({"livreurId": lv["id"]}):
            await db.positions_livreurs.insert_one({
                "livreurId": lv["id"], "lat": -4.3178, "lng": 15.3136, "updatedAt": iso(now_utc()),
            })


app.include_router(api_router)


@app.get("/health")
async def health():
    return await api_health()

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
    await charger_cles_pawapay()
    logger.info("Pinkberry Drc API prete")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
