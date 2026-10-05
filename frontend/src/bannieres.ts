import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/src/api";

/**
 * Bannières de l'accueil (affiches), gérées par l'admin. Format unique imposé :
 * ratio 3:1, 1200 × 400 px recommandé. Le serveur recadre au ratio exact et
 * stocke deux variantes : `imageUrl` (1800 × 600) et `imageMobileUrl` (1200 × 400).
 */
export const RATIO_BANNIERE = 3;
export const FORMAT_RECOMMANDE = { largeur: 1200, hauteur: 400 };

export type PositionTexte = "gauche" | "centre" | "droite";
export type TypeLien = "produit" | "categorie" | "promotion";

export type LienBanniere = {
  type: TypeLien;
  valeur: string;
  // Lien vers une promotion : de quoi l'appliquer ou la mettre en avant au clic.
  code?: string | null;
  automatique?: boolean;
  cible?: string | null;
  cibleValeur?: string | null;
  disponible?: boolean;
};

export type Banniere = {
  id: string;
  imageUrl?: string | null;
  imageMobileUrl?: string | null;
  titre?: string | null;
  titreEn?: string | null;
  sousTitre?: string | null;
  sousTitreEn?: string | null;
  couleurTexte: string;
  positionTexte: PositionTexte;
  lien?: LienBanniere | null;
  actif: boolean;
  ordre: number;
  dateDebut?: string | null;
  dateFin?: string | null;
  statut?: "active" | "programmee" | "expiree" | "desactivee";
};

/** Bannières en cours (accueil client). */
export function useBannieres() {
  return useQuery({
    queryKey: ["bannieres"],
    queryFn: () => apiFetch<Banniere[]>("/bannieres"),
    staleTime: 60_000,
  });
}
