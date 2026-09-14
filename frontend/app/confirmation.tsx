import Feather from "@react-native-vector-icons/feather";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { apiFetch } from "@/src/api";
import { Bouton } from "@/src/components/Bouton";
import { usePanier } from "@/src/panier";
import { colors, fonts, radius, softShadow, spacing } from "@/src/theme";
import { useConfigApp, useMontant } from "@/src/taux";
import { useToast } from "@/src/toast";

export default function Confirmation() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();
  const { usd, fc } = useMontant();
  const { fraisLivraison: FRAIS } = useConfigApp();
  const { articles, adresse, sousTotal, vider } = usePanier();
  const [loading, setLoading] = useState(false);

  const total = sousTotal + FRAIS;

  const passerCommande = async () => {
    if (!adresse) {
      toast.show("Adresse manquante", "erreur");
      return;
    }
    setLoading(true);
    try {
      const cmd = await apiFetch<any>("/commandes", {
        method: "POST",
        body: {
          adresse,
          items: articles.map((a) => ({
            produitId: a.produitId,
            nom: a.nom,
            taille: a.taille,
            garnitures: a.garnitures,
            quantite: a.quantite,
            prixUnitaire: a.prixUnitaire,
            emoji: a.emoji,
            image: a.image,
          })),
        },
      });
      vider();
      qc.invalidateQueries({ queryKey: ["mes-commandes"] });
      toast.show(`Commande ${cmd.numero} envoyée !`, "succes");
      router.replace(`/suivi/${cmd.id}`);
    } catch (e: any) {
      toast.show(e.message, "erreur");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View testID="ecran-confirmation" style={styles.ecran}>
      <View style={[styles.entete, { paddingTop: insets.top + spacing.md }]}>
        <Pressable testID="btn-retour-confirmation" onPress={() => router.back()} style={styles.iconeBtn} hitSlop={8}>
          <Feather name="arrow-left" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.titre}>Confirmer la commande</Text>
        <View style={styles.iconeBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.contenu}>
        <View style={styles.carte}>
          <View style={styles.carteTitreRow}>
            <Feather name="map-pin" size={16} color={colors.brandPrimary} />
            <Text style={styles.carteTitre}>Livraison à {adresse?.label}</Text>
          </View>
          <Text style={styles.ligne}>
            {adresse?.avenue} n° {adresse?.numero}, {adresse?.commune}
          </Text>
          <Text style={styles.repere}>Repère : {adresse?.repere}</Text>
          <Text style={styles.ligne}>Contact : {adresse?.telephone}</Text>
        </View>

        <View style={styles.carte}>
          <View style={styles.carteTitreRow}>
            <Feather name="shopping-bag" size={16} color={colors.brandPrimary} />
            <Text style={styles.carteTitre}>Vos articles</Text>
          </View>
          {articles.map((a) => (
            <View key={a.cle} style={styles.articleRow}>
              <Text style={styles.articleNom}>
                {a.quantite}× {a.nom}
              </Text>
              <Text style={styles.articlePrix}>{usd(a.prixUnitaire * a.quantite)}</Text>
            </View>
          ))}
        </View>

        <View testID="badge-paiement-cash" style={styles.badgeCash}>
          <Feather name="dollar-sign" size={18} color={colors.brandPrimary} />
          <Text style={styles.badgeCashTexte}>Paiement à la livraison (cash)</Text>
        </View>

        <View style={styles.carte}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Sous-total</Text>
            <Text style={styles.totalValeur}>{usd(sousTotal)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Frais de livraison</Text>
            <Text style={styles.totalValeur}>{usd(FRAIS)}</Text>
          </View>
          <View style={styles.separateur} />
          <View style={styles.totalRow}>
            <Text style={styles.grandTotalLabel}>Total à payer</Text>
            <View>
              <Text testID="confirmation-total" style={styles.grandTotalValeur}>
                {usd(total)}
              </Text>
              <Text style={styles.grandTotalFc}>≈ {fc(total)}</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.pied, { paddingBottom: insets.bottom + spacing.lg }]}>
        <Bouton
          testID="btn-passer-commande"
          label="Passer la commande"
          icone="check"
          loading={loading}
          onPress={passerCommande}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: colors.surfaceSecondary },
  entete: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
    ...softShadow,
  },
  iconeBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  titre: { fontFamily: fonts.display, fontSize: 19, color: colors.onSurface },
  contenu: { padding: spacing.lg, gap: spacing.md },
  carte: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    ...softShadow,
  },
  carteTitreRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.xs },
  carteTitre: { fontFamily: fonts.display, fontSize: 16, color: colors.onSurface },
  ligne: { fontFamily: fonts.text, fontSize: 13, color: colors.onSurface },
  repere: { fontFamily: fonts.text, fontSize: 13, color: colors.brandPrimary, fontWeight: "700" },
  articleRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  articleNom: { flex: 1, fontFamily: fonts.text, fontSize: 13, color: colors.onSurface },
  articlePrix: { fontFamily: fonts.display, fontSize: 14, color: colors.onSurface },
  badgeCash: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.brandTertiary,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  badgeCashTexte: { fontFamily: fonts.text, fontSize: 13, fontWeight: "800", color: colors.brandPrimary },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 3 },
  totalLabel: { fontFamily: fonts.text, fontSize: 13, color: colors.muted, fontWeight: "700" },
  totalValeur: { fontFamily: fonts.text, fontSize: 14, color: colors.onSurface, fontWeight: "700" },
  separateur: { height: 1, backgroundColor: colors.divider, marginVertical: spacing.sm },
  grandTotalLabel: { fontFamily: fonts.display, fontSize: 17, color: colors.onSurface },
  grandTotalValeur: { fontFamily: fonts.display, fontSize: 24, color: colors.brandPrimary, textAlign: "right" },
  grandTotalFc: { fontFamily: fonts.text, fontSize: 11, color: colors.muted, textAlign: "right" },
  pied: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    ...softShadow,
  },
});
