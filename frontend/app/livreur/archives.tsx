import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { apiFetch } from "@/src/api";
import { Chargement } from "@/src/components/Chargement";
import { Bouton } from "@/src/components/Bouton";
import { Icone } from "@/src/components/Icone";
import { usd } from "@/src/money";
import { LARGEUR_CONTENU } from "@/src/reactif";
import { colors, fonts, poids, radius, softShadow, spacing, stylesDynamiques } from "@/src/theme";
import { useTheme } from "@/src/theme-contexte";
import { useToast } from "@/src/toast";

const LIBELLES: Record<string, string> = { livree: "Livrée", annulee: "Annulée" };

export default function ArchivesLivreur() {
  useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();
  const [aSupprimer, setASupprimer] = useState<any | null>(null);

  const q = useQuery({
    queryKey: ["livreur-archives"],
    queryFn: () => apiFetch<any[]>("/livreur/courses/archives"),
  });

  const rafraichir = () => {
    qc.invalidateQueries({ queryKey: ["livreur-archives"] });
    qc.invalidateQueries({ queryKey: ["livreur-courses"] });
  };

  const desarchiver = async (id: string) => {
    try {
      await apiFetch(`/livreur/courses/${id}/desarchiver`, { method: "POST" });
      rafraichir();
      toast.show("Course remise dans la liste", "succes");
    } catch (e: any) {
      toast.show(e.message, "erreur");
    }
  };

  const supprimer = async () => {
    if (!aSupprimer) return;
    try {
      await apiFetch(`/livreur/courses/${aSupprimer.id}/masquer`, { method: "DELETE" });
      setASupprimer(null);
      rafraichir();
      toast.show("Course supprimée de votre historique", "succes");
    } catch (e: any) {
      toast.show(e.message, "erreur");
    }
  };

  return (
    <View testID="ecran-archives-livreur" style={styles.ecran}>
      <View style={[styles.entete, { paddingTop: spacing.lg }]}>
        <Pressable testID="btn-retour-archives-livreur" onPress={() => router.back()} style={styles.iconeBtn}>
          <Icone name="arrow-left" size={20} color={colors.brandPrimary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.titre}>Courses archivées</Text>
          <Text style={styles.sousTitre}>Vous seul les voyez ici</Text>
        </View>
      </View>

      {q.isLoading ? (
        <View style={styles.centre}>
          <Chargement taille={52} />
        </View>
      ) : (
        <FlatList
          testID="liste-archives-livreur"
          data={q.data ?? []}
          keyExtractor={(c) => c.id}
          contentContainerStyle={[styles.liste, { paddingBottom: insets.bottom + spacing.xxxl }]}
          refreshing={q.isRefetching}
          onRefresh={() => q.refetch()}
          ListEmptyComponent={
            <View style={styles.centre}>
              <Icone name="archive" size={42} color={colors.brandTertiary} />
              <Text style={styles.vide}>Aucune course archivée</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View testID={`archive-course-${item.numero}`} style={styles.carte}>
              <View style={styles.carteHaut}>
                <Text style={styles.numero}>{item.numero}</Text>
                <Text style={styles.montant}>{usd(item.total)}</Text>
              </View>
              <Text style={styles.statut}>
                {LIBELLES[item.statut] ?? item.statut}
                {item.cashEncaisse ? " · cash encaissé" : ""}
              </Text>
              <Text style={styles.adresse} numberOfLines={1}>
                {item.adresse?.commune} — {item.adresse?.avenue} n° {item.adresse?.numero}
              </Text>
              <View style={styles.actions}>
                <Pressable
                  testID={`btn-desarchiver-course-${item.numero}`}
                  onPress={() => desarchiver(item.id)}
                  style={styles.action}
                >
                  <Icone name="package" size={16} color={colors.brandPrimary} />
                  <Text style={styles.actionTexte}>Désarchiver</Text>
                </Pressable>
                <Pressable
                  testID={`btn-supprimer-course-${item.numero}`}
                  onPress={() => setASupprimer(item)}
                  style={styles.action}
                >
                  <Icone name="trash-2" size={16} color={colors.error} />
                  <Text style={[styles.actionTexte, { color: colors.error }]}>Supprimer</Text>
                </Pressable>
              </View>
            </View>
          )}
        />
      )}

      <Modal visible={!!aSupprimer} transparent animationType="fade" onRequestClose={() => setASupprimer(null)}>
        <View style={styles.voile}>
          <View testID="modal-supprimer-course" style={styles.boite}>
            <Icone name="alert-circle" size={30} color={colors.error} />
            <Text style={styles.boiteTitre}>Supprimer cette course ?</Text>
            <Text style={styles.boiteTexte}>
              Elle disparaîtra de votre historique. La boutique la conserve pour ses rapports et sa
              comptabilité.
            </Text>
            <Bouton
              testID="btn-confirmer-suppression-course"
              label="Supprimer"
              variant="danger"
              onPress={supprimer}
            />
            <Bouton
              testID="btn-annuler-suppression-course"
              label="Annuler"
              variant="contour"
              onPress={() => setASupprimer(null)}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = stylesDynamiques(() => StyleSheet.create({
  ecran: { flex: 1, backgroundColor: colors.surfaceSecondary },
  entete: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  iconeBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  titre: { fontFamily: fonts.display, fontSize: 21, fontWeight: poids.fort, color: colors.onSurface },
  sousTitre: { fontFamily: fonts.text, fontSize: 12, fontWeight: poids.corps, color: colors.muted },
  liste: { ...LARGEUR_CONTENU, paddingHorizontal: spacing.lg, gap: spacing.md },
  centre: { alignItems: "center", justifyContent: "center", paddingVertical: spacing.xxxl, gap: spacing.sm },
  vide: { fontFamily: fonts.text, fontSize: 14, fontWeight: poids.corps, color: colors.muted },
  carte: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    ...softShadow,
  },
  carteHaut: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  numero: { fontFamily: fonts.display, fontSize: 17, fontWeight: poids.fort, color: colors.onSurface },
  montant: { fontFamily: fonts.display, fontSize: 17, fontWeight: poids.fort, color: colors.brandPrimary },
  statut: { fontFamily: fonts.text, fontSize: 12, fontWeight: poids.fort, color: colors.muted },
  adresse: { fontFamily: fonts.text, fontSize: 12, fontWeight: poids.corps, color: colors.onSurface },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  action: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    minHeight: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSecondary,
  },
  actionTexte: { fontFamily: fonts.text, fontSize: 13, fontWeight: poids.fort, color: colors.brandPrimary },
  voile: {
    flex: 1,
    backgroundColor: "rgba(42,23,33,0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  boite: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    gap: spacing.md,
    alignItems: "center",
  },
  boiteTitre: {
    fontFamily: fonts.display,
    fontSize: 20,
    fontWeight: poids.fort,
    color: colors.onSurface,
    textAlign: "center",
  },
  boiteTexte: {
    fontFamily: fonts.text,
    fontSize: 13,
    fontWeight: poids.corps,
    color: colors.muted,
    textAlign: "center",
  },
}));
