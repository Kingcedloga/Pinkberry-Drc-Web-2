import { Icone } from "@/src/components/Icone";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { colors, spacing } from "@/src/theme";

export function Etoiles({
  valeur,
  onChange,
  taille = 32,
}: {
  valeur: number;
  onChange?: (n: number) => void;
  taille?: number;
}) {
  return (
    <View style={styles.row}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable
          key={n}
          testID={`etoile-${n}`}
          disabled={!onChange}
          onPress={() => onChange?.(n)}
          hitSlop={8}
          style={styles.cible}
        >
          <Icone
            name="star"
            size={taille}
            color={n <= valeur ? colors.brandPrimary : colors.border}
            fill={n <= valeur ? colors.brandPrimary : "none"}
          />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: spacing.sm, justifyContent: "center" },
  cible: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
});
