import { useRouter } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Icone } from "@/src/components/Icone";
import { colors, fonts, radius, spacing, stylesDynamiques } from "@/src/theme";

/**
 * Titre de page web : intitulé, sous-titre, fil d'Ariane de retour éventuel et
 * actions alignées à droite. Remplace les en-têtes « application mobile ».
 */
export function TitrePage({
  titre,
  sousTitre,
  retour,
  actions,
  testID,
}: {
  titre: string;
  sousTitre?: string;
  /** URL de retour : affiche un lien « ← » à la manière d'un site web. */
  retour?: string;
  actions?: React.ReactNode;
  testID?: string;
}) {
  const router = useRouter();

  return (
    <View testID={testID} style={styles.bloc}>
      <View style={styles.gauche}>
        {retour ? (
          <Pressable
            testID="btn-retour"
            onPress={() => router.push(retour as any)}
            style={({ pressed }) => [styles.retour, pressed && { opacity: 0.7 }]}
          >
            <Icone name="arrow-left" size={18} color={colors.brandPrimary} />
          </Pressable>
        ) : null}
        <View style={styles.textes}>
          <Text style={styles.titre}>{titre}</Text>
          {sousTitre ? <Text style={styles.sousTitre}>{sousTitre}</Text> : null}
        </View>
      </View>
      {actions ? <View style={styles.actions}>{actions}</View> : null}
    </View>
  );
}

const styles = stylesDynamiques(() =>
  StyleSheet.create({
    bloc: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing.lg,
      flexWrap: "wrap",
    },
    gauche: { flexDirection: "row", alignItems: "center", gap: spacing.md, flexShrink: 1 },
    retour: {
      width: 44,
      height: 44,
      borderRadius: radius.pill,
      backgroundColor: colors.brandTertiary,
      alignItems: "center",
      justifyContent: "center",
    },
    textes: { gap: 2, flexShrink: 1 },
    titre: { fontFamily: fonts.display, fontSize: 26, color: colors.onSurface },
    sousTitre: { fontFamily: fonts.text, fontSize: 13, color: colors.muted },
    actions: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.sm, maxWidth: "100%" },
  }),
);
