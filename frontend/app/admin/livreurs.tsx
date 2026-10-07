import { Chargement } from "@/src/components/Chargement";
import { Icone } from "@/src/components/Icone";
import { BulkDeleteDialog, SelectionBar, SelectionHeader, ToggleSelection, useListeSelection } from "@/src/components/ListeSelection";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { apiFetch } from "@/src/api";
import { useAuth } from "@/src/auth";
import { Bouton } from "@/src/components/Bouton";
import { Champ } from "@/src/components/Champ";
import { TitrePage } from "@/src/components/TitrePage";
import { useLangue } from "@/src/i18n";
import { LARGEUR_FEUILLE, LARGEUR_LARGE, completerGrille, useEcran } from "@/src/reactif";
import { colors, fonts, radius, softShadow, spacing, stylesDynamiques } from "@/src/theme";
import { useTheme } from "@/src/theme-contexte";
import { useToast } from "@/src/toast";

export default function Livreurs() {
  useTheme();
  const insets = useSafeAreaInsets();
  const { bureau, large } = useEcran();
  const cols = large ? 3 : bureau ? 2 : 1;
  const toast = useToast();
  const { t } = useLangue();
  const qc = useQueryClient();
  const { user } = useAuth();
  const estSuper = user?.role === "superadmin";
  const q = useQuery({
    queryKey: ["admin-livreurs"],
    queryFn: () => apiFetch<any[]>("/admin/livreurs"),
    refetchInterval: 10000,
  });
  const selection = useListeSelection((q.data ?? []).map((livreur) => livreur.id));
  const [confirmerSuppressionMultiple, setConfirmerSuppressionMultiple] = useState(false);

  const [ouvert, setOuvert] = useState(false);
  const [nom, setNom] = useState("");
  const [telephone, setTelephone] = useState("");
  const [vehicule, setVehicule] = useState(() => t("admin.vehiculeDefaut"));
  const [plaque, setPlaque] = useState("");
  const [motDePasse, setMotDePasse] = useState("livreur123");

  const ajouter = async () => {
    if (!nom.trim() || telephone.trim().length < 9) {
      toast.show(t("admin.nomTelephoneRequis"), "erreur");
      return;
    }
    try {
      await apiFetch("/admin/livreurs", {
        method: "POST",
        body: { nom, telephone, vehicule, plaque, note: 5, actif: true, motDePasse },
      });
      qc.invalidateQueries({ queryKey: ["admin-livreurs"] });
      setOuvert(false);
      setNom("");
      setTelephone("");
      setPlaque("");
      toast.show(t("admin.livreurAjoute"), "succes");
    } catch (e: any) {
      toast.show(e.message, "erreur");
    }
  };

  const basculerActif = async (l: any, actif: boolean) => {
    try {
      await apiFetch(`/admin/livreurs/${l.id}`, {
        method: "PUT",
        body: { nom: l.nom, telephone: l.telephone, vehicule: l.vehicule, plaque: l.plaque, note: l.note, actif },
      });
      qc.invalidateQueries({ queryKey: ["admin-livreurs"] });
    } catch (e: any) {
      toast.show(e.message, "erreur");
    }
  };

  const supprimerSelection = async () => {
    try {
      const count = selection.selectedIds.length;
      await apiFetch("/admin/livreurs/bulk/delete", { method: "DELETE", body: { ids: selection.selectedIds } });
      selection.clear();
      setConfirmerSuppressionMultiple(false);
      await qc.invalidateQueries({ queryKey: ["admin-livreurs"] });
      await qc.invalidateQueries({ queryKey: ["superadmin-comptes"] });
      toast.show(t("admin.livreursSupprimes", { count }), "succes");
    } catch (e: any) {
      toast.show(e.message, "erreur");
    }
  };

  return (
    <View testID="ecran-admin-livreurs" style={styles.ecran}>
      <View style={styles.enteteWeb}>
        <TitrePage
          titre={t("admin.livreursTitre")}
          sousTitre={t("admin.livreursSousTitre")}
          actions={
            estSuper ? (
              <Pressable testID="btn-ajouter-livreur" onPress={() => setOuvert(true)} style={styles.btnPrimaire}>
                <Icone name="plus" size={16} color={colors.onBrandPrimary} />
                <Text style={styles.btnPrimaireTexte}>{t("admin.nouveauLivreur")}</Text>
              </Pressable>
            ) : null
          }
        />
      </View>

      {q.isLoading ? (
        <View style={styles.centre}>
          <Chargement taille={52} />
        </View>
      ) : (
        <FlatList
          testID="liste-admin-livreurs"
          data={completerGrille(q.data ?? [], cols)}
          keyExtractor={(l) => l.id}
          contentContainerStyle={[styles.liste, { paddingBottom: spacing.xxxl }]}
          key={`livreurs-${cols}`}
          numColumns={cols}
          columnWrapperStyle={cols > 1 ? styles.rangeeGrille : undefined}
          refreshing={q.isRefetching}
          onRefresh={() => q.refetch()}
          ListHeaderComponent={estSuper ? <SelectionHeader checked={selection.allSelected} onToggle={selection.toggleAll} totalCount={selection.totalCount} /> : null}
          renderItem={({ item }: any) =>
            item.vide ? (
              <View style={styles.carteGrille} />
            ) : (
            <View testID={`livreur-${item.nom}`} style={[styles.carte, cols > 1 && styles.carteGrille]}>
              {estSuper ? (
                <ToggleSelection
                  checked={selection.selectedIds.includes(item.id)}
                  onToggle={() => selection.toggle(item.id)}
                  testID={`selection-livreur-${item.nom}`}
                />
              ) : null}
              <View style={styles.avatar}>
                <Text style={styles.initiale}>{item.nom.charAt(0)}</Text>
              </View>
              <View style={styles.texte}>
                <Text style={styles.nom}>{item.nom}</Text>
                <Text style={styles.detail}>
                  {item.telephone} · {item.vehicule} {item.plaque}
                </Text>
                <View style={styles.posRow}>
                  <Icone name="map-pin" size={12} color={colors.brandPrimary} />
                  <Text style={styles.pos}>
                    {item.position
                      ? `${item.position.lat.toFixed(3)}, ${item.position.lng.toFixed(3)}`
                      : t("admin.positionInconnue")}
                  </Text>
                </View>
              </View>
              <Switch
                testID={`switch-livreur-${item.nom}`}
                value={item.actif}
                onValueChange={(v) => basculerActif(item, v)}
                trackColor={{ true: colors.success, false: colors.border }}
              />
            </View>
            )
          }
        />
      )}

      <Modal visible={ouvert} animationType="slide" transparent onRequestClose={() => setOuvert(false)}>
        <View style={styles.voile}>
          <Pressable style={{ flex: 1 }} onPress={() => setOuvert(false)} />
          <View style={[styles.feuille, { paddingBottom: insets.bottom + spacing.lg }]}>
            <KeyboardAwareScrollView bottomOffset={60} contentContainerStyle={styles.feuilleContenu}>
              <Text style={styles.feuilleTitre}>{t("admin.nouveauLivreur")}</Text>
              <Champ label={t("params.nom")} testID="input-livreur-nom" value={nom} onChangeText={setNom} />
              <Champ label={t("params.telephone")} testID="input-livreur-telephone" value={telephone} onChangeText={setTelephone} keyboardType="phone-pad" />
              <Champ label={t("admin.vehicule")} testID="input-livreur-vehicule" value={vehicule} onChangeText={setVehicule} />
              <Champ label={t("admin.plaque")} testID="input-livreur-plaque" value={plaque} onChangeText={setPlaque} />
              <Champ label={t("admin.mdpConnexion")} testID="input-livreur-motdepasse" value={motDePasse} onChangeText={setMotDePasse} secureTextEntry />
              <Bouton testID="btn-enregistrer-livreur" label={t("admin.ajouterLivreur")} onPress={ajouter} />
              <Bouton testID="btn-annuler-livreur" label={t("commun.annuler")} variant="contour" onPress={() => setOuvert(false)} />
            </KeyboardAwareScrollView>
          </View>
        </View>
      </Modal>
      {estSuper ? (
        <>
          <SelectionBar selectedCount={selection.selectedIds.length} onClear={selection.clear} onDelete={() => setConfirmerSuppressionMultiple(true)} />
          <BulkDeleteDialog
            visible={confirmerSuppressionMultiple}
            count={selection.selectedIds.length}
            onCancel={() => setConfirmerSuppressionMultiple(false)}
            onConfirm={supprimerSelection}
          />
        </>
      ) : null}
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
  },
  titre: { fontFamily: fonts.display, fontSize: 26, color: colors.onSurface },
  ajouter: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  centre: { alignItems: "center", justifyContent: "center", paddingVertical: spacing.xxxl },
  liste: { ...LARGEUR_LARGE, paddingHorizontal: spacing.xl, paddingBottom: spacing.xl, gap: spacing.md },
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
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...softShadow,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: radius.pill,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  initiale: { fontFamily: fonts.display, fontSize: 20, color: colors.brandPrimary },
  texte: { flex: 1, gap: 1 },
  nom: { fontFamily: fonts.display, fontSize: 16, color: colors.onSurface },
  detail: { fontFamily: fonts.text, fontSize: 12, color: colors.muted },
  posRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  pos: { fontFamily: fonts.text, fontSize: 11, color: colors.brandPrimary },
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
}));
