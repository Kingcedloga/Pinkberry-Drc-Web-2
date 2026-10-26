"""Authentification des tests : le super admin est le compte Google du
proprietaire (sans mot de passe) ; les tests signent un jeton pour lui."""
import os
from datetime import datetime, timedelta, timezone

import jwt
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))


def jeton_superadmin() -> str:
    with MongoClient(os.environ["MONGO_URL"]) as cli:
        u = cli[os.environ["DB_NAME"]].users.find_one({"role": "superadmin"}, {"_id": 0, "id": 1})
    assert u, "aucun super admin en base"
    jeton = jwt.encode(
        {"sub": u["id"], "exp": datetime.now(timezone.utc) + timedelta(hours=2)},
        os.environ["JWT_SECRET"], algorithm="HS256",
    )
    return jeton


def entetes_superadmin() -> dict:
    return {"Authorization": f"Bearer {jeton_superadmin()}"}


def article_commandable(quantite: int = 1) -> dict:
    """Ligne de panier valide avec le catalogue actuel : le frozen yogurt compose
    (taille + recipient, sans garnitures). Les anciens produits « Pot Test » /
    produits[0] n'existent plus ou sont en rupture."""
    import requests

    api = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/") + "/api"
    produit = next(p for p in requests.get(f"{api}/produits", timeout=15).json()
                   if p.get("configurable") and p.get("disponible"))
    compo = requests.get(f"{api}/composition", timeout=15).json()
    contenant = next(c for c in compo["contenants"] if c.get("disponible", True))
    return {"produitId": produit["id"], "nom": produit["nom"], "taille": compo["tailles"][0]["nom"],
            "contenant": contenant["nom"], "garnitures": [], "quantite": quantite}
