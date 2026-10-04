import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Icone } from "@/src/components/Icone";
import { useLibelle } from "@/src/catalogue-i18n";
import { useLangue, useT } from "@/src/i18n";
import { usePanier } from "@/src/panier";
import { useDescriptionPromo, usePromotionsActives, type Promotion } from "@/src/promotions";
import { colors, fonts, poids, radius, spacing, stylesDynamiques } from "@/src/theme";
import { useToast } from "@/src/toast";

/**
 * Promotions en cours, aux couleurs Pinkberry : automatiques (appliquées d'elles-
 * mêmes au paiement) et codes publics. Toucher un code l'ajoute au panier : il
 * est appliqué automatiquement au paiement. Rien ne s'affiche sans promotion.
 */
export function BannierePromotions() {
  const t = useT();
  const { langue } = useLangue();
  const libelle = useLibelle();
  const decrire = useDescriptionPromo();
  const toast = useToast();
  const { codePromo, setCodePromo } = usePanier();
  const q = usePromotionsActives();
  const promos = q.data ?? [];

  const utiliser = (p: Promotion) => {
    if (!p.code) return;
    setCodePromo(p.code);
    toast.show(t("promo.codeAjouteTexte"), "succes", t("promo.codeAjoute", { code: p.code }));
  };
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
        {promos.map((p) => {
          const choisi = !!p.code && codePromo === p.code;
          return (
            <Pressable
              key={p.id}
              testID={`promo-${p.id}`}
              disabled={!p.code}
              accessibilityRole={p.code ? "button" : undefined}
              accessibilityLabel={p.code ? t("promo.utiliserCode", { code: p.code }) : undefined}
              onPress={() => utiliser(p)}
              style={({ pressed }) => [styles.carte, promos.length === 1 && styles.carteSeule, pressed && { opacity: 0.85 }]}
            >
              <Text style={styles.remise} numberOfLines={2}>
                {decrire(p)}
              </Text>
              <Text style={styles.nom} numberOfLines={1}>
                {libelle(p.nom, p.nomEn)}
              </Text>
              {p.code ? (
                <View style={styles.codeLigne}>
                  <Text testID={`code-${p.code}`} style={styles.code}>
                    {p.code}
                  </Text>
                  <Text style={[styles.codeAction, choisi && { color: colors.success }]}>
                    {choisi ? `✓ ${t("promo.codeChoisi")}` : t("promo.toucherPourUtiliser")}
                  </Text>
                </View>
              ) : (
                <Text style={styles.auto}>{t("promo.automatique")}</Text>
              )}
              {p.dateFin ? <Text style={styles.fin}>{t("promo.jusquau", { date: date(p.dateFin) })}</Text> : null}
            </Pressable>
          );
        })}
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
    codeLigne: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.xs },
    code: {
      fontFamily: fonts.text,
      fontSize: 13,
      fontWeight: poids.fort,
      letterSpacing: 1,
      color: colors.brandPrimary,
      borderWidth: 1,
      borderStyle: "dashed",
      borderColor: colors.brandPrimary,
      borderRadius: radius.md,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
    },
    codeAction: { flexShrink: 1, fontFamily: fonts.text, fontSize: 11, fontWeight: poids.fort, color: colors.muted },
    auto: { fontFamily: fonts.text, fontSize: 11, fontWeight: poids.fort, color: colors.success, marginTop: 2 },
  }),
);
