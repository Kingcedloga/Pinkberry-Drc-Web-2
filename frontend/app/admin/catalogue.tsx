import { Chargement } from "@/src/components/Chargement";
import { Icone } from "@/src/components/Icone";
import { BulkDeleteDialog, SelectionBar, SelectionHeader, ToggleSelection, useListeSelection } from "@/src/components/ListeSelection";
import { ListeOptions, type Option } from "@/src/components/ListeOptions";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import React, { useMemo, useState } from "react";
import {
  FlatList,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { apiFetch, apiUpload } from "@/src/api";
import { Bouton } from "@/src/components/Bouton";
import { Champ } from "@/src/components/Champ";
import { PhotoProduit } from "@/src/components/PhotoProduit";
import { traduireContenuCatalogue } from "@/src/catalogue-i18n";
import { useT } from "@/src/i18n";
import { prix } from "@/src/money";
import { TitrePage } from "@/src/components/TitrePage";
import { LARGEUR_FEUILLE, LARGEUR_LARGE, useEcran } from "@/src/reactif";
import { colors, fonts, radius, softShadow, spacing, stylesDynamiques } from "@/src/theme";
import { useTheme } from "@/src/theme-contexte";
import { useMontant } from "@/src/taux";
import { useToast } from "@/src/toast";

const TAILLE_MAX = 5 * 1024 * 1024;
const FORMATS = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

const CATEGORIES_VIDES: { id: string; nom: string; nbProduits: number }[] = [];
const TAILLES = (t: (cle: string, vars?: Record<string, string | number>) => string) => [
  { nom: t("catalogue.petit"), ecart: 0 },
  { nom: t("catalogue.moyen"), ecart: 1.5 },
  { nom: t("catalogue.grand"), ecart: 3.0 },
];
const GARNITURES = (t: (cle: string, vars?: Record<string, string | number>) => string) => [
  { nom: t("catalogue.fruitsFrais"), prix: 1.0 },
  { nom: t("catalogue.granola"), prix: 0.75 },
  { nom: t("catalogue.coulisFraise"), prix: 0.5 },
  { nom: t("catalogue.pepitesChocolat"), prix: 0.75 },
  { nom: t("catalogue.mochi"), prix: 1.25 },
];

const nombre = (v: string) => {
  const n = parseFloat((v || "0").replace(",", "."));
  return isNaN(n) ? 0 : Math.round(n * 100) / 100;
};

export default function Catalogue() {
  useTheme();
  const t = useT();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["produits"], queryFn: () => apiFetch<any[]>("/produits") });
  const categoriesQ = useQuery({
    queryKey: ["admin-categories"],
    queryFn: () => apiFetch<{ id: string; nom: string; nbProduits: number }[]>("/admin/categories"),
  });
  const categories = categoriesQ.data ?? CATEGORIES_VIDES;
  const { taux, fc, usd } = useMontant();

  const [tauxOuvert, setTauxOuvert] = useState(false);
  const [tauxTexte, setTauxTexte] = useState("");
  const [catsOuvert, setCatsOuvert] = useState(false);
  const [recherche, setRecherche] = useState("");
  const { bureau } = useEcran();

  const produits = useMemo(() => {
    const texte = recherche.trim().toLowerCase();
    return (q.data ?? []).filter(
      (p: any) =>
        !texte || p.nom.toLowerCase().includes(texte) || String(p.categorie ?? "").toLowerCase().includes(texte),
    );
  }, [q.data, recherche]);
  const selection = useListeSelection(produits.map((p: any) => p.id));
  const [confirmerSuppressionMultiple, setConfirmerSuppressionMultiple] = useState(false);
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
    setPrixTexte(p ? String(p.prix * taux) : "");
    setImage(p?.image ?? null);
    setApercuLocal(null);
    setDescription(p?.description ?? "");
    setDisponible(p?.disponible ?? true);
    setEnAvant(p?.enAvant ?? false);
    setTailles(
      p
        ? (p.tailles ?? []).map((t: any) => ({ nom: t.nom, valeur: String((t.ecart ?? 0) * taux) }))
        : TAILLES(t).map((taille) => ({ nom: taille.nom, valeur: String(taille.ecart * taux) })),
    );
    setGarnitures(
      p
        ? (p.garnitures ?? []).map((g: any) => ({ nom: g.nom, valeur: String((g.prix ?? 0) * taux) }))
        : GARNITURES(t).map((garniture) => ({ nom: garniture.nom, valeur: String(garniture.prix * taux) })),
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
          toast.show(t("catalogue.accesPhotosBloque"), "erreur");
          if (Platform.OS !== "web") Linking.openSettings();
          return;
        }
      } else {
        toast.show(t("catalogue.accesPhotosBloque"), "erreur");
        if (Platform.OS !== "web") Linking.openSettings();
        return;
      }
    }
    if (statut !== "granted") {
      toast.show(t("catalogue.autorisationRefusee"), "erreur");
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
      toast.show(t("catalogue.formatsAcceptes"), "erreur");
      return;
    }
    if ((asset.fileSize ?? 0) > TAILLE_MAX) {
      toast.show(t("catalogue.photoTropLourde"), "erreur");
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
      toast.show(t("catalogue.photoEnvoyee"), "succes");
    } catch (e: any) {
      setApercuLocal(null);
      toast.show(e.message, "erreur");
    } finally {
      setEnvoiPhoto(false);
    }
  };

  const enregistrer = async () => {
    const prixFC = parseFloat(prixTexte.replace(",", "."));
    if (!nom.trim() || isNaN(prixFC) || prixFC < 0) {
      toast.show(t("catalogue.nomPrixRequis"), "erreur");
      return;
    }
    const prixUSD = Math.round((prixFC / taux) * 100) / 100;
    const body = {
      nom,
      categorie,
      prix: prixUSD,
      emoji: null,
      image,
      description,
      disponible,
      enAvant,
      tailles: tailles
        .filter((t) => t.nom.trim())
        .map((t) => ({ nom: t.nom.trim(), ecart: Math.round((nombre(t.valeur) / taux) * 100) / 100 })),
      garnitures: garnitures
        .filter((g) => g.nom.trim())
        .map((g) => ({ nom: g.nom.trim(), prix: Math.round((nombre(g.valeur) / taux) * 100) / 100 })),
    };
    try {
      if (edition?.nouveau) await apiFetch("/admin/produits", { method: "POST", body });
      else await apiFetch(`/admin/produits/${edition.id}`, { method: "PUT", body });
      qc.invalidateQueries({ queryKey: ["produits"] });
      setEdition(null);
      toast.show(t("catalogue.produitEnregistre"), "succes");
    } catch (e: any) {
      toast.show(e.message, "erreur");
    }
  };

  const enregistrerTaux = async () => {
    const valeur = parseFloat(tauxTexte.replace(/\s/g, "").replace(",", "."));
    if (isNaN(valeur) || valeur <= 0) {
      toast.show(t("catalogue.tauxInvalide"), "erreur");
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
      toast.show(t("catalogue.tauxMisAJour", { taux: enregistre.tauxFC }), "succes");
    } catch (e: any) {
      toast.show(e.message, "erreur");
    }
  };

  const ajouterCategorie = async () => {
    const nomCat = nouvelleCat.trim();
    if (nomCat.length < 2) {
      toast.show(t("catalogue.categorieNomCourt"), "erreur");
      return;
    }
    try {
      await apiFetch("/admin/categories", { method: "POST", body: { nom: nomCat } });
      qc.invalidateQueries({ queryKey: ["admin-categories"] });
      qc.invalidateQueries({ queryKey: ["categories"] });
      setNouvelleCat("");
      toast.show(t("catalogue.categorieAjoutee", { nom: nomCat }), "succes");
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
          ? t("catalogue.produitsSupprimes", { n: r.produitsSupprimes })
          : t("catalogue.categorieSupprimee"),
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
      toast.show(t("catalogue.produitSupprime"), "succes");
    } catch (e: any) {
      toast.show(e.message, "erreur");
    }
  };

  const supprimerSelection = async () => {
    const count = selection.selectedIds.length;
    try {
      await apiFetch("/admin/produits/bulk/delete", { method: "DELETE", body: { ids: selection.selectedIds } });
      selection.clear();
      setConfirmerSuppressionMultiple(false);
      await qc.invalidateQueries({ queryKey: ["produits"] });
      toast.show(count > 1 ? t("catalogue.plusieursProduits", { n: count }) : t("catalogue.unProduit", { n: count }), "succes");
    } catch (e: any) {
      toast.show(e.message, "erreur");
    }
  };

  return (
    <View testID="ecran-admin-catalogue" style={styles.ecran}>
      <View style={styles.enteteWeb}>
        <TitrePage
          titre={t("catalogue.titre")}
          sousTitre={t("catalogue.sousTitre")}
          actions={
            <>
              <Pressable testID="btn-gerer-categories" onPress={() => setCatsOuvert(true)} style={styles.btnSecondaire}>
                <Icone name="grid" size={16} color={colors.brandPrimary} />
                <Text style={styles.btnSecondaireTexte}>{t("catalogue.gererCategories")}</Text>
              </Pressable>
              <Pressable testID="btn-ajouter-produit" onPress={() => ouvrir(null)} style={styles.btnPrimaire}>
                <Icone name="plus" size={16} color={colors.onBrandPrimary} />
                <Text style={styles.btnPrimaireTexte}>{t("catalogue.nouveauProduit")}</Text>
              </Pressable>
            </>
          }
        />
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
          <Text style={styles.banniereTitre}>{t("catalogue.tauxTitre")}</Text>
          <Text testID="taux-actuel" style={styles.banniereValeur}>
            1 USD = {fc(1)}
          </Text>
        </View>
        <Text style={styles.banniereLien}>{t("catalogue.modifier")}</Text>
      </Pressable>

      {q.isLoading ? (
        <View style={styles.centre}>
          <Chargement taille={52} />
        </View>
      ) : (
        <FlatList
          testID="liste-admin-produits"
          data={produits}
          keyExtractor={(p) => p.id}
          contentContainerStyle={[styles.liste, { paddingBottom: spacing.xxxl }]}
          refreshing={q.isRefetching}
          onRefresh={() => q.refetch()}
          ListHeaderComponent={
            <View style={styles.outils}>
              <SelectionHeader
                checked={selection.allSelected}
                onToggle={selection.toggleAll}
                totalCount={selection.totalCount}
              />
              <View style={styles.rechercheWrap}>
                <Icone name="search" size={16} color={colors.muted} />
                <TextInput
                  testID="input-recherche-produits"
                  value={recherche}
                  onChangeText={setRecherche}
                  placeholder={t("catalogue.rechercher")}
                  placeholderTextColor={colors.muted}
                  style={styles.rechercheChamp}
                />
              </View>
              <Text style={styles.compteur}>
                {produits.length > 1 ? t("catalogue.plusieursProduits", { n: produits.length }) : t("catalogue.unProduit", { n: produits.length })}
              </Text>
              {bureau ? (
                <View testID="entete-tableau-produits" style={styles.ligneEnteteTable}>
                  <Text style={[styles.celluleEntete, styles.colProduit]}>{t("catalogue.produit")}</Text>
                  <Text style={[styles.celluleEntete, styles.colCategorie]}>{t("catalogue.categorie")}</Text>
                  <Text style={[styles.celluleEntete, styles.colPrix]}>{t("catalogue.prix")}</Text>
                  <Text style={[styles.celluleEntete, styles.colEtat]}>{t("catalogue.etat")}</Text>
                  <Text style={[styles.celluleEntete, styles.colActions]}>{t("catalogue.actions")}</Text>
                </View>
              ) : null}
            </View>
          }
          renderItem={({ item }) =>
            bureau ? (
              <View testID={`admin-produit-${item.nom}`} style={styles.ligneTable}>
                <ToggleSelection
                  checked={selection.selectedIds.includes(item.id)}
                  onToggle={() => selection.toggle(item.id)}
                  testID={`selection-produit-${item.nom}`}
                />
                <View style={[styles.colProduit, styles.cellProduit]}>
                  <PhotoProduit image={item.image} taille={44} rayon={radius.md} />
                  <Text style={styles.nom} numberOfLines={1}>
                    {traduireContenuCatalogue(item.nom, t)}
                  </Text>
                </View>
                <Text style={[styles.cat, styles.colCategorie]}>
                  {traduireContenuCatalogue(item.categorie, t)}
                </Text>
                <Text style={[styles.prix, styles.colPrix]}>{prix(item.prix)}</Text>
                <View style={[styles.colEtat, styles.cellEtat]}>
                  {item.disponible ? (
                    <Text style={styles.badgeVert}>{t("catalogue.disponible")}</Text>
                  ) : (
                    <Text style={styles.rupture}>{t("catalogue.rupture")}</Text>
                  )}
                  {item.enAvant ? <Text style={styles.enAvant}>⭐ {t("catalogue.recommande")}</Text> : null}
                </View>
                <View style={[styles.colActions, styles.cellActions]}>
                  <Pressable testID={`btn-modifier-${item.nom}`} onPress={() => ouvrir(item)} style={styles.iconeBtn}>
                    <Icone name="edit-2" size={17} color={colors.brandPrimary} />
                  </Pressable>
                  <Pressable testID={`btn-supprimer-${item.nom}`} onPress={() => supprimer(item.id)} style={styles.iconeBtn}>
                    <Icone name="trash-2" size={17} color={colors.error} />
                  </Pressable>
                </View>
              </View>
            ) : (
              <View testID={`admin-produit-${item.nom}`} style={styles.carte}>
                <ToggleSelection
                  checked={selection.selectedIds.includes(item.id)}
                  onToggle={() => selection.toggle(item.id)}
                  testID={`selection-produit-${item.nom}`}
                />
                <PhotoProduit image={item.image} taille={56} rayon={radius.md} />
                <View style={styles.texte}>
                  <Text style={styles.nom}>{traduireContenuCatalogue(item.nom, t)}</Text>
                  <Text style={styles.cat}>{traduireContenuCatalogue(item.categorie, t)}</Text>
                  <Text style={styles.prix}>{prix(item.prix)}</Text>
                  {!item.disponible ? <Text style={styles.rupture}>{t("catalogue.rupture")}</Text> : null}
                  {item.enAvant ? <Text style={styles.enAvant}>⭐ {t("catalogue.recommande")}</Text> : null}
                </View>
                <Pressable testID={`btn-modifier-${item.nom}`} onPress={() => ouvrir(item)} style={styles.iconeBtn}>
                  <Icone name="edit-2" size={17} color={colors.brandPrimary} />
                </Pressable>
                <Pressable testID={`btn-supprimer-${item.nom}`} onPress={() => supprimer(item.id)} style={styles.iconeBtn}>
                  <Icone name="trash-2" size={17} color={colors.error} />
                </Pressable>
              </View>
            )
          }
        />
      )}

      <Modal visible={!!edition} animationType="slide" transparent onRequestClose={() => setEdition(null)}>
        <View style={styles.voile}>
          <Pressable style={{ flex: 1 }} onPress={() => setEdition(null)} />
          <View style={[styles.feuille, { paddingBottom: insets.bottom + spacing.lg }]}>
            <KeyboardAwareScrollView bottomOffset={60} contentContainerStyle={styles.feuilleContenu}>
              <Text style={styles.feuilleTitre}>
                {edition?.nouveau ? t("catalogue.nouveauProduitTitre") : t("catalogue.modifierProduit")}
              </Text>

              <Text style={styles.label}>{t("catalogue.photoProduit")}</Text>
              <View style={styles.photoBloc}>
                {apercuLocal ? (
                  <PhotoProduit image={apercuLocal} taille={88} rayon={radius.lg} testID="apercu-photo-locale" />
                ) : (
                  <PhotoProduit image={image} taille={88} rayon={radius.lg} testID="apercu-photo" />
                )}
                <View style={styles.photoActions}>
                  <Bouton
                    testID="btn-choisir-photo"
                    label={image || apercuLocal ? t("catalogue.remplacerPhoto") : t("catalogue.choisirPhoto")}
                    icone="image-plus"
                    variant="secondaire"
                    petit
                    loading={envoiPhoto}
                    onPress={choisirPhoto}
                  />
                  {image ? (
                    <Bouton
                      testID="btn-retirer-photo"
                      label={t("catalogue.retirer")}
                      icone="trash-2"
                      variant="danger"
                      petit
                      onPress={() => setImage(null)}
                    />
                  ) : null}
                  <Text style={styles.photoAide}>{t("catalogue.photoAide")}</Text>
                </View>
              </View>

              <Champ label={t("params.nom")} testID="input-produit-nom" value={nom} onChangeText={setNom} />
              <Champ label={t("catalogue.prix")} testID="input-produit-prix" value={prixTexte} onChangeText={setPrixTexte} keyboardType="decimal-pad" />
              <Champ label={t("catalogue.description")} testID="input-produit-description" value={description} onChangeText={setDescription} multiline />

              <Text style={styles.label}>{t("catalogue.categorie")}</Text>
              <View style={styles.chipsRow}>
                {categories.map((c) => (
                  <Pressable
                    key={c.id}
                    testID={`cat-${c.nom}`}
                    onPress={() => setCategorie(c.nom)}
                    style={[styles.chip, categorie === c.nom && styles.chipActif]}
                  >
                    <Text style={[styles.chipTexte, categorie === c.nom && { color: colors.onBrandPrimary }]}>
                      {traduireContenuCatalogue(c.nom, t)}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>{t("catalogue.disponible")}</Text>
                <Switch
                  testID="switch-disponible"
                  value={disponible}
                  onValueChange={setDisponible}
                  trackColor={{ true: colors.success, false: colors.border }}
                />
              </View>
              <View style={styles.switchRow}>
                <View style={styles.switchTexte}>
                  <Text style={styles.switchLabel}>{t("catalogue.mettreEnAvant")}</Text>
                  <Text style={styles.switchAide}>{t("catalogue.mettreEnAvantAide")}</Text>
                </View>
                <Switch
                  testID="switch-en-avant"
                  value={enAvant}
                  onValueChange={setEnAvant}
                  trackColor={{ true: colors.brandPrimary, false: colors.border }}
                />
              </View>
              <ListeOptions
                titre={t("catalogue.tailles")}
                aide={t("catalogue.taillesAide")}
                cle="taille"
                options={tailles}
                onChange={setTailles}
                placeholderNom={t("catalogue.tailleExemple")}
              />

              <ListeOptions
                titre={t("catalogue.garnitures")}
                aide={t("catalogue.garnituresAide")}
                cle="garniture"
                options={garnitures}
                onChange={setGarnitures}
                placeholderNom={t("catalogue.garnitureExemple")}
              />

              <Bouton testID="btn-enregistrer-produit" label={t("commun.enregistrer")} onPress={enregistrer} />
              <Bouton testID="btn-annuler-produit" label={t("commun.annuler")} variant="contour" onPress={() => setEdition(null)} />
            </KeyboardAwareScrollView>
          </View>
        </View>
      </Modal>
      <Modal visible={tauxOuvert} animationType="fade" transparent onRequestClose={() => setTauxOuvert(false)}>
        <View style={styles.voileCentre}>
          <View testID="modal-taux" style={styles.dialogue}>
            <Text style={styles.feuilleTitre}>{t("catalogue.tauxTitreModal")}</Text>
            <Text style={styles.dialogueTexte}>{t("catalogue.tauxDescription")}</Text>
            <Champ
              label={t("catalogue.tauxSaisie")}
              testID="input-taux"
              value={tauxTexte}
              onChangeText={setTauxTexte}
              keyboardType="decimal-pad"
              placeholder="2800"
            />
            <Text style={styles.apercu}>
              {t("catalogue.apercu")} {" "}
              {String(Math.round(6 * (parseFloat(tauxTexte.replace(/\s/g, "").replace(",", ".")) || 0))).replace(
                /\B(?=(\d{3})+(?!\d))/g,
                " ",
              )}{" "}
              FC ≈ {usd(6)}
            </Text>
            <Bouton testID="btn-enregistrer-taux" label={t("catalogue.enregistrerTaux")} onPress={enregistrerTaux} />
            <Bouton testID="btn-annuler-taux" label={t("commun.annuler")} variant="contour" onPress={() => setTauxOuvert(false)} />
          </View>
        </View>
      </Modal>

      <Modal visible={catsOuvert} animationType="slide" transparent onRequestClose={() => setCatsOuvert(false)}>
        <View style={styles.voile}>
          <Pressable style={{ flex: 1 }} onPress={() => setCatsOuvert(false)} />
          <View style={[styles.feuille, { paddingBottom: insets.bottom + spacing.lg }]}>
            <KeyboardAwareScrollView bottomOffset={60} contentContainerStyle={styles.feuilleContenu}>
              <Text style={styles.feuilleTitre}>{t("catalogue.categories")}</Text>

              {catASupprimer ? (
                <View style={styles.alerte}>
                  <Text style={styles.alerteTexte}>
                    {t("catalogue.supprimerCategorieQuestion", {
                      nom: traduireContenuCatalogue(catASupprimer.nom, t),
                    })}{" "}
                    {catASupprimer.nbProduits > 0
                      ? t("catalogue.produitsCategorieSupprimes", { n: catASupprimer.nbProduits })
                      : t("catalogue.categorieVide")}
                  </Text>
                  <Bouton
                    testID="btn-confirmer-suppression-categorie"
                    label={t("commun.supprimer")}
                    variant="danger"
                    onPress={supprimerCategorie}
                  />
                  <Bouton
                    testID="btn-annuler-suppression-categorie"
                    label={t("commun.annuler")}
                    variant="contour"
                    onPress={() => setCatASupprimer(null)}
                  />
                </View>
              ) : null}

              <View testID="liste-categories">
                {categories.map((c) => (
                  <View key={c.id} testID={`categorie-${c.nom}`} style={styles.ligneCat}>
                    <Text style={styles.ligneCatNom}>{traduireContenuCatalogue(c.nom, t)}</Text>
                    <Text style={styles.ligneCatNb}>
                      {c.nbProduits > 1 ? t("catalogue.plusieursProduits", { n: c.nbProduits }) : t("catalogue.unProduit", { n: c.nbProduits })}
                    </Text>
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
                label={t("catalogue.nouvelleCategorie")}
                testID="input-nouvelle-categorie"
                value={nouvelleCat}
                onChangeText={setNouvelleCat}
                placeholder={t("catalogue.categorieExemple")}
              />
              <Bouton testID="btn-ajouter-categorie" label={t("catalogue.ajouterCategorie")} onPress={ajouterCategorie} />
              <Bouton
                testID="btn-fermer-categories"
                label={t("admin.fermer")}
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
      <SelectionBar
        selectedCount={selection.selectedIds.length}
        onClear={selection.clear}
        onDelete={() => setConfirmerSuppressionMultiple(true)}
      />
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
  liste: { ...LARGEUR_LARGE, paddingHorizontal: spacing.xl, paddingBottom: spacing.xl, gap: spacing.md },
  enteteWeb: { ...LARGEUR_LARGE, paddingHorizontal: spacing.xl, paddingTop: spacing.xl },
  btnSecondaire: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.brandTertiary,
  },
  btnSecondaireTexte: { fontFamily: fonts.text, fontSize: 13, fontWeight: "800", color: colors.brandPrimary },
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
  outils: { gap: spacing.md },
  rechercheWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    height: 44,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    maxWidth: 420,
  },
  rechercheChamp: { flex: 1, fontFamily: fonts.text, fontSize: 13, color: colors.onSurface, outlineStyle: "none" } as any,
  compteur: { fontFamily: fonts.text, fontSize: 12, fontWeight: "700", color: colors.muted },
  ligneEnteteTable: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg },
  celluleEntete: {
    fontFamily: fonts.text,
    fontSize: 11,
    fontWeight: "800",
    color: colors.muted,
    textTransform: "uppercase",
  },
  ligneTable: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  colProduit: { flex: 2 },
  colCategorie: { flex: 1 },
  colPrix: { width: 90 },
  colEtat: { flex: 1 },
  colActions: { width: 96 },
  cellProduit: { flexDirection: "row", alignItems: "center", gap: spacing.md, minWidth: 0 },
  cellEtat: { gap: 2 },
  cellActions: { flexDirection: "row", justifyContent: "flex-end", gap: spacing.xs },
  badgeVert: { fontFamily: fonts.text, fontSize: 12, fontWeight: "800", color: colors.success },
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
