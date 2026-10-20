import { useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useState } from "react";
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

import { apiFetch } from "@/src/api";
import { Chargement } from "@/src/components/Chargement";
import { Icone } from "@/src/components/Icone";
import { TitrePage } from "@/src/components/TitrePage";
import type { CategorieGarnitures, Composition, Contenant, GarnitureYogourt, TailleYogourt } from "@/src/composition";
import { useLibelle } from "@/src/catalogue-i18n";
import { BandeauLectureSeule, useDroits } from "@/src/droits";
import { useT } from "@/src/i18n";
import { LARGEUR_LARGE } from "@/src/reactif";
import { colors, fonts, radius, spacing, stylesDynamiques } from "@/src/theme";
import { useTheme } from "@/src/theme-contexte";
import { useToast } from "@/src/toast";

type Champ = { cle: string; libelle: string; numerique?: boolean };
type Valeurs = Record<string, string>;

/**
 * Ligne éditable (nom FR/EN, montants…) : enregistrement explicite quand elle a
 * changé, disponibilité et suppression immédiates. Sans `id`, c'est la ligne
 * d'ajout : elle se vide après l'enregistrement.
 */
function LigneEditable({
  id,
  champs,
  initiales,
  disponible,
  onEnregistrer,
  onDisponible,
  onSupprimer,
  avecEtiquettes = false,
  lectureSeule = false,
  testID,
}: {
  /** Admin : valeurs affichées, sans enregistrement ni suppression. */
  lectureSeule?: boolean;
  id?: string;
  /** Libellé au-dessus de chaque champ (montants, règle) : un champ rempli n'affiche plus son placeholder. */
  avecEtiquettes?: boolean;
  champs: Champ[];
  initiales: Valeurs;
  disponible?: boolean;
  onEnregistrer: (v: Valeurs) => Promise<boolean>;
  onDisponible?: (v: boolean) => void;
  onSupprimer?: () => void;
  testID: string;
}) {
  const t = useT();
  const [valeurs, setValeurs] = useState<Valeurs>(initiales);
  const [envoi, setEnvoi] = useState(false);
  const modifiee = champs.some((c) => (valeurs[c.cle] ?? "") !== (initiales[c.cle] ?? ""));
  const nouvelle = !id;

  const enregistrer = async () => {
    if (!modifiee || envoi) return;
    setEnvoi(true);
    const ok = await onEnregistrer(valeurs);
    setEnvoi(false);
    if (ok && nouvelle) setValeurs(initiales);
  };

  return (
    <View testID={testID} style={[styles.ligne, disponible === false && styles.ligneInactive]}>
      {champs.map((c) => (
        <View key={c.cle} style={[styles.champ, c.numerique ? styles.saisieMontant : styles.saisieNom]}>
          {avecEtiquettes ? <Text style={styles.etiquette}>{c.libelle}</Text> : null}
          <TextInput
            testID={`${testID}-${c.cle}`}
            accessibilityLabel={c.libelle}
            value={valeurs[c.cle] ?? ""}
            onChangeText={(v) => setValeurs((courant) => ({ ...courant, [c.cle]: v }))}
            onSubmitEditing={enregistrer}
            editable={!lectureSeule}
            placeholder={c.libelle}
            placeholderTextColor={colors.muted}
            keyboardType={c.numerique ? "number-pad" : "default"}
            style={[styles.saisie, c.numerique && styles.saisieDroite]}
          />
        </View>
      ))}
      <View style={[styles.ligneActions, avecEtiquettes && styles.ligneActionsEtiquetee]}>
        {onDisponible && disponible !== undefined ? (
          <Switch
            testID={`${testID}-disponible`}
            accessibilityLabel={t("catalogue.disponible")}
            value={disponible}
            disabled={lectureSeule}
            onValueChange={onDisponible}
            trackColor={{ true: colors.success, false: colors.border }}
          />
        ) : null}
        {lectureSeule ? null : (
          <Pressable
            testID={`${testID}-enregistrer`}
            accessibilityLabel={nouvelle ? t("composition.ajouter") : t("commun.enregistrer")}
            onPress={enregistrer}
            disabled={!modifiee || envoi}
            style={[styles.iconeBtn, styles.iconeBtnPrimaire, (!modifiee || envoi) && styles.iconeBtnInactif]}
          >
            <Icone name={nouvelle ? "plus" : "check"} size={16} color={colors.onBrandPrimary} />
          </Pressable>
        )}
        {onSupprimer && !lectureSeule ? (
          <Pressable
            testID={`${testID}-supprimer`}
            accessibilityLabel={t("commun.supprimer")}
            onPress={onSupprimer}
            style={styles.iconeBtn}
          >
            <Icone name="trash-2" size={16} color={colors.error} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function Section({ titre, aide, children }: { titre: string; aide: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitre}>{titre}</Text>
      <Text style={styles.sectionAide}>{aide}</Text>
      {children}
    </View>
  );
}

const vers = (v?: string) => parseInt((v ?? "").replace(/\s/g, ""), 10) || 0;

export default function CompositionAdmin() {
  useTheme();
  const t = useT();
  const libelle = useLibelle();
  const toast = useToast();
  const qc = useQueryClient();
  // Admin : consultation seule ; le serveur refuse aussi toute écriture (403).
  const { peutGerer, exiger } = useDroits();
  const ls = !peutGerer;
  const q = useQuery({ queryKey: ["admin-composition"], queryFn: () => apiFetch<Composition>("/admin/composition") });

  // Toute modification rafraîchit la vue admin et la composition vue par les clients.
  const appeler = async (chemin: string, method: string, body?: unknown, message = t("composition.enregistre")) => {
    if (!exiger()) return false;
    try {
      await apiFetch(chemin, { method, body });
      await qc.invalidateQueries({ queryKey: ["admin-composition"] });
      qc.invalidateQueries({ queryKey: ["composition"] });
      toast.show(message, "succes");
      return true;
    } catch (e: any) {
      toast.show(e.message, "erreur");
      return false;
    }
  };

  const nomEn = (v: Valeurs) => v.nomEn?.trim() || null;
  const champsNom: Champ[] = [
    { cle: "nom", libelle: t("composition.nomFr") },
    { cle: "nomEn", libelle: t("composition.nomEn") },
  ];
  const champsTaille: Champ[] = [
    ...champsNom,
    { cle: "prixBase", libelle: t("composition.prixBase"), numerique: true },
    { cle: "supplementGarnitures", libelle: t("composition.supplement"), numerique: true },
  ];

  const valeursTaille = (x?: TailleYogourt): Valeurs => ({
    nom: x?.nom ?? "",
    nomEn: x?.nomEn ?? "",
    prixBase: x ? String(x.prixBase) : "",
    supplementGarnitures: x ? String(x.supplementGarnitures) : "",
  });
  const corpsTaille = (v: Valeurs) => ({
    nom: v.nom,
    nomEn: nomEn(v),
    prixBase: vers(v.prixBase),
    supplementGarnitures: vers(v.supplementGarnitures),
  });
  const corpsContenant = (c: Contenant | undefined, v: Valeurs, disponible = c?.disponible ?? true) => ({
    nom: v.nom,
    nomEn: nomEn(v),
    disponible,
  });
  const corpsGarniture = (cat: CategorieGarnitures, g: GarnitureYogourt | undefined, v: Valeurs, disponible = g?.disponible ?? true) => ({
    categorieId: cat.id,
    nom: v.nom,
    nomEn: nomEn(v),
    disponible,
  });

  const data = q.data;
  const regle = data?.regle;
  // Règle : nombre exact à choisir dans chaque catégorie (3 sèches + 3 fruits par défaut).
  const categories = data?.categories ?? [];
  const champsRegle: Champ[] = categories.map((c) => ({
    cle: c.id,
    libelle: t("composition.aChoisir", { categorie: libelle(c.nom, c.nomEn) }),
    numerique: true,
  }));
  const valeursRegle: Valeurs = Object.fromEntries(categories.map((c) => [c.id, String(c.nombre)]));
  const proposees = categories.filter((c) => c.disponible && c.nombre > 0);

  return (
    <View testID="ecran-admin-composition" style={styles.ecran}>
      {q.isLoading || !data || !regle ? (
        <View style={styles.centre}>
          <Chargement taille={52} />
        </View>
      ) : (
        <KeyboardAwareScrollView bottomOffset={60} contentContainerStyle={styles.contenu}>
          <TitrePage titre={t("composition.titre")} sousTitre={t("composition.sousTitre")} retour="/admin/catalogue" />
          <BandeauLectureSeule />

          <Section titre={t("composition.regle")} aide={t("composition.regleAide")}>
            <LigneEditable
              key={`regle-${categories.map((c) => `${c.id}:${c.nombre}`).join("-")}`}
              id="regle"
              testID="regle"
              lectureSeule={ls}
              avecEtiquettes
              champs={champsRegle}
              initiales={valeursRegle}
              onEnregistrer={(v) =>
                appeler(
                  "/admin/regle-garnitures",
                  "PUT",
                  { categories: Object.fromEntries(categories.map((c) => [c.id, vers(v[c.id])])) },
                  t("composition.regleEnregistree"),
                )
              }
            />
            <Text testID="regle-resume" style={styles.legende}>
              {t("composition.regleResume", {
                detail: proposees.map((c) => `${c.nombre} ${libelle(c.nom, c.nomEn)}`).join(" + "),
                total: regle.total,
              })}
            </Text>
          </Section>

          <Section titre={t("composition.tailles")} aide={t("composition.taillesAide")}>
            {data.tailles.map((x) => (
              <LigneEditable
                key={`${x.id}-${x.nom}-${x.nomEn}-${x.prixBase}-${x.supplementGarnitures}`}
                id={x.id}
                testID={`taille-${x.nom}`}
                lectureSeule={ls}
                avecEtiquettes
                champs={champsTaille}
                initiales={valeursTaille(x)}
                onEnregistrer={(v) => appeler(`/admin/tailles/${x.id}`, "PUT", corpsTaille(v))}
                onSupprimer={() => appeler(`/admin/tailles/${x.id}`, "DELETE", undefined, t("composition.supprime"))}
              />
            ))}
            {peutGerer ? (
              <LigneEditable
                testID="nouvelle-taille"
                avecEtiquettes
                champs={champsTaille}
                initiales={valeursTaille()}
                onEnregistrer={(v) => appeler("/admin/tailles", "POST", corpsTaille(v))}
              />
            ) : null}
          </Section>

          <Section titre={t("composition.contenants")} aide={t("composition.contenantsAide")}>
            {data.contenants.map((c) => (
              <LigneEditable
                key={`${c.id}-${c.nom}-${c.nomEn}`}
                id={c.id}
                testID={`contenant-${c.nom}`}
                lectureSeule={ls}
                champs={champsNom}
                initiales={{ nom: c.nom, nomEn: c.nomEn ?? "" }}
                disponible={c.disponible}
                onDisponible={(d) =>
                  appeler(`/admin/contenants/${c.id}`, "PUT", corpsContenant(c, { nom: c.nom, nomEn: c.nomEn ?? "" }, d))
                }
                onEnregistrer={(v) => appeler(`/admin/contenants/${c.id}`, "PUT", corpsContenant(c, v))}
                onSupprimer={() => appeler(`/admin/contenants/${c.id}`, "DELETE", undefined, t("composition.supprime"))}
              />
            ))}
            {peutGerer ? (
              <LigneEditable
                testID="nouveau-contenant"
                champs={champsNom}
                initiales={{ nom: "", nomEn: "" }}
                onEnregistrer={(v) => appeler("/admin/contenants", "POST", corpsContenant(undefined, v))}
              />
            ) : null}
          </Section>

          <Section titre={t("composition.garnitures")} aide={t("composition.garnituresAide")}>
            {data.categories.map((cat) => {
              const disponibles = cat.garnitures.filter((g) => g.disponible).length;
              const masquee = !cat.disponible || disponibles === 0;
              return (
                <View key={cat.id} testID={`categorie-${cat.nom}`} style={[styles.carte, masquee && styles.carteMasquee]}>
                  <View style={styles.carteEntete}>
                    <View style={styles.carteTitreBloc}>
                      <Text style={styles.carteTitre}>{libelle(cat.nom, cat.nomEn)}</Text>
                      <Text style={styles.carteSousTitre}>
                        {t("composition.nbGarnitures", { n: disponibles, total: cat.garnitures.length })}
                      </Text>
                    </View>
                    <Switch
                      testID={`categorie-${cat.nom}-disponible`}
                      accessibilityLabel={t("catalogue.disponible")}
                      value={cat.disponible}
                      disabled={ls}
                      onValueChange={(d) => {
                        void appeler(`/admin/categories-garnitures/${cat.id}`, "PUT", { disponible: d });
                      }}
                      trackColor={{ true: colors.success, false: colors.border }}
                    />
                  </View>
                  {masquee ? (
                    <Text style={styles.avertissement}>
                      {cat.disponible ? t("composition.categorieVide") : t("composition.categorieMasquee")}
                    </Text>
                  ) : cat.nombre > disponibles ? (
                    <Text style={styles.avertissement}>{t("composition.nombreSuperieur", { n: disponibles })}</Text>
                  ) : null}
                  {cat.garnitures.map((g) => (
                    <LigneEditable
                      key={`${g.id}-${g.nom}-${g.nomEn}`}
                      id={g.id}
                      testID={`garniture-${g.nom}`}
                      lectureSeule={ls}
                      champs={champsNom}
                      initiales={{ nom: g.nom, nomEn: g.nomEn ?? "" }}
                      disponible={g.disponible}
                      onDisponible={(d) =>
                        appeler(`/admin/garnitures/${g.id}`, "PUT", corpsGarniture(cat, g, { nom: g.nom, nomEn: g.nomEn ?? "" }, d))
                      }
                      onEnregistrer={(v) => appeler(`/admin/garnitures/${g.id}`, "PUT", corpsGarniture(cat, g, v))}
                      onSupprimer={() => appeler(`/admin/garnitures/${g.id}`, "DELETE", undefined, t("composition.supprime"))}
                    />
                  ))}
                  {peutGerer ? (
                    <LigneEditable
                      testID={`nouvelle-garniture-${cat.nom}`}
                      champs={[
                        { cle: "nom", libelle: t("composition.nouvelleGarniture") },
                        { cle: "nomEn", libelle: t("composition.nomEn") },
                      ]}
                      initiales={{ nom: "", nomEn: "" }}
                      onEnregistrer={(v) => appeler("/admin/garnitures", "POST", corpsGarniture(cat, undefined, v))}
                    />
                  ) : null}
                </View>
              );
            })}
          </Section>
        </KeyboardAwareScrollView>
      )}
    </View>
  );
}

const styles = stylesDynamiques(() =>
  StyleSheet.create({
    ecran: { flex: 1, backgroundColor: colors.surfaceSecondary },
    centre: { flex: 1, alignItems: "center", justifyContent: "center" },
    contenu: { ...LARGEUR_LARGE, padding: spacing.xl, gap: spacing.xl, paddingBottom: spacing.xxxl },
    section: {
      gap: spacing.sm,
      backgroundColor: colors.surface,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
    },
    sectionTitre: { fontFamily: fonts.display, fontSize: 18, color: colors.onSurface },
    sectionAide: { fontFamily: fonts.text, fontSize: 12, color: colors.muted, marginBottom: spacing.xs },
    legende: { fontFamily: fonts.text, fontSize: 12, fontWeight: "700", color: colors.brandPrimary },
    ligne: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.sm },
    ligneInactive: { opacity: 0.55 },
    ligneActions: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginLeft: "auto" },
    saisie: {
      minHeight: 44,
      paddingHorizontal: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      fontFamily: fonts.text,
      fontSize: 14,
      color: colors.onSurface,
    },
    champ: { gap: 2 },
    etiquette: { fontFamily: fonts.text, fontSize: 11, fontWeight: "700", color: colors.muted },
    saisieNom: { flexGrow: 1, flexBasis: 160, minWidth: 140 },
    saisieMontant: { flexGrow: 1, flexBasis: 110, minWidth: 100 },
    saisieDroite: { textAlign: "right" },
    ligneActionsEtiquetee: { alignSelf: "flex-end" },
    iconeBtn: {
      width: 44,
      height: 44,
      borderRadius: radius.pill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.errorSoft,
    },
    iconeBtnPrimaire: { backgroundColor: colors.brandPrimary },
    iconeBtnInactif: { opacity: 0.35 },
    carte: {
      gap: spacing.sm,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      backgroundColor: colors.surfaceSecondary,
    },
    carteMasquee: { borderStyle: "dashed" },
    carteEntete: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    carteTitreBloc: { flex: 1 },
    carteTitre: { fontFamily: fonts.display, fontSize: 16, color: colors.onSurface },
    carteSousTitre: { fontFamily: fonts.text, fontSize: 12, color: colors.muted },
    avertissement: { fontFamily: fonts.text, fontSize: 12, fontWeight: "700", color: colors.error },
  }),
);
