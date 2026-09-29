import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { apiFetch } from "@/src/api";
import { Chargement } from "@/src/components/Chargement";
import { Icone } from "@/src/components/Icone";
import { useLibelle } from "@/src/catalogue-i18n";
import { useT, type CleTexte } from "@/src/i18n";
import { TitrePage } from "@/src/components/TitrePage";
import { prix } from "@/src/money";
import { LARGEUR_CONTENU } from "@/src/reactif";
import { colors, fonts, poids, radius, softShadow, spacing, stylesDynamiques } from "@/src/theme";
import { useTheme } from "@/src/theme-contexte";
import { useToast } from "@/src/toast";

export function couleurStatut(statut: string) {
  if (statut === "livree") return colors.success;
  if (statut === "annulee") return colors.error;
  if (statut === "en_route") return colors.success;
  return colors.brandPrimary;
}

export default function Commandes() {
  useTheme();
  const router = useRouter();
  const toast = useToast();
  const t = useT();
  const libelle = useLibelle();
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["mes-commandes"],
    queryFn: () => apiFetch<any[]>("/commandes/mes"),
    refetchInterval: 6000,
  });

  const archiver = async (id: string) => {
    try {
      await apiFetch(`/commandes/${id}/archiver`, { method: "POST" });
      qc.invalidateQueries({ queryKey: ["mes-commandes"] });
      qc.invalidateQueries({ queryKey: ["mes-commandes-archives"] });
      toast.show(t("commandes.archiveOk"), "succes");
    } catch (e: any) {
      toast.show(e.message, "erreur");
    }
  };

  return (
    <View testID="ecran-commandes" style={styles.ecran}>
      {q.isLoading ? (
        <View style={styles.centre}>
          <Chargement taille={52} />
        </View>
      ) : (
        <FlatList
          testID="liste-commandes"
          data={q.data ?? []}
          keyExtractor={(c) => c.id}
          contentContainerStyle={styles.liste}
          refreshing={q.isRefetching}
          onRefresh={() => q.refetch()}
          ListHeaderComponent={
            <TitrePage
              titre={t("commandes.titre")}
              sousTitre={t("commandes.sousTitre")}
              actions={
                <Pressable
                  testID="btn-archives-client"
                  onPress={() => router.push("/archives")}
                  style={styles.lienArchives}
                >
                  <Icone name="package" size={16} color={colors.brandPrimary} />
                  <Text style={styles.lienArchivesTexte}>{t("commandes.archives")}</Text>
                </Pressable>
              }
            />
          }
          ListEmptyComponent={
            <View style={styles.centre}>
              <Icone name="receipt" size={42} color={colors.brandTertiary} />
              <Text style={styles.vide}>{t("commandes.vide")}</Text>
              <Pressable testID="btn-vers-catalogue" onPress={() => router.push("/menu")} style={styles.lien}>
                <Text style={styles.lienTexte}>{t("commandes.voirCarte")}</Text>
              </Pressable>
            </View>
          }
          renderItem={({ item }) => {
            const terminee = item.statut === "livree" || item.statut === "annulee";
            return (
              <Pressable
                testID={`commande-${item.numero}`}
                onPress={() => router.push(`/suivi/${item.id}`)}
                style={({ pressed }) => [styles.carte, pressed && { backgroundColor: colors.brandTertiary }]}
              >
                <View style={styles.carteHaut}>
                  <Text style={styles.numero}>{item.numero}</Text>
                  <View style={[styles.pastille, { backgroundColor: couleurStatut(item.statut) }]}>
                    <Text style={styles.pastilleTexte}>{t(`statut.${item.statut}` as CleTexte)}</Text>
                  </View>
                </View>
                <Text style={styles.items} numberOfLines={2}>
                  {item.items
                    .map((i: any) => `${i.quantite}× ${libelle(i.nom, i.nomEn)}`)
                    .join(", ")}
                </Text>
                <View style={styles.carteBas}>
                  <Text style={styles.adresse} numberOfLines={1}>
                    <Icone name="map-pin" size={12} color={colors.muted} /> {item.adresse?.commune} ·{" "}
                    {item.adresse?.avenue}
                  </Text>
                  <Text style={styles.total}>{prix(item.total)}</Text>
                </View>
                {terminee ? (
                  <Pressable
                    testID={`btn-archiver-${item.numero}`}
                    onPress={() => archiver(item.id)}
                    style={styles.archiver}
                  >
                    <Icone name="archive" size={16} color={colors.brandPrimary} />
                    <Text style={styles.archiverTexte}>{t("commun.archiver")}</Text>
                  </Pressable>
                ) : null}
              </Pressable>
            );
          }}
        />
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
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  titre: { fontFamily: fonts.display, fontSize: 26, fontWeight: poids.fort, color: colors.onSurface },
  lienArchives: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.brandTertiary,
  },
  lienArchivesTexte: { fontFamily: fonts.text, fontSize: 13, fontWeight: poids.fort, color: colors.brandPrimary },
  liste: { ...LARGEUR_CONTENU, padding: spacing.xl, gap: spacing.md },
  centre: { alignItems: "center", justifyContent: "center", paddingVertical: spacing.xxxl, gap: spacing.sm },
  vide: { fontFamily: fonts.text, fontSize: 14, fontWeight: poids.corps, color: colors.muted },
  lien: { minHeight: 44, justifyContent: "center", paddingHorizontal: spacing.lg },
  lienTexte: { fontFamily: fonts.text, fontWeight: poids.fort, color: colors.brandPrimary },
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
  numero: { fontFamily: fonts.display, fontSize: 17, fontWeight: poids.fort, color: colors.onSurface },
  pastille: { paddingHorizontal: spacing.md, paddingVertical: 5, borderRadius: radius.pill },
  pastilleTexte: { fontFamily: fonts.text, fontSize: 11, fontWeight: poids.fort, color: colors.onBrandPrimary },
  items: { fontFamily: fonts.text, fontSize: 13, fontWeight: poids.corps, color: colors.onSurface },
  carteBas: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  adresse: { flex: 1, fontFamily: fonts.text, fontSize: 12, fontWeight: poids.corps, color: colors.muted },
  total: { fontFamily: fonts.display, fontSize: 17, fontWeight: poids.fort, color: colors.brandPrimary },
  archiver: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    minHeight: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSecondary,
  },
  archiverTexte: { fontFamily: fonts.text, fontSize: 13, fontWeight: poids.fort, color: colors.brandPrimary },
}));
