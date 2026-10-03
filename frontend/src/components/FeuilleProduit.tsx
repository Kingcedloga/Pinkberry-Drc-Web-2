import { Icone } from "@/src/components/Icone";
import React, { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Bouton } from "@/src/components/Bouton";
import { Chargement } from "@/src/components/Chargement";
import { PhotoProduit } from "@/src/components/PhotoProduit";
import { useLibelle } from "@/src/catalogue-i18n";
import { evaluerSelection, prixDes, useComposition, type GarnitureYogourt } from "@/src/composition";
import { useT } from "@/src/i18n";
import { ArticlePanier, Garniture } from "@/src/panier";
import { LARGEUR_FEUILLE, useEcran } from "@/src/reactif";
import { colors, fonts, radius, softShadow, spacing, stylesDynamiques } from "@/src/theme";
import { useMontant } from "@/src/taux";

export type Produit = {
  id: string;
  nom: string;
  nomEn?: string | null;
  categorie: string;
  categorieEn?: string | null;
  sousCategorie?: string | null;
  sousCategorieEn?: string | null;
  prix: number;
  image?: string | null;
  emoji?: string | null;
  description?: string | null;
  descriptionEn?: string | null;
  disponible: boolean;
  enAvant?: boolean;
  tailles: { nom: string; ecart: number; nomEn?: string | null }[];
  garnitures: Garniture[];
  /** Frozen yogurt composé : taille, récipient et garnitures viennent de /composition. */
  configurable?: boolean;
};

export function FeuilleProduit({
  produit,
  visible,
  onClose,
  onAjouter,
}: {
  produit: Produit | null;
  visible: boolean;
  onClose: () => void;
  onAjouter: (a: Omit<ArticlePanier, "cle">) => void;
}) {
  const insets = useSafeAreaInsets();
  const { bureau } = useEcran();
  const tr = useT();
  const libelle = useLibelle();
  const { usd, fc, prix } = useMontant();
  const [tailleIndex, setTailleIndex] = useState(0);
  const [contenantIndex, setContenantIndex] = useState(0);
  // Noms des garnitures (produit simple) ou identifiants (frozen yogurt composé).
  const [garnituresChoisies, setGarnitures] = useState<string[]>([]);
  // Les garnitures ne s'affichent qu'après « Avec garnitures ».
  const [avecGarnitures, setAvecGarnitures] = useState(false);
  const [quantite, setQuantite] = useState(1);

  const compoQ = useComposition();
  const compo = compoQ.data;
  const compose = !!produit?.configurable;
  const garnituresCompo = useMemo(
    () => new Map((compo?.categories ?? []).flatMap((c) => c.garnitures.map((g) => [g.id, g] as const))),
    [compo],
  );
  const choisiesYogourt = garnituresChoisies
    .map((id) => garnituresCompo.get(id))
    .filter((g): g is GarnitureYogourt => !!g);
  const evaluation = compo ? evaluerSelection(choisiesYogourt, compo.regle) : null;
  const tailleYogourt = compo?.tailles[tailleIndex];
  const contenant = compo?.contenants[contenantIndex];

  const reset = () => {
    setTailleIndex(0);
    setContenantIndex(0);
    setGarnitures([]);
    setAvecGarnitures(false);
    setQuantite(1);
  };

  // Fermer sans commander repart de zéro : les choix ne passent pas au produit suivant.
  const fermer = () => {
    reset();
    onClose();
  };

  const prixUnitaire = useMemo(() => {
    if (!produit) return 0;
    // Frozen yogurt : prix de base de la taille + supplément forfaitaire si garnitures.
    if (compose) {
      return tailleYogourt ? tailleYogourt.prixBase + (avecGarnitures ? tailleYogourt.supplementGarnitures : 0) : 0;
    }
    const ecart = produit.tailles[tailleIndex]?.ecart ?? 0;
    const sup = produit.garnitures
      .filter((g) => garnituresChoisies.includes(g.nom))
      .reduce((s, g) => s + g.prix, 0);
    return produit.prix + ecart + sup;
  }, [produit, compose, tailleYogourt, avecGarnitures, tailleIndex, garnituresChoisies]);

  if (!produit) return null;

  // Avec garnitures, la commande n'est possible qu'une fois la règle respectée.
  const valide = compose
    ? !!tailleYogourt && (!compo?.contenants.length || !!contenant) && (!avecGarnitures || !!evaluation?.valide)
    : true;
  const messageRegle = (() => {
    if (!compose || !avecGarnitures || !compo || !evaluation || evaluation.valide) return null;
    const { nombre, categoriesMin, categoriesMax } = compo.regle;
    if (evaluation.nb < nombre) return tr("feuilleProduit.encoreGarnitures", { n: nombre - evaluation.nb });
    if (evaluation.nbCategories < categoriesMin) return tr("feuilleProduit.minCategories", { min: categoriesMin });
    return tr("feuilleProduit.maxCategories", { max: categoriesMax });
  })();

  const basculerGarniture = (id: string, coche: boolean) =>
    setGarnitures((prev) => (coche ? prev.filter((x) => x !== id) : [...prev, id]));

  const ajouter = () => {
    if (!valide) return;
    if (compose && compo && tailleYogourt) {
      const categories = new Map(compo.categories.map((c) => [c.id, c]));
      onAjouter({
        produitId: produit.id,
        nom: produit.nom,
        nomEn: produit.nomEn,
        taille: tailleYogourt.nom,
        tailleEn: tailleYogourt.nomEn,
        contenant: contenant?.nom ?? null,
        contenantEn: contenant?.nomEn ?? null,
        garnitures: avecGarnitures
          ? choisiesYogourt.map((g) => ({
              id: g.id,
              nom: g.nom,
              nomEn: g.nomEn,
              prix: 0,
              categorie: categories.get(g.categorieId)?.nom,
              categorieEn: categories.get(g.categorieId)?.nomEn,
            }))
          : [],
        quantite,
        prixUnitaire,
        emoji: produit.emoji,
        image: produit.image,
      });
      fermer();
      return;
    }
    onAjouter({
      produitId: produit.id,
      nom: produit.nom,
      nomEn: produit.nomEn,
      taille: produit.tailles[tailleIndex]?.nom ?? null,
      tailleEn: produit.tailles[tailleIndex]?.nomEn ?? null,
      garnitures: produit.garnitures.filter((g) => garnituresChoisies.includes(g.nom)),
      quantite,
      prixUnitaire,
      emoji: produit.emoji,
      image: produit.image,
    });
    fermer();
  };

  return (
    <Modal visible={visible} animationType={bureau ? "fade" : "slide"} transparent onRequestClose={fermer}>
      <View style={[styles.voile, bureau && styles.voileCentre]}>
        <Pressable
          style={bureau ? StyleSheet.absoluteFill : styles.zoneFermeture}
          onPress={fermer}
          testID="fermer-feuille-fond"
        />
        <View
          testID="feuille-produit"
          style={[
            styles.feuille,
            { paddingBottom: bureau ? spacing.lg : insets.bottom + spacing.lg },
            bureau && styles.dialogue,
          ]}
        >
          {bureau ? (
            <Pressable testID="btn-fermer-feuille" onPress={fermer} style={styles.fermer}>
              <Icone name="x" size={20} color={colors.muted} />
            </Pressable>
          ) : (
            <View style={styles.poignee} />
          )}
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            <View style={styles.entete}>
              <PhotoProduit image={produit.image} taille={96} rayon={radius.lg} />
              <View style={styles.enteteTexte}>
                <Text testID="feuille-nom-produit" style={styles.nom}>
                  {libelle(produit.nom, produit.nomEn)}
                </Text>
                <Text style={styles.desc}>
                  {produit.description
                    ? libelle(produit.description, produit.descriptionEn)
                    : libelle(produit.categorie, produit.categorieEn)}
                </Text>
                <Text style={styles.prixBase}>
                  {compose
                    ? tr("feuilleProduit.des", { prix: fc(prixDes(compo)) })
                    : `${fc(produit.prix)} ≈ ${usd(produit.prix)}`}
                </Text>
              </View>
            </View>

            {compose && !compo ? (
              <View style={styles.centre}>
                {compoQ.isError ? (
                  <Text style={styles.desc}>{tr("feuilleProduit.compositionIndisponible")}</Text>
                ) : (
                  <Chargement taille={40} />
                )}
              </View>
            ) : null}

            {compose && compo ? (
              <>
                <View style={styles.section}>
                  <Text style={styles.sectionTitre}>{tr("feuilleProduit.choisirTaille")}</Text>
                  {compo.tailles.map((taille, i) => (
                    <Pressable
                      key={taille.id}
                      testID={`taille-${taille.nom}`}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: i === tailleIndex }}
                      onPress={() => setTailleIndex(i)}
                      style={[styles.option, i === tailleIndex && styles.optionActive]}
                    >
                      <View style={[styles.radio, i === tailleIndex && styles.radioActif]}>
                        {i === tailleIndex ? <View style={styles.radioPoint} /> : null}
                      </View>
                      <View style={styles.optionTexte}>
                        <Text style={styles.optionNom}>{libelle(taille.nom, taille.nomEn)}</Text>
                        <Text style={styles.optionAide}>
                          {tr("feuilleProduit.avecSupplement", { prix: fc(taille.supplementGarnitures) })}
                        </Text>
                      </View>
                      <Text style={styles.optionPrix}>{fc(taille.prixBase)}</Text>
                    </Pressable>
                  ))}
                </View>

                {compo.contenants.length > 0 ? (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitre}>{tr("feuilleProduit.choisirContenant")}</Text>
                    <View style={styles.chips} accessibilityRole="radiogroup">
                      {compo.contenants.map((c, i) => {
                        const actif = i === contenantIndex;
                        return (
                          <Pressable
                            key={c.id}
                            testID={`contenant-${c.nom}`}
                            accessibilityRole="radio"
                            accessibilityState={{ checked: actif }}
                            onPress={() => setContenantIndex(i)}
                            style={[styles.chip, actif && styles.chipActif]}
                          >
                            <Text style={[styles.chipTexte, actif && { color: colors.onBrandPrimary }]}>
                              {libelle(c.nom, c.nomEn)}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                ) : null}

                {compo.categories.length > 0 && evaluation ? (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitre}>{tr("feuilleProduit.garnitures")}</Text>
                    <View style={styles.choixGarnitures} accessibilityRole="radiogroup">
                      {[false, true].map((avec) => {
                        const actif = avecGarnitures === avec;
                        return (
                          <Pressable
                            key={String(avec)}
                            testID={avec ? "btn-avec-garnitures" : "btn-sans-garnitures"}
                            accessibilityRole="radio"
                            accessibilityState={{ checked: actif }}
                            onPress={() => {
                              setAvecGarnitures(avec);
                              if (!avec) setGarnitures([]);
                            }}
                            style={[styles.choixGarniture, actif && styles.choixGarnitureActif]}
                          >
                            <Text style={[styles.choixGarnitureTexte, actif && { color: colors.onBrandPrimary }]}>
                              {tr(avec ? "feuilleProduit.avecGarnitures" : "feuilleProduit.sansGarnitures")}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>

                    {avecGarnitures ? (
                      <>
                        <Text style={styles.optionAide}>
                          {tr("feuilleProduit.regleGarnitures", {
                            nombre: compo.regle.nombre,
                            min: compo.regle.categoriesMin,
                            max: compo.regle.categoriesMax,
                          })}
                        </Text>
                        <View style={styles.compteurs} testID="compteurs-garnitures">
                          <Text
                            testID="compteur-garnitures"
                            style={[styles.compteur, evaluation.complet && styles.compteurOk]}
                          >
                            {tr("feuilleProduit.compteurGarnitures", { n: evaluation.nb, total: compo.regle.nombre })}
                          </Text>
                          <Text
                            testID="compteur-categories"
                            style={[
                              styles.compteur,
                              evaluation.nbCategories >= compo.regle.categoriesMin &&
                                evaluation.nbCategories <= compo.regle.categoriesMax &&
                                styles.compteurOk,
                            ]}
                          >
                            {tr("feuilleProduit.compteurCategories", {
                              n: evaluation.nbCategories,
                              min: compo.regle.categoriesMin,
                              max: compo.regle.categoriesMax,
                            })}
                          </Text>
                        </View>
                        {evaluation.categoriesPleines && !evaluation.complet ? (
                          <Text style={styles.optionAide}>
                            {tr("feuilleProduit.categoriesPleines", { max: compo.regle.categoriesMax })}
                          </Text>
                        ) : null}

                        {compo.categories.map((cat) => {
                          const nbDansCat = choisiesYogourt.filter((g) => g.categorieId === cat.id).length;
                          return (
                            <View key={cat.id} style={styles.categorie} testID={`categorie-garnitures-${cat.nom}`}>
                              <View style={styles.categorieEntete}>
                                <Text style={styles.categorieNom}>{libelle(cat.nom, cat.nomEn)}</Text>
                                {nbDansCat > 0 ? <Text style={styles.categorieNb}>{nbDansCat}</Text> : null}
                              </View>
                              <View style={styles.chips}>
                                {cat.garnitures.map((g) => {
                                  const coche = garnituresChoisies.includes(g.id);
                                  const bloque = !coche && !evaluation.peutAjouter(g);
                                  return (
                                    <Pressable
                                      key={g.id}
                                      testID={`garniture-${g.nom}`}
                                      accessibilityRole="checkbox"
                                      accessibilityState={{ checked: coche, disabled: bloque }}
                                      disabled={bloque}
                                      onPress={() => basculerGarniture(g.id, coche)}
                                      style={[styles.chip, coche && styles.chipActif, bloque && styles.chipBloque]}
                                    >
                                      {coche ? <Icone name="check" size={13} color={colors.onBrandPrimary} /> : null}
                                      <Text style={[styles.chipTexte, coche && { color: colors.onBrandPrimary }]}>
                                        {libelle(g.nom, g.nomEn)}
                                      </Text>
                                    </Pressable>
                                  );
                                })}
                              </View>
                            </View>
                          );
                        })}
                      </>
                    ) : null}
                  </View>
                ) : null}
              </>
            ) : null}

            {!compose && produit.tailles.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitre}>{tr("feuilleProduit.choisirTaille")}</Text>
                {produit.tailles.map((taille, i) => (
                  <Pressable
                    key={taille.nom}
                    testID={`taille-${taille.nom}`}
                    onPress={() => setTailleIndex(i)}
                    style={[styles.option, i === tailleIndex && styles.optionActive]}
                  >
                    <View style={[styles.radio, i === tailleIndex && styles.radioActif]}>
                      {i === tailleIndex ? <View style={styles.radioPoint} /> : null}
                    </View>
                    <Text style={styles.optionNom}>{libelle(taille.nom, taille.nomEn)}</Text>
                    <Text style={styles.optionPrix}>
                      {taille.ecart > 0 ? `+ ${prix(taille.ecart)}` : tr("feuilleProduit.inclus")}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            {!compose && produit.garnitures.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitre}>{tr("feuilleProduit.garnitures")}</Text>
                <View style={styles.choixGarnitures} accessibilityRole="radiogroup">
                  {[false, true].map((avec) => {
                    const actif = avecGarnitures === avec;
                    return (
                      <Pressable
                        key={String(avec)}
                        testID={avec ? "btn-avec-garnitures" : "btn-sans-garnitures"}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: actif }}
                        onPress={() => {
                          setAvecGarnitures(avec);
                          if (!avec) setGarnitures([]);
                        }}
                        style={[styles.choixGarniture, actif && styles.choixGarnitureActif]}
                      >
                        <Text style={[styles.choixGarnitureTexte, actif && { color: colors.onBrandPrimary }]}>
                          {tr(avec ? "feuilleProduit.avecGarnitures" : "feuilleProduit.sansGarnitures")}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                {avecGarnitures && produit.garnitures.map((g) => {
                  const coche = garnituresChoisies.includes(g.nom);
                  return (
                    <Pressable
                      key={g.nom}
                      testID={`garniture-${g.nom}`}
                      onPress={() =>
                        setGarnitures((prev) => (coche ? prev.filter((x) => x !== g.nom) : [...prev, g.nom]))
                      }
                      style={[styles.option, coche && styles.optionActive]}
                    >
                      <View style={[styles.checkbox, coche && styles.checkboxActif]}>
                        {coche ? <Icone name="check" size={14} color={colors.onBrandPrimary} /> : null}
                      </View>
                      <Text style={styles.optionNom}>{libelle(g.nom, g.nomEn)}</Text>
                      <Text style={styles.optionPrix}>{tr("feuilleProduit.plus", { prix: prix(g.prix) })}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            <View style={styles.section}>
              <Text style={styles.sectionTitre}>{tr("feuilleProduit.quantite")}</Text>
              <View style={styles.quantiteRow}>
                <Pressable
                  testID="btn-quantite-moins"
                  onPress={() => setQuantite((q) => Math.max(1, q - 1))}
                  style={styles.qBtn}
                >
                  <Icone name="minus" size={18} color={colors.brandPrimary} />
                </Pressable>
                <Text testID="valeur-quantite" style={styles.qValeur}>
                  {quantite}
                </Text>
                <Pressable testID="btn-quantite-plus" onPress={() => setQuantite((q) => q + 1)} style={styles.qBtn}>
                  <Icone name="plus" size={18} color={colors.brandPrimary} />
                </Pressable>
              </View>
            </View>
          </ScrollView>

          <View style={styles.cta}>
            {messageRegle ? (
              <Text testID="message-regle-garnitures" style={styles.messageRegle} accessibilityLiveRegion="polite">
                {messageRegle}
              </Text>
            ) : null}
            <Bouton
              testID="btn-ajouter-panier"
              label={tr("feuilleProduit.ajouterPanier", { total: fc(prixUnitaire * quantite) })}
              icone="shopping-bag"
              disabled={!valide}
              onPress={ajouter}
            />
            <Text style={styles.ctaFc}>≈ {usd(prixUnitaire * quantite)}</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = stylesDynamiques(() => StyleSheet.create({
  voile: { flex: 1, backgroundColor: "rgba(42,23,33,0.45)", justifyContent: "flex-end" },
  voileCentre: { justifyContent: "center", alignItems: "center", padding: spacing.xl },
  dialogue: { borderRadius: radius.xl, maxWidth: 560, maxHeight: "88%", paddingTop: spacing.lg },
  fermer: { alignSelf: "flex-end", width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  zoneFermeture: { flex: 1 },
  feuille: {
    ...LARGEUR_FEUILLE,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: "88%",
    paddingHorizontal: spacing.xl,
    ...softShadow,
  },
  poignee: {
    width: 44,
    height: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
    alignSelf: "center",
    marginVertical: spacing.md,
  },
  scroll: { gap: spacing.lg, paddingBottom: spacing.lg },
  entete: { flexDirection: "row", gap: spacing.lg },
  image: { width: 96, height: 96, borderRadius: radius.lg, backgroundColor: colors.brandTertiary },
  imageVide: { alignItems: "center", justifyContent: "center" },
  emoji: { fontSize: 40 },
  enteteTexte: { flex: 1, gap: 2 },
  nom: { fontFamily: fonts.display, fontSize: 22, color: colors.onSurface },
  desc: { fontFamily: fonts.text, fontSize: 13, color: colors.muted },
  prixBase: { fontFamily: fonts.display, fontSize: 16, color: colors.brandPrimary, marginTop: spacing.xs },
  section: { gap: spacing.sm },
  sectionTitre: { fontFamily: fonts.display, fontSize: 16, color: colors.onSurface },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  optionActive: { borderColor: colors.brandPrimary, backgroundColor: colors.brandTertiary },
  choixGarnitures: { flexDirection: "row", gap: spacing.sm },
  choixGarniture: {
    flex: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  choixGarnitureActif: { borderColor: colors.brandPrimary, backgroundColor: colors.brandPrimary },
  choixGarnitureTexte: { fontFamily: fonts.text, fontSize: 14, fontWeight: "800", color: colors.onSurface },
  optionNom: { flex: 1, fontFamily: fonts.text, fontSize: 15, fontWeight: "700", color: colors.onSurface },
  optionTexte: { flex: 1, gap: 2 },
  optionAide: { fontFamily: fonts.text, fontSize: 12, color: colors.muted },
  centre: { alignItems: "center", paddingVertical: spacing.lg },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minHeight: 38,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActif: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  chipBloque: { opacity: 0.4 },
  chipTexte: { fontFamily: fonts.text, fontSize: 13, fontWeight: "700", color: colors.onSurface },
  compteurs: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  compteur: {
    fontFamily: fonts.text,
    fontSize: 13,
    fontWeight: "800",
    color: colors.brandPrimary,
    backgroundColor: colors.brandTertiary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    overflow: "hidden",
  },
  compteurOk: { color: colors.success, backgroundColor: colors.successSoft },
  categorie: { gap: spacing.xs, paddingTop: spacing.xs },
  categorieEntete: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  categorieNom: { fontFamily: fonts.text, fontSize: 13, fontWeight: "800", color: colors.onSurface },
  categorieNb: {
    minWidth: 20,
    textAlign: "center",
    fontFamily: fonts.text,
    fontSize: 11,
    fontWeight: "800",
    color: colors.onBrandPrimary,
    backgroundColor: colors.brandPrimary,
    borderRadius: radius.pill,
    paddingHorizontal: 6,
    overflow: "hidden",
  },
  messageRegle: { textAlign: "center", fontFamily: fonts.text, fontSize: 13, fontWeight: "700", color: colors.error },
  optionPrix: { fontFamily: fonts.text, fontSize: 13, color: colors.muted, fontWeight: "700" },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  radioActif: { borderColor: colors.brandPrimary },
  radioPoint: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.brandPrimary },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxActif: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  quantiteRow: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
  qBtn: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  qValeur: { fontFamily: fonts.display, fontSize: 20, color: colors.onSurface, minWidth: 28, textAlign: "center" },
  cta: { paddingTop: spacing.md, gap: spacing.xs },
  ctaFc: { textAlign: "center", fontFamily: fonts.text, fontSize: 12, color: colors.muted },
}));
