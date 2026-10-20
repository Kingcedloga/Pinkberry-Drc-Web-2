"""Messages d'erreur du serveur : chaque message ecrit dans le code a sa version
anglaise (et francaise accentuee si besoin), et la reponse suit la langue de la
requete. Analyse statique de server.py, sans demarrer le serveur."""
import ast
import os
import re

import requests

SERVEUR = os.path.join(os.path.dirname(__file__), "..", "server.py")
API = f"{os.environ['EXPO_PUBLIC_BACKEND_URL'].rstrip('/')}/api"


def _tables():
    src = open(SERVEUR, encoding="utf-8").read()
    debut, fin = src.index("ERREURS_EN: Dict[str, str] = {"), src.index("def _motifs")
    ns: dict = {}
    exec("from typing import Dict\n" + src[debut:fin], ns)  # noqa: S102 - tables litterales uniquement
    return src, ns["ERREURS_EN"], ns["ERREURS_FR"]


def _messages_du_code(src: str):
    """Messages des HTTPException : litteraux, f-strings ({} = valeur) et constantes."""
    arbre = ast.parse(src)
    constantes = {
        n.targets[0].id: n.value.value
        for n in arbre.body
        if isinstance(n, ast.Assign) and isinstance(n.targets[0], ast.Name)
        and isinstance(n.value, ast.Constant) and isinstance(n.value.value, str)
    }
    for n in ast.walk(arbre):
        if not (isinstance(n, ast.Call) and getattr(n.func, "id", None) == "HTTPException"):
            continue
        d = next((k.value for k in n.keywords if k.arg == "detail"), None)
        if isinstance(d, ast.Constant) and isinstance(d.value, str):
            yield n.lineno, d.value
        elif isinstance(d, ast.JoinedStr):
            yield n.lineno, "".join(v.value if isinstance(v, ast.Constant) else "{}" for v in d.values)
        elif isinstance(d, ast.Name) and d.id in constantes:
            yield n.lineno, constantes[d.id]


def test_chaque_message_a_sa_version_anglaise():
    src, en, _ = _tables()
    manquants = []
    for ligne, msg in _messages_du_code(src):
        if msg == "{} introuvable":  # _introuvable(libelle) : chaque libelle est traduit en entier
            continue
        if msg not in en:
            manquants.append(f"ligne {ligne} : {msg}")
    assert not manquants, "Messages sans traduction anglaise (ERREURS_EN) :\n" + "\n".join(manquants)


def test_libelles_introuvable_traduits():
    src, en, _ = _tables()
    libelles = set(re.findall(r'_introuvable\([^,]+,\s*[^,]+,\s*"([^"]+)"\)', src))
    assert libelles and all(f"{l} introuvable" in en for l in libelles), libelles


def test_tables_coherentes():
    _, en, fr = _tables()
    assert set(fr) <= set(en), set(fr) - set(en)
    for source, cible in [*en.items(), *fr.items()]:
        assert source.count("{}") == cible.count("{}"), source


def test_reponse_dans_la_langue_de_la_requete():
    corps = {"telephone": "0990000001", "motDePasse": "mauvais"}
    fr = requests.post(f"{API}/auth/connexion", json=corps, headers={"Accept-Language": "fr"}, timeout=15).json()
    en = requests.post(f"{API}/auth/connexion", json=corps, headers={"Accept-Language": "en-US,en;q=0.9"},
                       timeout=15).json()
    assert fr["detail"] == "Téléphone ou mot de passe incorrect"
    assert en["detail"] == "Incorrect phone number or password"
