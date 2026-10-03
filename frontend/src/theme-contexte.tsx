import React, { createContext, useContext, useEffect, useMemo } from "react";
import { Platform, useColorScheme } from "react-native";

import { useLangue, type ThemeChoisi } from "@/src/i18n";
import { appliquerScheme, setColorScheme, themes, type ColorScheme, type ThemeColors } from "@/src/theme";

type ThemeValue = {
  choix: ThemeChoisi;
  scheme: ColorScheme;
  colors: ThemeColors;
  changerTheme: (choix: ThemeChoisi) => Promise<void>;
};

const ThemeContext = createContext<ThemeValue | null>(null);

/**
 * Applique le thème choisi (clair / sombre / système) à toute l'application.
 * La palette active est posée avant le rendu des enfants : `colors` et les
 * feuilles créées avec `stylesDynamiques` suivent automatiquement.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { prefs, enregistrerPrefs } = useLangue();
  const systeme = useColorScheme();
  const choix = prefs.theme ?? "systeme";

  const scheme: ColorScheme =
    choix === "systeme" ? ((systeme as ColorScheme) ?? "light") : choix === "sombre" ? "dark" : "light";

  // Pendant le rendu : les enfants doivent voir la bonne palette immédiatement.
  appliquerScheme(scheme);

  useEffect(() => {
    // Aligne les composants natifs (clavier, sélecteurs, barre de statut).
    setColorScheme(choix === "systeme" ? null : scheme);
  }, [choix, scheme]);

  useEffect(() => {
    // Web / PWA : barres système (status bar, barre d'adresse) de la couleur de
    // l'en-tête, y compris quand le thème est forcé contre celui de l'appareil.
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    const surface = themes[scheme].surface;
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", surface));
    document.documentElement.style.colorScheme = scheme;
    document.documentElement.style.backgroundColor = themes[scheme].surfaceSecondary;
  }, [scheme]);

  const value = useMemo<ThemeValue>(
    () => ({
      choix,
      scheme,
      colors: themes[scheme],
      changerTheme: (suivant: ThemeChoisi) => enregistrerPrefs({ theme: suivant }),
    }),
    [choix, scheme, enregistrerPrefs],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/**
 * À appeler dans chaque écran : abonne l'écran au thème pour qu'il se
 * redessine quand l'utilisateur bascule clair / sombre.
 */
export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme doit être utilisé dans ThemeProvider");
  return ctx;
}
