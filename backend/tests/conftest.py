"""Fin de session pytest : les donnees laissees par les tests (prefixes TEST,
commandes de test et leurs notifications…) sont supprimees, pour ne jamais
les retrouver dans l'app ni dans une base mise en production."""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "outils"))


def pytest_sessionfinish(session, exitstatus):
    try:
        from pymongo import MongoClient

        from nettoyer_donnees_test import nettoyer

        with MongoClient(os.environ["MONGO_URL"], serverSelectionTimeoutMS=5000) as cli:
            bilan = nettoyer(cli[os.environ["DB_NAME"]], appliquer=True, bavard=False)
        if bilan:
            print(f"\nNettoyage des donnees de test : {bilan}")
    except Exception as e:  # le nettoyage ne doit jamais faire echouer la suite
        print(f"\nNettoyage des donnees de test impossible : {e}")
