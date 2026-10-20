import { Platform } from "react-native";
import { useTranslation } from "react-i18next";

/** Adresse publique du site, pour les liens cités dans les textes (ex. suppression de compte). */
export function adresseSite(): string {
  if (Platform.OS === "web" && typeof window !== "undefined") return window.location.origin;
  return (process.env.EXPO_PUBLIC_BACKEND_URL ?? "").replace(/\/$/, "");
}

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
  return t(`legal.${document}`, { returnObjects: true, site: adresseSite() }) as DocLegal;
}
