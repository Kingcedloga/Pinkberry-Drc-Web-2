import { useTranslation } from "react-i18next";

/**
 * Libellés du catalogue saisis par l'admin. Le français (`nom`, `categorie`,
 * `taille`…) fait foi et sert d'identifiant ; le backend stocke l'anglais à côté
 * (`nomEn`, `descriptionEn`, `categorieEn`, `tailleEn`). Repli sur le français
 * quand la traduction manque.
 *
 * `const libelle = useLibelle();` puis `libelle(produit.nom, produit.nomEn)`.
 */
export function useLibelle() {
  const { i18n } = useTranslation();
  const anglais = i18n.language === "en";
  return (fr: string | null | undefined, en?: string | null) => (anglais && en?.trim()) || fr || "";
}

type LigneAffichee = {
  taille?: string | null;
  tailleEn?: string | null;
  contenant?: string | null;
  contenantEn?: string | null;
  garnitures?: { nom: string; nomEn?: string | null }[];
};

/**
 * Détail d'un article de panier ou de commande dans la langue de l'interface :
 * `options` → « Régulière · Cornet gaufré », `garnitures` → « Brownie, Miel… ».
 */
export function useDetailLigne() {
  const libelle = useLibelle();
  return {
    options: (l: LigneAffichee) =>
      [libelle(l.taille, l.tailleEn), libelle(l.contenant, l.contenantEn)].filter(Boolean).join(" · "),
    garnitures: (l: LigneAffichee) => (l.garnitures ?? []).map((g) => libelle(g.nom, g.nomEn)).join(", "),
  };
}
