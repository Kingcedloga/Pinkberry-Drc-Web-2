import { Chargement } from "@/src/components/Chargement";
import { Icone } from "@/src/components/Icone";
import { ListeOptions, type Option } from "@/src/components/ListeOptions";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import React, { useState } from "react";
import {
  FlatList,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { apiFetch, apiUpload } from "@/src/api";
import { Bouton } from "@/src/components/Bouton";
import { Champ } from "@/src/components/Champ";
import { PhotoProduit } from "@/src/components/PhotoProduit";
import { usd } from "@/src/money";
import { LARGEUR_FEUILLE, LARGEUR_LARGE } from "@/src/reactif";
import { colors, fonts, radius, softShadow, spacing, stylesDynamiques } from "@/src/theme";
import { useTheme } from "@/src/theme-contexte";
import { useMontant } from "@/src/taux";
import { useToast } from "@/src/toast";

const TAILLE_MAX = 5 * 1024 * 1024;
const FORMATS = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

const CATEGORIES_VIDES: { id: string; nom: string; nbProduits: number }[] = [];
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

const nombre = (v: string) => {
  const n = parseFloat((v || "0").replace(",", "."));
  return isNaN(n) ? 0 : Math.round(n * 100) / 100;
};

export default function Catalogue() {
  useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["produits"], queryFn: () => apiFetch<any[]>("/produits") });
  const categoriesQ = useQuery({
    queryKey: ["admin-categories"],
    queryFn: () => apiFetch<{ id: string; nom: string; nbProduits: number }[]>("/admin/categories"),
  });
  const categories = categoriesQ.data ?? CATEGORIES_VIDES;
  const { taux, fc } = useMontant();

  const [tauxOuvert, setTauxOuvert] = useState(false);
  const [tauxTexte, setTauxTexte] = useState("");
  const [catsOuvert, setCatsOuvert] = useState(false);
  const [nouvelleCat, setNouvelleCat] = useState("");
  const [catASupprimer, setCatASupprimer] = useState<{ id: string; nom: string; nbProduits: number } | null>(null);

  const [edition, setEdition] = useState<any>(null);
  const [nom, setNom] = useState("");
  const [categorie, setCategorie] = useState("");
  const [prixTexte, setPrixTexte] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [apercuLocal, setApercuLocal] = useState<string | null>(null);
  const [envoiPhoto, setEnvoiPhoto] = useState(false);
  const [description, setDescription] = useState("");
  const [disponible, setDisponible] = useState(true);
  const [enAvant, setEnAvant] = useState(false);
  const [tailles, setTailles] = useState<Option[]>([]);
  const [garnitures, setGarnitures] = useState<Option[]>([]);

  const ouvrir = (p: any | null) => {
    setEdition(p ?? { nouveau: true });
    setNom(p?.nom ?? "");
    setCategorie(p?.categorie ?? categories[0]?.nom ?? "");
    setPrixTexte(p ? String(p.prix) : "");
    setImage(p?.image ?? null);
    setApercuLocal(null);
    setDescription(p?.description ?? "");
    setDisponible(p?.disponible ?? true);
    setEnAvant(p?.enAvant ?? false);
    setTailles(
      p
        ? (p.tailles ?? []).map((t: any) => ({ nom: t.nom, valeur: String(t.ecart ?? 0) }))
        : TAILLES.map((t) => ({ nom: t.nom, valeur: String(t.ecart) })),
    );
    setGarnitures(
      p
        ? (p.garnitures ?? []).map((g: any) => ({ nom: g.nom, valeur: String(g.prix ?? 0) }))
        : GARNITURES.map((g) => ({ nom: g.nom, valeur: String(g.prix) })),
    );
  };

  const choisirPhoto = async () => {
    const actuelle = await ImagePicker.getMediaLibraryPermissionsAsync();
    let statut = actuelle.status;
    if (statut !== "granted") {
      if (actuelle.canAskAgain) {
        const demande = await ImagePicker.requestMediaLibraryPermissionsAsync();
        statut = demande.status;
        if (demande.status !== "granted" && !demande.canAskAgain) {
          toast.show("Accès aux photos bloqué, ouvrez les réglages", "erreur");
          if (Platform.OS !== "web") Linking.openSettings();
          return;
        }
      } else {
        toast.show("Accès aux photos bloqué, ouvrez les réglages", "erreur");
        if (Platform.OS !== "web") Linking.openSettings();
        return;
      }
    }
    if (statut !== "granted") {
      toast.show("Autorisation refusée", "erreur");
      return;
    }

    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.9,
      allowsMultipleSelection: false,
    });
    if (res.canceled || !res.assets?.length) return;

    const asset = res.assets[0];
    const type = (asset.mimeType ?? "image/jpeg").toLowerCase();
    if (!FORMATS.includes(type)) {
      toast.show("Formats acceptés : JPG, PNG ou WebP", "erreur");
      return;
    }
    if ((asset.fileSize ?? 0) > TAILLE_MAX) {
      toast.show("Image trop lourde (5 Mo maximum)", "erreur");
      return;
    }

    setApercuLocal(asset.uri);
    setEnvoiPhoto(true);
    try {
      const nomFichier = asset.fileName ?? `photo.${type.split("/")[1] ?? "jpg"}`;
      const form = new FormData();
      if (Platform.OS === "web") {
        const blob = await (await fetch(asset.uri)).blob();
        form.append("file", blob, nomFichier);
      } else {
        form.append("file", { uri: asset.uri, name: nomFichier, type } as any);
      }
      const r = await apiUpload<{ url: string }>("/admin/photos", form);
      setImage(r.url);
      setApercuLocal(null);
      toast.show("Photo envoyée", "succes");
    } catch (e: any) {
      setApercuLocal(null);
      toast.show(e.message, "erreur");
    } finally {
      setEnvoiPhoto(false);
    }
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
      emoji: null,
      image,
      description,
      disponible,
      enAvant,
      tailles: tailles
        .filter((t) => t.nom.trim())
        .map((t) => ({ nom: t.nom.trim(), ecart: nombre(t.valeur) })),
      garnitures: garnitures
        .filter((g) => g.nom.trim())
        .map((g) => ({ nom: g.nom.trim(), prix: nombre(g.valeur) })),
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

  const enregistrerTaux = async () => {
    const valeur = parseFloat(tauxTexte.replace(/\s/g, "").replace(",", "."));
    if (isNaN(valeur) || valeur <= 0) {
      toast.show("Entrez un taux valide (ex. 2800)", "erreur");
      return;
    }
    try {
      // Le serveur renvoie la config relue en base : on affiche cette valeur
      // de reference plutot que la saisie locale.
      const enregistre = await apiFetch<{ tauxFC: number }>("/admin/config", {
        method: "PUT",
        body: { tauxFC: valeur },
      });
      qc.setQueryData(["config"], enregistre);
      await qc.refetchQueries({ queryKey: ["config"] });
      setTauxOuvert(false);
      toast.show(`Taux mis à jour : 1 USD = ${enregistre.tauxFC} FC`, "succes");
    } catch (e: any) {
      toast.show(e.message, "erreur");
    }
  };

  const ajouterCategorie = async () => {
    const nomCat = nouvelleCat.trim();
    if (nomCat.length < 2) {
      toast.show("Nom de catégorie trop court", "erreur");
      return;
    }
    try {
      await apiFetch("/admin/categories", { method: "POST", body: { nom: nomCat } });
      qc.invalidateQueries({ queryKey: ["admin-categories"] });
      qc.invalidateQueries({ queryKey: ["categories"] });
      setNouvelleCat("");
      toast.show(`Catégorie « ${nomCat} » ajoutée`, "succes");
    } catch (e: any) {
      toast.show(e.message, "erreur");
    }
  };

  const supprimerCategorie = async () => {
    if (!catASupprimer) return;
    try {
      const r = await apiFetch<{ produitsSupprimes: number }>(`/admin/categories/${catASupprimer.id}`, {
        method: "DELETE",
      });
      qc.invalidateQueries({ queryKey: ["admin-categories"] });
      qc.invalidateQueries({ queryKey: ["categories"] });
      qc.invalidateQueries({ queryKey: ["produits"] });
      toast.show(
        r.produitsSupprimes > 0
          ? `Catégorie et ${r.produitsSupprimes} produit(s) supprimés`
          : "Catégorie supprimée",
        "succes",
      );
      setCatASupprimer(null);
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
      <View style={[styles.entete, { paddingTop: spacing.lg }]}>
        <Text style={styles.titre}>Catalogue</Text>
        <View style={styles.actionsEntete}>
          <Pressable testID="btn-gerer-categories" onPress={() => setCatsOuvert(true)} style={styles.secondaire}>
            <Icone name="grid" size={20} color={colors.brandPrimary} />
          </Pressable>
          <Pressable testID="btn-ajouter-produit" onPress={() => ouvrir(null)} style={styles.ajouter}>
            <Icone name="plus" size={20} color={colors.onBrandPrimary} />
          </Pressable>
        </View>
      </View>

      <Pressable
        testID="banniere-taux"
        onPress={() => {
          setTauxTexte(String(taux));
          setTauxOuvert(true);
        }}
        style={({ pressed }) => [styles.banniere, pressed && { backgroundColor: "#F7CFE1" }]}
      >
        <Icone name="repeat" size={18} color={colors.brandPrimary} />
        <View style={styles.banniereTexte}>
          <Text style={styles.banniereTitre}>Taux de change USD → FC</Text>
          <Text testID="taux-actuel" style={styles.banniereValeur}>
            1 USD = {fc(1)}
          </Text>
        </View>
        <Text style={styles.banniereLien}>Modifier</Text>
      </Pressable>

      {q.isLoading ? (
        <View style={styles.centre}>
          <Chargement taille={52} />
        </View>
      ) : (
        <FlatList
          testID="liste-admin-produits"
          data={q.data ?? []}
          keyExtractor={(p) => p.id}
          contentContainerStyle={[styles.liste, { paddingBottom: spacing.xxxl }]}
          refreshing={q.isRefetching}
          onRefresh={() => q.refetch()}
          renderItem={({ item }) => (
            <View testID={`admin-produit-${item.nom}`} style={styles.carte}>
              <PhotoProduit image={item.image} taille={56} rayon={radius.md} />
              <View style={styles.texte}>
                <Text style={styles.nom}>{item.nom}</Text>
                <Text style={styles.cat}>{item.categorie}</Text>
                <Text style={styles.prix}>{usd(item.prix)}</Text>
                {!item.disponible ? <Text style={styles.rupture}>En rupture</Text> : null}
                {item.enAvant ? <Text style={styles.enAvant}>⭐ Recommandé</Text> : null}
              </View>
              <Pressable testID={`btn-modifier-${item.nom}`} onPress={() => ouvrir(item)} style={styles.iconeBtn}>
                <Icone name="edit-2" size={17} color={colors.brandPrimary} />
              </Pressable>
              <Pressable testID={`btn-supprimer-${item.nom}`} onPress={() => supprimer(item.id)} style={styles.iconeBtn}>
                <Icone name="trash-2" size={17} color={colors.error} />
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

              <Text style={styles.label}>Photo du produit</Text>
              <View style={styles.photoBloc}>
                {apercuLocal ? (
                  <PhotoProduit image={apercuLocal} taille={88} rayon={radius.lg} testID="apercu-photo-locale" />
                ) : (
                  <PhotoProduit image={image} taille={88} rayon={radius.lg} testID="apercu-photo" />
                )}
                <View style={styles.photoActions}>
                  <Bouton
                    testID="btn-choisir-photo"
                    label={image || apercuLocal ? "Remplacer la photo" : "Choisir une photo"}
                    icone="image-plus"
                    variant="secondaire"
                    petit
                    loading={envoiPhoto}
                    onPress={choisirPhoto}
                  />
                  {image ? (
                    <Bouton
                      testID="btn-retirer-photo"
                      label="Retirer"
                      icone="trash-2"
                      variant="danger"
                      petit
                      onPress={() => setImage(null)}
                    />
                  ) : null}
                  <Text style={styles.photoAide}>JPG, PNG ou WebP · 5 Mo maximum</Text>
                </View>
              </View>

              <Champ label="Nom" testID="input-produit-nom" value={nom} onChangeText={setNom} />
              <Champ label="Prix (USD)" testID="input-produit-prix" value={prixTexte} onChangeText={setPrixTexte} keyboardType="decimal-pad" />
              <Champ label="Description" testID="input-produit-description" value={description} onChangeText={setDescription} multiline />

              <Text style={styles.label}>Catégorie</Text>
              <View style={styles.chipsRow}>
                {categories.map((c) => (
                  <Pressable
                    key={c.id}
                    testID={`cat-${c.nom}`}
                    onPress={() => setCategorie(c.nom)}
                    style={[styles.chip, categorie === c.nom && styles.chipActif]}
                  >
                    <Text style={[styles.chipTexte, categorie === c.nom && { color: colors.onBrandPrimary }]}>
                      {c.nom}
                    </Text>
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
                <View style={styles.switchTexte}>
                  <Text style={styles.switchLabel}>Mettre en avant / Recommander</Text>
                  <Text style={styles.switchAide}>Affiché en haut de l&apos;accueil client</Text>
                </View>
                <Switch
                  testID="switch-en-avant"
                  value={enAvant}
                  onValueChange={setEnAvant}
                  trackColor={{ true: colors.brandPrimary, false: colors.border }}
                />
              </View>
              <ListeOptions
                titre="Tailles"
                aide="Supplément ajouté au prix de base (0 pour la taille standard)"
                cle="taille"
                options={tailles}
                onChange={setTailles}
                placeholderNom="Ex. Grand"
              />

              <ListeOptions
                titre="Garnitures"
                aide="Prix de la garniture ajoutée par le client"
                cle="garniture"
                options={garnitures}
                onChange={setGarnitures}
                placeholderNom="Ex. Granola"
              />

              <Bouton testID="btn-enregistrer-produit" label="Enregistrer" onPress={enregistrer} />
              <Bouton testID="btn-annuler-produit" label="Annuler" variant="contour" onPress={() => setEdition(null)} />
            </KeyboardAwareScrollView>
          </View>
        </View>
      </Modal>
      <Modal visible={tauxOuvert} animationType="fade" transparent onRequestClose={() => setTauxOuvert(false)}>
        <View style={styles.voileCentre}>
          <View testID="modal-taux" style={styles.dialogue}>
            <Text style={styles.feuilleTitre}>Taux de change</Text>
            <Text style={styles.dialogueTexte}>
              Combien de francs congolais vaut 1 dollar américain ? Le nouveau taux s&apos;applique
              immédiatement à tous les prix affichés côté client.
            </Text>
            <Champ
              label="1 USD = ... FC"
              testID="input-taux"
              value={tauxTexte}
              onChangeText={setTauxTexte}
              keyboardType="decimal-pad"
              placeholder="2800"
            />
            <Text style={styles.apercu}>
              Aperçu : $6.00 ≈{" "}
              {String(Math.round(6 * (parseFloat(tauxTexte.replace(/\s/g, "").replace(",", ".")) || 0))).replace(
                /\B(?=(\d{3})+(?!\d))/g,
                " ",
              )}{" "}
              FC
            </Text>
            <Bouton testID="btn-enregistrer-taux" label="Enregistrer le taux" onPress={enregistrerTaux} />
            <Bouton testID="btn-annuler-taux" label="Annuler" variant="contour" onPress={() => setTauxOuvert(false)} />
          </View>
        </View>
      </Modal>

      <Modal visible={catsOuvert} animationType="slide" transparent onRequestClose={() => setCatsOuvert(false)}>
        <View style={styles.voile}>
          <Pressable style={{ flex: 1 }} onPress={() => setCatsOuvert(false)} />
          <View style={[styles.feuille, { paddingBottom: insets.bottom + spacing.lg }]}>
            <KeyboardAwareScrollView bottomOffset={60} contentContainerStyle={styles.feuilleContenu}>
              <Text style={styles.feuilleTitre}>Catégories</Text>

              {catASupprimer ? (
                <View style={styles.alerte}>
                  <Text style={styles.alerteTexte}>
                    Supprimer « {catASupprimer.nom} » ?{" "}
                    {catASupprimer.nbProduits > 0
                      ? `Les ${catASupprimer.nbProduits} produit(s) de cette catégorie seront aussi supprimés.`
                      : "Cette catégorie est vide."}
                  </Text>
                  <Bouton
                    testID="btn-confirmer-suppression-categorie"
                    label="Supprimer définitivement"
                    variant="danger"
                    onPress={supprimerCategorie}
                  />
                  <Bouton
                    testID="btn-annuler-suppression-categorie"
                    label="Annuler"
                    variant="contour"
                    onPress={() => setCatASupprimer(null)}
                  />
                </View>
              ) : null}

              <View testID="liste-categories">
                {categories.map((c) => (
                  <View key={c.id} testID={`categorie-${c.nom}`} style={styles.ligneCat}>
                    <Text style={styles.ligneCatNom}>{c.nom}</Text>
                    <Text style={styles.ligneCatNb}>{c.nbProduits} produit(s)</Text>
                    <Pressable
                      testID={`btn-supprimer-categorie-${c.nom}`}
                      hitSlop={8}
                      onPress={() => setCatASupprimer(c)}
                      style={styles.secondaire}
                    >
                      <Icone name="trash-2" size={18} color={colors.error} />
                    </Pressable>
                  </View>
                ))}
              </View>

              <Champ
                label="Nouvelle catégorie"
                testID="input-nouvelle-categorie"
                value={nouvelleCat}
                onChangeText={setNouvelleCat}
                placeholder="Ex. Gaufres"
              />
              <Bouton testID="btn-ajouter-categorie" label="Ajouter la catégorie" onPress={ajouterCategorie} />
              <Bouton
                testID="btn-fermer-categories"
                label="Fermer"
                variant="contour"
                onPress={() => {
                  setCatASupprimer(null);
                  setCatsOuvert(false);
                }}
              />
            </KeyboardAwareScrollView>
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
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  actionsEntete: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  titre: { fontFamily: fonts.display, fontSize: 26, color: colors.onSurface },
  ajouter: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaire: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  ligneCat: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: 56,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  ligneCatNom: { flex: 1, fontFamily: fonts.text, fontSize: 15, color: colors.onSurface },
  ligneCatNb: { fontFamily: fonts.text, fontSize: 12, color: colors.muted },
  alerte: {
    backgroundColor: colors.errorSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  alerteTexte: { fontFamily: fonts.text, fontSize: 13, color: colors.onSurface },
  centre: { alignItems: "center", justifyContent: "center", paddingVertical: spacing.xxxl },
  liste: { ...LARGEUR_LARGE, paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: spacing.md },
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
  photoBloc: { flexDirection: "row", gap: spacing.lg, alignItems: "center" },
  photoActions: { flex: 1, gap: spacing.sm },
  photoAide: { fontFamily: fonts.text, fontSize: 11, color: colors.muted },
  texte: { flex: 1 },
  nom: { fontFamily: fonts.display, fontSize: 16, color: colors.onSurface },
  cat: { fontFamily: fonts.text, fontSize: 11, color: colors.muted },
  prix: { fontFamily: fonts.display, fontSize: 14, color: colors.brandPrimary },
  enAvant: { fontFamily: fonts.text, fontSize: 11, fontWeight: "800", color: colors.brandPrimary },
  switchTexte: { flex: 1 },
  switchAide: { fontFamily: fonts.text, fontSize: 11, color: colors.muted },
  rupture: { fontFamily: fonts.text, fontSize: 11, fontWeight: "800", color: colors.error },
  iconeBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  voile: { flex: 1, backgroundColor: "rgba(42,23,33,0.45)", justifyContent: "flex-end" },
  voileCentre: {
    flex: 1,
    backgroundColor: "rgba(42,23,33,0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  dialogue: {
    width: "100%",
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    gap: spacing.md,
  },
  dialogueTexte: { fontFamily: fonts.text, fontSize: 12, color: colors.muted },
  apercu: { fontFamily: fonts.display, fontSize: 15, color: colors.brandPrimary },
  banniere: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.brandTertiary,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    minHeight: 64,
  },
  banniereTexte: { flex: 1 },
  banniereTitre: { fontFamily: fonts.text, fontSize: 11, fontWeight: "800", color: colors.muted },
  banniereValeur: { fontFamily: fonts.display, fontSize: 17, color: colors.brandPrimary },
  banniereLien: { fontFamily: fonts.text, fontSize: 13, fontWeight: "800", color: colors.brandPrimary },
  feuille: {
    ...LARGEUR_FEUILLE,
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
}));
