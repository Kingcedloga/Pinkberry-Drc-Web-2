import React from "react";
import { FlatList, Pressable, StyleSheet, Text } from "react-native";

import { colors, fonts, radius, spacing } from "@/src/theme";

export function Chips({
  options,
  valeur,
  onChange,
  testID = "chips-categories",
}: {
  options: string[];
  valeur: string;
  onChange: (v: string) => void;
  testID?: string;
}) {
  return (
    <FlatList
      testID={testID}
      horizontal
      showsHorizontalScrollIndicator={false}
      data={options}
      keyExtractor={(o) => o}
      style={styles.row}
      contentContainerStyle={styles.contenu}
      renderItem={({ item }) => {
        const actif = item === valeur;
        return (
          <Pressable
            testID={`chip-${item}`}
            onPress={() => onChange(item)}
            style={[styles.chip, actif ? styles.chipActif : styles.chipInactif]}
          >
            <Text style={[styles.texte, { color: actif ? colors.onBrandPrimary : colors.onSurface }]}>{item}</Text>
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  row: { height: 56, flexGrow: 0 },
  contenu: { gap: spacing.sm, paddingHorizontal: spacing.lg, alignItems: "center" },
  chip: {
    height: 36,
    flexShrink: 0,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  chipActif: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  chipInactif: { backgroundColor: colors.surface, borderColor: colors.border },
  texte: { fontFamily: fonts.text, fontSize: 13, fontWeight: "700" },
});
