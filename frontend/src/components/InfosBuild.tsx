import Constants from "expo-constants";
import React from "react";
import { StyleSheet, Text } from "react-native";

import { colors, fonts, spacing, stylesDynamiques } from "@/src/theme";
import { useTheme } from "@/src/theme-contexte";

/**
 * Empreinte du build, figée à la compilation : permet de vérifier qu'un APK de
 * test et un AAB publié viennent du même code et appellent la même API.
 */
export function InfosBuild() {
  useTheme();
  const config = Constants.expoConfig;
  const build = (config?.extra?.build ?? {}) as { commit?: string; date?: string; profil?: string };
  const api = (process.env.EXPO_PUBLIC_BACKEND_URL ?? "").replace(/^https?:\/\//, "") || "API non définie";
  const versionCode = config?.android?.versionCode;
  const lignes = [
    `v${config?.version ?? "?"}${versionCode ? ` (${versionCode})` : ""} · ${build.commit ?? "?"} · ${build.profil ?? "?"}${__DEV__ ? " · debug" : ""}`,
    `${build.date ?? ""} · ${api}`,
  ];
  return (
    <Text testID="infos-build" selectable style={styles.texte}>
      {lignes.join("\n")}
    </Text>
  );
}

const styles = stylesDynamiques(() =>
  StyleSheet.create({
    texte: {
      fontFamily: fonts.text,
      fontSize: 11,
      lineHeight: 16,
      color: colors.muted,
      textAlign: "center",
      marginTop: spacing.md,
    },
  }),
);
