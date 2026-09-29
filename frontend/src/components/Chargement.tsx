import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";

import { Swirl } from "@/src/components/Logo";
import { colors, fonts, poids, spacing, stylesDynamiques } from "@/src/theme";

/**
 * Indicateur de chargement Pinkberry : la spirale du logo qui tourne.
 * Remplace l'ActivityIndicator générique dans toute l'application.
 */
export function Chargement({
  taille = 44,
  libelle,
  testID = "chargement",
}: {
  taille?: number;
  libelle?: string;
  testID?: string;
}) {
  const rotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const boucle = Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: 1100,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    boucle.start();
    return () => boucle.stop();
  }, [rotation]);

  const tourne = rotation.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  return (
    <View testID={testID} style={styles.bloc}>
      <Animated.View style={{ transform: [{ rotate: tourne }] }}>
        <Swirl taille={taille} />
      </Animated.View>
      {libelle ? <Text style={styles.libelle}>{libelle}</Text> : null}
    </View>
  );
}

const styles = stylesDynamiques(() => StyleSheet.create({
  bloc: { alignItems: "center", justifyContent: "center", gap: spacing.sm },
  libelle: { fontFamily: fonts.text, fontSize: 13, fontWeight: poids.titre, color: colors.muted },
}));
