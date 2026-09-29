import { Image } from "expo-image";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors, fonts, stylesDynamiques } from "@/src/theme";

// Symbole officiel (spirale + feuilles), généré par scripts/gen_icones.py.
const SYMBOLE = require("@/assets/images/logo.png");

/**
 * Marque Pinkberry : le symbole du logo, suivi du mot « Pinkberry ».
 */
export function Swirl({ taille = 32 }: { taille?: number }) {
  return (
    <Image
      source={SYMBOLE}
      style={{ width: taille, height: taille }}
      contentFit="contain"
      accessibilityIgnoresInvertColors
    />
  );
}

export function Logo({
  taille = 28,
  couleur = colors.brandPrimary,
  testID = "logo-pinkberry",
}: {
  taille?: number;
  couleur?: string;
  testID?: string;
}) {
  return (
    <View testID={testID} style={styles.ligne}>
      <Swirl taille={taille * 1.35} />
      <Text style={[styles.mot, { fontSize: taille, color: couleur }]}>Pinkberry</Text>
    </View>
  );
}

const styles = stylesDynamiques(() => StyleSheet.create({
  ligne: { flexDirection: "row", alignItems: "center", gap: 7 },
  mot: { fontFamily: fonts.display, letterSpacing: -0.5 },
}));
