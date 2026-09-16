import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Icone } from "@/src/components/Icone";
import { useT, type ThemeChoisi } from "@/src/i18n";
import { colors, fonts, poids, radius, spacing, stylesDynamiques } from "@/src/theme";
import { useTheme } from "@/src/theme-contexte";

const CHOIX: { cle: ThemeChoisi; label: "params.themeClair" | "params.themeSombre" | "params.themeSysteme"; icone: "sun" | "moon" | "smartphone" }[] = [
  { cle: "clair", label: "params.themeClair", icone: "sun" },
  { cle: "sombre", label: "params.themeSombre", icone: "moon" },
  { cle: "systeme", label: "params.themeSysteme", icone: "smartphone" },
];

/** Sélecteur Clair / Sombre / Système, partagé par les écrans Paramètres. */
export function ChoixTheme({ onChange }: { onChange?: () => void }) {
  const t = useT();
  const { choix, changerTheme } = useTheme();

  return (
    <View style={styles.rangee}>
      {CHOIX.map((c) => {
        const actif = choix === c.cle;
        return (
          <Pressable
            key={c.cle}
            testID={`btn-theme-${c.cle}`}
            onPress={async () => {
              await changerTheme(c.cle);
              onChange?.();
            }}
            style={[styles.option, actif && styles.optionActive]}
          >
            <Icone
              name={c.icone}
              size={18}
              color={actif ? colors.onBrandPrimary : colors.brandPrimary}
            />
            <Text style={[styles.texte, actif && styles.texteActif]}>{t(c.label)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = stylesDynamiques(() => StyleSheet.create({
  rangee: { flexDirection: "row", gap: spacing.sm, padding: spacing.md },
  option: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    minHeight: 64,
    borderRadius: radius.lg,
    backgroundColor: colors.brandTertiary,
  },
  optionActive: { backgroundColor: colors.brandPrimary },
  texte: { fontFamily: fonts.text, fontSize: 12, fontWeight: poids.fort, color: colors.brandPrimary },
  texteActif: { color: colors.onBrandPrimary },
}));
