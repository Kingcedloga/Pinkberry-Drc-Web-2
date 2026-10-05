import React from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";

import { colors, fonts, radius, spacing, stylesDynamiques } from "@/src/theme";

/** Pastilles de choix exclusif (type, mode, cible…). */
export function Choix<T extends string>({
  options,
  valeur,
  onChange,
  libelle,
  testID,
}: {
  options: T[];
  valeur: T;
  onChange: (v: T) => void;
  libelle: (v: T) => string;
  testID: string;
}) {
  return (
    <View style={styles.chips} accessibilityRole="radiogroup">
      {options.map((o) => {
        const actif = o === valeur;
        return (
          <Pressable
            key={o}
            testID={`${testID}-${o}`}
            accessibilityRole="radio"
            accessibilityState={{ checked: actif }}
            onPress={() => onChange(o)}
            style={[styles.chip, actif && styles.chipActif]}
          >
            <Text style={[styles.chipTexte, actif && { color: colors.onBrandPrimary }]}>{libelle(o)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Interrupteur({
  label,
  aide,
  value,
  onChange,
  testID,
}: {
  label: string;
  aide?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  testID: string;
}) {
  return (
    <View style={styles.switchRow}>
      <View style={styles.switchTexte}>
        <Text style={styles.switchLabel}>{label}</Text>
        {aide ? <Text style={styles.aide}>{aide}</Text> : null}
      </View>
      <Switch testID={testID} value={value} onValueChange={onChange} trackColor={{ true: colors.brandPrimary, false: colors.border }} />
    </View>
  );
}

const styles = stylesDynamiques(() =>
  StyleSheet.create({
    aide: { fontFamily: fonts.text, fontSize: 12, color: colors.muted },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    chip: {
      minHeight: 44,
      paddingHorizontal: spacing.lg,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    chipActif: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
    chipTexte: { fontFamily: fonts.text, fontSize: 12, fontWeight: "700", color: colors.onSurface },
    switchRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing.md,
      minHeight: 52,
      backgroundColor: colors.surfaceSecondary,
      borderRadius: radius.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
    },
    switchTexte: { flex: 1 },
    switchLabel: { fontFamily: fonts.text, fontSize: 14, fontWeight: "700", color: colors.onSurface },
  }),
);
