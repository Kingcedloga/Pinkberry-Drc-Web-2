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
