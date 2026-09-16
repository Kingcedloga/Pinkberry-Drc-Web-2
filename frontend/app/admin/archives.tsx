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
import { colors, fonts, radius, softShadow, spacing, stylesDynamiques } from "@/src/theme";
import { useTheme } from "@/src/theme-contexte";
import { useToast } from "@/src/toast";

export default function Archives() {
  useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();
  const [aSupprimer, setASupprimer] = useState<any>(null);

  const q = useQuery({
    queryKey: ["admin-archives"],
    queryFn: () => apiFetch<any[]>("/admin/commandes/archives"),
  });

  const rafraichir = () => {
    qc.invalidateQueries({ queryKey: ["admin-archives"] });
    qc.invalidateQueries({ queryKey: ["admin-commandes"] });
  };

  const restaurer = async (cmd: any) => {
    try {
      await apiFetch(`/admin/commandes/${cmd.id}/desarchiver`, { method: "POST" });
      rafraichir();
      toast.show(`${cmd.numero} remise dans le tableau de bord`, "succes");
    } catch (e: any) {
      toast.show(e.message, "erreur");
    }
  };

  const supprimer = async () => {
    try {
      await apiFetch(`/admin/commandes/${aSupprimer.id}`, { method: "DELETE" });
      setASupprimer(null);
      rafraichir();
      toast.show("Commande supprimée définitivement", "succes");
    } catch (e: any) {
      toast.show(e.message, "erreur");
    }
  };

  return (
    <View testID="ecran-archives" style={styles.ecran}>
      <View style={[styles.entete, { paddingTop: insets.top + spacing.md }]}>
        <Pressable testID="btn-retour-archives" onPress={() => router.back()} style={styles.iconeBtn}>
          <Icone name="arrow-left" size={20} color={colors.brandPrimary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.titre}>Archives</Text>
          <Text style={styles.sousTitre}>Toujours comptées dans les rapports</Text>
        </View>
      </View>

      {q.isLoading ? (
        <View style={styles.centre}>
          <Chargement taille={52} />
        </View>
      ) : (
        <FlatList
          testID="liste-archives"
          data={q.data ?? []}
          keyExtractor={(c) => c.id}
          contentContainerStyle={[styles.liste, { paddingBottom: insets.bottom + spacing.xxxl }]}
          refreshing={q.isRefetching}
          onRefresh={() => q.refetch()}
          ListEmptyComponent={
            <View style={styles.centre}>
              <Icone name="package" size={40} color={colors.brandTertiary} />
              <Text style={styles.vide}>Aucune commande archivée</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View testID={`archive-${item.numero}`} style={styles.carte}>
              <View style={styles.carteHaut}>
                <Text style={styles.numero}>{item.numero}</Text>
                <View
                  style={[
                    styles.pastille,
                    { backgroundColor: item.statut === "annulee" ? colors.error : colors.success },
                  ]}
                >
                  <Text style={styles.pastilleTexte}>{item.statut === "annulee" ? "Annulée" : "Livrée"}</Text>
                </View>
              </View>
              <Text style={styles.client}>
                {item.clientNom} · {usd(item.total)}
              </Text>
              <Text style={styles.detail} numberOfLines={1}>
                {item.adresse?.commune} — {new Date(item.createdAt).toLocaleDateString("fr-FR")}
              </Text>
              <View style={styles.actions}>
                <Pressable
                  testID={`btn-restaurer-${item.numero}`}
                  onPress={() => restaurer(item)}
                  style={styles.action}
                >
                  <Icone name="refresh-cw" size={16} color={colors.brandPrimary} />
                  <Text style={styles.actionTexte}>Restaurer</Text>
                </Pressable>
                <Pressable
                  testID={`btn-supprimer-${item.numero}`}
                  onPress={() => setASupprimer(item)}
                  style={[styles.action, styles.actionDanger]}
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
          <View testID="modal-suppression-commande" style={styles.dialogue}>
            <Icone name="alert-circle" size={30} color={colors.error} />
            <Text style={styles.dialogueTitre}>Supprimer {aSupprimer?.numero} ?</Text>
            <Text style={styles.dialogueTexte}>
              La commande sera retirée définitivement de l&apos;application et de vos rapports. Cette action est
              irréversible.
            </Text>
            <Bouton
              testID="btn-confirmer-suppression-commande"
              label="Supprimer définitivement"
              variant="danger"
              onPress={supprimer}
            />
            <Bouton
              testID="btn-annuler-suppression-commande"
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
  titre: { fontFamily: fonts.display, fontSize: 22, color: colors.onSurface },
  sousTitre: { fontFamily: fonts.text, fontSize: 12, color: colors.muted },
  centre: { alignItems: "center", justifyContent: "center", paddingVertical: spacing.xxxl, gap: spacing.sm },
  vide: { fontFamily: fonts.text, fontSize: 14, color: colors.muted },
  liste: { paddingHorizontal: spacing.lg, gap: spacing.md },
  carte: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 2,
    ...softShadow,
  },
  carteHaut: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  numero: { fontFamily: fonts.display, fontSize: 17, color: colors.onSurface },
  pastille: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.pill },
  pastilleTexte: { fontFamily: fonts.text, fontSize: 11, fontWeight: "700", color: colors.onBrandPrimary },
  client: { fontFamily: fonts.text, fontSize: 13, color: colors.onSurface },
  detail: { fontFamily: fonts.text, fontSize: 12, color: colors.muted },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  action: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.brandTertiary,
  },
  actionDanger: { backgroundColor: colors.errorSoft },
  actionTexte: { fontFamily: fonts.text, fontSize: 13, fontWeight: "700", color: colors.brandPrimary },
  voile: {
    flex: 1,
    backgroundColor: "rgba(42,23,33,0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  dialogue: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    gap: spacing.md,
    alignItems: "center",
  },
  dialogueTitre: { fontFamily: fonts.display, fontSize: 20, color: colors.onSurface, textAlign: "center" },
  dialogueTexte: { fontFamily: fonts.text, fontSize: 13, color: colors.muted, textAlign: "center" },
}));
