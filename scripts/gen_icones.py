"""Genere toutes les declinaisons du logo Pinkberry a partir des deux sources.

    /root/.venv/bin/python scripts/gen_icones.py

Sources (a remplacer pour changer de logo, puis relancer le script) :
  - frontend/public/PINK LOGO icon .png : symbole (spirale + feuilles)
  - frontend/public/PINK LOGOS.png      : logo complet, pour l'Open Graph
"""
from pathlib import Path

from PIL import Image

FRONT = Path(__file__).resolve().parent.parent / "frontend"
SYMBOLE = FRONT / "public" / "PINK LOGO icon .png"
LOGO_COMPLET = FRONT / "public" / "PINK LOGOS.png"
BLANC = (255, 255, 255, 255)


def rogner(chemin: Path) -> Image.Image:
    im = Image.open(chemin).convert("RGBA")
    return im.crop(im.getbbox())


def placer(logo: Image.Image, largeur: int, hauteur: int, echelle: float, fond=None) -> Image.Image:
    """Logo centre, sa plus grande dimension occupant `echelle` du cadre."""
    ratio = min(largeur * echelle / logo.width, hauteur * echelle / logo.height)
    reduit = logo.resize((round(logo.width * ratio), round(logo.height * ratio)), Image.LANCZOS)
    cadre = Image.new("RGBA", (largeur, hauteur), fond or (255, 255, 255, 0))
    cadre.alpha_composite(reduit, ((largeur - reduit.width) // 2, (hauteur - reduit.height) // 2))
    return cadre


def carre(logo, cote, echelle, fond=None):
    return placer(logo, cote, cote, echelle, fond)


def silhouette(im: Image.Image) -> Image.Image:
    """Blanc sur transparent : format impose aux icones de notification Android."""
    blanc = Image.new("RGBA", im.size, BLANC)
    blanc.putalpha(im.getchannel("A"))
    return blanc


def enregistrer(im: Image.Image, relatif: str, opaque=False):
    chemin = FRONT / relatif
    chemin.parent.mkdir(parents=True, exist_ok=True)
    (im.convert("RGB") if opaque else im).save(chemin, optimize=True)
    print(f"{relatif:45} {im.width}x{im.height}")


def main():
    symbole = rogner(SYMBOLE)

    # Application native (Expo). iOS refuse la transparence ; la zone sure de
    # l'icone adaptative Android est le disque central de 66 %.
    enregistrer(carre(symbole, 1024, 0.72, BLANC), "assets/images/icon.png", opaque=True)
    enregistrer(carre(symbole, 1024, 0.58), "assets/images/adaptive-icon.png")
    enregistrer(carre(symbole, 1024, 1.0), "assets/images/splash-image.png")
    enregistrer(carre(symbole, 196, 0.92), "assets/images/favicon.png")
    enregistrer(silhouette(carre(symbole, 96, 0.84)), "assets/images/notification-icon.png")
    # Logo affiche dans l'application (composant Swirl).
    enregistrer(carre(symbole, 384, 1.0), "assets/images/logo.png")

    # Web / PWA.
    enregistrer(carre(symbole, 192, 0.9), "public/icones/icon-192.png")
    enregistrer(carre(symbole, 512, 0.9), "public/icones/icon-512.png")
    enregistrer(carre(symbole, 180, 0.76, BLANC), "public/icones/icon-180.png", opaque=True)
    enregistrer(carre(symbole, 192, 0.6, BLANC), "public/icones/maskable-192.png", opaque=True)
    enregistrer(carre(symbole, 512, 0.6, BLANC), "public/icones/maskable-512.png", opaque=True)
    enregistrer(silhouette(carre(symbole, 96, 0.84)), "public/icones/badge-96.png")
    enregistrer(carre(symbole, 32, 0.96), "public/icones/favicon-32.png")
    # Emails (affiche en 48 px, fourni en 3x).
    enregistrer(carre(symbole, 144, 1.0), "public/icones/email-logo.png")
    carre(symbole, 48, 0.96).save(FRONT / "public" / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
    print(f"{'public/favicon.ico':45} 16/32/48")

    # Open Graph : 1200x630 recommande par Facebook, LinkedIn, X et WhatsApp.
    enregistrer(placer(rogner(LOGO_COMPLET), 1200, 630, 0.72, BLANC), "public/og-image.png", opaque=True)


if __name__ == "__main__":
    main()
