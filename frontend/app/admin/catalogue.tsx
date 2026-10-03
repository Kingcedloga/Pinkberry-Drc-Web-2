import { Chargement } from "@/src/components/Chargement";
import { Icone } from "@/src/components/Icone";
import { BulkDeleteDialog, SelectionBar, SelectionHeader, ToggleSelection, useListeSelection } from "@/src/components/ListeSelection";
import { ListeOptions, type Option } from "@/src/components/ListeOptions";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
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
import { useLibelle } from "@/src/catalogue-i18n";
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

type SousCategorie = { nom: string; nomEn?: string | null };
type CategorieAdmin = {
  id: string;
  nom: string;
  nomEn?: string | null;
  sousCategories?: SousCategorie[];
  nbProduits: number;
};

const CATEGORIES_VIDES: CategorieAdmin[] = [];

const vide = (v?: string | null) => !v?.trim();

/** Montant saisi en FC (monnaie de référence), arrondi au franc. */
const nombre = (v: string) => {
  const n = parseFloat((v || "0").replace(/\s/g, "").replace(",", "."));
  return isNaN(n) ? 0 : Math.round(n);
};

// Tailles et garnitures d'un produit, prêtes pour l'édition (montants en FC).
const optionsDe = (p: any) => ({
  tailles: (p?.tailles ?? []).map((t: any) => ({ nom: t.nom, nomEn: t.nomEn ?? "", valeur: String(t.ecart ?? 0) })),
  garnitures: (p?.garnitures ?? []).map((g: any) => ({ nom: g.nom, nomEn: g.nomEn ?? "", valeur: String(g.prix ?? 0) })),
});

export default function Catalogue() {
  useTheme();
  const t = useT();
  const libelle = useLibelle();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const router = useRouter();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["produits"], queryFn: () => apiFetch<any[]>("/produits") });
  const categoriesQ = useQuery({
    queryKey: ["admin-categories"],
    queryFn: () => apiFetch<CategorieAdmin[]>("/admin/categories"),
  });
  const categories = categoriesQ.data ?? CATEGORIES_VIDES;
  const { taux, fc } = useMontant();

  const [tauxOuvert, setTauxOuvert] = useState(false);
  const [tauxTexte, setTauxTexte] = useState("");
  const [catsOuvert, setCatsOuvert] = useState(false);
  const [recherche, setRecherche] = useState("");
  const { bureau } = useEcran();

  const produits = useMemo(() => {
    const texte = recherche.trim().toLowerCase();
    return (q.data ?? []).filter(
      (p: any) =>
        !texte ||
        [p.nom, p.nomEn, p.categorie, p.categorieEn, p.sousCategorie, p.sousCategorieEn].some((v) =>
          String(v ?? "").toLowerCase().includes(texte),
        ),
    );
  }, [q.data, recherche]);
  const selection = useListeSelection(produits.map((p: any) => p.id));
  const [confirmerSuppressionMultiple, setConfirmerSuppressionMultiple] = useState(false);
  const [nouvelleCat, setNouvelleCat] = useState("");
  const [catASupprimer, setCatASupprimer] = useState<CategorieAdmin | null>(null);
  // Libellés anglais et nouvelles sous-catégories en cours de saisie (id -> texte).
  const [categoriesEn, setCategoriesEn] = useState<Record<string, string>>({});
  const [nouvellesSousCats, setNouvellesSousCats] = useState<Record<string, string>>({});

  const [edition, setEdition] = useState<any>(null);
  const [nom, setNom] = useState("");
  const [nomEn, setNomEn] = useState("");
  const [categorie, setCategorie] = useState("");
  const [sousCategorie, setSousCategorie] = useState("");
  const [prixTexte, setPrixTexte] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [apercuLocal, setApercuLocal] = useState<string | null>(null);
  const [envoiPhoto, setEnvoiPhoto] = useState(false);
  const [description, setDescription] = useState("");
  const [descriptionEn, setDescriptionEn] = useState("");
  const [traduction, setTraduction] = useState(false);
  const [disponible, setDisponible] = useState(true);
  const [enAvant, setEnAvant] = useState(false);
  // Frozen yogurt composé : taille, récipient et garnitures viennent de /admin/composition.
  const [configurable, setConfigurable] = useState(false);
  const [tailles, setTailles] = useState<Option[]>([]);
  const [garnitures, setGarnitures] = useState<Option[]>([]);
  // Faux tant que l'admin n'a pas retouché les tailles/garnitures d'un nouveau produit.
  const [optionsModifiees, setOptionsModifiees] = useState(false);

  const sousCategoriesDe = (nomCat: string) => categories.find((c) => c.nom === nomCat)?.sousCategories ?? [];

  // Modèle d'une catégorie : le produit existant le plus complet. Un nouveau
  // produit en reprend prix, tailles et garnitures pour garder la carte homogène.
  const modeleDe = (nomCat: string) =>
    (q.data ?? [])
      .filter((p: any) => p.categorie === nomCat)
      .sort(
        (a: any, b: any) =>
          (b.tailles?.length ?? 0) + (b.garnitures?.length ?? 0) - (a.tailles?.length ?? 0) - (a.garnitures?.length ?? 0),
      )[0] ?? null;

  const appliquerModele = (nomCat: string) => {
    const modele = modeleDe(nomCat);
    const options = optionsDe(modele);
    setPrixTexte(modele ? String(modele.prix) : "");
    setTailles(options.tailles);
    setGarnitures(options.garnitures);
  };

  const choisirCategorie = (nomCat: string) => {
    setCategorie(nomCat);
    setSousCategorie("");
    if (edition?.nouveau && !optionsModifiees) appliquerModele(nomCat);
  };

  const ouvrir = (p: any | null) => {
    const nomCat = p?.categorie ?? categories[0]?.nom ?? "";
    setEdition(p ?? { nouveau: true });
    setNom(p?.nom ?? "");
    setNomEn(p?.nomEn ?? "");
    setCategorie(nomCat);
    setSousCategorie(p?.sousCategorie ?? "");
    setOptionsModifiees(false);
    setImage(p?.image ?? null);
    setApercuLocal(null);
    setDescription(p?.description ?? "");
    setDescriptionEn(p?.descriptionEn ?? "");
    setDisponible(p?.disponible ?? true);
    setEnAvant(p?.enAvant ?? false);
    setConfigurable(!!p?.configurable);
    if (p) {
      const options = optionsDe(p);
      setPrixTexte(String(p.prix));
      setTailles(options.tailles);
      setGarnitures(options.garnitures);
    } else {
      appliquerModele(nomCat);
    }
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

  // Remplit les champs anglais vides pour relecture ; une saisie de l'admin n'est
  // jamais écrasée. Les champs encore vides seront traduits à l'enregistrement.
  const traduireFormulaire = async () => {
    const textes = [
      vide(nomEn) ? nom : "",
      vide(descriptionEn) ? description : "",
      ...tailles.map((o) => (vide(o.nomEn) ? o.nom : "")),
      ...garnitures.map((o) => (vide(o.nomEn) ? o.nom : "")),
    ];
    if (textes.every((texte) => vide(texte))) return;
    setTraduction(true);
    try {
      const { traductions } = await apiFetch<{ traductions: (string | null)[] }>("/admin/traduire", {
        method: "POST",
        body: { textes },
      });
      if (!traductions.some(Boolean)) {
        toast.show(t("catalogue.traductionIndisponible"), "erreur");
        return;
      }
      const [enNom, enDescription, ...enOptions] = traductions;
      const completer = (valeur: string | undefined, trad?: string | null) => (vide(valeur) && trad) || valeur || "";
      const nbTailles = tailles.length;
      setNomEn((v) => completer(v, enNom));
      setDescriptionEn((v) => completer(v, enDescription));
      setTailles((liste) => liste.map((o, i) => ({ ...o, nomEn: completer(o.nomEn, enOptions[i]) })));
      setGarnitures((liste) => liste.map((o, i) => ({ ...o, nomEn: completer(o.nomEn, enOptions[nbTailles + i]) })));
    } catch (e: any) {
      toast.show(e.message, "erreur");
    } finally {
      setTraduction(false);
    }
  };

  const enregistrer = async () => {
    const prixFC = parseFloat(prixTexte.replace(/\s/g, "").replace(",", "."));
    if (!nom.trim() || (!configurable && (isNaN(prixFC) || prixFC < 0))) {
      toast.show(t("catalogue.nomPrixRequis"), "erreur");
      return;
    }
    const body = {
      nom,
      nomEn: nomEn.trim() || null,
      categorie,
      sousCategorie: sousCategorie || null,
      prix: configurable ? 0 : Math.round(prixFC),
      configurable,
      emoji: null,
      image,
      description,
      descriptionEn: descriptionEn.trim() || null,
      disponible,
      enAvant,
      tailles: tailles
        .filter((t) => t.nom.trim())
        .map((t) => ({
          nom: t.nom.trim(),
          nomEn: t.nomEn?.trim() || null,
          ecart: nombre(t.valeur),
        })),
      garnitures: garnitures
        .filter((g) => g.nom.trim())
        .map((g) => ({
          nom: g.nom.trim(),
          nomEn: g.nomEn?.trim() || null,
          prix: nombre(g.valeur),
        })),
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

  const enregistrerCategorieEn = async (c: CategorieAdmin) => {
    const saisie = categoriesEn[c.id];
    if (saisie === undefined || saisie.trim() === (c.nomEn ?? "")) return;
    try {
      // Vide, le libellé est retraduit automatiquement par le serveur.
      await apiFetch(`/admin/categories/${c.id}`, { method: "PUT", body: { nomEn: saisie.trim() || null } });
      await qc.invalidateQueries({ queryKey: ["admin-categories"] });
      qc.invalidateQueries({ queryKey: ["categories"] });
      qc.invalidateQueries({ queryKey: ["produits"] });
      setCategoriesEn(({ [c.id]: _, ...reste }) => reste);
      toast.show(t("catalogue.traductionEnregistree"), "succes");
    } catch (e: any) {
      toast.show(e.message, "erreur");
    }
  };

  const enregistrerSousCategories = async (c: CategorieAdmin, liste: SousCategorie[], message: string) => {
    try {
      await apiFetch(`/admin/categories/${c.id}`, { method: "PUT", body: { sousCategories: liste } });
      await qc.invalidateQueries({ queryKey: ["admin-categories"] });
      qc.invalidateQueries({ queryKey: ["categories"] });
      qc.invalidateQueries({ queryKey: ["produits"] });
      toast.show(message, "succes");
      return true;
    } catch (e: any) {
      toast.show(e.message, "erreur");
      return false;
    }
  };

  const ajouterSousCategorie = async (c: CategorieAdmin) => {
    const nomSous = (nouvellesSousCats[c.id] ?? "").trim();
    if (nomSous.length < 2) return;
    const ok = await enregistrerSousCategories(
      c,
      [...(c.sousCategories ?? []), { nom: nomSous }],
      t("catalogue.sousCategorieAjoutee", { nom: nomSous }),
    );
    if (ok) setNouvellesSousCats(({ [c.id]: _, ...reste }) => reste);
  };

  const retirerSousCategorie = (c: CategorieAdmin, nomSous: string) =>
    enregistrerSousCategories(
      c,
      (c.sousCategories ?? []).filter((s) => s.nom !== nomSous),
      t("catalogue.sousCategorieRetiree", { nom: nomSous }),
    );

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

  // Changement rapide de l'état depuis la liste : affiché tout de suite, annulé
  // si le serveur refuse (ex. produit à 0 FC qu'on voudrait rendre disponible).
  const [etatsEnCours, setEtatsEnCours] = useState<Set<string>>(() => new Set());
  const changerEtat = async (item: any, maj: { disponible?: boolean; enAvant?: boolean }) => {
    if (etatsEnCours.has(item.id)) return;
    setEtatsEnCours((s) => new Set(s).add(item.id));
    qc.setQueryData<any[]>(["produits"], (liste) => liste?.map((p) => (p.id === item.id ? { ...p, ...maj } : p)));
    try {
      await apiFetch(`/admin/produits/${item.id}/etat`, { method: "PATCH", body: maj });
    } catch (e: any) {
      toast.show(e.message, "erreur");
    } finally {
      await qc.invalidateQueries({ queryKey: ["produits"] });
      setEtatsEnCours((s) => {
        const suivant = new Set(s);
        suivant.delete(item.id);
        return suivant;
      });
    }
  };

  const changerEtatSelection = async (maj: { disponible?: boolean; enAvant?: boolean }) => {
    try {
      const r = await apiFetch<{ updated_count: number; ignores: string[] }>("/admin/produits/bulk/etat", {
        method: "POST",
        body: { ids: selection.selectedIds, ...maj },
      });
      await qc.invalidateQueries({ queryKey: ["produits"] });
      if (r.updated_count > 0) toast.show(t("catalogue.etatsMisAJour", { n: r.updated_count }), "succes");
      if (r.ignores.length > 0) toast.show(t("catalogue.prixRequisDisponible", { n: r.ignores.length }), "erreur");
    } catch (e: any) {
      toast.show(e.message, "erreur");
    }
  };

  const badgesEtat = (item: any) => (
    <View style={styles.badges}>
      <Pressable
        testID={`btn-etat-disponible-${item.nom}`}
        accessibilityRole="switch"
        accessibilityState={{ checked: !!item.disponible }}
        accessibilityLabel={t("catalogue.disponible")}
        onPress={() => changerEtat(item, { disponible: !item.disponible })}
        style={styles.badgeZone}
      >
        <View style={[styles.badge, item.disponible ? styles.badgeDisponible : styles.badgeRupture]}>
          <Text style={[styles.badgeTexte, { color: item.disponible ? colors.success : colors.error }]}>
            {item.disponible ? t("catalogue.disponible") : t("catalogue.rupture")}
          </Text>
        </View>
      </Pressable>
      <Pressable
        testID={`btn-etat-recommande-${item.nom}`}
        accessibilityRole="switch"
        accessibilityState={{ checked: !!item.enAvant }}
        accessibilityLabel={t("catalogue.recommande")}
        onPress={() => changerEtat(item, { enAvant: !item.enAvant })}
        style={styles.badgeZone}
      >
        <View style={[styles.badge, item.enAvant ? styles.badgeRecommande : styles.badgeNeutre]}>
          <Text style={[styles.badgeTexte, { color: item.enAvant ? colors.brandPrimary : colors.muted }]}>
            {item.enAvant ? `⭐ ${t("catalogue.recommande")}` : `☆ ${t("catalogue.recommander")}`}
          </Text>
        </View>
      </Pressable>
    </View>
  );

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
              <Pressable
                testID="btn-composition"
                onPress={() => router.push("/admin/composition")}
                style={styles.btnSecondaire}
              >
                <Icone name="ice-cream" size={16} color={colors.brandPrimary} />
                <Text style={styles.btnSecondaireTexte}>{t("composition.titre")}</Text>
              </Pressable>
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
            1 USD = {fc(taux)}
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
                    {libelle(item.nom, item.nomEn)}
                  </Text>
                </View>
                <Text style={[styles.cat, styles.colCategorie]}>
                  {libelle(item.categorie, item.categorieEn)}
                  {item.sousCategorie ? ` · ${libelle(item.sousCategorie, item.sousCategorieEn)}` : ""}
                </Text>
                <Text style={[styles.prix, styles.colPrix]}>
                  {item.configurable ? t("catalogue.compose") : prix(item.prix)}
                </Text>
                <View style={[styles.colEtat, styles.cellEtat]}>{badgesEtat(item)}</View>
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
              <View testID={`admin-produit-${item.nom}`} style={styles.carteMobile}>
              <View style={styles.carte}>
                <ToggleSelection
                  checked={selection.selectedIds.includes(item.id)}
                  onToggle={() => selection.toggle(item.id)}
                  testID={`selection-produit-${item.nom}`}
                />
                <PhotoProduit image={item.image} taille={56} rayon={radius.md} />
                <View style={styles.texte}>
                  <Text style={styles.nom}>{libelle(item.nom, item.nomEn)}</Text>
                  <Text style={styles.cat}>
                    {libelle(item.categorie, item.categorieEn)}
                    {item.sousCategorie ? ` · ${libelle(item.sousCategorie, item.sousCategorieEn)}` : ""}
                  </Text>
                  <Text style={styles.prix}>{item.configurable ? t("catalogue.compose") : prix(item.prix)}</Text>
                </View>
                <Pressable testID={`btn-modifier-${item.nom}`} onPress={() => ouvrir(item)} style={styles.iconeBtn}>
                  <Icone name="edit-2" size={17} color={colors.brandPrimary} />
                </Pressable>
                <Pressable testID={`btn-supprimer-${item.nom}`} onPress={() => supprimer(item.id)} style={styles.iconeBtn}>
                  <Icone name="trash-2" size={17} color={colors.error} />
                </Pressable>
              </View>
              {badgesEtat(item)}
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
              <Champ label={t("catalogue.nomAnglais")} testID="input-produit-nom-en" value={nomEn} onChangeText={setNomEn} />
              <View style={styles.switchRow}>
                <View style={styles.switchTexte}>
                  <Text style={styles.switchLabel}>{t("catalogue.yogourtCompose")}</Text>
                  <Text style={styles.switchAide}>{t("catalogue.yogourtComposeAide")}</Text>
                </View>
                <Switch
                  testID="switch-configurable"
                  value={configurable}
                  onValueChange={setConfigurable}
                  trackColor={{ true: colors.brandPrimary, false: colors.border }}
                />
              </View>
              {!configurable ? (
                <Champ label={t("catalogue.prix")} testID="input-produit-prix" value={prixTexte} onChangeText={setPrixTexte} keyboardType="decimal-pad" />
              ) : null}
              <Champ label={t("catalogue.description")} testID="input-produit-description" value={description} onChangeText={setDescription} multiline />
              <Champ
                label={t("catalogue.descriptionAnglais")}
                testID="input-produit-description-en"
                value={descriptionEn}
                onChangeText={setDescriptionEn}
                multiline
              />
              <View style={styles.traductionBloc}>
                <Text style={[styles.photoAide, styles.texte]}>{t("catalogue.traductionAuto")}</Text>
                <Bouton
                  testID="btn-traduire-produit"
                  label={t("catalogue.traduire")}
                  icone="languages"
                  variant="secondaire"
                  petit
                  loading={traduction}
                  onPress={traduireFormulaire}
                />
              </View>

              <Text style={styles.label}>{t("catalogue.categorie")}</Text>
              <View style={styles.chipsRow}>
                {categories.map((c) => (
                  <Pressable
                    key={c.id}
                    testID={`cat-${c.nom}`}
                    onPress={() => choisirCategorie(c.nom)}
                    style={[styles.chip, categorie === c.nom && styles.chipActif]}
                  >
                    <Text style={[styles.chipTexte, categorie === c.nom && { color: colors.onBrandPrimary }]}>
                      {libelle(c.nom, c.nomEn)}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {sousCategoriesDe(categorie).length > 0 ? (
                <>
                  <Text style={styles.label}>{t("catalogue.sousCategorie")}</Text>
                  <View style={styles.chipsRow}>
                    {[{ nom: "" } as SousCategorie, ...sousCategoriesDe(categorie)].map((s) => {
                      const actif = sousCategorie === s.nom;
                      return (
                        <Pressable
                          key={s.nom || "aucune"}
                          testID={`sous-cat-${s.nom || "aucune"}`}
                          onPress={() => setSousCategorie(s.nom)}
                          style={[styles.chip, actif && styles.chipActif]}
                        >
                          <Text style={[styles.chipTexte, actif && { color: colors.onBrandPrimary }]}>
                            {s.nom ? libelle(s.nom, s.nomEn) : t("catalogue.aucuneSousCategorie")}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              ) : null}

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
              {!configurable ? (
                <>
                  <ListeOptions
                    titre={t("catalogue.tailles")}
                    aide={t("catalogue.taillesAide")}
                    cle="taille"
                    options={tailles}
                    onChange={(o) => {
                      setTailles(o);
                      setOptionsModifiees(true);
                    }}
                    placeholderNom={t("catalogue.tailleExemple")}
                  />

                  <ListeOptions
                    titre={t("catalogue.garnitures")}
                    aide={t("catalogue.garnituresAide")}
                    cle="garniture"
                    options={garnitures}
                    onChange={(o) => {
                      setGarnitures(o);
                      setOptionsModifiees(true);
                    }}
                    placeholderNom={t("catalogue.garnitureExemple")}
                  />
                </>
              ) : null}

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
              {t("catalogue.apercu")} {fc(10000)} ≈ $
              {(10000 / (parseFloat(tauxTexte.replace(/\s/g, "").replace(",", ".")) || 1)).toFixed(2)}
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
                      nom: libelle(catASupprimer.nom, catASupprimer.nomEn),
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
                    <View style={styles.ligneCatTexte}>
                      <Text style={styles.ligneCatNom}>{c.nom}</Text>
                      <TextInput
                        testID={`input-categorie-en-${c.nom}`}
                        value={categoriesEn[c.id] ?? c.nomEn ?? ""}
                        onChangeText={(v) => setCategoriesEn((courant) => ({ ...courant, [c.id]: v }))}
                        onBlur={() => enregistrerCategorieEn(c)}
                        placeholder={t("catalogue.enAnglais")}
                        placeholderTextColor={colors.muted}
                        style={styles.saisieCategorieEn}
                      />
                      <View style={styles.sousCats}>
                        {(c.sousCategories ?? []).map((s) => (
                          <Pressable
                            key={s.nom}
                            testID={`btn-retirer-sous-categorie-${s.nom}`}
                            accessibilityLabel={t("catalogue.retirerSousCategorie", { nom: s.nom })}
                            onPress={() => retirerSousCategorie(c, s.nom)}
                            style={styles.sousCatChip}
                          >
                            <Text style={styles.sousCatTexte}>{s.nom}</Text>
                            <Icone name="x" size={12} color={colors.muted} />
                          </Pressable>
                        ))}
                        <TextInput
                          testID={`input-sous-categorie-${c.nom}`}
                          value={nouvellesSousCats[c.id] ?? ""}
                          onChangeText={(v) => setNouvellesSousCats((courant) => ({ ...courant, [c.id]: v }))}
                          onSubmitEditing={() => ajouterSousCategorie(c)}
                          returnKeyType="done"
                          placeholder={t("catalogue.ajouterSousCategorie")}
                          placeholderTextColor={colors.muted}
                          style={styles.saisieSousCat}
                        />
                        {(nouvellesSousCats[c.id] ?? "").trim().length >= 2 ? (
                          <Pressable
                            testID={`btn-ajouter-sous-categorie-${c.nom}`}
                            onPress={() => ajouterSousCategorie(c)}
                            style={styles.sousCatAjouter}
                            hitSlop={6}
                          >
                            <Icone name="plus" size={14} color={colors.onBrandPrimary} />
                          </Pressable>
                        ) : null}
                      </View>
                    </View>
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
        actions={[
          { label: t("catalogue.rendreDisponible"), testID: "btn-selection-disponible", onPress: () => changerEtatSelection({ disponible: true }) },
          { label: t("catalogue.mettreEnRupture"), testID: "btn-selection-rupture", onPress: () => changerEtatSelection({ disponible: false }) },
          { label: `⭐ ${t("catalogue.recommander")}`, testID: "btn-selection-recommander", onPress: () => changerEtatSelection({ enAvant: true }) },
          { label: t("catalogue.nePlusRecommander"), testID: "btn-selection-non-recommander", onPress: () => changerEtatSelection({ enAvant: false }) },
        ]}
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
  ligneCatTexte: { flex: 1, gap: spacing.xs, paddingVertical: spacing.sm },
  ligneCatNom: { fontFamily: fonts.text, fontSize: 15, color: colors.onSurface },
  saisieCategorieEn: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    fontFamily: fonts.text,
    fontSize: 13,
    color: colors.onSurface,
  },
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
  badges: { flexDirection: "row", flexWrap: "wrap", columnGap: spacing.xs },
  badgeZone: { minHeight: 44, justifyContent: "center" },
  badge: { minHeight: 28, paddingHorizontal: spacing.sm, borderRadius: radius.pill, justifyContent: "center", borderWidth: 1 },
  badgeDisponible: { backgroundColor: colors.successSoft, borderColor: colors.successSoft },
  badgeRupture: { backgroundColor: colors.errorSoft, borderColor: colors.errorSoft },
  badgeRecommande: { backgroundColor: colors.brandTertiary, borderColor: colors.brandTertiary },
  badgeNeutre: { backgroundColor: "transparent", borderColor: colors.border },
  badgeTexte: { fontFamily: fonts.text, fontSize: 11, fontWeight: "800" },
  cellActions: { flexDirection: "row", justifyContent: "flex-end", gap: spacing.xs },
  // Carte produit sur petit écran : ligne principale, puis l'état sur toute la largeur.
  carteMobile: {
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...softShadow,
  },
  carte: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  emoji: { fontSize: 30 },
  photoBloc: { flexDirection: "row", gap: spacing.lg, alignItems: "center" },
  photoActions: { flex: 1, gap: spacing.sm },
  photoAide: { fontFamily: fonts.text, fontSize: 11, color: colors.muted },
  traductionBloc: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  sousCats: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.xs },
  sousCatChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minHeight: 44,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.brandTertiary,
  },
  sousCatTexte: { fontFamily: fonts.text, fontSize: 12, fontWeight: "700", color: colors.onSurface },
  saisieSousCat: {
    flexGrow: 1,
    minWidth: 150,
    minHeight: 44,
    paddingHorizontal: spacing.sm,
    fontFamily: fonts.text,
    fontSize: 12,
    color: colors.onSurface,
    outlineStyle: "none",
  } as any,
  sousCatAjouter: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brandPrimary,
  },
  texte: { flex: 1 },
  nom: { fontFamily: fonts.display, fontSize: 16, color: colors.onSurface },
  cat: { fontFamily: fonts.text, fontSize: 11, color: colors.muted },
  prix: { fontFamily: fonts.display, fontSize: 14, color: colors.brandPrimary },
  switchTexte: { flex: 1 },
  switchAide: { fontFamily: fonts.text, fontSize: 11, color: colors.muted },
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
    minHeight: 44,
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
