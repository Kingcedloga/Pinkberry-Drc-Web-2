import Feather from "@react-native-vector-icons/feather";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Bouton } from "@/src/components/Bouton";
import { usePanier } from "@/src/panier";
import { colors, fonts, radius, softShadow, spacing } from "@/src/theme";
import { useMontant } from "@/src/taux";

export default function Panier() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { usd, fc } = useMontant();
  const { articles, changerQuantite, retirer, sousTotal, nbArticles } = usePanier();

  return (
    <View testID="ecran-panier" style={styles.ecran}>
      <View style={[styles.entete, { paddingTop: insets.top + spacing.md }]}>
        <Pressable testID="btn-retour-panier" onPress={() => router.back()} style={styles.iconeBtn} hitSlop={8}>
          <Feather name="arrow-left" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.titre}>Mon panier</Text>
        <View style={styles.iconeBtn} />
      </View>

      {articles.length === 0 ? (
        <View style={styles.centre}>
          <Text style={styles.videEmoji}>🛒</Text>
          <Text style={styles.vide}>Votre panier est vide</Text>
          <Bouton
            testID="btn-retour-catalogue"
            label="Retour au catalogue"
            variant="secondaire"
            onPress={() => router.replace("/accueil")}
          />
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.liste}>
            {articles.map((a) => (
              <View key={a.cle} testID={`panier-article-${a.produitId}`} style={styles.carte}>
                {a.image ? (
                  <Image source={{ uri: a.image }} style={styles.vignette} contentFit="cover" />
                ) : (
                  <View style={[styles.vignette, styles.vignetteVide]}>
                    <Text style={styles.vignetteEmoji}>{a.emoji ?? "🍦"}</Text>
                  </View>
                )}
                <View style={styles.texte}>
                  <Text style={styles.nom} numberOfLines={1}>
                    {a.nom}
                  </Text>
                  <Text style={styles.options} numberOfLines={2}>
                    {[a.taille, ...a.garnitures.map((g) => g.nom)].filter(Boolean).join(" · ") || "Sans option"}
                  </Text>
                  <Text style={styles.prix}>
                    {usd(a.prixUnitaire * a.quantite)} <Text style={styles.prixFc}>≈ {fc(a.prixUnitaire * a.quantite)}</Text>
                  </Text>
                </View>
                <View style={styles.actions}>
                  <Pressable testID={`btn-retirer-${a.produitId}`} onPress={() => retirer(a.cle)} hitSlop={6} style={styles.suppr}>
                    <Feather name="trash-2" size={16} color={colors.error} />
                  </Pressable>
                  <View style={styles.qRow}>
                    <Pressable
                      testID={`btn-moins-${a.produitId}`}
                      onPress={() => changerQuantite(a.cle, -1)}
                      style={styles.qBtn}
                    >
                      <Feather name="minus" size={15} color={colors.brandPrimary} />
                    </Pressable>
                    <Text style={styles.qValeur}>{a.quantite}</Text>
                    <Pressable
                      testID={`btn-plus-${a.produitId}`}
                      onPress={() => changerQuantite(a.cle, 1)}
                      style={styles.qBtn}
                    >
                      <Feather name="plus" size={15} color={colors.brandPrimary} />
                    </Pressable>
                  </View>
                </View>
              </View>
            ))}
          </ScrollView>

          <View style={[styles.pied, { paddingBottom: insets.bottom + spacing.lg }]}>
            <View style={styles.ligneTotal}>
              <Text style={styles.sousTotalLabel}>Sous-total ({nbArticles} articles)</Text>
              <View>
                <Text testID="panier-sous-total" style={styles.sousTotalValeur}>
                  {usd(sousTotal)}
                </Text>
                <Text style={styles.sousTotalFc}>≈ {fc(sousTotal)}</Text>
              </View>
            </View>
            <Bouton
              testID="btn-choisir-adresse"
              label="Choisir l'adresse de livraison"
              icone="map-pin"
              onPress={() => router.push("/adresse")}
            />
          </View>
        </>
      )}
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
  titre: { fontFamily: fonts.display, fontSize: 20, color: colors.onSurface },
  centre: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.lg, paddingHorizontal: spacing.xl },
  vide: { fontFamily: fonts.text, fontSize: 15, color: colors.muted },
  videEmoji: { fontSize: 46 },
  liste: { padding: spacing.lg, gap: spacing.md },
  carte: {
    flexDirection: "row",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...softShadow,
  },
  vignette: { width: 64, height: 64, borderRadius: radius.md, backgroundColor: colors.brandTertiary },
  vignetteVide: { alignItems: "center", justifyContent: "center" },
  vignetteEmoji: { fontSize: 28 },
  texte: { flex: 1, gap: 2 },
  nom: { fontFamily: fonts.display, fontSize: 16, color: colors.onSurface },
  options: { fontFamily: fonts.text, fontSize: 11, color: colors.muted },
  prix: { fontFamily: fonts.display, fontSize: 15, color: colors.brandPrimary },
  prixFc: { fontFamily: fonts.text, fontSize: 10, color: colors.muted },
  actions: { alignItems: "flex-end", justifyContent: "space-between", gap: spacing.sm },
  suppr: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  qRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  qBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  qValeur: { fontFamily: fonts.display, fontSize: 15, color: colors.onSurface, minWidth: 18, textAlign: "center" },
  pied: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.md,
    ...softShadow,
  },
  ligneTotal: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sousTotalLabel: { fontFamily: fonts.text, fontSize: 14, color: colors.muted, fontWeight: "700" },
  sousTotalValeur: { fontFamily: fonts.display, fontSize: 22, color: colors.onSurface, textAlign: "right" },
  sousTotalFc: { fontFamily: fonts.text, fontSize: 11, color: colors.muted, textAlign: "right" },
});
