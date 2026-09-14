import { Image } from "expo-image";
import { useRouter } from "expo-router";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Bouton } from "@/src/components/Bouton";
import { Logo } from "@/src/components/Logo";
import { colors, fonts, radius, softShadow, spacing } from "@/src/theme";

const HERO = require("@/assets/images/livreur-pinkberry.jpg");

export default function Bienvenue() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View testID="ecran-bienvenue" style={styles.ecran}>
      <View style={[styles.contenu, { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.xl }]}>
        <Logo taille={34} />

        <View style={styles.heroZone}>
          <View style={styles.heroWrap}>
            <Image source={HERO} style={styles.hero} contentFit="cover" transition={300} />
          </View>
        </View>

        <View style={styles.bloc}>
          <Text style={styles.titre}>Le vrai frozen yogurt, livré chez toi à Kinshasa</Text>
          <Text style={styles.sous}>
            Pots de crème, smoothies et garnitures fraîches. Commandez, suivez votre livreur, payez en cash.
          </Text>
        </View>

        <View style={styles.actions}>
          <Bouton
            testID="btn-creer-compte"
            label="Créer un compte"
            icone="user-plus"
            onPress={() => router.push("/inscription")}
          />
          <Bouton
            testID="btn-deja-compte"
            label="J'ai déjà un compte"
            variant="secondaire"
            onPress={() => router.push("/connexion")}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: colors.surfaceSecondary },
  contenu: { flex: 1, paddingHorizontal: spacing.xl, gap: spacing.xl },
  heroZone: { flex: 1, alignItems: "center", justifyContent: "center" },
  heroWrap: {
    borderRadius: radius.xl,
    overflow: "hidden",
    ...softShadow,
    alignSelf: "center",
    width: "100%",
    maxWidth: 320,
  },
  hero: { width: "100%", aspectRatio: 1, backgroundColor: colors.brandTertiary },
  bloc: { gap: spacing.sm },
  titre: { fontFamily: fonts.display, fontSize: 28, lineHeight: 34, color: colors.onSurface },
  sous: { fontFamily: fonts.text, fontSize: 15, lineHeight: 22, color: colors.muted },
  actions: { marginTop: "auto", gap: spacing.md },
});
