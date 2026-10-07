import { useTranslation } from "react-i18next";

/**
 * Pages légales (FR / EN) : le contenu vit dans `src/locales/{fr,en}.json`
 * (`legal.confidentialite`, `legal.conditions`), utilisé par `PageLegale`.
 */
export type SectionLegale = { titre: string; paragraphes: string[] };
export type DocLegal = { titre: string; sousTitre: string; sections: SectionLegale[] };
export type DocumentLegal = "confidentialite" | "conditions";

/** Document légal dans la langue de l'interface. */
export function useDocLegal(document: DocumentLegal): DocLegal {
  const { t } = useTranslation();
  return t(`legal.${document}`, { returnObjects: true }) as DocLegal;
}
