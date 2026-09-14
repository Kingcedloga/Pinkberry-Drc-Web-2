import Feather from "@react-native-vector-icons/feather";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useState } from "react";
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { apiFetch } from "@/src/api";
import { Bouton } from "@/src/components/Bouton";
import { Champ } from "@/src/components/Champ";
import { usd } from "@/src/money";
import { colors, fonts, radius, softShadow, spacing } from "@/src/theme";
import { useToast } from "@/src/toast";

const CATEGORIES = ["Pots de crème", "Smoothies", "Toppings", "Boissons"];
const TAILLES = [
  { nom: "Petit", ecart: 0 },
  { nom: "Moyen", ecart: 1.5 },
  { nom: "Grand", ecart: 3.0 },
];
const GARNITURES = [
  { nom: "Fruits frais", prix: 1.0 },
  { nom: "Granola", prix: 0.75 },
  { nom: "Coulis fraise", prix: 0.5 },
  { nom: "Pépites de chocolat", prix: 0.75 },
  { nom: "Mochi", prix: 1.25 },
];

export default function Catalogue() {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["produits"], queryFn: () => apiFetch<any[]>("/produits") });

  const [edition, setEdition] = useState<any>(null);
  const [nom, setNom] = useState("");
  const [categorie, setCategorie] = useState(CATEGORIES[0]);
  const [prixTexte, setPrixTexte] = useState("");
  const [emoji, setEmoji] = useState("🍦");
  const [description, setDescription] = useState("");
  const [disponible, setDisponible] = useState(true);
  const [avecTailles, setAvecTailles] = useState(true);
  const [avecGarnitures, setAvecGarnitures] = useState(true);

  const ouvrir = (p: any | null) => {
    setEdition(p ?? { nouveau: true });
    setNom(p?.nom ?? "");
    setCategorie(p?.categorie ?? CATEGORIES[0]);
    setPrixTexte(p ? String(p.prix) : "");
    setEmoji(p?.emoji ?? "🍦");
    setDescription(p?.description ?? "");
    setDisponible(p?.disponible ?? true);
    setAvecTailles((p?.tailles?.length ?? 0) > 0 || !p);
    setAvecGarnitures((p?.garnitures?.length ?? 0) > 0 || !p);
  };

  const enregistrer = async () => {
    const prix = parseFloat(prixTexte.replace(",", "."));
    if (!nom.trim() || isNaN(prix)) {
      toast.show("Nom et prix valides requis", "erreur");
      return;
    }
    const body = {
      nom,
      categorie,
      prix,
      emoji,
      image: edition?.image ?? null,
      description,
      disponible,
      tailles: avecTailles ? TAILLES : [],
      garnitures: avecGarnitures ? GARNITURES : [],
    };
    try {
      if (edition?.nouveau) await apiFetch("/admin/produits", { method: "POST", body });
      else await apiFetch(`/admin/produits/${edition.id}`, { method: "PUT", body });
      qc.invalidateQueries({ queryKey: ["produits"] });
      setEdition(null);
      toast.show("Produit enregistré", "succes");
    } catch (e: any) {
      toast.show(e.message, "erreur");
    }
  };

  const supprimer = async (id: string) => {
    try {
      await apiFetch(`/admin/produits/${id}`, { method: "DELETE" });
      qc.invalidateQueries({ queryKey: ["produits"] });
      toast.show("Produit supprimé", "succes");
    } catch (e: any) {
      toast.show(e.message, "erreur");
    }
  };

  return (
    <View testID="ecran-admin-catalogue" style={styles.ecran}>
      <View style={[styles.entete, { paddingTop: insets.top + spacing.lg }]}>
        <Text style={styles.titre}>Catalogue</Text>
        <Pressable testID="btn-ajouter-produit" onPress={() => ouvrir(null)} style={styles.ajouter}>
          <Feather name="plus" size={20} color={colors.onBrandPrimary} />
        </Pressable>
      </View>

      {q.isLoading ? (
        <View style={styles.centre}>
          <ActivityIndicator color={colors.brandPrimary} size="large" />
        </View>
      ) : (
        <FlatList
          testID="liste-admin-produits"
          data={q.data ?? []}
          keyExtractor={(p) => p.id}
          contentContainerStyle={styles.liste}
          refreshing={q.isRefetching}
          onRefresh={() => q.refetch()}
          renderItem={({ item }) => (
            <View testID={`admin-produit-${item.nom}`} style={styles.carte}>
              <Text style={styles.emoji}>{item.emoji ?? "🍦"}</Text>
              <View style={styles.texte}>
                <Text style={styles.nom}>{item.nom}</Text>
                <Text style={styles.cat}>{item.categorie}</Text>
                <Text style={styles.prix}>{usd(item.prix)}</Text>
                {!item.disponible ? <Text style={styles.rupture}>En rupture</Text> : null}
              </View>
              <Pressable testID={`btn-modifier-${item.nom}`} onPress={() => ouvrir(item)} style={styles.iconeBtn}>
                <Feather name="edit-2" size={17} color={colors.brandPrimary} />
              </Pressable>
              <Pressable testID={`btn-supprimer-${item.nom}`} onPress={() => supprimer(item.id)} style={styles.iconeBtn}>
                <Feather name="trash-2" size={17} color={colors.error} />
              </Pressable>
            </View>
          )}
        />
      )}

      <Modal visible={!!edition} animationType="slide" transparent onRequestClose={() => setEdition(null)}>
        <View style={styles.voile}>
          <Pressable style={{ flex: 1 }} onPress={() => setEdition(null)} />
          <View style={[styles.feuille, { paddingBottom: insets.bottom + spacing.lg }]}>
            <KeyboardAwareScrollView bottomOffset={60} contentContainerStyle={styles.feuilleContenu}>
              <Text style={styles.feuilleTitre}>{edition?.nouveau ? "Nouveau produit" : "Modifier le produit"}</Text>
              <Champ label="Nom" testID="input-produit-nom" value={nom} onChangeText={setNom} />
              <Champ label="Prix (USD)" testID="input-produit-prix" value={prixTexte} onChangeText={setPrixTexte} keyboardType="decimal-pad" />
              <Champ label="Emoji" testID="input-produit-emoji" value={emoji} onChangeText={setEmoji} />
              <Champ label="Description" testID="input-produit-description" value={description} onChangeText={setDescription} multiline />

              <Text style={styles.label}>Catégorie</Text>
              <View style={styles.chipsRow}>
                {CATEGORIES.map((c) => (
                  <Pressable
                    key={c}
                    testID={`cat-${c}`}
                    onPress={() => setCategorie(c)}
                    style={[styles.chip, categorie === c && styles.chipActif]}
                  >
                    <Text style={[styles.chipTexte, categorie === c && { color: colors.onBrandPrimary }]}>{c}</Text>
                  </Pressable>
                ))}
              </View>

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Disponible</Text>
                <Switch
                  testID="switch-disponible"
                  value={disponible}
                  onValueChange={setDisponible}
                  trackColor={{ true: colors.success, false: colors.border }}
                />
              </View>
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Tailles (Petit/Moyen/Grand)</Text>
                <Switch
                  testID="switch-tailles"
                  value={avecTailles}
                  onValueChange={setAvecTailles}
                  trackColor={{ true: colors.success, false: colors.border }}
                />
              </View>
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Garnitures</Text>
                <Switch
                  testID="switch-garnitures"
                  value={avecGarnitures}
                  onValueChange={setAvecGarnitures}
                  trackColor={{ true: colors.success, false: colors.border }}
                />
              </View>

              <Bouton testID="btn-enregistrer-produit" label="Enregistrer" onPress={enregistrer} />
              <Bouton testID="btn-annuler-produit" label="Annuler" variant="contour" onPress={() => setEdition(null)} />
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
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...softShadow,
  },
  emoji: { fontSize: 30 },
  texte: { flex: 1 },
  nom: { fontFamily: fonts.display, fontSize: 16, color: colors.onSurface },
  cat: { fontFamily: fonts.text, fontSize: 11, color: colors.muted },
  prix: { fontFamily: fonts.display, fontSize: 14, color: colors.brandPrimary },
  rupture: { fontFamily: fonts.text, fontSize: 11, fontWeight: "800", color: colors.error },
  iconeBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  voile: { flex: 1, backgroundColor: "rgba(42,23,33,0.45)", justifyContent: "flex-end" },
  feuille: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: "90%",
  },
  feuilleContenu: { padding: spacing.xl, gap: spacing.md },
  feuilleTitre: { fontFamily: fonts.display, fontSize: 21, color: colors.onSurface },
  label: { fontFamily: fonts.text, fontSize: 13, fontWeight: "700", color: colors.muted },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    minHeight: 40,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  chipActif: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  chipTexte: { fontFamily: fonts.text, fontSize: 12, fontWeight: "700", color: colors.onSurface },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 48,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
  },
  switchLabel: { fontFamily: fonts.text, fontSize: 14, fontWeight: "700", color: colors.onSurface },
});
