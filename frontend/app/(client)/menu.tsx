import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { apiFetch } from "@/src/api";
import { BanniereRecommandes } from "@/src/components/BanniereRecommandes";
import { Chargement } from "@/src/components/Chargement";
import { Chips } from "@/src/components/Chips";
import { FeuilleProduit, Produit } from "@/src/components/FeuilleProduit";
import { Icone } from "@/src/components/Icone";
import { PhotoProduit } from "@/src/components/PhotoProduit";
import { useT } from "@/src/i18n";
import { usePanier } from "@/src/panier";
import { useEcran } from "@/src/reactif";
import { colors, fonts, radius, softShadow, spacing, stylesDynamiques } from "@/src/theme";
import { useMontant } from "@/src/taux";
import { useTheme } from "@/src/theme-contexte";
import { useToast } from "@/src/toast";

const CATEGORIES_DEFAUT = ["Tous"];
const LARGEUR_PAGE = 1360;

/** Catalogue web : filtres en colonne sur grand écran, grille de produits multi-colonnes. */
export default function Menu() {
  useTheme();
  const router = useRouter();
  const toast = useToast();
  const t = useT();
  const { usd, fc } = useMontant();
  const { ajouter, nbArticles, sousTotal } = usePanier();
  const { bureau, large, tablette } = useEcran();

  const [recherche, setRecherche] = useState("");
  const [categorie, setCategorie] = useState("Tous");
  const [produitOuvert, setProduitOuvert] = useState<Produit | null>(null);

  const colonnes = large ? 4 : bureau ? 3 : tablette ? 2 : 1;

  const produitsQ = useQuery({ queryKey: ["produits"], queryFn: () => apiFetch<Produit[]>("/produits") });
  const categoriesQ = useQuery({ queryKey: ["categories"], queryFn: () => apiFetch<string[]>("/categories") });

  const produits = useMemo(() => produitsQ.data ?? [], [produitsQ.data]);
  const categories = categoriesQ.data ?? CATEGORIES_DEFAUT;
  const enAvant = produits.filter((p) => p.enAvant);
  const rechercheActive = recherche.trim().length > 0;

  const filtres = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return produits.filter(
      (p) =>
        (categorie === "Tous" || p.categorie === categorie) &&
        (!q || p.nom.toLowerCase().includes(q) || p.categorie.toLowerCase().includes(q)),
    );
  }, [produits, categorie, recherche]);

  // La dernière rangée est complétée pour que les cartes gardent leur largeur.
  const donnees = useMemo(() => {
    if (colonnes <= 1) return filtres;
    const reste = filtres.length % colonnes;
    if (reste === 0) return filtres;
    const bouchons = Array.from({ length: colonnes - reste }, (_, i) => ({ id: `vide-${i}`, vide: true }));
    return [...filtres, ...(bouchons as any[])];
  }, [filtres, colonnes]);

  const enTete = (
    <View style={styles.enTete}>
      <View style={styles.hero}>
        <Text style={styles.heroTitre}>Le vrai frozen yogurt, livré chez vous à Kinshasa</Text>
        <Text style={styles.heroSous}>
          Choisissez vos pots, smoothies et garnitures. Paiement à la livraison.
        </Text>
        <View style={styles.rechercheWrap}>
          <Icone name="search" size={18} color={colors.muted} />
          <TextInput
            testID="input-recherche"
            value={recherche}
            onChangeText={setRecherche}
            placeholder={t("accueil.rechercher")}
            placeholderTextColor={colors.muted}
            style={styles.recherche}
          />
        </View>
      </View>

      {!bureau ? <Chips options={categories} valeur={categorie} onChange={setCategorie} /> : null}

      {!rechercheActive ? (
        <BanniereRecommandes produits={enAvant} onChoisir={(p) => setProduitOuvert(p)} />
      ) : null}

      <View style={styles.titreListe}>
        <Text style={styles.sectionTitre}>{categorie === "Tous" ? t("accueil.notreCarte") : categorie}</Text>
        <Text style={styles.compteur}>
          {filtres.length} produit{filtres.length > 1 ? "s" : ""}
        </Text>
      </View>
    </View>
  );

  const grille = (
    <FlatList
      testID="liste-produits"
      data={donnees}
      key={`grille-${colonnes}`}
      numColumns={colonnes}
      columnWrapperStyle={colonnes > 1 ? styles.rangee : undefined}
      keyExtractor={(p: any) => p.id}
      contentContainerStyle={[styles.liste, { paddingBottom: nbArticles > 0 && !bureau ? 110 : spacing.xxxl }]}
      refreshing={produitsQ.isRefetching}
      onRefresh={() => produitsQ.refetch()}
      ListHeaderComponent={enTete}
      ListEmptyComponent={
        <View style={styles.centre}>
          <Icone name="ice-cream" size={42} color={colors.brandTertiary} />
          <Text style={styles.vide}>{t("accueil.aucunProduit")}</Text>
        </View>
      }
      renderItem={({ item }: any) =>
        item.vide ? (
          <View style={styles.carteVide} />
        ) : (
          <Pressable
            testID={`produit-${item.id}`}
            disabled={!item.disponible}
            onPress={() => setProduitOuvert(item)}
            style={({ pressed, hovered }: any) => [
              styles.carte,
              colonnes > 1 && styles.carteGrille,
              (pressed || hovered) && styles.carteSurvol,
              !item.disponible && styles.carteIndispo,
            ]}
          >
            <PhotoProduit image={item.image} taille={colonnes > 1 ? 150 : 76} />
            <View style={[styles.carteTexte, colonnes > 1 && styles.carteTexteGrille]}>
              <Text style={styles.produitNom} numberOfLines={1}>
                {item.nom}
              </Text>
              <Text style={styles.produitCat}>{item.categorie}</Text>
              <Text style={styles.produitPrix}>
                {usd(item.prix)} <Text style={styles.produitFc}>≈ {fc(item.prix)}</Text>
              </Text>
              {!item.disponible ? <Text style={styles.rupture}>{t("accueil.rupture")}</Text> : null}
            </View>
            <View style={[styles.plus, colonnes > 1 && styles.plusGrille]}>
              <Icone name="plus" size={18} color={colors.onBrandPrimary} />
              {colonnes > 1 ? <Text style={styles.plusTexte}>Ajouter</Text> : null}
            </View>
          </Pressable>
        )
      }
    />
  );

  return (
    <View testID="ecran-menu" style={styles.ecran}>
      {produitsQ.isLoading ? (
        <View style={styles.centre}>
          <Chargement taille={52} />
        </View>
      ) : produitsQ.isError ? (
        <View style={styles.centre}>
          <Text style={styles.vide}>{t("accueil.erreur")}</Text>
          <Pressable testID="btn-recharger" onPress={() => produitsQ.refetch()} style={styles.recharger}>
            <Text style={styles.rechargerTexte}>{t("accueil.recharger")}</Text>
          </Pressable>
        </View>
      ) : bureau ? (
        <View style={styles.page}>
          <View style={styles.filtres}>
            <Text style={styles.filtresTitre}>Catégories</Text>
            {categories.map((c) => {
              const actif = c === categorie;
              return (
                <Pressable
                  key={c}
                  testID={`filtre-${c}`}
                  onPress={() => setCategorie(c)}
                  style={({ pressed }) => [
                    styles.filtre,
                    actif && styles.filtreActif,
                    !actif && pressed && { backgroundColor: colors.brandTertiary },
                  ]}
                >
                  <Text style={[styles.filtreTexte, actif && { color: colors.onBrandPrimary }]}>{c}</Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.colonneGrille}>{grille}</View>
        </View>
      ) : (
        grille
      )}

      {nbArticles > 0 && !bureau ? (
        <Pressable
          testID="barre-panier"
          onPress={() => router.push("/panier")}
          style={({ pressed }) => [
            styles.barrePanier,
            { backgroundColor: pressed ? colors.brandSecondary : colors.brandPrimary },
          ]}
        >
          <View style={styles.badge}>
            <Text style={styles.badgeTexte}>{nbArticles}</Text>
          </View>
          <Text style={styles.barreTexte}>{t("accueil.voirPanier")}</Text>
          <Text style={styles.barreTotal}>{usd(sousTotal)}</Text>
        </Pressable>
      ) : null}

      <FeuilleProduit
        produit={produitOuvert}
        visible={!!produitOuvert}
        onClose={() => setProduitOuvert(null)}
        onAjouter={(a) => {
          ajouter(a);
          toast.show(t("accueil.ajoute"), "succes");
        }}
      />
    </View>
  );
}

const styles = stylesDynamiques(() =>
  StyleSheet.create({
    ecran: { flex: 1, backgroundColor: colors.surfaceSecondary },
    page: {
      flex: 1,
      flexDirection: "row",
      gap: spacing.xl,
      width: "100%",
      maxWidth: LARGEUR_PAGE,
      alignSelf: "center",
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.xl,
    },
    filtres: { width: 220, gap: spacing.xs },
    filtresTitre: {
      fontFamily: fonts.text,
      fontSize: 11,
      fontWeight: "800",
      color: colors.muted,
      textTransform: "uppercase",
      marginBottom: spacing.sm,
      paddingHorizontal: spacing.md,
    },
    filtre: { minHeight: 44, justifyContent: "center", paddingHorizontal: spacing.md, borderRadius: radius.md },
    filtreActif: { backgroundColor: colors.brandPrimary },
    filtreTexte: { fontFamily: fonts.text, fontSize: 14, fontWeight: "700", color: colors.onSurface },
    colonneGrille: { flex: 1, minWidth: 0 },

    enTete: { gap: spacing.lg, paddingBottom: spacing.md },
    hero: {
      backgroundColor: colors.surface,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.xl,
      gap: spacing.sm,
      ...softShadow,
    },
    heroTitre: { fontFamily: fonts.display, fontSize: 28, lineHeight: 34, color: colors.onSurface },
    heroSous: { fontFamily: fonts.text, fontSize: 14, color: colors.muted },
    rechercheWrap: {
      marginTop: spacing.md,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      height: 48,
      borderRadius: radius.pill,
      backgroundColor: colors.surfaceSecondary,
      paddingHorizontal: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
      maxWidth: 520,
    },
    recherche: { flex: 1, fontFamily: fonts.text, fontSize: 14, color: colors.onSurface, outlineStyle: "none" } as any,

    liste: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, gap: spacing.md },
    rangee: { gap: spacing.md, alignItems: "stretch" },
    centre: { alignItems: "center", justifyContent: "center", paddingVertical: spacing.xxxl, gap: spacing.sm, flex: 1 },
    vide: { fontFamily: fonts.text, fontSize: 14, color: colors.muted },
    recharger: { paddingHorizontal: spacing.xl, minHeight: 44, justifyContent: "center" },
    rechargerTexte: { fontFamily: fonts.text, fontWeight: "700", color: colors.brandPrimary },

    recoSection: { gap: spacing.md },
    sectionTitre: { fontFamily: fonts.display, fontSize: 20, color: colors.onSurface },
    titreListe: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
    compteur: { fontFamily: fonts.text, fontSize: 12, color: colors.muted, fontWeight: "700" },
    recoRow: { gap: spacing.md, paddingRight: spacing.lg, paddingBottom: spacing.xs },
    recoCarte: {
      width: 200,
      backgroundColor: colors.surface,
      borderRadius: radius.xl,
      padding: spacing.lg,
      gap: spacing.xs,
      borderWidth: 1,
      borderColor: colors.border,
    },
    recoNumero: { fontFamily: fonts.text, fontSize: 11, fontWeight: "800", color: colors.muted },
    recoItems: { fontFamily: fonts.text, fontSize: 13, fontWeight: "700", color: colors.onSurface, minHeight: 36 },
    recoTotal: { fontFamily: fonts.display, fontSize: 17, color: colors.brandPrimary },
    recoBtn: {
      marginTop: spacing.xs,
      minHeight: 44,
      borderRadius: radius.pill,
      backgroundColor: colors.brandPrimary,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
    },
    recoBtnTexte: { fontFamily: fonts.text, fontSize: 13, fontWeight: "700", color: colors.onBrandPrimary },

    carte: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.lg,
      backgroundColor: colors.surface,
      borderRadius: radius.xl,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    carteGrille: { flex: 1, flexDirection: "column", alignItems: "center", padding: spacing.lg, gap: spacing.md },
    carteVide: { flex: 1 },
    carteSurvol: { borderColor: colors.brandPrimary, ...softShadow },
    carteIndispo: { opacity: 0.55 },
    carteTexte: { flex: 1, gap: 2 },
    carteTexteGrille: { alignItems: "center", flexGrow: 0, flexShrink: 0, flexBasis: "auto", width: "100%" },
    produitNom: { fontFamily: fonts.display, fontSize: 17, color: colors.onSurface },
    produitCat: { fontFamily: fonts.text, fontSize: 12, color: colors.muted },
    produitPrix: { fontFamily: fonts.display, fontSize: 15, color: colors.brandPrimary, marginTop: 2 },
    produitFc: { fontFamily: fonts.text, fontSize: 11, color: colors.muted },
    rupture: { fontFamily: fonts.text, fontSize: 11, fontWeight: "800", color: colors.error },
    plus: {
      width: 44,
      height: 44,
      borderRadius: radius.pill,
      backgroundColor: colors.brandPrimary,
      alignItems: "center",
      justifyContent: "center",
    },
    plusGrille: {
      width: "100%",
      flexDirection: "row",
      gap: spacing.sm,
      borderRadius: radius.md,
      minHeight: 44,
    },
    plusTexte: { fontFamily: fonts.text, fontSize: 14, fontWeight: "800", color: colors.onBrandPrimary },

    barrePanier: {
      position: "absolute",
      left: spacing.lg,
      right: spacing.lg,
      bottom: spacing.lg,
      height: 60,
      borderRadius: radius.pill,
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: spacing.lg,
      gap: spacing.md,
      ...softShadow,
    },
    badge: {
      minWidth: 30,
      height: 30,
      borderRadius: radius.pill,
      backgroundColor: colors.onBrandPrimary,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 6,
    },
    badgeTexte: { fontFamily: fonts.display, fontSize: 15, color: colors.brandPrimary },
    barreTexte: { flex: 1, fontFamily: fonts.text, fontSize: 15, fontWeight: "800", color: colors.onBrandPrimary },
    barreTotal: { fontFamily: fonts.display, fontSize: 17, color: colors.onBrandPrimary },
  }),
);
