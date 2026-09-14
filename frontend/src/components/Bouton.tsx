import { Icone } from "@/src/components/Icone";
import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View, ViewStyle } from "react-native";

import { colors, fonts, radius, softShadow, spacing } from "@/src/theme";

type Variant = "primaire" | "secondaire" | "contour" | "succes" | "danger";

export function Bouton({
  label,
  onPress,
  variant = "primaire",
  disabled,
  loading,
  icone,
  testID,
  style,
  petit,
}: {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  icone?: string;
  testID?: string;
  style?: ViewStyle;
  petit?: boolean;
}) {
  const inactif = disabled || loading;
  const palette: Record<Variant, { bg: string; bgPressed: string; fg: string; border?: string }> = {
    primaire: { bg: colors.brandPrimary, bgPressed: colors.brandSecondary, fg: colors.onBrandPrimary },
    secondaire: { bg: colors.brandTertiary, bgPressed: "#F7CFE1", fg: colors.brandPrimary },
    contour: { bg: colors.surface, bgPressed: colors.surfaceSecondary, fg: colors.onSurface, border: colors.border },
    succes: { bg: colors.success, bgPressed: "#7AB033", fg: colors.onSuccess },
    danger: { bg: colors.errorSoft, bgPressed: "#F9D3D7", fg: colors.error },
  };
  const p = palette[variant];

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={inactif}
      style={({ pressed }) => [
        styles.base,
        petit && styles.petit,
        {
          backgroundColor: pressed ? p.bgPressed : p.bg,
          opacity: inactif ? 0.5 : 1,
          borderWidth: p.border ? 1 : 0,
          borderColor: p.border,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
        variant === "primaire" && !inactif ? softShadow : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={p.fg} />
      ) : (
        <View style={styles.contenu}>
          {icone ? <Icone name={icone as any} size={petit ? 15 : 18} color={p.fg} /> : null}
          <Text style={[styles.label, petit && styles.labelPetit, { color: p.fg }]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  petit: { minHeight: 44, paddingHorizontal: spacing.lg },
  contenu: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  label: { fontFamily: fonts.text, fontSize: 16, fontWeight: "700" },
  labelPetit: { fontSize: 14 },
});
