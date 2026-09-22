import { Image } from "expo-image";
import { useRouter } from "expo-router";
import React, { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { EnteteMarque, MotifCoin, Vague } from "@/src/components/DecorAuth";
import { colors, fonts, poids, radius, spacing, stylesDynamiques } from "@/src/theme";
import { useTheme } from "@/src/theme-contexte";

const HERO = require("@/assets/images/livreur-pinkberry-v2.webp");

export default function Bienvenue() {
  const { scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width, height } = useWindowDimensions();

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
  const borne = height > 820 ? Math.min(height - spacing.xxxl * 2, 760) : undefined;
  const largeurHero = largeurCarte * 1.45;
  const hauteurHero = Math.min(largeurHero * 0.82, (borne ?? height) * 0.54);

  return (
    <View testID="ecran-bienvenue" style={[styles.ecran, borne ? styles.ecranCentre : null]}>
      <View
        style={[
          styles.carte,
          borne
            ? { width: largeurCarte, height: borne, flexGrow: 0, flexShrink: 0, flexBasis: "auto" }
            : { width: largeurCarte, marginTop: insets.top + spacing.sm, marginBottom: insets.bottom + spacing.sm },
        ]}
      >
        <EnteteMarque />

        <View style={styles.illustration}>
          <MotifCoin couleur={scheme === "dark" ? colors.brandSecondary : colors.brandPrimary} />
          <Animated.View style={[styles.heroBloc, { transform: [{ translateY: monte }] }]}>
            <Image
              testID="image-livreur"
              source={HERO}
              style={{ width: largeurHero, height: hauteurHero }}
              contentFit="contain"
              transition={400}
            />
          </Animated.View>
          <Vague largeur={largeurCarte} couleur={colors.surface} />
        </View>

        <View style={styles.bas}>
          <Text style={styles.slogan}>Le vrai frozen yogurt, livré chez toi à Kinshasa</Text>

          <Pressable
            testID="btn-creer-compte"
            onPress={() => router.push("/inscription")}
            style={({ pressed }) => [styles.cta, pressed && styles.pressee]}
          >
            <Text style={styles.ctaTexte}>Créer un compte</Text>
          </Pressable>

          <Pressable
            testID="btn-deja-compte"
            onPress={() => router.push("/connexion")}
            style={({ pressed }) => [styles.ctaSecondaire, pressed && styles.pressee]}
          >
            <Text style={styles.ctaSecondaireTexte}>J&apos;ai déjà un compte</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = stylesDynamiques(() => StyleSheet.create({
  ecran: {
    flex: 1,
    alignItems: "center",
    backgroundColor: colors.surfaceSecondary,
    paddingHorizontal: spacing.md,
  },
  ecranCentre: { justifyContent: "center" },
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
  heroBloc: { alignItems: "center", justifyContent: "center", marginBottom: spacing.xs },
  bas: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, paddingTop: spacing.sm, gap: spacing.sm },
  slogan: {
    fontFamily: fonts.display,
    fontSize: 19,
    lineHeight: 25,
    fontWeight: poids.fort,
    color: colors.onSurface,
    textAlign: "center",
    marginBottom: spacing.xs,
  },
  cta: {
    minHeight: 54,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.brandPrimary,
  },
  ctaTexte: { fontFamily: fonts.display, fontSize: 16, fontWeight: poids.fort, color: colors.onBrandPrimary },
  ctaSecondaire: {
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.brandTertiary,
  },
  ctaSecondaireTexte: { fontFamily: fonts.text, fontSize: 14, fontWeight: poids.fort, color: colors.brandPrimary },
  pressee: { opacity: 0.85 },
}));
