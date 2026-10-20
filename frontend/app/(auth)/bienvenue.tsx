import { Image } from "expo-image";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icone } from "@/src/components/Icone";
import { MotifCoin } from "@/src/components/DecorAuth";
import { useLangue } from "@/src/i18n";
import { colors, fonts, poids, radius, softShadow, spacing, stylesDynamiques } from "@/src/theme";
import { useTheme } from "@/src/theme-contexte";

// Mascotte recadrée (sans marge transparente) : elle remplit sa zone.
const MASCOTTE = require("@/assets/images/mascotte.webp");
const RATIO = 935 / 1099; // largeur / hauteur de l'image

/**
 * Accueil : la mascotte et un seul bouton vers la carte. La connexion n'est
 * demandée qu'au passage en caisse (ou depuis « Se connecter » dans la navigation).
 */
export default function Bienvenue() {
  const { scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useLangue();
  const { width, height } = useWindowDimensions();

  const [flotte] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const anim = (toValue: number) =>
      Animated.timing(flotte, { toValue, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true });
    const boucle = Animated.loop(Animated.sequence([anim(1), anim(0)]));
    boucle.start();
    return () => boucle.stop();
  }, [flotte]);
  const monte = flotte.interpolate({ inputRange: [0, 1], outputRange: [8, -12] });

  // Le plus grand possible sans dépasser : 60 % de la hauteur, la largeur moins les marges.
  const hauteur = Math.min(height * 0.6, (width - spacing.xl * 2) / RATIO, 560);
  const largeur = hauteur * RATIO;

  return (
    <View
      testID="ecran-bienvenue"
      style={[styles.ecran, { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xxl }]}
    >
      <MotifCoin couleur={scheme === "dark" ? colors.brandSecondary : colors.brandPrimary} />
      <Animated.View style={{ transform: [{ translateY: monte }] }}>
        <Image
          testID="image-livreur"
          source={MASCOTTE}
          accessibilityLabel={t("commun.marque")}
          style={{ width: largeur, height: hauteur }}
          contentFit="contain"
          transition={400}
        />
      </Animated.View>
      <Pressable
        testID="btn-decouvrir-carte"
        accessibilityRole="button"
        onPress={() => router.replace("/menu")}
        style={({ pressed }) => [styles.bouton, pressed && styles.pressee]}
      >
        <Text style={styles.boutonTexte}>{t("auth.decouvrirCarte")}</Text>
        <Icone name="arrow-right" size={20} color={colors.onBrandPrimary} />
      </Pressable>
    </View>
  );
}

const styles = stylesDynamiques(() =>
  StyleSheet.create({
    ecran: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.xxl,
      paddingHorizontal: spacing.xl,
      backgroundColor: colors.brandTertiary,
      overflow: "hidden",
    },
    bouton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
      minHeight: 58,
      minWidth: 260,
      paddingHorizontal: spacing.xxl,
      borderRadius: radius.pill,
      backgroundColor: colors.brandPrimary,
      ...softShadow,
    },
    boutonTexte: { fontFamily: fonts.display, fontSize: 18, fontWeight: poids.fort, color: colors.onBrandPrimary },
    pressee: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  }),
);
