import React, { useCallback } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useAuth } from "@/src/auth";
import { Icone } from "@/src/components/Icone";
import { useT } from "@/src/i18n";
import { colors, fonts, radius, spacing, stylesDynamiques } from "@/src/theme";
import { useToast } from "@/src/toast";

/**
 * Droits de gestion. Hiérarchie : super admin > admin > livreur > client.
 * La configuration (menu, composition, zones, promotions, bannières, taux,
 * comptes) n'est modifiable que par le super admin ; l'admin la consulte.
 * Le serveur applique la même règle (403) : masquer les boutons n'est qu'un confort.
 */
export function useDroits() {
  const { user } = useAuth();
  const t = useT();
  const toast = useToast();
  const peutGerer = user?.role === "superadmin";
  /** À appeler en tête d'une action de gestion : false (et message) si elle est réservée. */
  const exiger = useCallback(() => {
    if (!peutGerer) toast.show(t("droits.reserve"), "erreur");
    return peutGerer;
  }, [peutGerer, t, toast]);
  return { peutGerer, exiger };
}

/** Bandeau des pages de configuration pour un admin : consultation seule. */
export function BandeauLectureSeule() {
  const t = useT();
  const { peutGerer } = useDroits();
  if (peutGerer) return null;
  return (
    <View testID="bandeau-lecture-seule" accessibilityRole="text" style={styles.bandeau}>
      <Icone name="lock" size={16} color={colors.brandPrimary} />
      <View style={styles.texte}>
        <Text style={styles.titre}>{t("droits.lectureSeule")}</Text>
        <Text style={styles.detail}>{t("droits.lectureSeuleDetail")}</Text>
      </View>
    </View>
  );
}

const styles = stylesDynamiques(() =>
  StyleSheet.create({
    bandeau: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      padding: spacing.md,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.brandTertiary,
    },
    texte: { flex: 1, gap: 2 },
    titre: { fontFamily: fonts.text, fontSize: 13, fontWeight: "800", color: colors.brandPrimary },
    detail: { fontFamily: fonts.text, fontSize: 12, color: colors.onSurface },
  }),
);
