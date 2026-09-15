import React, { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, View } from "react-native";

import { colors, radius, spacing } from "@/src/theme";

/** Boucle douce entre 0 et 1 (aller-retour). */
function useBoucle(duree: number, actif: boolean) {
  const valeur = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!actif) {
      valeur.setValue(0);
      return;
    }
    const boucle = Animated.loop(
      Animated.sequence([
        Animated.timing(valeur, {
          toValue: 1,
          duration: duree,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(valeur, {
          toValue: 0,
          duration: duree,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    boucle.start();
    return () => boucle.stop();
  }, [valeur, duree, actif]);
  return valeur;
}

/** Boucle linéaire 0 → 1 (défilement de la route). */
function useDefilement(duree: number, actif: boolean) {
  const valeur = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!actif) {
      valeur.setValue(0);
      return;
    }
    const boucle = Animated.loop(
      Animated.timing(valeur, {
        toValue: 1,
        duration: duree,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    boucle.start();
    return () => boucle.stop();
  }, [valeur, duree, actif]);
  return valeur;
}

const PAS_ROUTE = 32;

/**
 * Scène animée en emojis : le livreur Pinkberry file sur sa moto avec un pot
 * de frozen yogurt. Aucune image ni vidéo, animations sobres et en boucle.
 */
export function HeroLivreur() {
  const [animer, setAnimer] = useState(true);

  useEffect(() => {
    let vivant = true;
    AccessibilityInfo.isReduceMotionEnabled?.().then((reduit) => {
      if (vivant && reduit) setAnimer(false);
    });
    const sub = AccessibilityInfo.addEventListener?.("reduceMotionChanged", (reduit) =>
      setAnimer(!reduit),
    );
    return () => {
      vivant = false;
      sub?.remove?.();
    };
  }, []);

  const rebond = useBoucle(720, animer);
  const tremblement = useBoucle(160, animer);
  const flottement = useBoucle(1500, animer);
  const etincelles = useBoucle(1100, animer);
  const route = useDefilement(700, animer);

  const monte = rebond.interpolate({ inputRange: [0, 1], outputRange: [0, -10] });
  const secousse = tremblement.interpolate({ inputRange: [0, 1], outputRange: [-1.5, 1.5] });
  const inclinaison = rebond.interpolate({ inputRange: [0, 1], outputRange: ["-3deg", "1.5deg"] });
  const potMonte = flottement.interpolate({ inputRange: [0, 1], outputRange: [4, -6] });
  const potTourne = flottement.interpolate({ inputRange: [0, 1], outputRange: ["-6deg", "6deg"] });
  const opaciteEtincelles = etincelles.interpolate({ inputRange: [0, 1], outputRange: [0.25, 1] });
  const defile = route.interpolate({ inputRange: [0, 1], outputRange: [0, -PAS_ROUTE] });
  const vitesse = tremblement.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.9] });

  return (
    <View testID="hero-livreur" accessibilityLabel="Livreur Pinkberry à moto" style={styles.carte}>
      <View style={styles.halo} />

      <Animated.Text style={[styles.etincelleGauche, { opacity: opaciteEtincelles }]}>✨</Animated.Text>
      <Animated.Text style={[styles.etincelleDroite, { opacity: opaciteEtincelles }]}>✨</Animated.Text>

      <Animated.View style={[styles.traits, { opacity: vitesse }]}>
        <View style={[styles.trait, { width: 34 }]} />
        <View style={[styles.trait, { width: 22, backgroundColor: colors.success }]} />
        <View style={[styles.trait, { width: 28 }]} />
      </Animated.View>

      <Animated.View
        style={[
          styles.scene,
          { transform: [{ translateY: monte }, { translateY: secousse }, { rotate: inclinaison }] },
        ]}
      >
        <Animated.View
          style={[styles.bulle, { transform: [{ translateY: potMonte }, { rotate: potTourne }] }]}
        >
          <Text style={styles.pot}>🍦</Text>
        </Animated.View>
        <Text style={styles.personnage}>🧑</Text>
        <Text style={styles.moto}>🛵</Text>
      </Animated.View>

      <View style={styles.route}>
        <Animated.View style={[styles.pointilles, { transform: [{ translateX: defile }] }]}>
          {Array.from({ length: 16 }).map((_, i) => (
            <View key={i} style={styles.pointille} />
          ))}
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  carte: {
    width: "100%",
    maxWidth: 360,
    aspectRatio: 1.15,
    alignSelf: "center",
    borderRadius: radius.xl,
    backgroundColor: colors.surfaceTertiary,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  halo: {
    position: "absolute",
    top: "12%",
    alignSelf: "center",
    width: "68%",
    aspectRatio: 1,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    opacity: 0.55,
  },
  etincelleGauche: { position: "absolute", top: "16%", left: "12%", fontSize: 20 },
  etincelleDroite: { position: "absolute", top: "28%", right: "14%", fontSize: 14 },
  traits: {
    position: "absolute",
    left: "6%",
    bottom: "34%",
    gap: spacing.xs,
  },
  trait: { height: 4, borderRadius: radius.pill, backgroundColor: colors.brandPrimary, opacity: 0.6 },
  scene: {
    height: 150,
    marginBottom: 26,
    alignSelf: "center",
    width: 190,
  },
  moto: { position: "absolute", left: 18, bottom: 0, fontSize: 96, lineHeight: 104 },
  personnage: {
    position: "absolute",
    left: 56,
    bottom: 58,
    fontSize: 46,
    lineHeight: 52,
    transform: [{ rotate: "-8deg" }],
  },
  bulle: {
    position: "absolute",
    right: 4,
    top: 0,
    width: 50,
    height: 50,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.success,
    alignItems: "center",
    justifyContent: "center",
  },
  pot: { fontSize: 24, lineHeight: 30 },
  route: {
    height: 10,
    marginHorizontal: "8%",
    marginBottom: spacing.xl,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
    overflow: "hidden",
    justifyContent: "center",
  },
  pointilles: { flexDirection: "row", alignItems: "center", gap: PAS_ROUTE - 18 },
  pointille: { width: 18, height: 3, borderRadius: radius.pill, backgroundColor: colors.brandPrimary, opacity: 0.45 },
});
