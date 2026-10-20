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
