import React from "react";
import { Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";

import { useLangue, type Langue } from "@/src/i18n";
import { colors, fonts, radius, spacing, stylesDynamiques } from "@/src/theme";

const LANGUES: Langue[] = ["fr", "en"];

/**
 * Choix FR / EN avant connexion (accueil, connexion, inscription). Le choix est
 * gardé sur l'appareil puis appliqué au compte à la connexion.
 */
export function ChoixLangueCompact({ style }: { style?: ViewStyle }) {
  const { langue, t, enregistrerPrefs } = useLangue();
  return (
    <View testID="choix-langue-compact" accessibilityRole="radiogroup" accessibilityLabel={t("params.langue")} style={[styles.groupe, style]}>
      {LANGUES.map((code) => {
        const actif = langue === code;
        return (
          <Pressable
            key={code}
            testID={`btn-langue-compact-${code}`}
            accessibilityRole="radio"
            accessibilityState={{ checked: actif }}
            accessibilityLabel={t(code === "fr" ? "langue.fr" : "langue.en")}
            onPress={() => void enregistrerPrefs({ langue: code })}
            style={[styles.option, actif && styles.optionActive]}
          >
            <Text style={[styles.texte, actif && styles.texteActif]}>{code.toUpperCase()}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = stylesDynamiques(() =>
  StyleSheet.create({
    groupe: {
      flexDirection: "row",
      padding: 3,
      gap: 2,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    option: { minWidth: 44, minHeight: 36, paddingHorizontal: spacing.sm, alignItems: "center", justifyContent: "center", borderRadius: radius.pill },
    optionActive: { backgroundColor: colors.brandPrimary },
    texte: { fontFamily: fonts.text, fontSize: 13, fontWeight: "800", letterSpacing: 0.5, color: colors.muted },
    texteActif: { color: colors.onBrandPrimary },
  }),
);
