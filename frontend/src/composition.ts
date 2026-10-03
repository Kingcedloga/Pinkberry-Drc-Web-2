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
  garnitures: GarnitureYogourt[];
};
export type RegleGarnitures = { nombre: number; categoriesMin: number; categoriesMax: number };
export type Composition = {
  tailles: TailleYogourt[];
  contenants: Contenant[];
  categories: CategorieGarnitures[];
  regle: RegleGarnitures;
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
 * Sélection au regard de la règle. Sans garniture, elle est valide ; avec, il
 * faut exactement `nombre` garnitures sur `categoriesMin` à `categoriesMax`
 * catégories. `peutAjouter` empêche la 7ᵉ garniture et une catégorie de trop.
 */
export function evaluerSelection(choisies: GarnitureYogourt[], regle: RegleGarnitures) {
  const categories = new Set(choisies.map((g) => g.categorieId));
  const complet = choisies.length === regle.nombre;
  const categoriesOk = categories.size >= regle.categoriesMin && categories.size <= regle.categoriesMax;
  return {
    nb: choisies.length,
    nbCategories: categories.size,
    complet,
    valide: complet && categoriesOk,
    peutAjouter: (g: GarnitureYogourt) =>
      choisies.length < regle.nombre && (categories.has(g.categorieId) || categories.size < regle.categoriesMax),
    categoriesPleines: categories.size >= regle.categoriesMax,
  };
}
