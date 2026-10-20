import { useRouter } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Icone } from "@/src/components/Icone";
import { useLangue } from "@/src/i18n";
import { colors, fonts, poids, radius, softShadow, spacing, stylesDynamiques } from "@/src/theme";

export function LiensLegaux() {
  const router = useRouter();
  const { t } = useLangue();

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitre}>{t("params.legal")}</Text>
      <View style={styles.carte}>
        <Pressable
          testID="ligne-politique-confidentialite"
          onPress={() => router.push("/legal/confidentialite")}
          style={({ pressed }) => [styles.ligne, pressed && styles.lignePresse]}
        >
          <Icone name="info" size={20} color={colors.brandPrimary} />
          <Text style={styles.label}>{t("params.confidentialite")}</Text>
          <Icone name="chevron-down" size={16} color={colors.muted} />
        </Pressable>
        <Pressable
          testID="ligne-conditions-utilisation"
          onPress={() => router.push("/legal/conditions")}
          style={({ pressed }) => [styles.ligne, pressed && styles.lignePresse]}
        >
          <Icone name="receipt" size={20} color={colors.brandPrimary} />
          <Text style={styles.label}>{t("params.conditions")}</Text>
          <Icone name="chevron-down" size={16} color={colors.muted} />
        </Pressable>
        <Pressable
          testID="ligne-suppression-compte"
          onPress={() => router.push("/legal/suppression-compte")}
          style={({ pressed }) => [styles.ligne, pressed && styles.lignePresse]}
        >
          <Icone name="trash-2" size={20} color={colors.brandPrimary} />
          <Text style={styles.label}>{t("params.suppressionCompte")}</Text>
          <Icone name="chevron-down" size={16} color={colors.muted} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = stylesDynamiques(() => StyleSheet.create({
  section: { gap: spacing.sm },
  sectionTitre: {
    fontFamily: fonts.text,
    fontSize: 12,
    fontWeight: poids.fort,
    color: colors.muted,
    textTransform: "uppercase",
  },
  carte: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    ...softShadow,
  },
  ligne: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: 60,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  lignePresse: { backgroundColor: colors.brandTertiary },
  label: { flex: 1, fontFamily: fonts.text, fontSize: 15, fontWeight: poids.titre, color: colors.onSurface },
}));
