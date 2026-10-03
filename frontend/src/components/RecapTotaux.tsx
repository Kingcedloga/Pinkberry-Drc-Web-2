import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { useLibelle } from "@/src/catalogue-i18n";
import { useT } from "@/src/i18n";
import type { Totaux } from "@/src/promotions";
import { colors, fonts, spacing, stylesDynamiques } from "@/src/theme";
import { useMontant } from "@/src/taux";

/**
 * Détail du calcul d'une commande : sous-total, réductions par promotion,
 * livraison (offerte le cas échéant) et total final. Valeurs calculées par le
 * serveur (aperçu du checkout ou commande enregistrée).
 */
export function RecapTotaux({ totaux, testID = "recap-totaux" }: { totaux: Totaux; testID?: string }) {
  const t = useT();
  const libelle = useLibelle();
  const { fc, usd } = useMontant();
  const livraisonOfferte = (totaux.reductionLivraison ?? 0) > 0;

  return (
    <View testID={testID} style={styles.bloc}>
      <View style={styles.ligne}>
        <Text style={styles.libelle}>{t("confirmation.sousTotal")}</Text>
        <Text testID={`${testID}-sous-total`} style={styles.valeur}>
          {fc(totaux.sousTotal)}
        </Text>
      </View>
      {(totaux.promotions ?? [])
        .filter((p) => p.montant > 0)
        .map((p) => (
          <View key={p.id} style={styles.ligne}>
            <Text style={[styles.libelle, styles.promo]} numberOfLines={2}>
              {libelle(p.nom, p.nomEn)}
              {p.code ? ` (${p.code})` : ""}
            </Text>
            <Text testID={`${testID}-reduction`} style={[styles.valeur, styles.promo]}>
              −{fc(p.montant)}
            </Text>
          </View>
        ))}
      <View style={styles.ligne}>
        <Text style={styles.libelle}>{t("confirmation.frais")}</Text>
        {livraisonOfferte ? (
          <View style={styles.livraison}>
            <Text style={styles.barre}>{fc(totaux.fraisLivraison)}</Text>
            <Text testID={`${testID}-livraison-offerte`} style={[styles.valeur, styles.promo]}>
              {t("promo.offerte")}
            </Text>
          </View>
        ) : (
          <Text style={styles.valeur}>{fc(totaux.fraisLivraison)}</Text>
        )}
      </View>
      <View style={styles.separateur} />
      <View style={styles.ligne}>
        <Text style={styles.totalLibelle}>{t("confirmation.total")}</Text>
        <View style={styles.totalBloc}>
          <Text testID={`${testID}-total`} style={styles.totalValeur}>
            {fc(totaux.total)}
          </Text>
          <Text style={styles.usd}>≈ {usd(totaux.total)}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = stylesDynamiques(() =>
  StyleSheet.create({
    bloc: { gap: spacing.xs },
    ligne: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
    libelle: { flex: 1, fontFamily: fonts.text, fontSize: 14, color: colors.muted },
    valeur: { fontFamily: fonts.text, fontSize: 14, fontWeight: "700", color: colors.onSurface },
    promo: { color: colors.success, fontWeight: "800" },
    livraison: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
    barre: { fontFamily: fonts.text, fontSize: 13, color: colors.muted, textDecorationLine: "line-through" },
    separateur: { height: 1, backgroundColor: colors.border, marginVertical: spacing.xs },
    totalLibelle: { fontFamily: fonts.display, fontSize: 17, color: colors.onSurface },
    totalBloc: { alignItems: "flex-end" },
    totalValeur: { fontFamily: fonts.display, fontSize: 22, color: colors.brandPrimary },
    usd: { fontFamily: fonts.text, fontSize: 12, color: colors.muted },
  }),
);
