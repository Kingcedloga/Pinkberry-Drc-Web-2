import { Image } from "expo-image";
import { useRouter } from "expo-router";
import React, { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ChoixLangueCompact } from "@/src/components/ChoixLangueCompact";
import { EnteteMarque, MotifCoin, Vague } from "@/src/components/DecorAuth";
import { Logo } from "@/src/components/Logo";
import { useLangue } from "@/src/i18n";
import { useEcran } from "@/src/reactif";
import { colors, fonts, poids, radius, spacing, stylesDynamiques } from "@/src/theme";
import { useTheme } from "@/src/theme-contexte";

const HERO = require("@/assets/images/livreur-pinkberry-v2.webp");

export default function Bienvenue() {
  const { scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useLangue();
  const { width, height } = useWindowDimensions();
  const { bureau } = useEcran();

  const flotte = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = (toValue: number) =>
      Animated.timing(flotte, { toValue, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true });
    const boucle = Animated.loop(Animated.sequence([anim(1), anim(0)]));
    boucle.start();
    return () => boucle.stop();
  }, [flotte]);

  const monte = flotte.interpolate({ inputRange: [0, 1], outputRange: [8, -12] });

  const actions = (
    <>
      <Pressable
        testID="btn-creer-compte"
        onPress={() => router.push("/inscription")}
        style={({ pressed }) => [styles.cta, pressed && styles.pressee]}
      >
        <Text style={styles.ctaTexte}>{t("auth.creerCompte")}</Text>
      </Pressable>
      <Pressable
        testID="btn-deja-compte"
        onPress={() => router.push("/connexion")}
        style={({ pressed }) => [styles.ctaSecondaire, pressed && styles.pressee]}
      >
        <Text style={styles.ctaSecondaireTexte}>{t("auth.compteExistant")}</Text>
      </Pressable>
    </>
  );

  // Page d'accueil web : deux colonnes, pleine largeur, comme un vrai site.
  if (bureau) {
    return (
      <View testID="ecran-bienvenue" style={styles.site}>
        <View style={styles.enteteSite}>
          <View style={styles.enteteSiteInterieur}>
            <Logo taille={22} />
            <View style={styles.enteteDroite}>
              <ChoixLangueCompact />
              <Pressable testID="btn-deja-compte-entete" onPress={() => router.push("/connexion")} style={styles.lienEntete}>
                <Text style={styles.lienEnteteTexte}>{t("auth.seConnecter")}</Text>
              </Pressable>
            </View>
          </View>
        </View>

        <View style={styles.heroSite}>
          <View style={styles.heroTexte}>
            <Text style={styles.badgeSite}>{t("auth.livraisonKinshasa")}</Text>
            <Text style={styles.titreSite}>{t("auth.sloganWeb")}</Text>
            <Text style={styles.sousTitreSite}>{t("auth.presentation")}</Text>
            <View style={styles.actionsSite}>{actions}</View>
            <View style={styles.pointsForts}>
              <Text style={styles.pointFort}>• {t("auth.pointZones")}</Text>
              <Text style={styles.pointFort}>• {t("auth.pointPaiement")}</Text>
              <Text style={styles.pointFort}>• {t("auth.pointSuivi")}</Text>
            </View>
          </View>

          <View style={styles.heroVisuel}>
            <MotifCoin couleur={scheme === "dark" ? colors.brandSecondary : colors.brandPrimary} />
            <Animated.View style={{ transform: [{ translateY: monte }] }}>
              <Image
                testID="image-livreur"
                source={HERO}
                style={{ width: Math.min(width * 0.38, 520), height: Math.min(height * 0.6, 460) }}
                contentFit="contain"
                transition={400}
              />
            </Animated.View>
          </View>
        </View>
      </View>
    );
  }

  // Petit écran : carte verticale compacte.
  const largeurCarte = Math.min(width - spacing.md * 2, 520);
  const largeurHero = largeurCarte * 1.45;
  const hauteurHero = Math.min(largeurHero * 0.82, height * 0.54);

  return (
    <View testID="ecran-bienvenue" style={styles.ecran}>
      <View
        style={[
          styles.carte,
          { width: largeurCarte, marginTop: insets.top + spacing.sm, marginBottom: insets.bottom + spacing.sm },
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
          <Text style={styles.slogan}>{t("auth.sloganMobile")}</Text>
          {actions}
          <ChoixLangueCompact style={styles.langueMobile} />
        </View>
      </View>
    </View>
  );
}

const styles = stylesDynamiques(() =>
  StyleSheet.create({
    // --- version web ---
    site: { flex: 1, backgroundColor: colors.surfaceSecondary },
    enteteSite: {
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    enteteSiteInterieur: {
      width: "100%",
      maxWidth: 1280,
      alignSelf: "center",
      height: 72,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.xl,
    },
    enteteDroite: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    langueMobile: { alignSelf: "center" },
    lienEntete: {
      minHeight: 44,
      paddingHorizontal: spacing.lg,
      borderRadius: radius.pill,
      justifyContent: "center",
      backgroundColor: colors.brandTertiary,
    },
    lienEnteteTexte: { fontFamily: fonts.text, fontSize: 14, fontWeight: poids.fort, color: colors.brandPrimary },
    heroSite: {
      flex: 1,
      width: "100%",
      maxWidth: 1280,
      alignSelf: "center",
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xxxl,
      paddingHorizontal: spacing.xl,
    },
    heroTexte: { flex: 1.1, gap: spacing.md, minWidth: 0 },
    badgeSite: {
      alignSelf: "flex-start",
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
      borderRadius: radius.pill,
      backgroundColor: colors.brandTertiary,
      fontFamily: fonts.text,
      fontSize: 12,
      fontWeight: poids.fort,
      color: colors.brandPrimary,
      overflow: "hidden",
    },
    titreSite: { fontFamily: fonts.display, fontSize: 46, lineHeight: 52, color: colors.onSurface },
    sousTitreSite: { fontFamily: fonts.text, fontSize: 16, lineHeight: 24, color: colors.muted, maxWidth: 560 },
    actionsSite: { flexDirection: "row", gap: spacing.md, marginTop: spacing.md, flexWrap: "wrap" },
    pointsForts: { gap: spacing.xs, marginTop: spacing.lg },
    pointFort: { fontFamily: fonts.text, fontSize: 13, color: colors.onSurface, fontWeight: poids.corps },
    heroVisuel: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.brandTertiary,
      borderRadius: 40,
      paddingVertical: spacing.xl,
      overflow: "hidden",
      alignSelf: "center",
    },

    // --- version compacte ---
    ecran: {
      flex: 1,
      alignItems: "center",
      backgroundColor: colors.surfaceSecondary,
      paddingHorizontal: spacing.md,
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

    // --- boutons partagés ---
    cta: {
      minHeight: 54,
      minWidth: 200,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: spacing.xl,
      borderRadius: radius.pill,
      backgroundColor: colors.brandPrimary,
    },
    ctaTexte: { fontFamily: fonts.display, fontSize: 16, fontWeight: poids.fort, color: colors.onBrandPrimary },
    ctaSecondaire: {
      minHeight: 50,
      minWidth: 200,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: spacing.xl,
      borderRadius: radius.pill,
      backgroundColor: colors.brandTertiary,
    },
    ctaSecondaireTexte: { fontFamily: fonts.text, fontSize: 14, fontWeight: poids.fort, color: colors.brandPrimary },
    pressee: { opacity: 0.85 },
  }),
);
