// Design tokens Pinkberry Drc — thème clair uniquement.
// Les clés correspondent au bloc "color" de /app/design_guidelines.json.

import { useMemo } from "react";
import { Appearance, StyleSheet, useColorScheme } from "react-native";

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

export const defaultScheme = "light" satisfies ColorScheme;

export const themes: { light: ThemeColors; dark?: ThemeColors } = { light };

export function setColorScheme(scheme: ColorScheme | null) {
  Appearance.setColorScheme?.(scheme);
}

setColorScheme?.(themes.dark ? null : defaultScheme);

export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  const system = useColorScheme();
  const scheme: ColorScheme = system && themes[system] ? system : defaultScheme;
  return { scheme, colors: themes[scheme] ?? themes.light };
}

export const colors = light;

export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ThemeColors) => T & StyleSheet.NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    const { colors: c } = useTheme();
    return useMemo(() => StyleSheet.create(factory(c)), [c]);
  };
}

// Tokens de mise en page (design_guidelines.json)
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 };
export const radius = { sm: 8, md: 16, lg: 20, xl: 24, pill: 999 };

export const fonts = { display: "Fredoka", text: "Nunito" };

export const softShadow = {
  shadowColor: light.shadowPink,
  shadowOpacity: 0.16,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: 8 },
  elevation: 4,
};
