"""Supprime les donnees laissees par les tests automatiques (prefixes TEST,
« Test iter4 », « Av. de la Testerie »…) avant une mise en production.

    python outils/nettoyer_donnees_test.py              # simulation : compte seulement
    python outils/nettoyer_donnees_test.py --appliquer  # suppression

Ne touche jamais au super admin, aux comptes de demonstration ni a leurs
commandes reelles : seuls les elements explicitement marques comme tests
(et ce qui en depend : notifications, sessions, positions…) sont supprimes.
"""
import os
import re
import sys

from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

TEST = {"$regex": r"^\s*TEST", "$options": "i"}
COMPTES_DEMO = ["0810000000", "0990000001", "0820000001", "0820000002"]
# Numeros fixes utilises par d'anciens tests (comptes « x » crees pour verifier les droits).
TELEPHONES_TEST = ["0821111112", "0821111113", "0812222222"]
UUID = re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")


def nettoyer(db, appliquer: bool = False, bavard: bool = True) -> dict:
    bilan: dict = {}

    def supprimer(collection: str, filtre: dict) -> None:
        n = db[collection].count_documents(filtre)
        if n and appliquer:
            db[collection].delete_many(filtre)
        if n:
            bilan[collection] = bilan.get(collection, 0) + n

    # Comptes de test (jamais le super admin ni les comptes de demonstration).
    users = list(db.users.find(
        {"$or": [{"nom": TEST}, {"telephone": {"$in": TELEPHONES_TEST}}],
         "role": {"$ne": "superadmin"}, "telephone": {"$nin": COMPTES_DEMO}},
        {"_id": 0, "id": 1, "telephone": 1, "livreurId": 1},
    ))
    ids_users = [u["id"] for u in users]
    livreurs = {lv["id"] for lv in db.livreurs.find(
        {"$or": [{"nom": TEST}, {"telephone": {"$in": TELEPHONES_TEST}}]}, {"_id": 0, "id": 1})}
    livreurs |= {u["livreurId"] for u in users if u.get("livreurId")}

    commandes = {c["id"] for c in db.commandes.find({"$or": [
        {"adresse.label": TEST}, {"adresse.avenue": TEST}, {"adresse.avenue": {"$regex": "Testerie"}},
        {"items.nom": TEST}, {"clientNom": TEST}, {"userId": {"$in": ids_users}},
    ]}, {"_id": 0, "id": 1})}
    existantes = {c["id"] for c in db.commandes.find({}, {"_id": 0, "id": 1})} - commandes

    # Notifications des commandes supprimees, des comptes supprimes, ou orphelines.
    notifs = []
    for n in db.notifications.find({}, {"_id": 1, "userId": 1, "lien": 1, "tag": 1}):
        lies = set(UUID.findall(f"{n.get('lien') or ''} {n.get('tag') or ''}"))
        if n.get("userId") in ids_users or (lies and (lies & commandes or not lies & (existantes | livreurs | set(ids_users)))):
            notifs.append(n["_id"])

    supprimer("notifications", {"_id": {"$in": notifs}})
    supprimer("paiements", {"commandeId": {"$in": list(commandes)}})
    supprimer("commandes", {"id": {"$in": list(commandes)}})
    supprimer("adresses", {"$or": [{"label": TEST}, {"userId": {"$in": ids_users}}]})
    supprimer("user_sessions", {"user_id": {"$in": ids_users}})
    supprimer("push_subscriptions", {"userId": {"$in": ids_users}})
    supprimer("otps", {"telephone": {"$in": [u.get("telephone") for u in users if u.get("telephone")]}})
    supprimer("positions_livreurs", {"livreurId": {"$in": list(livreurs)}})
    supprimer("livreurs", {"id": {"$in": list(livreurs)}})
    supprimer("users", {"id": {"$in": ids_users}})
    # Catalogue et configuration de test.
    for collection, champ in (("zones", "commune"), ("categories", "nom"), ("produits", "nom"), ("promotions", "nom"),
                              ("bannieres", "titre"), ("tailles", "nom"), ("contenants", "nom"),
                              ("garnitures", "nom"), ("categories_garnitures", "nom")):
        supprimer(collection, {champ: TEST})

    if bavard:
        mode = "supprime(s)" if appliquer else "a supprimer (simulation)"
        print(f"Donnees de test {mode} :" if bilan else "Aucune donnee de test.")
        for c, n in sorted(bilan.items()):
            print(f"  {c:22s} {n}")
    return bilan


if __name__ == "__main__":
    client = MongoClient(os.environ["MONGO_URL"])
    nettoyer(client[os.environ["DB_NAME"]], appliquer="--appliquer" in sys.argv)
