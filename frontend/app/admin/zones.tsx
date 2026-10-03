import { useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { apiFetch } from "@/src/api";
import { Chargement } from "@/src/components/Chargement";
import { Bouton } from "@/src/components/Bouton";
import { Champ } from "@/src/components/Champ";
import { Icone } from "@/src/components/Icone";
import { BulkDeleteDialog, SelectionBar, SelectionHeader, ToggleSelection, useListeSelection } from "@/src/components/ListeSelection";
import { useLangue } from "@/src/i18n";
import { TitrePage } from "@/src/components/TitrePage";
import { LARGEUR_FEUILLE, LARGEUR_LARGE, completerGrille, useEcran } from "@/src/reactif";
import { colors, fonts, radius, softShadow, spacing, stylesDynamiques } from "@/src/theme";
import { useTheme } from "@/src/theme-contexte";
import { useToast } from "@/src/toast";

export default function Zones() {
  useTheme();
  const insets = useSafeAreaInsets();
  const { bureau, large } = useEcran();
  const cols = large ? 3 : bureau ? 2 : 1;
  const toast = useToast();
  const { t } = useLangue();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["zones"], queryFn: () => apiFetch<any[]>("/zones") });
  const selection = useListeSelection((q.data ?? []).map((zone) => zone.id));
  const [confirmerSuppressionMultiple, setConfirmerSuppressionMultiple] = useState(false);

  const [ouvert, setOuvert] = useState(false);
  const [commune, setCommune] = useState("");
  const [active, setActive] = useState(true);
  const [aSupprimer, setASupprimer] = useState<any>(null);

  const rafraichir = () => qc.invalidateQueries({ queryKey: ["zones"] });

  const basculer = async (zone: any, valeur: boolean) => {
    try {
      await apiFetch(`/admin/zones/${zone.id}`, { method: "PUT", body: { active: valeur } });
      rafraichir();
      toast.show(
        valeur ? t("admin.livraisonCommuneActive", { commune: zone.commune }) : t("admin.livraisonCommuneSuspendue", { commune: zone.commune }),
        "succes",
      );
    } catch (e: any) {
      toast.show(e.message, "erreur");
    }
  };

  const ajouter = async () => {
    if (commune.trim().length < 2) {
      toast.show(t("admin.zoneNomCourt"), "erreur");
      return;
    }
    try {
      await apiFetch("/admin/zones", { method: "POST", body: { commune: commune.trim(), active } });
      rafraichir();
      setOuvert(false);
      setCommune("");
      setActive(true);
      toast.show(t("admin.zoneAjoutee", { commune: commune.trim() }), "succes");
    } catch (e: any) {
      toast.show(e.message, "erreur");
    }
  };

  const supprimer = async () => {
    try {
      await apiFetch(`/admin/zones/${aSupprimer.id}`, { method: "DELETE" });
      rafraichir();
      setASupprimer(null);
      toast.show(t("admin.zoneSupprimee"), "succes");
    } catch (e: any) {
      toast.show(e.message, "erreur");
    }
  };

  const supprimerSelection = async () => {
    try {
      await apiFetch("/admin/zones/bulk/delete", { method: "DELETE", body: { ids: selection.selectedIds } });
      const count = selection.selectedIds.length;
      selection.clear();
      setConfirmerSuppressionMultiple(false);
      await rafraichir();
      toast.show(`${count} zone(s) supprimée(s)`, "succes");
    } catch (e: any) {
      toast.show(e.message, "erreur");
    }
  };

  return (
    <View testID="ecran-admin-zones" style={styles.ecran}>
      <View style={styles.enteteWeb}>
        <TitrePage
          titre={t("admin.zonesTitre")}
          sousTitre={t("admin.zonesSousTitre")}
          actions={
            <Pressable testID="btn-ajouter-zone" onPress={() => setOuvert(true)} style={styles.btnPrimaire}>
              <Icone name="plus" size={16} color={colors.onBrandPrimary} />
              <Text style={styles.btnPrimaireTexte}>{t("admin.nouvelleZone")}</Text>
            </Pressable>
          }
        />
      </View>

      {q.isLoading ? (
        <View style={styles.centre}>
          <Chargement taille={52} />
        </View>
      ) : (
        <FlatList
          testID="liste-zones"
          data={completerGrille(q.data ?? [], cols)}
          keyExtractor={(z) => z.id}
          contentContainerStyle={[styles.liste, { paddingBottom: spacing.xxxl }]}
          key={`zones-${cols}`}
          numColumns={cols}
          columnWrapperStyle={cols > 1 ? styles.rangeeGrille : undefined}
          refreshing={q.isRefetching}
          onRefresh={() => q.refetch()}
          ListEmptyComponent={
            <View style={styles.centre}>
              <Text style={styles.sous}>{t("admin.aucuneZone")}</Text>
            </View>
          }
          ListHeaderComponent={
            <SelectionHeader checked={selection.allSelected} onToggle={selection.toggleAll} totalCount={selection.totalCount} />
          }
          renderItem={({ item }: any) =>
            item.vide ? (
              <View style={styles.carteGrille} />
            ) : (
            <View testID={`zone-${item.commune}`} style={[styles.carte, cols > 1 && styles.carteGrille]}>
              <ToggleSelection
                checked={selection.selectedIds.includes(item.id)}
                onToggle={() => selection.toggle(item.id)}
                testID={`selection-zone-${item.commune}`}
              />
              <View style={styles.texte}>
                <Text style={styles.nom}>{item.commune}</Text>
                <Text style={[styles.etat, { color: item.active ? colors.success : colors.muted }]}>
                  {item.active ? t("admin.couverte") : t("admin.nonCouverte")}
                </Text>
              </View>
              <Switch
                testID={`switch-zone-${item.commune}`}
                value={item.active}
                onValueChange={(v) => basculer(item, v)}
                trackColor={{ true: colors.success, false: colors.border }}
              />
              <Pressable
                testID={`btn-supprimer-zone-${item.commune}`}
                hitSlop={8}
                onPress={() => setASupprimer(item)}
                style={styles.corbeille}
              >
                <Icone name="trash-2" size={18} color={colors.error} />
              </Pressable>
            </View>
            )
          }
        />
      )}

      <Modal visible={ouvert} transparent animationType="slide" onRequestClose={() => setOuvert(false)}>
        <View style={styles.voile}>
          <Pressable style={{ flex: 1 }} onPress={() => setOuvert(false)} />
          <View style={[styles.feuille, { paddingBottom: insets.bottom + spacing.lg }]}>
            <KeyboardAwareScrollView bottomOffset={60} contentContainerStyle={styles.feuilleContenu}>
              <Text style={styles.feuilleTitre}>{t("admin.nouvelleZone")}</Text>
              <Champ
                label={t("admin.communeQuartier")}
                testID="input-zone-commune"
                value={commune}
                onChangeText={setCommune}
                placeholder="Ex. Ngaliema"
              />
              <View style={styles.ligneSwitch}>
                <Text style={styles.switchLabel}>{t("admin.zoneActiveImmediate")}</Text>
                <Switch
                  testID="switch-nouvelle-zone"
                  value={active}
                  onValueChange={setActive}
                  trackColor={{ true: colors.success, false: colors.border }}
                />
              </View>
              <Bouton testID="btn-creer-zone" label={t("admin.ajouterZone")} onPress={ajouter} />
              <Bouton
                testID="btn-annuler-zone"
                label={t("commun.annuler")}
                variant="contour"
                onPress={() => setOuvert(false)}
              />
            </KeyboardAwareScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={!!aSupprimer} transparent animationType="fade" onRequestClose={() => setASupprimer(null)}>
        <View style={styles.voileCentre}>
          <View testID="modal-suppression-zone" style={styles.dialogue}>
            <Icone name="alert-circle" size={30} color={colors.error} />
            <Text style={styles.dialogueTitre}>{t("admin.supprimerZoneTitre", { commune: aSupprimer?.commune ?? "" })}</Text>
            <Text style={styles.dialogueTexte}>{t("admin.supprimerZoneTexte")}</Text>
            <Bouton
              testID="btn-confirmer-suppression-zone"
              label={t("admin.supprimerZone")}
              variant="danger"
              onPress={supprimer}
            />
            <Bouton
              testID="btn-annuler-suppression-zone"
              label={t("commun.annuler")}
              variant="contour"
              onPress={() => setASupprimer(null)}
            />
          </View>
        </View>
      </Modal>
      <SelectionBar selectedCount={selection.selectedIds.length} onClear={selection.clear} onDelete={() => setConfirmerSuppressionMultiple(true)} />
      <BulkDeleteDialog
        visible={confirmerSuppressionMultiple}
        count={selection.selectedIds.length}
        onCancel={() => setConfirmerSuppressionMultiple(false)}
        onConfirm={supprimerSelection}
      />
    </View>
  );
}

const styles = stylesDynamiques(() => StyleSheet.create({
  ecran: { flex: 1, backgroundColor: colors.surfaceSecondary },
  entete: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.xs },
  enteteHaut: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  ajouter: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  titre: { fontFamily: fonts.display, fontSize: 26, color: colors.onSurface },
  sous: { fontFamily: fonts.text, fontSize: 12, color: colors.muted },
  centre: { alignItems: "center", justifyContent: "center", paddingVertical: spacing.xxxl },
  liste: { ...LARGEUR_LARGE, paddingHorizontal: spacing.xl, paddingBottom: spacing.xl, gap: spacing.sm },
  enteteWeb: { ...LARGEUR_LARGE, paddingHorizontal: spacing.xl, paddingTop: spacing.xl },
  rangeeGrille: { gap: spacing.md, alignItems: "stretch" },
  carteGrille: { flex: 1 },
  btnPrimaire: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.brandPrimary,
  },
  btnPrimaireTexte: { fontFamily: fonts.text, fontSize: 13, fontWeight: "800", color: colors.onBrandPrimary },

  carte: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...softShadow,
  },
  texte: { flex: 1, gap: 2 },
  nom: { fontFamily: fonts.display, fontSize: 16, color: colors.onSurface },
  etat: { fontFamily: fonts.text, fontSize: 11, fontWeight: "800" },
  corbeille: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  voile: { flex: 1, backgroundColor: "rgba(42,23,33,0.45)", justifyContent: "flex-end" },
  feuille: {
    ...LARGEUR_FEUILLE,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: "90%",
  },
  feuilleContenu: { padding: spacing.xl, gap: spacing.md },
  feuilleTitre: { fontFamily: fonts.display, fontSize: 21, color: colors.onSurface },
  ligneSwitch: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  switchLabel: { flex: 1, fontFamily: fonts.text, fontSize: 14, color: colors.onSurface },
  voileCentre: {
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
