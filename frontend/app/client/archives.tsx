import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { apiFetch } from "@/src/api";
import { Chargement } from "@/src/components/Chargement";
import { Bouton } from "@/src/components/Bouton";
import { Icone } from "@/src/components/Icone";
import { useT, type CleTexte } from "@/src/i18n";
import { usd } from "@/src/money";
import { LARGEUR_CONTENU } from "@/src/reactif";
import { colors, fonts, poids, radius, softShadow, spacing, stylesDynamiques } from "@/src/theme";
import { useTheme } from "@/src/theme-contexte";
import { useToast } from "@/src/toast";

export default function ArchivesClient() {
  useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const t = useT();
  const qc = useQueryClient();
  const [aSupprimer, setASupprimer] = useState<any | null>(null);

  const q = useQuery({
    queryKey: ["mes-commandes-archives"],
    queryFn: () => apiFetch<any[]>("/commandes/mes/archives"),
  });

  const rafraichir = () => {
    qc.invalidateQueries({ queryKey: ["mes-commandes-archives"] });
    qc.invalidateQueries({ queryKey: ["mes-commandes"] });
  };

  const desarchiver = async (id: string) => {
    try {
      await apiFetch(`/commandes/${id}/desarchiver`, { method: "POST" });
      rafraichir();
      toast.show(t("commandes.desarchiveOk"), "succes");
    } catch (e: any) {
      toast.show(e.message, "erreur");
    }
  };

  const supprimer = async () => {
    if (!aSupprimer) return;
    try {
      await apiFetch(`/commandes/${aSupprimer.id}/masquer`, { method: "DELETE" });
      setASupprimer(null);
      rafraichir();
      toast.show(t("commandes.supprimeOk"), "succes");
    } catch (e: any) {
      toast.show(e.message, "erreur");
    }
  };

  return (
    <View testID="ecran-archives-client" style={styles.ecran}>
      <View style={[styles.entete, { paddingTop: insets.top + spacing.md }]}>
        <Pressable testID="btn-retour-archives-client" onPress={() => router.back()} style={styles.iconeBtn}>
          <Icone name="arrow-left" size={20} color={colors.brandPrimary} />
        </Pressable>
        <Text style={styles.titre}>{t("commandes.archivesTitre")}</Text>
      </View>

      {q.isLoading ? (
        <View style={styles.centre}>
          <Chargement taille={52} />
        </View>
      ) : (
        <FlatList
          testID="liste-archives-client"
          data={q.data ?? []}
          keyExtractor={(c) => c.id}
          contentContainerStyle={[styles.liste, { paddingBottom: insets.bottom + spacing.xxxl }]}
          refreshing={q.isRefetching}
          onRefresh={() => q.refetch()}
          ListEmptyComponent={
            <View style={styles.centre}>
              <Icone name="package" size={42} color={colors.brandTertiary} />
              <Text style={styles.vide}>{t("commandes.archivesVide")}</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View testID={`archive-${item.numero}`} style={styles.carte}>
              <View style={styles.carteHaut}>
                <Text style={styles.numero}>{item.numero}</Text>
                <Text style={styles.total}>{usd(item.total)}</Text>
              </View>
              <Text style={styles.statut}>{t(`statut.${item.statut}` as CleTexte)}</Text>
              <Text style={styles.items} numberOfLines={2}>
                {item.items.map((i: any) => `${i.quantite}× ${i.nom}`).join(", ")}
              </Text>
              <View style={styles.actions}>
                <Pressable
                  testID={`btn-desarchiver-${item.numero}`}
                  onPress={() => desarchiver(item.id)}
                  style={styles.action}
                >
                  <Icone name="package" size={16} color={colors.brandPrimary} />
                  <Text style={styles.actionTexte}>{t("commun.desarchiver")}</Text>
                </Pressable>
                <Pressable
                  testID={`btn-supprimer-${item.numero}`}
                  onPress={() => setASupprimer(item)}
                  style={styles.action}
                >
                  <Icone name="trash-2" size={16} color={colors.error} />
                  <Text style={[styles.actionTexte, { color: colors.error }]}>{t("commun.supprimer")}</Text>
                </Pressable>
              </View>
            </View>
          )}
        />
      )}

      <Modal visible={!!aSupprimer} transparent animationType="fade" onRequestClose={() => setASupprimer(null)}>
        <View style={styles.voile}>
          <View testID="modal-supprimer-commande" style={styles.boite}>
            <Icone name="alert-circle" size={30} color={colors.error} />
            <Text style={styles.boiteTitre}>{t("commandes.supprimerTitre")}</Text>
            <Text style={styles.boiteTexte}>{t("commandes.supprimerTexte")}</Text>
            <Bouton
              testID="btn-confirmer-suppression-commande"
              label={t("commun.supprimer")}
              variant="danger"
              onPress={supprimer}
            />
            <Bouton
              testID="btn-annuler-suppression-commande"
              label={t("commun.annuler")}
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
  titre: { fontFamily: fonts.display, fontSize: 22, fontWeight: poids.fort, color: colors.onSurface },
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
  total: { fontFamily: fonts.display, fontSize: 17, fontWeight: poids.fort, color: colors.brandPrimary },
  statut: { fontFamily: fonts.text, fontSize: 12, fontWeight: poids.fort, color: colors.muted },
  items: { fontFamily: fonts.text, fontSize: 13, fontWeight: poids.corps, color: colors.onSurface },
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
  boiteTitre: { fontFamily: fonts.display, fontSize: 20, fontWeight: poids.fort, color: colors.onSurface, textAlign: "center" },
  boiteTexte: { fontFamily: fonts.text, fontSize: 13, fontWeight: poids.corps, color: colors.muted, textAlign: "center" },
}));
