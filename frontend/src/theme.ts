// Design tokens Pinkberry Drc — thèmes clair et sombre.
// Les clés correspondent au bloc "color" de /app/design_guidelines.json.

import { useMemo } from "react";
import { Appearance, StyleSheet, useColorScheme, type ImageStyle, type TextStyle, type ViewStyle } from "react-native";

export type ColorScheme = "light" | "dark";

const light = {
  // Surfaces
  surface: "#FFFFFF",
  onSurface: "#2A1721",
  surfaceSecondary: "#FBF6F9",
  onSurfaceSecondary: "#2A1721",
  surfaceTertiary: "#FCE4EF",
  onSurfaceTertiary: "#E6156F",
  surfaceInverse: "#2A1721",
  onSurfaceInverse: "#FFFFFF",
  muted: "#9A8E94",

  // Marque
  brand: "#E6156F",
  onBrand: "#FFFFFF",
  brandPrimary: "#E6156F",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#B60E56",
  onBrandSecondary: "#FFFFFF",
  brandTertiary: "#FCE4EF",
  onBrandTertiary: "#E6156F",

  // Statuts
  success: "#8DC63F",
  onSuccess: "#FFFFFF",
  warning: "#F5A623",
  onWarning: "#FFFFFF",
  error: "#D0021B",
  onError: "#FFFFFF",
  info: "#8DC63F",
  onInfo: "#FFFFFF",

  // Lignes
  border: "#F0E6EB",
  borderStrong: "#E6156F",
  divider: "#F0E6EB",

  // Extras Pinkberry
  shadowPink: "#E6156F",
  successSoft: "#EEF7E0",
  errorSoft: "#FDE8EA",
};

export type ThemeColors = typeof light;


// Thème sombre : mêmes clés, fonds profonds, accents rose/vert conservés.
const dark: ThemeColors = {
  surface: "#241820",
  onSurface: "#F7EFF3",
  surfaceSecondary: "#1A1016",
  onSurfaceSecondary: "#F7EFF3",
  surfaceTertiary: "#3A2130",
  onSurfaceTertiary: "#FF7FB2",
  surfaceInverse: "#F7EFF3",
  onSurfaceInverse: "#1A1016",
  muted: "#A9949F",

  brand: "#E6156F",
  onBrand: "#FFFFFF",
  brandPrimary: "#E6156F",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#FF4D93",
  onBrandSecondary: "#FFFFFF",
  brandTertiary: "#3A2130",
  onBrandTertiary: "#FF7FB2",

  success: "#8DC63F",
  onSuccess: "#14200A",
  warning: "#F5A623",
  onWarning: "#20160A",
  error: "#FF5A6E",
  onError: "#2A0A0E",
  info: "#8DC63F",
  onInfo: "#14200A",

  border: "#3A2B34",
  borderStrong: "#E6156F",
  divider: "#3A2B34",

  shadowPink: "#000000",
  successSoft: "#243016",
  errorSoft: "#3A1620",
};

export const defaultScheme = "light" satisfies ColorScheme;

export const themes: { light: ThemeColors; dark: ThemeColors } = { light, dark };

/** Palette active. Modifiée par le ThemeProvider (src/theme-contexte.tsx). */
let schemeActif: ColorScheme = defaultScheme;

export function schemeActuel(): ColorScheme {
  return schemeActif;
}

export function appliquerScheme(scheme: ColorScheme) {
  schemeActif = scheme;
}

/** `null` = suivre l'appareil. Android plante sur `null` : on envoie "unspecified". */
export function setColorScheme(scheme: ColorScheme | null) {
  Appearance.setColorScheme?.(scheme ?? "unspecified");
}

export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  const system = useColorScheme();
  const scheme: ColorScheme = schemeActif ?? (system as ColorScheme) ?? defaultScheme;
  return { scheme, colors: themes[scheme] };
}

/**
 * `colors` résout la couleur au moment de la lecture : les styles créés via
 * `stylesDynamiques` et les usages en ligne suivent donc le thème actif.
 */
export const colors: ThemeColors = new Proxy({} as ThemeColors, {
  get: (_cible, cle: string) => (themes[schemeActif] as any)[cle],
  has: (_cible, cle: string) => cle in themes.light,
  ownKeys: () => Reflect.ownKeys(themes.light),
  getOwnPropertyDescriptor: (_cible, cle: string) => ({
    value: (themes[schemeActif] as any)[cle],
    enumerable: true,
    configurable: true,
  }),
});

/**
 * Feuille de styles recalculée (et mise en cache) pour chaque thème.
 * Usage : `const styles = stylesDynamiques(() => StyleSheet.create({ ... }));`
 */
export function stylesDynamiques<T extends Record<string, any>>(fabrique: () => T): T {
  const cache: Partial<Record<ColorScheme, T>> = {};
  const resoudre = (): T => {
    const scheme = schemeActif;
    if (!cache[scheme]) cache[scheme] = fabrique();
    return cache[scheme] as T;
  };
  return new Proxy({} as T, {
    get: (_cible, cle: string) => (resoudre() as any)[cle],
    has: (_cible, cle: string) => cle in (resoudre() as any),
    ownKeys: () => Reflect.ownKeys(resoudre() as any),
    getOwnPropertyDescriptor: (_cible, cle: string) => ({
      value: (resoudre() as any)[cle],
      enumerable: true,
      configurable: true,
    }),
  });
}

/** Remplace StyleSheet.NamedStyles, retiré des types de React Native 0.88. */
type StylesNommes = { readonly [cle: string]: ViewStyle | TextStyle | ImageStyle };

export function makeStyles<T extends StylesNommes>(factory: (colors: ThemeColors) => T): () => T {
  return function useStyles(): T {
    const { colors: c } = useTheme();
    return useMemo(() => StyleSheet.create(factory(c)), [c]);
  };
}

// Tokens de mise en page (design_guidelines.json)
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 };
export const radius = { sm: 8, md: 16, lg: 20, xl: 24, pill: 999 };

export const fonts = { display: "Fredoka", text: "Nunito" };

// Poids typographiques (interface volontairement affirmée)
export const poids = { corps: "600", titre: "700", fort: "800" } as const;

export const softShadow = {
  shadowColor: "#2A1721",
  shadowOpacity: 0.14,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: 8 },
  elevation: 4,
};
