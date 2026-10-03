import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { Icone } from "@/src/components/Icone";
import { useLibelle } from "@/src/catalogue-i18n";
import { useLangue, useT } from "@/src/i18n";
import { useDescriptionPromo, usePromotionsActives } from "@/src/promotions";
import { colors, fonts, poids, radius, spacing, stylesDynamiques } from "@/src/theme";

/**
 * Promotions automatiques en cours, aux couleurs Pinkberry. Elles s'appliquent
 * d'elles-mêmes au paiement ; rien ne s'affiche s'il n'y en a aucune.
 */
export function BannierePromotions() {
  const t = useT();
  const { langue } = useLangue();
  const libelle = useLibelle();
  const decrire = useDescriptionPromo();
  const q = usePromotionsActives();
  const promos = q.data ?? [];
  if (promos.length === 0) return null;

  const date = (iso: string) =>
    new Date(iso).toLocaleDateString(langue === "en" ? "en-GB" : "fr-FR", { day: "numeric", month: "short" });

  return (
    <View testID="banniere-promotions" style={styles.banniere}>
      <LinearGradient
        colors={[colors.brandSecondary, colors.brandPrimary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.entete}>
        <Icone name="gift" size={18} color={colors.onBrandPrimary} />
        <Text style={styles.titre}>{t("promo.banniereTitre")}</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rangee}>
        {promos.map((p) => (
          <View key={p.id} testID={`promo-${p.id}`} style={[styles.carte, promos.length === 1 && styles.carteSeule]}>
            <Text style={styles.remise} numberOfLines={2}>
              {decrire(p)}
            </Text>
            <Text style={styles.nom} numberOfLines={1}>
              {libelle(p.nom, p.nomEn)}
            </Text>
            {p.dateFin ? <Text style={styles.fin}>{t("promo.jusquau", { date: date(p.dateFin) })}</Text> : null}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = stylesDynamiques(() =>
  StyleSheet.create({
    banniere: {
      borderRadius: radius.xl,
      overflow: "hidden",
      backgroundColor: colors.brandPrimary,
      paddingVertical: spacing.lg,
      gap: spacing.sm,
    },
    entete: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.lg },
    titre: { fontFamily: fonts.display, fontSize: 18, color: colors.onBrandPrimary },
    rangee: { gap: spacing.sm, paddingHorizontal: spacing.lg },
    carte: {
      width: 240,
      gap: 2,
      padding: spacing.md,
      borderRadius: radius.lg,
      backgroundColor: colors.surface,
    },
    carteSeule: { width: "auto", minWidth: 240 },
    remise: { fontFamily: fonts.display, fontSize: 16, color: colors.brandPrimary },
    nom: { fontFamily: fonts.text, fontSize: 13, fontWeight: poids.fort, color: colors.onSurface },
    fin: { fontFamily: fonts.text, fontSize: 11, color: colors.muted },
  }),
);
