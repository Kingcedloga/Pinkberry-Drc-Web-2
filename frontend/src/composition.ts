import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/src/api";

/**
 * Composition du frozen yogurt : tailles (prix de base + supplément garnitures),
 * récipients, catégories de garnitures et règle de sélection, gérés par l'admin.
 * Montants en FC.
 */
export type Libelle = { nom: string; nomEn?: string | null };
export type TailleYogourt = Libelle & { id: string; prixBase: number; supplementGarnitures: number };
export type Contenant = Libelle & { id: string; disponible: boolean };
export type GarnitureYogourt = Libelle & { id: string; categorieId: string; disponible: boolean };
export type CategorieGarnitures = Libelle & {
  id: string;
  disponible: boolean;
  ordre: number;
  /** Garnitures à choisir exactement dans cette catégorie (3 sèches + 3 fruits par défaut). */
  nombre: number;
  garnitures: GarnitureYogourt[];
};
export type Composition = {
  tailles: TailleYogourt[];
  contenants: Contenant[];
  categories: CategorieGarnitures[];
  /** Total à choisir (somme des catégories proposées). */
  regle: { total: number };
};

/** Composition publique : éléments disponibles uniquement. */
export function useComposition() {
  return useQuery({
    queryKey: ["composition"],
    queryFn: () => apiFetch<Composition>("/composition"),
    staleTime: 30_000,
  });
}

/** Prix d'appel d'un frozen yogurt : la taille la moins chère, sans garniture. */
export function prixDes(c?: Composition | null): number {
  return c?.tailles.length ? Math.min(...c.tailles.map((t) => t.prixBase)) : 0;
}

/**
 * Sélection au regard de la règle : exactement `nombre` garnitures dans chaque
 * catégorie. `peutAjouter` empêche d'en prendre une de plus dans une catégorie
 * pleine ; `manquantes` liste ce qu'il reste à choisir, catégorie par catégorie.
 */
export function evaluerSelection(choisies: GarnitureYogourt[], categories: CategorieGarnitures[]) {
  const parCategorie = categories.map((c) => {
    const n = choisies.filter((g) => g.categorieId === c.id).length;
    return { categorie: c, n, requis: c.nombre, plein: n >= c.nombre, ok: n === c.nombre };
  });
  const etat = new Map(parCategorie.map((x) => [x.categorie.id, x]));
  return {
    parCategorie,
    nb: choisies.length,
    valide: parCategorie.every((x) => x.ok),
    manquantes: parCategorie.filter((x) => x.n < x.requis).map((x) => ({ categorie: x.categorie, n: x.requis - x.n })),
    peutAjouter: (g: GarnitureYogourt) => !etat.get(g.categorieId)?.plein,
  };
}
