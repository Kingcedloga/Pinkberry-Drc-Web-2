import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Line, Path } from "react-native-svg";

import { Swirl } from "@/src/components/Logo";
import { colors, fonts, poids, spacing, stylesDynamiques } from "@/src/theme";

/** Fines lignes décoratives dans le coin haut droit d'une zone illustration. */
export function MotifCoin({ couleur }: { couleur: string }) {
  return (
    <Svg width={120} height={120} viewBox="0 0 120 120" style={styles.motif}>
      {[0, 14, 28, 42, 56].map((d) => (
        <Line key={d} x1={60 + d} y1={-10} x2={120} y2={50 - d} stroke={couleur} strokeWidth={2} strokeLinecap="round" />
      ))}
    </Svg>
  );
}

/** Vague décorative qui sépare l'illustration de la zone du bas. */
export function Vague({ largeur, couleur }: { largeur: number; couleur: string }) {
  return (
    <Svg width={largeur} height={56} viewBox="0 0 390 56" preserveAspectRatio="none" style={styles.vague}>
      <Path d="M0 28 C 70 -12 150 46 230 22 C 300 2 350 12 390 30 L390 56 L0 56 Z" fill={couleur} />
    </Svg>
  );
}

/**
 * En-tête de marque centré : spirale + « pinkberry », fin trait, sous-titre « Livraison ».
 * `anime` fait tourner la spirale (écran de démarrage).
 */
export function EnteteMarque({
  taille = 34,
  anime = false,
  sousTitre = "Livraison",
}: {
  taille?: number;
  anime?: boolean;
  sousTitre?: string;
}) {
  const rotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!anime) return;
    const boucle = Animated.loop(
      Animated.timing(rotation, { toValue: 1, duration: 1100, easing: Easing.linear, useNativeDriver: true }),
    );
    boucle.start();
    return () => boucle.stop();
  }, [anime, rotation]);

  const tourne = rotation.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  return (
    <View style={styles.entete}>
      <View style={styles.marque}>
        <Animated.View style={anime ? { transform: [{ rotate: tourne }] } : undefined}>
          <Swirl taille={taille} couleur={colors.brandPrimary} />
        </Animated.View>
        <Text style={[styles.mot, { fontSize: taille * 0.76 }]}>Pinkberry</Text>
      </View>
      <View style={styles.trait} />
      <Text style={styles.sousMarque}>{sousTitre}</Text>
    </View>
  );
}

/** Carte blanche à coins arrondis occupant l'écran, commune aux écrans d'authentification. */
export function CarteAuth({ children, testID }: { children: React.ReactNode; testID?: string }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const largeur = Math.min(width - spacing.md * 2, 520);

  return (
    <View testID={testID} style={styles.ecran}>
      <View
        style={[
          styles.carte,
          { width: largeur, marginTop: insets.top + spacing.sm, marginBottom: insets.bottom + spacing.sm },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

const styles = stylesDynamiques(() => StyleSheet.create({
  motif: { position: "absolute", top: 0, right: 0, opacity: 0.35 },
  vague: { position: "absolute", left: 0, right: 0, bottom: -1 },
  entete: { alignItems: "center", paddingTop: spacing.xl, paddingBottom: spacing.md, gap: 6 },
  marque: { flexDirection: "row", alignItems: "center", gap: 8 },
  mot: { fontFamily: fonts.display, fontWeight: poids.fort, color: colors.brandPrimary },
  trait: { width: 54, height: 1, backgroundColor: colors.border, marginTop: 4 },
  sousMarque: {
    fontFamily: fonts.text,
    fontSize: 11,
    fontWeight: poids.fort,
    letterSpacing: 3,
    textTransform: "uppercase",
    color: colors.muted,
  },
  ecran: { flex: 1, alignItems: "center", backgroundColor: colors.surfaceSecondary, paddingHorizontal: spacing.md },
  carte: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 34,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
  },
}));
