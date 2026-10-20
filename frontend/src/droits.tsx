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

/**
 * Notice des pages de configuration pour un admin : consultation seule.
 * Discrète (fond de carte, fine bordure) pour ne pas se confondre avec les
 * blocs d'information de la page ; le texte passe à la ligne sur mobile.
 */
export function BandeauLectureSeule() {
  const t = useT();
  const { peutGerer } = useDroits();
  if (peutGerer) return null;
  return (
    <View testID="bandeau-lecture-seule" accessibilityRole="text" style={styles.bandeau}>
      <View style={styles.pastille}>
        <Icone name="lock" size={14} color={colors.brandPrimary} />
      </View>
      <Text style={styles.texte}>
        <Text style={styles.titre}>{t("droits.lectureSeule")}</Text>
        <Text style={styles.separateur}>  ·  </Text>
        {t("droits.lectureSeuleDetail")}
      </Text>
    </View>
  );
}

const styles = stylesDynamiques(() =>
  StyleSheet.create({
    bandeau: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    pastille: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.brandTertiary,
    },
    texte: { flex: 1, fontFamily: fonts.text, fontSize: 13, lineHeight: 19, color: colors.muted },
    titre: { fontWeight: "800", color: colors.onSurface },
    separateur: { color: colors.border },
  }),
);
