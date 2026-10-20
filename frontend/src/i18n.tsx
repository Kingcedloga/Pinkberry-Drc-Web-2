import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import i18n from "i18next";
import { Platform } from "react-native";
import { initReactI18next, useTranslation } from "react-i18next";

import { apiFetch } from "@/src/api";
import { useAuth } from "@/src/auth";
import { CLE_LANGUE, CLE_LANGUE_HORS_CONNEXION, CLE_THEME } from "@/src/prefs";
import { storage } from "@/src/utils/storage";
import fr from "@/src/locales/fr.json";
import en from "@/src/locales/en.json";

export type Langue = "fr" | "en";

const estLangue = (v: unknown): v is Langue => v === "fr" || v === "en";

/**
 * Langue du tout premier rendu, lue de façon synchrone (pas de flash FR puis
 * EN au chargement) : choix enregistré sur cet appareil, sinon langue de
 * l'appareil (anglais si elle commence par « en »), sinon français.
 */
function langueInitiale(): Langue {
  if (Platform.OS === "web" && typeof localStorage !== "undefined") {
    try {
      const enregistree = JSON.parse(localStorage.getItem(CLE_LANGUE) ?? "null");
      if (estLangue(enregistree)) return enregistree;
    } catch {
      /* stockage illisible : langue de l'appareil */
    }
  }
  try {
    const appareil =
      (typeof navigator !== "undefined" && navigator.language) || Intl.DateTimeFormat().resolvedOptions().locale;
    return appareil?.toLowerCase().startsWith("en") ? "en" : "fr";
  } catch {
    return "fr";
  }
}

i18n.use(initReactI18next).init({
  resources: { fr: { translation: fr }, en: { translation: en } },
  lng: langueInitiale(),
  supportedLngs: ["fr", "en"],
  fallbackLng: "fr",
  // Clé absente : jamais de « section.cle » brut à l'écran (le dernier segment au pire),
  // et un avertissement en développement pour la corriger.
  parseMissingKeyHandler: (cle) => cle.split(".").pop() ?? cle,
  saveMissing: __DEV__,
  missingKeyHandler: (_lngs, _ns, cle) => console.warn(`[i18n] clé manquante : ${cle}`),
  returnEmptyString: false,
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});

// Web : <html lang> suit la langue (lecteurs d'écran, traduction automatique du navigateur).
const synchroniserHtml = (l: string) => {
  if (typeof document !== "undefined") document.documentElement.lang = l;
};
synchroniserHtml(i18n.language);
i18n.on("languageChanged", synchroniserHtml);

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

/**
 * Une seule règle de priorité pour la langue :
 * 1. Compte connecté : ses préférences font foi, sur tous les appareils…
 * 2. …sauf si la personne vient de choisir une langue avant de se connecter :
 *    ce choix explicite l'emporte et est enregistré sur son compte.
 * 3. Hors connexion : choix enregistré sur l'appareil, sinon langue de l'appareil.
 */
export function LangueProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<Preferences>(() => ({ ...PREFS_DEFAUT, langue: i18n.language as Langue }));
  // Les préférences du compte arrivent : la lecture locale, plus lente, ne doit plus les écraser.
  const compteApplique = useRef(false);

  const appliquerLangue = useCallback((langue: Langue) => {
    if (i18n.language !== langue) void i18n.changeLanguage(langue);
    void storage.setItem(CLE_LANGUE, langue);
  }, []);

  // Choix local (thème ; langue sur mobile, où le stockage ne se lit pas de façon synchrone).
  useEffect(() => {
    (async () => {
      const [locale, theme] = await Promise.all([
        storage.getItem<string>(CLE_LANGUE, ""),
        storage.getItem<string>(CLE_THEME, ""),
      ]);
      if (compteApplique.current) return;
      const langue = estLangue(locale) ? locale : (i18n.language as Langue);
      if (i18n.language !== langue) await i18n.changeLanguage(langue);
      setPrefs((p) => ({
        ...p,
        langue,
        theme: theme === "clair" || theme === "sombre" || theme === "systeme" ? (theme as ThemeChoisi) : p.theme,
      }));
    })();
  }, []);

  // Compte connecté : ses préférences font foi (sauf choix fait juste avant la connexion).
  useEffect(() => {
    const distantes = (user as any)?.preferences as Preferences | undefined;
    if (!distantes) {
      compteApplique.current = false;
      return;
    }
    compteApplique.current = true;
    let suivantes: Preferences = { ...PREFS_DEFAUT, ...distantes };
    (async () => {
      const choixHorsConnexion = await storage.getItem<string>(CLE_LANGUE_HORS_CONNEXION, "");
      if (estLangue(choixHorsConnexion)) {
        void storage.removeItem(CLE_LANGUE_HORS_CONNEXION);
        if (choixHorsConnexion !== suivantes.langue) {
          suivantes = { ...suivantes, langue: choixHorsConnexion };
          apiFetch("/auth/preferences", { method: "PUT", body: suivantes }).catch(() => undefined);
        }
      }
      appliquerLangue(suivantes.langue);
      setPrefs(suivantes);
      void storage.setItem(CLE_THEME, suivantes.theme ?? "systeme");
    })();
  }, [user, appliquerLangue]);

  const enregistrerPrefs = useCallback(
    async (maj: Partial<Preferences>) => {
      const suivantes = { ...prefs, ...maj };
      appliquerLangue(suivantes.langue);
      setPrefs(suivantes);
      await storage.setItem(CLE_THEME, suivantes.theme);
      if (user) await apiFetch("/auth/preferences", { method: "PUT", body: suivantes });
      // Hors connexion : retenu pour l'appliquer au compte à la prochaine connexion.
      else if (maj.langue) await storage.setItem(CLE_LANGUE_HORS_CONNEXION, maj.langue);
    },
    [prefs, user, appliquerLangue],
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

/** Raccourci : `const t = useT();` puis `t("params.titre")`. Fonction stable tant que la langue ne change pas. */
export function useT() {
  const { t } = useTranslation();
  return useCallback((cle: CleTexte, vars?: Record<string, string | number>) => String(t(cle, vars)), [t]);
}
