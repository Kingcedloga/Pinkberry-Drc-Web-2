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
from fastapi import APIRouter, Depends, FastAPI, File, HTTPException, Request, UploadFile
from fastapi.responses import Response, StreamingResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from motor.motor_asyncio import AsyncIOMotorClient
from PIL import Image
from pydantic import BaseModel, Field
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

TAUX_FC = float(os.environ.get("TAUX_FC", "2800"))
FRAIS_LIVRAISON = float(os.environ.get("FRAIS_LIVRAISON", "2.5"))
SUPERADMIN_EMAIL = (os.environ.get("SUPERADMIN_EMAIL") or "mecedloga@gmail.com").strip().lower()
# Comptes de demonstration (admin / client / livreurs) : uniquement si les mots de
# passe sont fournis par l'environnement, et desactivables d'un coup.
SEED_DEMO = (os.environ.get("SEED_DEMO_ACCOUNTS") or "true").strip().lower() not in ("0", "false", "no")
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


class ZoneCreationIn(BaseModel):
    commune: str
    active: bool = True


class ZoneIn(BaseModel):
    active: bool


class ConfigIn(BaseModel):
    tauxFC: float


class AssignIn(BaseModel):
    livreurId: str


class SessionIn(BaseModel):
    session_id: str


class TelephoneIn(BaseModel):
    telephone: str


class RegisterPushBody(BaseModel):
    user_id: str
    platform: str
    device_token: str


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


# --------------------------------------------------- notifications push (relay)
@api_router.post("/register-push", status_code=201)
async def register_push(body: RegisterPushBody):
    resp = await _push_client.post("/api/v1/push/users/register", json=body.model_dump())
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
    admins = await db.users.find({"role": "admin"}, {"_id": 0, "id": 1}).to_list(50)
    return [a["id"] for a in admins]


async def id_user_livreur(livreur_id: Optional[str]) -> Optional[str]:
    if not livreur_id:
        return None
    u = await db.users.find_one({"livreurId": livreur_id}, {"_id": 0, "id": 1})
    return u["id"] if u else None


MESSAGES_PUSH = {
    "recue": ("Commande reçue", "Nous avons bien reçu votre commande {numero}."),
    "en_preparation": ("En préparation", "Votre commande {numero} est en préparation."),
    "recuperee": ("Commande récupérée", "Le livreur a récupéré votre commande {numero}."),
    "en_route": ("Livreur en route", "Votre livreur arrive, suivez-le sur la carte."),
    "livree": ("Commande livrée", "Bon appétit ! Merci pour votre commande {numero}."),
    "annulee": ("Commande annulée", "Votre commande {numero} a été annulée."),
}


async def notifier_client(cmd: Dict[str, Any], statut: str) -> None:
    modele = MESSAGES_PUSH.get(statut)
    if not modele:
        return
    titre, message = modele
    try:
        await send_push(
            recipients=[cmd["userId"]],
            data={
                "title": titre,
                "message": message.format(numero=cmd.get("numero", "")),
                "action_url": f"/suivi/{cmd['id']}",
            },
            idempotency_key=f"{cmd['id']}-{statut}",
        )
    except Exception as e:
        logger.warning(f"Push client non bloquant: {e}")


async def notifier_admins(cmd: Dict[str, Any]) -> None:
    try:
        await send_push(
            recipients=await ids_admins(),
            data={
                "title": "Nouvelle commande",
                "message": f"{cmd.get('clientNom')} · {cmd.get('numero')} · ${cmd.get('total')}",
                "action_url": "/dashboard",
            },
            idempotency_key=f"{cmd['id']}-admin",
        )
    except Exception as e:
        logger.warning(f"Push admin non bloquant: {e}")


async def notifier_livreur(cmd: Dict[str, Any]) -> None:
    try:
        cible = await id_user_livreur(cmd.get("livreurId"))
        if not cible:
            return
        await send_push(
            recipients=[cible],
            data={
                "title": "Nouvelle course",
                "message": f"{cmd.get('numero')} · {cmd.get('adresse', {}).get('commune')} · ${cmd.get('total')} à encaisser",
                "action_url": f"/course/{cmd['id']}",
            },
            idempotency_key=f"{cmd['id']}-livreur-{cmd.get('livreurId')}",
        )
    except Exception as e:
        logger.warning(f"Push livreur non bloquant: {e}")


# --------------------------------------------------------------------- catalogue
@api_router.get("/produits")
async def liste_produits():
    items = await db.produits.find({}, {"_id": 0}).to_list(500)
    return sorted(items, key=lambda p: (p["categorie"], p["nom"]))


@api_router.get("/categories")
async def liste_categories():
    cats = await db.categories.find({}, {"_id": 0}).to_list(100)
    noms = sorted({c["nom"] for c in cats})
    return ["Tous", *noms]


@api_router.get("/admin/categories")
async def admin_categories(_=Depends(require_admin)):
    cats = await db.categories.find({}, {"_id": 0}).to_list(100)
    for c in cats:
        c["nbProduits"] = await db.produits.count_documents({"categorie": c["nom"]})
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
    doc = {"id": str(uuid.uuid4()), "nom": nom}
    await db.categories.insert_one(dict(doc))
    doc["nbProduits"] = 0
    return doc


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
    await db.livreurs.delete_one({"id": livreur_id})
    await db.users.delete_one({"livreurId": livreur_id, "role": "livreur"})
    return {"ok": True}


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
    await notifier_client(cmd, "recue")
    await notifier_admins(cmd)
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
        {
            "$set": {"statut": "annulee", "termineeAt": iso(now_utc())},
            "$push": {"historique": {"statut": "annulee", "at": iso(now_utc())}},
        },
    )
    await notifier_client(cmd, "annulee")
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
    return [await enrichir(c) for c in cmds]


@api_router.get("/admin/commandes/archives")
async def admin_commandes_archivees(_=Depends(require_admin)):
    cmds = await db.commandes.find({"archivee": True}, {"_id": 0}).to_list(500)
    cmds.sort(key=lambda c: c.get("archiveeAt") or c["createdAt"], reverse=True)
    return [await enrichir(c) for c in cmds]


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
            + (f" ({a.get('taille')})" if a.get("taille") else "")
            for a in c.get("items", [])
        )
        adr = c.get("adresse") or {}
        lignes.append({
            "numero": c.get("numero", ""),
            "date": (c.get("createdAt") or "")[:16].replace("T", " "),
            "client": c.get("clientNom") or "—",
            "adresse": f"{adr.get('commune', '')} — {adr.get('avenue', '')} {adr.get('numero', '')}".strip(" —"),
            "articles": articles,
            "total": round(float(c.get("total", 0)), 2),
            "statut": LIBELLES_STATUT.get(c.get("statut", ""), c.get("statut", "")),
            "livreur": livreurs.get(c.get("livreurId") or "", "—"),
        })

    livrees = [c for c in cmds if c.get("statut") == "livree"]
    annulees = [c for c in cmds if c.get("statut") == "annulee"]
    resume = {
        "nbCommandes": len(cmds),
        "chiffre": round(sum(float(c.get("total", 0)) for c in livrees), 2),
        "nbLivrees": len(livrees),
        "nbAnnulees": len(annulees),
    }
    titre = f"Rapport des commandes du {debut} au {fin}"
    nom_fichier = f"pinkberry-rapport-{debut}-{fin}.{format}"

    contenu = (
        construire_xlsx(titre, lignes, resume) if format == "xlsx" else construire_pdf(titre, lignes, resume)
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
    ("total", "Total USD", 11),
    ("statut", "Statut", 14),
    ("livreur", "Livreur", 18),
]


def construire_xlsx(titre: str, lignes: List[Dict[str, Any]], resume: Dict[str, Any]) -> bytes:
    from openpyxl import Workbook
    from openpyxl.styles import Alignment, Font, PatternFill

    wb = Workbook()
    ws = wb.active
    ws.title = "Commandes"

    ws.append([titre])
    ws["A1"].font = Font(bold=True, size=14, color="E6156F")
    ws.append([])

    entetes = [c[1] for c in COLONNES_RAPPORT]
    ws.append(entetes)
    for cell in ws[3]:
        cell.font = Font(bold=True, color="FFFFFF")
        cell.fill = PatternFill("solid", fgColor="E6156F")
        cell.alignment = Alignment(horizontal="center")

    for lg in lignes:
        ws.append([lg[c[0]] for c in COLONNES_RAPPORT])

    for i, (_, __, largeur) in enumerate(COLONNES_RAPPORT, start=1):
        ws.column_dimensions[ws.cell(row=3, column=i).column_letter].width = largeur

    ws.append([])
    ws.append(["Récapitulatif"])
    ws.cell(row=ws.max_row, column=1).font = Font(bold=True, size=12)
    for label, valeur in [
        ("Nombre de commandes", resume["nbCommandes"]),
        ("Chiffre d'affaires (commandes livrées)", f"$ {resume['chiffre']:.2f}"),
        ("Livraisons réussies", resume["nbLivrees"]),
        ("Commandes annulées", resume["nbAnnulees"]),
    ]:
        ws.append([label, valeur])

    flux = io.BytesIO()
    wb.save(flux)
    return flux.getvalue()


def construire_pdf(titre: str, lignes: List[Dict[str, Any]], resume: Dict[str, Any]) -> bytes:
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

    donnees = [[Paragraph(f"<b>{c[1]}</b>", petit) for c in COLONNES_RAPPORT]]
    for lg in lignes:
        donnees.append([
            Paragraph(f"$ {lg[c[0]]:.2f}" if c[0] == "total" else str(lg[c[0]]), petit)
            for c in COLONNES_RAPPORT
        ])

    largeurs = [22 * mm, 26 * mm, 30 * mm, 48 * mm, 62 * mm, 20 * mm, 24 * mm, 28 * mm]
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
        [
            ["Nombre de commandes", str(resume["nbCommandes"])],
            ["Chiffre d'affaires (commandes livrées)", f"$ {resume['chiffre']:.2f}"],
            ["Livraisons réussies", str(resume["nbLivrees"])],
            ["Commandes annulées", str(resume["nbAnnulees"])],
        ],
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

    chiffre = round(sum(c["total"] for c in cmds), 2)
    articles: Dict[str, Dict[str, Any]] = {}
    for c in cmds:
        for i in c.get("items", []):
            e = articles.setdefault(i["nom"], {"nom": i["nom"], "quantite": 0, "montant": 0.0, "image": i.get("image")})
            e["quantite"] += i.get("quantite", 0)
            e["montant"] = round(e["montant"] + i.get("prixUnitaire", 0) * i.get("quantite", 0), 2)

    top = sorted(articles.values(), key=lambda a: (a["quantite"], a["montant"]), reverse=True)[:5]
    return {
        "date": jour,
        "chiffre": chiffre,
        "nbCommandes": len(cmds),
        "panierMoyen": round(chiffre / len(cmds), 2) if cmds else 0,
        "topProduits": top,
    }


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
        {
            "$set": {
                "statut": body.statut,
                **({"termineeAt": iso(now_utc())} if body.statut in ("livree", "annulee") else {}),
            },
            "$push": {"historique": {"statut": body.statut, "at": iso(now_utc())}},
        },
    )
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

    # categories : reprises des produits existants puis gerees par l'admin
    for nom in sorted({p["categorie"] for p in await db.produits.find({}, {"_id": 0, "categorie": 1}).to_list(500)}):
        await db.categories.update_one(
            {"nom": nom},
            {"$setOnInsert": {"id": str(uuid.uuid4()), "nom": nom}},
            upsert=True,
        )

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
    return {"status": "ok"}

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
