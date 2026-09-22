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
import { hauteurOngletsNatifs } from "@/src/nav";
import { LARGEUR_FEUILLE, LARGEUR_LARGE } from "@/src/reactif";
import { colors, fonts, radius, softShadow, spacing, stylesDynamiques } from "@/src/theme";
import { useTheme } from "@/src/theme-contexte";
import { useToast } from "@/src/toast";

export default function Zones() {
  useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["zones"], queryFn: () => apiFetch<any[]>("/zones") });

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
        valeur ? `On livre maintenant à ${zone.commune}` : `Livraison suspendue à ${zone.commune}`,
        "succes",
      );
    } catch (e: any) {
      toast.show(e.message, "erreur");
    }
  };

  const ajouter = async () => {
    if (commune.trim().length < 2) {
      toast.show("Nom de zone trop court", "erreur");
      return;
    }
    try {
      await apiFetch("/admin/zones", { method: "POST", body: { commune: commune.trim(), active } });
      rafraichir();
      setOuvert(false);
      setCommune("");
      setActive(true);
      toast.show(`Zone « ${commune.trim()} » ajoutée`, "succes");
    } catch (e: any) {
      toast.show(e.message, "erreur");
    }
  };

  const supprimer = async () => {
    try {
      await apiFetch(`/admin/zones/${aSupprimer.id}`, { method: "DELETE" });
      rafraichir();
      setASupprimer(null);
      toast.show("Zone supprimée", "succes");
    } catch (e: any) {
      toast.show(e.message, "erreur");
    }
  };

  return (
    <View testID="ecran-admin-zones" style={styles.ecran}>
      <View style={[styles.entete, { paddingTop: insets.top + spacing.lg }]}>
        <View style={styles.enteteHaut}>
          <Text style={styles.titre}>Zones de livraison</Text>
          <Pressable testID="btn-ajouter-zone" onPress={() => setOuvert(true)} style={styles.ajouter}>
            <Icone name="plus" size={20} color={colors.onBrandPrimary} />
          </Pressable>
        </View>
        <Text style={styles.sous}>
          Seules les communes couvertes sont proposées au client. Retirer une zone la rend
          immédiatement indisponible.
        </Text>
      </View>

      {q.isLoading ? (
        <View style={styles.centre}>
          <Chargement taille={52} />
        </View>
      ) : (
        <FlatList
          testID="liste-zones"
          data={q.data ?? []}
          keyExtractor={(z) => z.id}
          contentContainerStyle={[styles.liste, { paddingBottom: spacing.xl + hauteurOngletsNatifs(insets.bottom) }]}
          refreshing={q.isRefetching}
          onRefresh={() => q.refetch()}
          ListEmptyComponent={
            <View style={styles.centre}>
              <Text style={styles.sous}>Aucune zone. Ajoutez votre première commune.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View testID={`zone-${item.commune}`} style={styles.carte}>
              <View style={styles.texte}>
                <Text style={styles.nom}>{item.commune}</Text>
                <Text style={[styles.etat, { color: item.active ? colors.success : colors.muted }]}>
                  {item.active ? "Couverte" : "Non couverte"}
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
          )}
        />
      )}

      <Modal visible={ouvert} transparent animationType="slide" onRequestClose={() => setOuvert(false)}>
        <View style={styles.voile}>
          <Pressable style={{ flex: 1 }} onPress={() => setOuvert(false)} />
          <View style={[styles.feuille, { paddingBottom: insets.bottom + spacing.lg }]}>
            <KeyboardAwareScrollView bottomOffset={60} contentContainerStyle={styles.feuilleContenu}>
              <Text style={styles.feuilleTitre}>Nouvelle zone</Text>
              <Champ
                label="Commune ou quartier"
                testID="input-zone-commune"
                value={commune}
                onChangeText={setCommune}
                placeholder="Ex. Ngaliema"
              />
              <View style={styles.ligneSwitch}>
                <Text style={styles.switchLabel}>Activer la livraison tout de suite</Text>
                <Switch
                  testID="switch-nouvelle-zone"
                  value={active}
                  onValueChange={setActive}
                  trackColor={{ true: colors.success, false: colors.border }}
                />
              </View>
              <Bouton testID="btn-creer-zone" label="Ajouter la zone" onPress={ajouter} />
              <Bouton
                testID="btn-annuler-zone"
                label="Annuler"
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
            <Text style={styles.dialogueTitre}>Supprimer {aSupprimer?.commune} ?</Text>
            <Text style={styles.dialogueTexte}>
              Cette commune ne sera plus proposée aux clients et les nouvelles commandes y seront
              refusées. Les commandes déjà passées ne changent pas.
            </Text>
            <Bouton
              testID="btn-confirmer-suppression-zone"
              label="Supprimer la zone"
              variant="danger"
              onPress={supprimer}
            />
            <Bouton
              testID="btn-annuler-suppression-zone"
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
  liste: { ...LARGEUR_LARGE, paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: spacing.sm },
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
  corbeille: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
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
