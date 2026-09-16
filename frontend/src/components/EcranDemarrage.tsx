import { Image } from "expo-image";
import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View, useWindowDimensions } from "react-native";

import { EnteteMarque, MotifCoin, Vague } from "@/src/components/DecorAuth";
import { colors, fonts, poids, spacing, stylesDynamiques } from "@/src/theme";

const HERO = require("@/assets/images/livreur-pinkberry-v2.webp");

/**
 * Écran de démarrage : même mise en page que la page Bienvenue (carte arrondie, logo
 * animé, illustration sur aplat rose, vague) affichée pendant le chargement de l'app.
 * N'utilise pas les safe-area insets : il est rendu avant les providers.
 */
export function EcranDemarrage({ testID = "ecran-demarrage" }: { testID?: string }) {
  const { width } = useWindowDimensions();
  const flotte = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = (toValue: number) =>
      Animated.timing(flotte, { toValue, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true });
    const boucle = Animated.loop(Animated.sequence([anim(1), anim(0)]));
    boucle.start();
    return () => boucle.stop();
  }, [flotte]);

  const monte = flotte.interpolate({ inputRange: [0, 1], outputRange: [8, -12] });
  const largeurCarte = Math.min(width - spacing.md * 2, 520);
  const largeurHero = largeurCarte * 1.24;

  return (
    <View testID={testID} style={styles.ecran}>
      <View style={[styles.carte, { width: largeurCarte }]}>
        <EnteteMarque anime />

        <View style={styles.illustration}>
          <MotifCoin couleur={colors.brandPrimary} />
          <Animated.View style={{ transform: [{ translateY: monte }] }}>
            <Image
              testID="image-demarrage"
              source={HERO}
              style={{ width: largeurHero, height: largeurHero * 0.7 }}
              contentFit="contain"
              transition={300}
            />
          </Animated.View>
          <Vague largeur={largeurCarte} couleur={colors.surface} />
        </View>

        <View style={styles.bas}>
          <Text style={styles.slogan}>Le vrai frozen yogurt, livré chez toi à Kinshasa</Text>
          <Text style={styles.chargement}>Chargement…</Text>
        </View>
      </View>
    </View>
  );
}

const styles = stylesDynamiques(() => StyleSheet.create({
  ecran: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceSecondary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xl,
  },
  carte: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 34,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
  },
  illustration: {
    flex: 1,
    minHeight: 240,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.brandTertiary,
    overflow: "hidden",
  },
  bas: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, paddingTop: spacing.sm, gap: spacing.sm },
  slogan: {
    fontFamily: fonts.display,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: poids.fort,
    color: colors.onSurface,
    textAlign: "center",
  },
  chargement: { fontFamily: fonts.text, fontSize: 13, fontWeight: poids.titre, color: colors.muted, textAlign: "center" },
}));
