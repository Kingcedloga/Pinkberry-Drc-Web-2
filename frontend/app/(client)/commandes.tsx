import { Icone } from "@/src/components/Icone";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { apiFetch } from "@/src/api";
import { hauteurOngletsNatifs } from "@/src/nav";
import { usd } from "@/src/money";
import { colors, fonts, radius, softShadow, spacing } from "@/src/theme";

const LIBELLES: Record<string, string> = {
  recue: "Commande reçue",
  en_preparation: "En préparation",
  recuperee: "Récupérée par le livreur",
  en_route: "Livreur en route",
  livree: "Livrée",
  annulee: "Annulée",
};

export function couleurStatut(statut: string) {
  if (statut === "livree") return colors.success;
  if (statut === "annulee") return colors.error;
  if (statut === "en_route") return colors.success;
  return colors.brandPrimary;
}

export default function Commandes() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const q = useQuery({
    queryKey: ["mes-commandes"],
    queryFn: () => apiFetch<any[]>("/commandes/mes"),
    refetchInterval: 6000,
  });

  return (
    <View testID="ecran-commandes" style={styles.ecran}>
      <View style={[styles.entete, { paddingTop: insets.top + spacing.lg }]}>
        <Text style={styles.titre}>Mes commandes</Text>
      </View>

      {q.isLoading ? (
        <View style={styles.centre}>
          <ActivityIndicator color={colors.brandPrimary} size="large" />
        </View>
      ) : (
        <FlatList
          testID="liste-commandes"
          data={q.data ?? []}
          keyExtractor={(c) => c.id}
          contentContainerStyle={[styles.liste, { paddingBottom: spacing.xl + hauteurOngletsNatifs(insets.bottom) }]}
          refreshing={q.isRefetching}
          onRefresh={() => q.refetch()}
          ListEmptyComponent={
            <View style={styles.centre}>
              <Icone name="receipt" size={42} color={colors.brandTertiary} />
              <Text style={styles.vide}>Aucune commande pour le moment</Text>
              <Pressable testID="btn-vers-catalogue" onPress={() => router.push("/accueil")} style={styles.lien}>
                <Text style={styles.lienTexte}>Voir la carte</Text>
              </Pressable>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              testID={`commande-${item.numero}`}
              onPress={() => router.push(`/suivi/${item.id}`)}
              style={({ pressed }) => [styles.carte, pressed && { backgroundColor: colors.brandTertiary }]}
            >
              <View style={styles.carteHaut}>
                <Text style={styles.numero}>{item.numero}</Text>
                <View style={[styles.pastille, { backgroundColor: couleurStatut(item.statut) }]}>
                  <Text style={styles.pastilleTexte}>{LIBELLES[item.statut] ?? item.statut}</Text>
                </View>
              </View>
              <Text style={styles.items} numberOfLines={2}>
                {item.items.map((i: any) => `${i.quantite}× ${i.nom}`).join(", ")}
              </Text>
              <View style={styles.carteBas}>
                <Text style={styles.adresse} numberOfLines={1}>
                  <Icone name="map-pin" size={12} color={colors.muted} /> {item.adresse?.commune} ·{" "}
                  {item.adresse?.avenue}
                </Text>
                <Text style={styles.total}>{usd(item.total)}</Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: colors.surfaceSecondary },
  entete: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  titre: { fontFamily: fonts.display, fontSize: 26, color: colors.onSurface },
  liste: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: spacing.md },
  centre: { alignItems: "center", justifyContent: "center", paddingVertical: spacing.xxxl, gap: spacing.sm },
  vide: { fontFamily: fonts.text, fontSize: 14, color: colors.muted },
  videEmoji: { fontSize: 42 },
  lien: { minHeight: 44, justifyContent: "center", paddingHorizontal: spacing.lg },
  lienTexte: { fontFamily: fonts.text, fontWeight: "700", color: colors.brandPrimary },
  carte: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    ...softShadow,
  },
  carteHaut: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  numero: { fontFamily: fonts.display, fontSize: 17, color: colors.onSurface },
  pastille: { paddingHorizontal: spacing.md, paddingVertical: 5, borderRadius: radius.pill },
  pastilleTexte: { fontFamily: fonts.text, fontSize: 11, fontWeight: "800", color: colors.onBrandPrimary },
  items: { fontFamily: fonts.text, fontSize: 13, color: colors.onSurface },
  carteBas: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  adresse: { flex: 1, fontFamily: fonts.text, fontSize: 12, color: colors.muted },
  total: { fontFamily: fonts.display, fontSize: 17, color: colors.brandPrimary },
});
