import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Redirect } from "expo-router";
import React, { useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { apiFetch } from "@/src/api";
import { useAuth } from "@/src/auth";
import { Chargement } from "@/src/components/Chargement";
import { Bouton } from "@/src/components/Bouton";
import { Champ } from "@/src/components/Champ";
import { Garde } from "@/src/components/Garde";
import { Icone } from "@/src/components/Icone";
import { BulkDeleteDialog, SelectionBar, SelectionHeader, ToggleSelection, useListeSelection } from "@/src/components/ListeSelection";
import { TitrePage } from "@/src/components/TitrePage";
import { useLangue } from "@/src/i18n";
import { LARGEUR_FEUILLE, LARGEUR_LARGE, completerGrille, useEcran } from "@/src/reactif";
import { colors, fonts, radius, softShadow, spacing, stylesDynamiques } from "@/src/theme";
import { useTheme } from "@/src/theme-contexte";
import { useToast } from "@/src/toast";

type Compte = {
  id: string;
  nom: string;
  telephone?: string | null;
  email?: string | null;
  role: "admin" | "livreur";
  actif: boolean;
  livreurId?: string | null;
  vehicule?: string;
  plaque?: string;
};

export default function Personnel() {
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
    queryKey: ["superadmin-comptes"],
    queryFn: () => apiFetch<Compte[]>("/superadmin/comptes"),
    enabled: estSuper,
  });
  const selection = useListeSelection((q.data ?? []).map((compte) => compte.id));
  const [confirmerSuppressionMultiple, setConfirmerSuppressionMultiple] = useState(false);

  const [ouvert, setOuvert] = useState(false);
  const [type, setType] = useState<"admin" | "livreur">("admin");
  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [telephone, setTelephone] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [vehicule, setVehicule] = useState(() => t("admin.vehiculeDefaut"));
  const [plaque, setPlaque] = useState("");

  if (!estSuper) return <Redirect href="/admin" />;

  const reinitialiser = () => {
    setNom("");
    setEmail("");
    setTelephone("");
    setMotDePasse("");
    setPlaque("");
    setVehicule(t("admin.vehiculeDefaut"));
  };

  const creer = async () => {
    if (!nom.trim() || telephone.trim().length < 9) {
      toast.show(t("admin.nomTelephoneRequis"), "erreur");
      return;
    }
    if (motDePasse.length < 6) {
      toast.show(t("params.mdpCourt"), "erreur");
      return;
    }
    try {
      if (type === "admin") {
        await apiFetch("/superadmin/admins", {
          method: "POST",
          body: { nom, email: email.trim() || undefined, telephone, motDePasse },
        });
      } else {
        await apiFetch("/admin/livreurs", {
          method: "POST",
          body: { nom, telephone, vehicule, plaque, note: 5, actif: true, motDePasse },
        });
      }
      qc.invalidateQueries({ queryKey: ["superadmin-comptes"] });
      qc.invalidateQueries({ queryKey: ["admin-livreurs"] });
      setOuvert(false);
      reinitialiser();
      toast.show(type === "admin" ? t("admin.adminCree") : t("admin.livreurAjoute"), "succes");
    } catch (e: any) {
      toast.show(e.message, "erreur");
    }
  };

  const basculer = async (c: Compte, actif: boolean) => {
    try {
      await apiFetch(`/superadmin/comptes/${c.id}/actif`, { method: "PATCH", body: { actif } });
      qc.invalidateQueries({ queryKey: ["superadmin-comptes"] });
      qc.invalidateQueries({ queryKey: ["admin-livreurs"] });
      toast.show(t(actif ? "admin.compteActive" : "admin.compteDesactiveNom", { nom: c.nom }), "info");
    } catch (e: any) {
      toast.show(e.message, "erreur");
    }
  };

  const supprimer = async (c: Compte) => {
    try {
      await apiFetch(`/superadmin/comptes/${c.id}`, { method: "DELETE" });
      qc.invalidateQueries({ queryKey: ["superadmin-comptes"] });
      qc.invalidateQueries({ queryKey: ["admin-livreurs"] });
      toast.show(t("admin.compteSupprime", { nom: c.nom }), "succes");
    } catch (e: any) {
      toast.show(e.message, "erreur");
    }
  };

  const supprimerSelection = async () => {
    try {
      const count = selection.selectedIds.length;
      await apiFetch("/superadmin/comptes/bulk/delete", { method: "DELETE", body: { ids: selection.selectedIds } });
      selection.clear();
      setConfirmerSuppressionMultiple(false);
      await qc.invalidateQueries({ queryKey: ["superadmin-comptes"] });
      await qc.invalidateQueries({ queryKey: ["admin-livreurs"] });
      toast.show(t("admin.comptesSupprimes", { count }), "succes");
    } catch (e: any) {
      toast.show(e.message, "erreur");
    }
  };

  return (
    <Garde roles={["superadmin"]}>
    <View testID="ecran-personnel" style={styles.ecran}>
      <View style={styles.enteteWeb}>
        <TitrePage
          titre={t("admin.personnelTitre")}
          sousTitre={t("admin.personnelSousTitre")}
          actions={
            <Pressable testID="btn-ajouter-compte" onPress={() => setOuvert(true)} style={styles.btnPrimaire}>
              <Icone name="user-plus" size={16} color={colors.onBrandPrimary} />
              <Text style={styles.btnPrimaireTexte}>{t("admin.nouveauCompte")}</Text>
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
          testID="liste-comptes"
          data={completerGrille(q.data ?? [], cols)}
          keyExtractor={(c) => c.id}
          contentContainerStyle={[styles.liste, { paddingBottom: spacing.xxxl }]}
          key={`comptes-${cols}`}
          numColumns={cols}
          columnWrapperStyle={cols > 1 ? styles.rangeeGrille : undefined}
          refreshing={q.isRefetching}
          onRefresh={() => q.refetch()}
          ListEmptyComponent={
            <View style={styles.centre}>
              <Icone name="users" size={36} color={colors.muted} />
              <Text style={styles.refus}>{t("admin.aucunComptePersonnel")}</Text>
            </View>
          }
          ListHeaderComponent={<SelectionHeader checked={selection.allSelected} onToggle={selection.toggleAll} totalCount={selection.totalCount} />}
          renderItem={({ item }: any) =>
            item.vide ? (
              <View style={styles.carteGrille} />
            ) : (
            <View testID={`compte-${item.nom}`} style={[styles.carte, cols > 1 && styles.carteGrille]}>
              <ToggleSelection
                checked={selection.selectedIds.includes(item.id)}
                onToggle={() => selection.toggle(item.id)}
                testID={`selection-compte-${item.nom}`}
              />
              <View style={styles.hautCarte}>
                <View style={[styles.badge, item.role === "admin" ? styles.badgeAdmin : styles.badgeLivreur]}>
                  <Icone
                    name={item.role === "admin" ? "key" : "scooter"}
                    size={13}
                    color={item.role === "admin" ? colors.brandPrimary : colors.brandSecondary}
                  />
                  <Text
                    style={[
                      styles.badgeTexte,
                      { color: item.role === "admin" ? colors.brandPrimary : colors.brandSecondary },
                    ]}
                  >
                    {item.role === "admin" ? t("admin.personnelTitre") : t("admin.livreursTitre")}
                  </Text>
                </View>
                <Switch
                  testID={`switch-compte-${item.nom}`}
                  value={item.actif}
                  onValueChange={(v) => basculer(item, v)}
                  trackColor={{ true: colors.success, false: colors.border }}
                />
                <Pressable
                  testID={`btn-supprimer-compte-${item.nom}`}
                  onPress={() => supprimer(item)}
                  hitSlop={8}
                  style={styles.supprimer}
                >
                  <Icone name="trash-2" size={18} color={colors.error} />
                </Pressable>
              </View>
              <Text style={styles.nom}>{item.nom}</Text>
              <Text style={styles.detail}>
                {item.telephone}
                {item.email ? ` · ${item.email}` : ""}
                {item.vehicule ? ` · ${item.vehicule} ${item.plaque ?? ""}` : ""}
              </Text>
              {!item.actif ? <Text style={styles.desactive}>{t("admin.compteDesactive")}</Text> : null}
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
              <Text style={styles.feuilleTitre}>{t("admin.nouveauCompte")}</Text>

              <View style={styles.selecteur}>
                {(["admin", "livreur"] as const).map((r) => (
                  <Pressable
                    key={r}
                    testID={`type-${r}`}
                    onPress={() => setType(r)}
                    style={[styles.option, type === r && styles.optionActive]}
                  >
                    <Icone
                      name={r === "admin" ? "key" : "scooter"}
                      size={16}
                      color={type === r ? colors.onBrandPrimary : colors.muted}
                    />
                    <Text style={[styles.optionTexte, type === r && styles.optionTexteActive]}>
                      {r === "admin" ? t("admin.personnelTitre") : t("admin.livreursTitre")}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Champ label={t("params.nom")} testID="input-compte-nom" value={nom} onChangeText={setNom} />
              {type === "admin" ? (
                <Champ
                  label={t("params.email")}
                  testID="input-compte-email"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              ) : null}
              <Champ
                label={t("params.telephone")}
                testID="input-compte-telephone"
                value={telephone}
                onChangeText={setTelephone}
                keyboardType="phone-pad"
              />
              {type === "livreur" ? (
                <>
                  <Champ label={t("admin.vehicule")} testID="input-compte-vehicule" value={vehicule} onChangeText={setVehicule} />
                  <Champ label={t("admin.plaque")} testID="input-compte-plaque" value={plaque} onChangeText={setPlaque} />
                </>
              ) : null}
              <Champ
                label={t("admin.mdpInitial")}
                testID="input-compte-motdepasse"
                value={motDePasse}
                onChangeText={setMotDePasse}
                secureTextEntry
                autoCapitalize="none"
              />

              <Bouton testID="btn-creer-compte" label={t("admin.creerCompte")} onPress={creer} />
              <Bouton testID="btn-annuler-compte" label={t("commun.annuler")} variant="contour" onPress={() => setOuvert(false)} />
            </KeyboardAwareScrollView>
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
    </Garde>
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
  sousTitre: { fontFamily: fonts.text, fontSize: 12, color: colors.muted },
  ajouter: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  centre: { alignItems: "center", justifyContent: "center", paddingVertical: spacing.xxxl, gap: spacing.sm },
  refus: { fontFamily: fonts.text, fontSize: 14, color: colors.muted },
  liste: { ...LARGEUR_LARGE, paddingHorizontal: spacing.xl, gap: spacing.md },
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
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 2,
    ...softShadow,
  },
  hautCarte: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.xs },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    marginRight: "auto",
  },
  badgeAdmin: { backgroundColor: colors.brandTertiary },
  badgeLivreur: { backgroundColor: colors.surfaceSecondary },
  badgeTexte: { fontFamily: fonts.text, fontSize: 11, fontWeight: "700" },
  supprimer: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  nom: { fontFamily: fonts.display, fontSize: 17, color: colors.onSurface },
  detail: { fontFamily: fonts.text, fontSize: 12, color: colors.muted },
  desactive: { fontFamily: fonts.text, fontSize: 12, color: colors.error, marginTop: 2 },
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
  selecteur: { flexDirection: "row", gap: spacing.sm },
  option: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 46,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  optionActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  optionTexte: { fontFamily: fonts.text, fontSize: 14, fontWeight: "700", color: colors.muted },
  optionTexteActive: { color: colors.onBrandPrimary },
}));
