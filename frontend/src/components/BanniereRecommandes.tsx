import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { type Produit } from "@/src/components/FeuilleProduit";
import { Icone } from "@/src/components/Icone";
import { PhotoProduit } from "@/src/components/PhotoProduit";
import { traduireContenuCatalogue } from "@/src/catalogue-i18n";
import { useT } from "@/src/i18n";
import { colors, fonts, poids, radius, softShadow, spacing, stylesDynamiques } from "@/src/theme";
import { useMontant } from "@/src/taux";

/**
 * Bannière « Recommandé » : les produits mis en avant par l'admin, en haut de
 * l'accueil client. Un seul produit = grande carte, plusieurs = carrousel.
 */
export function BanniereRecommandes({
  produits,
  onChoisir,
}: {
  produits: Produit[];
  onChoisir: (p: Produit) => void;
}) {
  const t = useT();
  const { usd, fc } = useMontant();

  if (produits.length === 0) return null;
  const seul = produits.length === 1;

  const carte = (p: Produit) => (
    <Pressable
      key={p.id}
      testID={`carte-recommande-${p.id}`}
      disabled={!p.disponible}
      onPress={() => onChoisir(p)}
      style={({ pressed }) => [
        styles.carte,
        seul && styles.carteSeule,
        pressed && styles.cartePressee,
        !p.disponible && styles.carteIndispo,
      ]}
    >
      <PhotoProduit image={p.image} taille={seul ? 92 : 76} rayon={radius.lg} />
      <View style={styles.carteTexte}>
        <Text style={styles.nom} numberOfLines={1}>
          {traduireContenuCatalogue(p.nom, t)}
        </Text>
        <Text style={styles.cat} numberOfLines={1}>
          {traduireContenuCatalogue(p.categorie, t)}
        </Text>
        <Text style={styles.prix} numberOfLines={1}>
          {fc(p.prix)} <Text style={styles.fc}>≈ {usd(p.prix)}</Text>
        </Text>
        {!p.disponible ? <Text style={styles.rupture}>{t("accueil.rupture")}</Text> : null}
      </View>
      <View style={styles.plus}>
        <Icone name="plus" size={18} color={colors.onBrandPrimary} />
      </View>
    </Pressable>
  );

  return (
    <View testID="banniere-recommandes" style={styles.banniere}>
      {/* Fond dégradé en calque : la bannière reste visible même si le dégradé
          n'est pas rendu (couleur pleine de secours dans `banniere`). */}
      <LinearGradient
        colors={[colors.brandPrimary, colors.brandSecondary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.badge}>
        <Text style={styles.badgeTexte}>⭐ {t("accueil.recommande")}</Text>
      </View>
      <Text style={styles.accroche}>{t("accueil.recommandeAccroche")}</Text>

      {seul ? (
        <View style={styles.solo}>{carte(produits[0])}</View>
      ) : (
        <ScrollView
          testID="carrousel-recommandes"
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.rangee}
        >
          {produits.map(carte)}
        </ScrollView>
      )}
    </View>
  );
}

const styles = stylesDynamiques(() => StyleSheet.create({
  banniere: {
    borderRadius: radius.xl,
    overflow: "hidden",
    backgroundColor: colors.brandPrimary,
    paddingVertical: spacing.lg,
    gap: spacing.sm,
    marginBottom: spacing.lg,
    ...softShadow,
  },
  badge: {
    alignSelf: "flex-start",
    marginHorizontal: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  badgeTexte: { fontFamily: fonts.text, fontSize: 12, fontWeight: poids.fort, color: colors.brandPrimary },
  accroche: {
    marginHorizontal: spacing.lg,
    fontFamily: fonts.display,
    fontSize: 18,
    fontWeight: poids.fort,
    color: colors.onBrandPrimary,
  },
  rangee: { paddingHorizontal: spacing.lg, gap: spacing.md },
  solo: { paddingHorizontal: spacing.lg },
  carte: {
    width: 252,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  carteSeule: { width: "100%" },
  cartePressee: { backgroundColor: colors.brandTertiary },
  carteIndispo: { opacity: 0.55 },
  carteTexte: { flex: 1, gap: 2 },
  nom: { fontFamily: fonts.display, fontSize: 15, fontWeight: poids.fort, color: colors.onSurface },
  cat: { fontFamily: fonts.text, fontSize: 11, fontWeight: poids.corps, color: colors.muted },
  prix: { fontFamily: fonts.text, fontSize: 13, fontWeight: poids.fort, color: colors.brandPrimary },
  fc: { fontFamily: fonts.text, fontSize: 11, fontWeight: poids.corps, color: colors.muted },
  rupture: { fontFamily: fonts.text, fontSize: 11, fontWeight: poids.fort, color: colors.error },
  plus: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
}));
