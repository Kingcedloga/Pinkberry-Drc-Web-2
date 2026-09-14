import { Icone } from "@/src/components/Icone";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useState } from "react";
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { apiFetch } from "@/src/api";
import { Bouton } from "@/src/components/Bouton";
import { Champ } from "@/src/components/Champ";
import { hauteurOngletsNatifs } from "@/src/nav";
import { colors, fonts, radius, softShadow, spacing } from "@/src/theme";
import { useToast } from "@/src/toast";

export default function Livreurs() {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["admin-livreurs"],
    queryFn: () => apiFetch<any[]>("/admin/livreurs"),
    refetchInterval: 10000,
  });

  const [ouvert, setOuvert] = useState(false);
  const [nom, setNom] = useState("");
  const [telephone, setTelephone] = useState("");
  const [vehicule, setVehicule] = useState("Moto");
  const [plaque, setPlaque] = useState("");
  const [motDePasse, setMotDePasse] = useState("livreur123");

  const ajouter = async () => {
    if (!nom.trim() || telephone.trim().length < 9) {
      toast.show("Nom et téléphone requis", "erreur");
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
      toast.show("Livreur ajouté", "succes");
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

  return (
    <View testID="ecran-admin-livreurs" style={styles.ecran}>
      <View style={[styles.entete, { paddingTop: insets.top + spacing.lg }]}>
        <Text style={styles.titre}>Livreurs</Text>
        <Pressable testID="btn-ajouter-livreur" onPress={() => setOuvert(true)} style={styles.ajouter}>
          <Icone name="plus" size={20} color={colors.onBrandPrimary} />
        </Pressable>
      </View>

      {q.isLoading ? (
        <View style={styles.centre}>
          <ActivityIndicator color={colors.brandPrimary} size="large" />
        </View>
      ) : (
        <FlatList
          testID="liste-admin-livreurs"
          data={q.data ?? []}
          keyExtractor={(l) => l.id}
          contentContainerStyle={[styles.liste, { paddingBottom: spacing.xl + hauteurOngletsNatifs(insets.bottom) }]}
          refreshing={q.isRefetching}
          onRefresh={() => q.refetch()}
          renderItem={({ item }) => (
            <View testID={`livreur-${item.nom}`} style={styles.carte}>
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
                      : "Position inconnue"}
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
          )}
        />
      )}

      <Modal visible={ouvert} animationType="slide" transparent onRequestClose={() => setOuvert(false)}>
        <View style={styles.voile}>
          <Pressable style={{ flex: 1 }} onPress={() => setOuvert(false)} />
          <View style={[styles.feuille, { paddingBottom: insets.bottom + spacing.lg }]}>
            <KeyboardAwareScrollView bottomOffset={60} contentContainerStyle={styles.feuilleContenu}>
              <Text style={styles.feuilleTitre}>Nouveau livreur</Text>
              <Champ label="Nom" testID="input-livreur-nom" value={nom} onChangeText={setNom} />
              <Champ label="Téléphone" testID="input-livreur-telephone" value={telephone} onChangeText={setTelephone} keyboardType="phone-pad" />
              <Champ label="Véhicule" testID="input-livreur-vehicule" value={vehicule} onChangeText={setVehicule} />
              <Champ label="Plaque" testID="input-livreur-plaque" value={plaque} onChangeText={setPlaque} />
              <Champ label="Mot de passe de connexion" testID="input-livreur-motdepasse" value={motDePasse} onChangeText={setMotDePasse} />
              <Bouton testID="btn-enregistrer-livreur" label="Ajouter le livreur" onPress={ajouter} />
              <Bouton testID="btn-annuler-livreur" label="Annuler" variant="contour" onPress={() => setOuvert(false)} />
            </KeyboardAwareScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
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
  liste: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: spacing.md },
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
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: "90%",
  },
  feuilleContenu: { padding: spacing.xl, gap: spacing.md },
  feuilleTitre: { fontFamily: fonts.display, fontSize: 21, color: colors.onSurface },
});
