import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { colors, fonts, stylesDynamiques } from "@/src/theme";

/**
 * Marque Pinkberry : spirale (yogourt glacé) surmontée de deux feuilles,
 * suivie du mot « pinkberry » en minuscules.
 */
function cheminSpirale(cx: number, cy: number, rMax: number, tours = 3.2) {
  const pas = 0.12;
  const total = tours * 2 * Math.PI;
  const pts: string[] = [];
  for (let t = 0; t <= total; t += pas) {
    const r = (t / total) * rMax;
    const x = cx + r * Math.cos(t - Math.PI / 2);
    const y = cy + r * Math.sin(t - Math.PI / 2);
    pts.push(`${x.toFixed(2)},${y.toFixed(2)}`);
  }
  return `M ${pts.join(" L ")}`;
}

export function Swirl({ taille = 32, couleur = colors.brandPrimary }: { taille?: number; couleur?: string }) {
  const spirale = useMemo(() => cheminSpirale(50, 58, 38), []);
  return (
    <Svg width={taille} height={taille} viewBox="0 0 100 100">
      {/* spirale */}
      <Path d={spirale} stroke={couleur} strokeWidth={7} fill="none" strokeLinecap="round" />
      {/* tige */}
      <Path d="M 56 20 C 56 12 58 6 60 2" stroke={couleur} strokeWidth={5} fill="none" strokeLinecap="round" />
      {/* feuille gauche */}
      <Path d="M 57 18 C 46 16 38 8 38 0 C 50 0 57 8 57 18 Z" fill={couleur} />
      {/* feuille droite */}
      <Path d="M 60 18 C 70 18 80 12 84 4 C 72 2 62 8 60 18 Z" fill={couleur} />
    </Svg>
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
      <Swirl taille={taille * 1.35} couleur={couleur} />
      <Text style={[styles.mot, { fontSize: taille, color: couleur }]}>Pinkberry</Text>
    </View>
  );
}

const styles = stylesDynamiques(() => StyleSheet.create({
  ligne: { flexDirection: "row", alignItems: "center", gap: 7 },
  mot: { fontFamily: fonts.display, letterSpacing: -0.5 },
}));
