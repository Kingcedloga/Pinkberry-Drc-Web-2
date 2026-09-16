"""Transforme les feuilles de styles statiques en feuilles dynamiques (thème
clair/sombre) et abonne chaque écran au thème."""
import re
import sys
from pathlib import Path

RACINE = Path("/app/frontend")
CIBLES = list((RACINE / "app").rglob("*.tsx")) + list((RACINE / "src").rglob("*.tsx"))
IGNORER = {"error-boundary.tsx", "theme-contexte.tsx"}

def fin_bloc(texte: str, debut: int) -> int:
    """Index du caractère juste après le `)` fermant de StyleSheet.create(."""
    i = texte.index("(", debut)
    profondeur = 0
    while i < len(texte):
        c = texte[i]
        if c in "({[":
            profondeur += 1
        elif c in ")}]":
            profondeur -= 1
            if profondeur == 0:
                return i + 1
        i += 1
    raise ValueError("bloc non fermé")

modifies = []
for chemin in CIBLES:
    if chemin.name in IGNORER:
        continue
    s = chemin.read_text()
    original = s

    # 1. styles dynamiques
    while True:
        m = re.search(r"const (\w+) = StyleSheet\.create\(", s)
        if not m:
            break
        fin = fin_bloc(s, m.end() - 1)
        bloc = s[m.start():fin]
        interieur = bloc[len(f"const {m.group(1)} = "):]
        nouveau = f"const {m.group(1)} = stylesDynamiques(() => {interieur})"
        s = s[:m.start()] + nouveau + s[fin:]

    if "stylesDynamiques(" in s and "stylesDynamiques," not in s and "{ stylesDynamiques }" not in s:
        # ajoute stylesDynamiques à l'import de @/src/theme
        m = re.search(r'import \{([^}]*)\} from "@/src/theme";', s)
        if m:
            noms = [n.strip() for n in m.group(1).split(",") if n.strip()]
            if "stylesDynamiques" not in noms:
                noms.append("stylesDynamiques")
            noms = sorted(set(noms), key=lambda n: n.lower())
            s = s[:m.start()] + 'import { ' + ", ".join(noms) + ' } from "@/src/theme";' + s[m.end():]
        else:
            s = s.replace("\nconst ", '\nimport { stylesDynamiques } from "@/src/theme";\n\nconst ', 1)

    # 2. abonnement au thème pour les écrans
    if chemin.is_relative_to(RACINE / "app"):
        m = re.search(r"export default function \w+\([^)]*\) \{\n", s)
        if m and "useTheme()" not in s:
            s = s[:m.end()] + "  useTheme();\n" + s[m.end():]
            if 'from "@/src/theme-contexte"' not in s:
                s = s.replace(
                    'import { stylesDynamiques } from "@/src/theme";',
                    'import { stylesDynamiques } from "@/src/theme";\nimport { useTheme } from "@/src/theme-contexte";',
                    1,
                )
                if 'from "@/src/theme-contexte"' not in s:
                    m2 = re.search(r'import \{[^}]*\} from "@/src/theme";\n', s)
                    if m2:
                        s = s[:m2.end()] + 'import { useTheme } from "@/src/theme-contexte";\n' + s[m2.end():]
                    else:
                        print("IMPORT MANQUANT", chemin)

    if s != original:
        chemin.write_text(s)
        modifies.append(str(chemin.relative_to(RACINE)))

print(f"{len(modifies)} fichiers modifiés")
for f in sorted(modifies):
    print(" -", f)
