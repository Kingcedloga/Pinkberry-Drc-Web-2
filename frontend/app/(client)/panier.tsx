import { Icone } from "@/src/components/Icone";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Bouton } from "@/src/components/Bouton";
import { PhotoProduit } from "@/src/components/PhotoProduit";
import { useT } from "@/src/i18n";
import { TitrePage } from "@/src/components/TitrePage";
import { usePanier } from "@/src/panier";
import { LARGEUR_CONTENU, useEcran } from "@/src/reactif";
import { colors, fonts, radius, softShadow, spacing, stylesDynamiques } from "@/src/theme";
import { useTheme } from "@/src/theme-contexte";
import { useMontant } from "@/src/taux";

export default function Panier() {
  useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { bureau } = useEcran();
  const t = useT();
  const { usd, fc } = useMontant();
  const { articles, changerQuantite, retirer, sousTotal, nbArticles } = usePanier();

  return (
    <View testID="ecran-panier" style={styles.ecran}>

      {articles.length === 0 ? (
        <View style={styles.centre}>
          <Icone name="shopping-cart" size={46} color={colors.brandTertiary} />
          <Text style={styles.vide}>{t("panier.vide")}</Text>
          <Bouton
            testID="btn-retour-catalogue"
            label={t("panier.retourCatalogue")}
            variant="secondaire"
            onPress={() => router.replace("/menu")}
          />
        </View>
      ) : (
        <View style={bureau ? styles.page : styles.pageMobile}>
          <ScrollView contentContainerStyle={[styles.liste, bureau && styles.listeBureau]} style={styles.colonne}>
            <TitrePage titre={t("panier.titre")} sousTitre={t("panier.sousTotal", { n: nbArticles })} retour="/menu" />
            {articles.map((a) => (
              <View key={a.cle} testID={`panier-article-${a.produitId}`} style={styles.carte}>
                {a.image ? (
                  <PhotoProduit image={a.image} taille={64} rayon={radius.md} />
                ) : (
                  <PhotoProduit taille={64} rayon={radius.md} />
                )}
                <View style={styles.texte}>
                  <Text style={styles.nom} numberOfLines={1}>
                    {a.nom}
                  </Text>
                  <Text style={styles.options} numberOfLines={2}>
                    {[a.taille, ...a.garnitures.map((g) => g.nom)].filter(Boolean).join(" · ") || t("panier.sansOption")}
                  </Text>
                  <Text style={styles.prix}>
                    {usd(a.prixUnitaire * a.quantite)} <Text style={styles.prixFc}>≈ {fc(a.prixUnitaire * a.quantite)}</Text>
                  </Text>
                </View>
                <View style={styles.actions}>
                  <Pressable testID={`btn-retirer-${a.produitId}`} onPress={() => retirer(a.cle)} hitSlop={6} style={styles.suppr}>
                    <Icone name="trash-2" size={16} color={colors.error} />
                  </Pressable>
                  <View style={styles.qRow}>
                    <Pressable
                      testID={`btn-moins-${a.produitId}`}
                      onPress={() => changerQuantite(a.cle, -1)}
                      style={styles.qBtn}
                    >
                      <Icone name="minus" size={15} color={colors.brandPrimary} />
                    </Pressable>
                    <Text style={styles.qValeur}>{a.quantite}</Text>
                    <Pressable
                      testID={`btn-plus-${a.produitId}`}
                      onPress={() => changerQuantite(a.cle, 1)}
                      style={styles.qBtn}
                    >
                      <Icone name="plus" size={15} color={colors.brandPrimary} />
                    </Pressable>
                  </View>
                </View>
              </View>
            ))}
          </ScrollView>

          <View
            style={[
              styles.pied,
              bureau ? styles.recap : { paddingBottom: insets.bottom + spacing.lg },
            ]}
          >
            {bureau ? <Text style={styles.recapTitre}>Récapitulatif</Text> : null}
            <View style={styles.ligneTotal}>
              <Text style={styles.sousTotalLabel}>{t("panier.sousTotal", { n: nbArticles })}</Text>
              <View>
                <Text testID="panier-sous-total" style={styles.sousTotalValeur}>
                  {usd(sousTotal)}
                </Text>
                <Text style={styles.sousTotalFc}>≈ {fc(sousTotal)}</Text>
              </View>
            </View>
            <Bouton
              testID="btn-choisir-adresse"
              label={t("panier.choisirAdresse")}
              icone="map-pin"
              onPress={() => router.push("/commande/adresse")}
            />
            {bureau ? (
              <Text style={styles.recapNote}>Frais de livraison confirmés à l&apos;étape suivante.</Text>
            ) : null}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = stylesDynamiques(() => StyleSheet.create({
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
  page: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.xl,
    width: "100%",
    maxWidth: 1160,
    alignSelf: "center",
    padding: spacing.xl,
  },
  pageMobile: { flex: 1 },
  colonne: { flex: 1, minWidth: 0 },
  liste: { ...LARGEUR_CONTENU, padding: spacing.lg, gap: spacing.md },
  listeBureau: { maxWidth: undefined, padding: 0, gap: spacing.md },
  recap: {
    width: 360,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    maxWidth: undefined,
    alignSelf: "flex-start",
  },
  recapTitre: { fontFamily: fonts.display, fontSize: 19, color: colors.onSurface },
  recapNote: { fontFamily: fonts.text, fontSize: 12, color: colors.muted, textAlign: "center" },
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
    ...LARGEUR_CONTENU,
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
}));
