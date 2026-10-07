import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import i18n from "i18next";
import { initReactI18next, useTranslation } from "react-i18next";

import { apiFetch } from "@/src/api";
import { useAuth } from "@/src/auth";
import { CLE_LANGUE, CLE_THEME } from "@/src/prefs";
import { storage } from "@/src/utils/storage";
import fr from "@/src/locales/fr.json";
import en from "@/src/locales/en.json";

export type Langue = "fr" | "en";

i18n.use(initReactI18next).init({
  resources: { fr: { translation: fr }, en: { translation: en } },
  lng: "fr",
  fallbackLng: "fr",
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});

// Web : <html lang> suit la langue choisie (lecteurs d'écran, traduction du navigateur).
i18n.on("languageChanged", (lng) => {
  if (typeof document !== "undefined") document.documentElement.lang = lng;
});

// Web : l'attribut lang de la page suit la langue (lecteurs d'écran, traduction auto).
i18n.on("languageChanged", (l) => {
  if (typeof document !== "undefined") document.documentElement.lang = l;
});

/**
 * Les traductions vivent dans `src/locales/{fr,en}.json` (source unique). Pour
 * traduire un nouvel écran : ajouter les clés dans les deux fichiers puis
 * remplacer les textes par `t("ma.cle")`. Variables : `{{nom}}`.
 */
export type CleTexte = string;

/** Valeurs d'une adresse pour les clés `commun.adresse*` (format FR / EN). */
export function champsAdresse(a?: { avenue?: string; numero?: string; commune?: string; repere?: string } | null) {
  return { avenue: a?.avenue ?? "", numero: a?.numero ?? "", commune: a?.commune ?? "", repere: a?.repere ?? "" };
}

/** Noms d'adresse prédéfinis : enregistrés en français, affichés dans la langue de l'interface. */
const NOMS_ADRESSE: Record<string, CleTexte> = { Maison: "adresse.maison", Bureau: "adresse.bureau", Autre: "adresse.autre" };
export function cleNomAdresse(label?: string | null): CleTexte | null {
  return (label && NOMS_ADRESSE[label]) || null;
}

export type ThemeChoisi = "clair" | "sombre" | "systeme";

export type Preferences = {
  langue: Langue;
  theme: ThemeChoisi;
  notifSuivi: boolean;
  notifPromos: boolean;
  notifNouveautes: boolean;
  /** Admin : nouvelles commandes et annulations. */
  notifCommandes: boolean;
  /** Livreur : courses assignées. */
  notifCourses: boolean;
};

export const PREFS_DEFAUT: Preferences = {
  langue: "fr",
  theme: "systeme",
  notifSuivi: true,
  notifPromos: true,
  notifNouveautes: true,
  notifCommandes: true,
  notifCourses: true,
};

type LangueValue = {
  prefs: Preferences;
  langue: Langue;
  t: (cle: CleTexte, vars?: Record<string, string | number>) => string;
  enregistrerPrefs: (maj: Partial<Preferences>) => Promise<void>;
};

const LangueContext = createContext<LangueValue | null>(null);

export function LangueProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<Preferences>(PREFS_DEFAUT);

  // 1. Reprise immédiate du choix local (avant même la connexion).
  useEffect(() => {
    (async () => {
      const locale = await storage.getItem<string>(CLE_LANGUE, "");
      const theme = await storage.getItem<string>(CLE_THEME, "");
      const langue = locale === "fr" || locale === "en" ? locale : "fr";
      await i18n.changeLanguage(langue);
      setPrefs((p) => ({
        ...p,
        langue,
        theme:
          theme === "clair" || theme === "sombre" || theme === "systeme" ? (theme as ThemeChoisi) : p.theme,
      }));
    })();
  }, []);

  // 2. Les préférences du compte font foi dès qu'on connaît l'utilisateur.
  useEffect(() => {
    const distantes = (user as any)?.preferences as Preferences | undefined;
    if (distantes) {
      const suivantes = { ...PREFS_DEFAUT, ...distantes };
      void i18n.changeLanguage(suivantes.langue);
      setPrefs(suivantes);
      storage.setItem(CLE_LANGUE, distantes.langue ?? "fr");
      storage.setItem(CLE_THEME, distantes.theme ?? "systeme");
    }
  }, [user]);

  const enregistrerPrefs = useCallback(
    async (maj: Partial<Preferences>) => {
      const suivantes = { ...prefs, ...maj };
      await i18n.changeLanguage(suivantes.langue);
      setPrefs(suivantes);
      await storage.setItem(CLE_LANGUE, suivantes.langue);
      await storage.setItem(CLE_THEME, suivantes.theme);
      if (user) await apiFetch("/auth/preferences", { method: "PUT", body: suivantes });
    },
    [prefs, user],
  );

  const value = useMemo<LangueValue>(
    () => ({
      prefs,
      langue: prefs.langue,
      t: (cle: CleTexte, vars?: Record<string, string | number>) => String(i18n.t(cle, vars)),
      enregistrerPrefs,
    }),
    [prefs, enregistrerPrefs],
  );

  return <LangueContext.Provider value={value}>{children}</LangueContext.Provider>;
}

export function useLangue(): LangueValue {
  const ctx = useContext(LangueContext);
  if (!ctx) throw new Error("useLangue doit être utilisé dans LangueProvider");
  return ctx;
}

/** Raccourci : `const t = useT();` puis `t("params.titre")`. */
export function useT() {
  const { t } = useTranslation();
  return (cle: CleTexte, vars?: Record<string, string | number>) => String(t(cle, vars));
}
