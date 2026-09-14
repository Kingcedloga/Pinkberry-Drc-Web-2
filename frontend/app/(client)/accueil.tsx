import Feather from "@react-native-vector-icons/feather";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { apiFetch } from "@/src/api";
import { useAuth } from "@/src/auth";
import { Chips } from "@/src/components/Chips";
import { FeuilleProduit, Produit } from "@/src/components/FeuilleProduit";
import { Logo } from "@/src/components/Logo";
import { fc, usd } from "@/src/money";
import { usePanier } from "@/src/panier";
import { colors, fonts, radius, softShadow, spacing } from "@/src/theme";
import { useToast } from "@/src/toast";

const CATEGORIES = ["Tous", "Pots de crème", "Smoothies", "Toppings", "Boissons"];

export default function Accueil() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const toast = useToast();
  const { ajouter, nbArticles, sousTotal } = usePanier();

  const [recherche, setRecherche] = useState("");
  const [categorie, setCategorie] = useState("Tous");
  const [produitOuvert, setProduitOuvert] = useState<Produit | null>(null);

  const produitsQ = useQuery({ queryKey: ["produits"], queryFn: () => apiFetch<Produit[]>("/produits") });
  const commandesQ = useQuery({
    queryKey: ["mes-commandes"],
    queryFn: () => apiFetch<any[]>("/commandes/mes"),
    enabled: !!user,
  });

  const produits = produitsQ.data ?? [];
  const aRecommander = (commandesQ.data ?? []).filter((c) => c.statut === "livree").slice(0, 5);

  const filtres = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return produits.filter(
      (p) =>
        (categorie === "Tous" || p.categorie === categorie) &&
        (!q || p.nom.toLowerCase().includes(q) || p.categorie.toLowerCase().includes(q)),
    );
  }, [produits, categorie, recherche]);

  const recommander = (commande: any) => {
    commande.items.forEach((i: any) =>
      ajouter({
        produitId: i.produitId,
        nom: i.nom,
        taille: i.taille,
        garnitures: i.garnitures ?? [],
        quantite: i.quantite,
        prixUnitaire: i.prixUnitaire,
        emoji: i.emoji,
        image: i.image,
      }),
    );
    toast.show("Panier rempli avec votre ancienne commande", "succes");
  };

  return (
    <View testID="ecran-accueil" style={styles.ecran}>
      {/* En-tête collant */}
      <View style={[styles.entete, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.enteteHaut}>
          <Logo taille={24} />
          <Pressable testID="btn-profil" onPress={() => router.push("/compte")} style={styles.avatar}>
            <Feather name="user" size={20} color={colors.brandPrimary} />
          </Pressable>
        </View>
        <View style={styles.rechercheWrap}>
          <Feather name="search" size={18} color={colors.muted} />
          <TextInput
            testID="input-recherche"
            value={recherche}
            onChangeText={setRecherche}
            placeholder="Rechercher un pot, un smoothie…"
            placeholderTextColor={colors.muted}
            style={styles.recherche}
          />
        </View>
        <Chips options={CATEGORIES} valeur={categorie} onChange={setCategorie} />
      </View>

      {produitsQ.isLoading ? (
        <View style={styles.centre}>
          <ActivityIndicator color={colors.brandPrimary} size="large" />
        </View>
      ) : produitsQ.isError ? (
        <View style={styles.centre}>
          <Text style={styles.vide}>Impossible de charger le catalogue</Text>
          <Pressable testID="btn-recharger" onPress={() => produitsQ.refetch()} style={styles.recharger}>
            <Text style={styles.rechargerTexte}>Recharger</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          testID="liste-produits"
          data={filtres}
          keyExtractor={(p) => p.id}
          contentContainerStyle={[styles.liste, { paddingBottom: nbArticles > 0 ? 110 : spacing.xl }]}
          refreshing={produitsQ.isRefetching}
          onRefresh={() => produitsQ.refetch()}
          ListHeaderComponent={
            aRecommander.length > 0 ? (
              <View testID="section-recommander" style={styles.recoSection}>
                <Text style={styles.sectionTitre}>Recommander</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recoRow}>
                  {aRecommander.map((c) => (
                    <View key={c.id} testID={`carte-reco-${c.numero}`} style={styles.recoCarte}>
                      <Text style={styles.recoNumero}>{c.numero}</Text>
                      <Text style={styles.recoItems} numberOfLines={2}>
                        {c.items.map((i: any) => `${i.quantite}× ${i.nom}`).join(", ")}
                      </Text>
                      <Text style={styles.recoTotal}>{usd(c.total)}</Text>
                      <Pressable
                        testID={`btn-recommander-${c.numero}`}
                        onPress={() => recommander(c)}
                        style={styles.recoBtn}
                      >
                        <Feather name="refresh-cw" size={13} color={colors.onBrandPrimary} />
                        <Text style={styles.recoBtnTexte}>Recommander</Text>
                      </Pressable>
                    </View>
                  ))}
                </ScrollView>
                <Text style={styles.sectionTitre}>Notre carte</Text>
              </View>
            ) : (
              <Text style={[styles.sectionTitre, styles.sectionSeule]}>Notre carte</Text>
            )
          }
          ListEmptyComponent={
            <View style={styles.centre}>
              <Text style={styles.videEmoji}>🍧</Text>
              <Text style={styles.vide}>Aucun produit dans cette catégorie</Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              testID={`produit-${item.id}`}
              disabled={!item.disponible}
              onPress={() => setProduitOuvert(item)}
              style={({ pressed }) => [styles.carte, pressed && styles.cartePressee, !item.disponible && styles.carteIndispo]}
            >
              {item.image ? (
                <Image source={{ uri: item.image }} style={styles.vignette} contentFit="cover" transition={200} />
              ) : (
                <View style={[styles.vignette, styles.vignetteVide]}>
                  <Text style={styles.vignetteEmoji}>{item.emoji ?? "🍦"}</Text>
                </View>
              )}
              <View style={styles.carteTexte}>
                <Text style={styles.produitNom} numberOfLines={1}>
                  {item.nom}
                </Text>
                <Text style={styles.produitCat}>{item.categorie}</Text>
                <Text style={styles.produitPrix}>
                  {usd(item.prix)} <Text style={styles.produitFc}>· {fc(item.prix)}</Text>
                </Text>
                {!item.disponible ? <Text style={styles.rupture}>En rupture</Text> : null}
              </View>
              <View style={styles.plus}>
                <Feather name="plus" size={20} color={colors.onBrandPrimary} />
              </View>
            </Pressable>
          )}
        />
      )}

      {nbArticles > 0 ? (
        <Pressable
          testID="barre-panier"
          onPress={() => router.push("/panier")}
          style={({ pressed }) => [
            styles.barrePanier,
            { bottom: spacing.lg, backgroundColor: pressed ? colors.brandSecondary : colors.brandPrimary },
          ]}
        >
          <View style={styles.badge}>
            <Text style={styles.badgeTexte}>{nbArticles}</Text>
          </View>
          <Text style={styles.barreTexte}>Voir mon panier</Text>
          <Text style={styles.barreTotal}>{usd(sousTotal)}</Text>
        </Pressable>
      ) : null}

      <FeuilleProduit
        produit={produitOuvert}
        visible={!!produitOuvert}
        onClose={() => setProduitOuvert(null)}
        onAjouter={(a) => {
          ajouter(a);
          toast.show("Ajouté au panier", "succes");
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: colors.surfaceSecondary },
  entete: {
    backgroundColor: colors.surface,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
    paddingBottom: spacing.sm,
    ...softShadow,
  },
  enteteHaut: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  rechercheWrap: {
    marginHorizontal: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSecondary,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  recherche: { flex: 1, fontFamily: fonts.text, fontSize: 14, color: colors.onSurface },
  liste: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, gap: spacing.md },
  centre: { alignItems: "center", justifyContent: "center", paddingVertical: spacing.xxxl, gap: spacing.sm },
  vide: { fontFamily: fonts.text, fontSize: 14, color: colors.muted },
  videEmoji: { fontSize: 42 },
  recharger: { paddingHorizontal: spacing.xl, minHeight: 44, justifyContent: "center" },
  rechargerTexte: { fontFamily: fonts.text, fontWeight: "700", color: colors.brandPrimary },
  recoSection: { gap: spacing.md, marginBottom: spacing.xs },
  sectionSeule: { marginBottom: spacing.xs },
  sectionTitre: { fontFamily: fonts.display, fontSize: 20, color: colors.onSurface },
  recoRow: { gap: spacing.md, paddingRight: spacing.lg, paddingBottom: spacing.xs },
  recoCarte: {
    width: 190,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    ...softShadow,
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
    ...softShadow,
  },
  cartePressee: { backgroundColor: colors.brandTertiary },
  carteIndispo: { opacity: 0.55 },
  vignette: { width: 72, height: 72, borderRadius: radius.lg, backgroundColor: colors.brandTertiary },
  vignetteVide: { alignItems: "center", justifyContent: "center" },
  vignetteEmoji: { fontSize: 32 },
  carteTexte: { flex: 1, gap: 2 },
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
  barrePanier: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
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
});
