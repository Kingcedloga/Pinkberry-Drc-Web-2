// Points de rupture et helpers responsive (mobile → tablette → bureau).
// L'app est une web app responsive : la mise en page suit la largeur réelle
// de la fenêtre, sans jamais figer un « écran de téléphone ».

import { useWindowDimensions } from "react-native";

export const RUPTURES = { sm: 480, md: 768, lg: 1024, xl: 1440 } as const;

/** Colonne étroite (authentification, saisie courte). */
export const LARGEUR_ETROITE = { width: "100%", maxWidth: 520, alignSelf: "center" } as const;
/** Contenu lisible centré (formulaires, listes simples, suivi). */
export const LARGEUR_CONTENU = { width: "100%", maxWidth: 760, alignSelf: "center" } as const;
/** Contenu large (catalogue client, tableaux back office). */
export const LARGEUR_LARGE = { width: "100%", maxWidth: 1280, alignSelf: "center" } as const;
/** Grille produits client. */
export const LARGEUR_GRILLE = { width: "100%", maxWidth: 1160, alignSelf: "center" } as const;
/** Feuilles / modales : jamais plus larges qu'une boîte de dialogue. */
export const LARGEUR_FEUILLE = { width: "100%", maxWidth: 640, alignSelf: "center" } as const;

export type Ecran = {
  largeur: number;
  hauteur: number;
  mobile: boolean;
  tablette: boolean;
  bureau: boolean;
  large: boolean;
  /** Nombre de colonnes conseillé pour une grille de cartes. */
  colonnes: number;
};

export function useEcran(): Ecran {
  const { width, height } = useWindowDimensions();
  const mobile = width < RUPTURES.md;
  const tablette = width >= RUPTURES.md && width < RUPTURES.lg;
  const bureau = width >= RUPTURES.lg;
  const large = width >= RUPTURES.xl;
  const colonnes = large ? 4 : bureau ? 3 : tablette ? 2 : 1;
  return { largeur: width, hauteur: height, mobile, tablette, bureau, large, colonnes };
}

/**
 * Complète la dernière rangée d'une grille avec des cellules invisibles pour que
 * les cartes conservent leur largeur (FlatList + numColumns).
 */
export function completerGrille<T extends { id: string }>(items: T[], colonnes: number): T[] {
  if (colonnes <= 1) return items;
  const reste = items.length % colonnes;
  if (reste === 0) return items;
  const bouchons = Array.from({ length: colonnes - reste }, (_, i) => ({ id: `vide-${i}`, vide: true }));
  return [...items, ...(bouchons as unknown as T[])];
}
