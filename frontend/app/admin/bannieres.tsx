import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import React, { useMemo, useState } from "react";
import { FlatList, Modal, Platform, Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { apiFetch, apiUpload } from "@/src/api";
import { FORMAT_RECOMMANDE, type Banniere, type PositionTexte } from "@/src/bannieres";
import { useLibelle } from "@/src/catalogue-i18n";
import { BanniereVisuel } from "@/src/components/BanniereVisuel";
import { Bouton } from "@/src/components/Bouton";
import { Champ } from "@/src/components/Champ";
import { Chargement } from "@/src/components/Chargement";
import { Choix, Interrupteur } from "@/src/components/ChoixAdmin";
import { Icone } from "@/src/components/Icone";
import { RecadrageBanniere, type Cadre } from "@/src/components/RecadrageBanniere";
import { TitrePage } from "@/src/components/TitrePage";
import { versIso, versLocal } from "@/src/dates";
import { useLangue, useT, type CleTexte } from "@/src/i18n";
import type { Promotion } from "@/src/promotions";
import { LARGEUR_FEUILLE, LARGEUR_LARGE } from "@/src/reactif";
import { colors, fonts, radius, spacing, stylesDynamiques } from "@/src/theme";
import { useTheme } from "@/src/theme-contexte";
import { useToast } from "@/src/toast";

const FORMATS = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const TAILLE_MAX = 5 * 1024 * 1024;
const COULEURS = ["#FFFFFF", "#2A1721", "#E6156F", "#8DC63F", "#FFD54F"];
const POSITIONS: PositionTexte[] = ["gauche", "centre", "droite"];
const LIENS = ["aucun", "produit", "categorie", "promotion"] as const;
type TypeLienForm = (typeof LIENS)[number];

type Formulaire = {
  imageUrl: string | null;
  imageMobileUrl: string | null;
  titre: string;
  titreEn: string;
  sousTitre: string;
  sousTitreEn: string;
  couleurTexte: string;
  positionTexte: PositionTexte;
  lienType: TypeLienForm;
  lienValeur: string;
  dateDebut: string;
  dateFin: string;
  actif: boolean;
};

const VIDE: Formulaire = {
  imageUrl: null,
  imageMobileUrl: null,
  titre: "",
  titreEn: "",
  sousTitre: "",
  sousTitreEn: "",
  couleurTexte: "#FFFFFF",
  positionTexte: "gauche",
  lienType: "aucun",
  lienValeur: "",
  dateDebut: "",
  dateFin: "",
  actif: true,
};

type ImageChoisie = { uri: string; largeur: number; hauteur: number; nom: string; type: string };

export default function BannieresAdmin() {
  useTheme();
  const t = useT();
  const { langue } = useLangue();
  const libelle = useLibelle();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin-bannieres"], queryFn: () => apiFetch<Banniere[]>("/admin/bannieres") });
  const produitsQ = useQuery({ queryKey: ["produits"], queryFn: () => apiFetch<any[]>("/produits") });
  const categoriesQ = useQuery({
    queryKey: ["admin-categories"],
    queryFn: () => apiFetch<{ id: string; nom: string; nomEn?: string | null }[]>("/admin/categories"),
  });
  const promotionsQ = useQuery({ queryKey: ["admin-promotions"], queryFn: () => apiFetch<Promotion[]>("/admin/promotions") });

  const [edition, setEdition] = useState<Banniere | "nouvelle" | null>(null);
  const [f, setF] = useState<Formulaire>(VIDE);
  const [aRecadrer, setARecadrer] = useState<ImageChoisie | null>(null);
  const [envoiImage, setEnvoiImage] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [recherche, setRecherche] = useState("");
  const [aSupprimer, setASupprimer] = useState<Banniere | null>(null);
  const maj = (champs: Partial<Formulaire>) => setF((courant) => ({ ...courant, ...champs }));

  const liste = q.data ?? [];

  const rafraichir = async () => {
    await qc.invalidateQueries({ queryKey: ["admin-bannieres"] });
    qc.invalidateQueries({ queryKey: ["bannieres"] });
  };

  const ouvrir = (b: Banniere | null) => {
    setEdition(b ?? "nouvelle");
    setRecherche("");
    setF(
      b
        ? {
            imageUrl: b.imageUrl ?? null,
            imageMobileUrl: b.imageMobileUrl ?? null,
            titre: b.titre ?? "",
            titreEn: b.titreEn ?? "",
            sousTitre: b.sousTitre ?? "",
            sousTitreEn: b.sousTitreEn ?? "",
            couleurTexte: b.couleurTexte,
            positionTexte: b.positionTexte,
            lienType: b.lien?.type ?? "aucun",
            lienValeur: b.lien?.valeur ?? "",
            dateDebut: versLocal(b.dateDebut),
            dateFin: versLocal(b.dateFin),
            actif: b.actif,
          }
        : VIDE,
    );
  };

  const choisirImage = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1, allowsMultipleSelection: false });
    if (res.canceled || !res.assets?.length) return;
    const a = res.assets[0];
    const type = (a.mimeType ?? "image/jpeg").toLowerCase();
    if (!FORMATS.includes(type)) {
      toast.show(t("catalogue.formatsAcceptes"), "erreur");
      return;
    }
    if ((a.fileSize ?? 0) > TAILLE_MAX) {
      toast.show(t("catalogue.photoTropLourde"), "erreur");
      return;
    }
    if (!a.width || !a.height) {
      toast.show(t("bannieres.imageIllisible"), "erreur");
      return;
    }
    setARecadrer({ uri: a.uri, largeur: a.width, hauteur: a.height, nom: a.fileName ?? `banniere.${type.split("/")[1]}`, type });
  };

  // Envoi de l'image et du cadre choisi : le serveur recadre au ratio exact et compresse.
  const envoyerImage = async (cadre: Cadre) => {
    if (!aRecadrer) return;
    setEnvoiImage(true);
    try {
      const form = new FormData();
      if (Platform.OS === "web") {
        const blob = await (await fetch(aRecadrer.uri)).blob();
        form.append("file", blob, aRecadrer.nom);
      } else {
        form.append("file", { uri: aRecadrer.uri, name: aRecadrer.nom, type: aRecadrer.type } as any);
      }
      form.append("x", String(cadre.x));
      form.append("y", String(cadre.y));
      form.append("w", String(cadre.w));
      form.append("h", String(cadre.h));
      const r = await apiUpload<{ imageUrl: string; imageMobileUrl: string; basseResolution: boolean }>(
        "/admin/bannieres/image",
        form,
      );
      maj({ imageUrl: r.imageUrl, imageMobileUrl: r.imageMobileUrl });
      setARecadrer(null);
      toast.show(r.basseResolution ? t("bannieres.tropPetite") : t("bannieres.imagePrete"), r.basseResolution ? "info" : "succes");
    } catch (e: any) {
      toast.show(e.message, "erreur");
    } finally {
      setEnvoiImage(false);
    }
  };

  const enregistrer = async () => {
    const dateDebut = versIso(f.dateDebut);
    const dateFin = versIso(f.dateFin);
    if (dateDebut === undefined || dateFin === undefined) {
      toast.show(t("promotions.dateInvalide"), "erreur");
      return;
    }
    if (f.lienType !== "aucun" && !f.lienValeur) {
      toast.show(t("bannieres.lienManquant"), "erreur");
      return;
    }
    const body = {
      imageUrl: f.imageUrl,
      imageMobileUrl: f.imageMobileUrl,
      titre: f.titre.trim() || null,
      titreEn: f.titreEn.trim() || null,
      sousTitre: f.sousTitre.trim() || null,
      sousTitreEn: f.sousTitreEn.trim() || null,
      couleurTexte: f.couleurTexte.toUpperCase(),
      positionTexte: f.positionTexte,
      lienType: f.lienType,
      lienValeur: f.lienType === "aucun" ? null : f.lienValeur,
      dateDebut,
      dateFin,
      actif: f.actif,
    };
    setEnvoi(true);
    try {
      if (edition === "nouvelle") await apiFetch("/admin/bannieres", { method: "POST", body });
      else if (edition) await apiFetch(`/admin/bannieres/${edition.id}`, { method: "PUT", body });
      await rafraichir();
      setEdition(null);
      toast.show(t("bannieres.enregistree"), "succes");
    } catch (e: any) {
      toast.show(e.message, "erreur");
    } finally {
      setEnvoi(false);
    }
  };

  const basculer = async (b: Banniere, actif: boolean) => {
    try {
      await apiFetch(`/admin/bannieres/${b.id}/actif`, { method: "PATCH", body: { actif } });
      await rafraichir();
    } catch (e: any) {
      toast.show(e.message, "erreur");
    }
  };

  const deplacer = async (index: number, sens: -1 | 1) => {
    const ids = liste.map((b) => b.id);
    const cible = index + sens;
    if (cible < 0 || cible >= ids.length) return;
    [ids[index], ids[cible]] = [ids[cible], ids[index]];
    try {
      await apiFetch("/admin/bannieres/ordre", { method: "PUT", body: { ids } });
      await rafraichir();
    } catch (e: any) {
      toast.show(e.message, "erreur");
    }
  };

  const supprimer = async () => {
    if (!aSupprimer) return;
    try {
      await apiFetch(`/admin/bannieres/${aSupprimer.id}`, { method: "DELETE" });
      await rafraichir();
      toast.show(t("bannieres.supprimee"), "succes");
    } catch (e: any) {
      toast.show(e.message, "erreur");
    } finally {
      setASupprimer(null);
    }
  };

  // Cibles possibles du lien, selon le type choisi.
  const optionsLien = useMemo(() => {
    const texte = recherche.trim().toLowerCase();
    if (f.lienType === "produit") {
      return (produitsQ.data ?? [])
        .filter((p) => !texte || [p.nom, p.nomEn].some((v) => String(v ?? "").toLowerCase().includes(texte)))
        .slice(0, 40)
        .map((p) => ({ id: p.id as string, libelle: libelle(p.nom, p.nomEn) }));
    }
    if (f.lienType === "categorie") {
      return (categoriesQ.data ?? []).map((c) => ({ id: c.nom, libelle: libelle(c.nom, c.nomEn) }));
    }
    if (f.lienType === "promotion") {
      return (promotionsQ.data ?? [])
        .filter((p) => p.statut === "active" || p.statut === "programmee")
        .map((p) => ({ id: p.id, libelle: `${libelle(p.nom, p.nomEn)}${p.code ? ` · ${p.code}` : ""}` }));
    }
    return [];
  }, [f.lienType, recherche, produitsQ.data, categoriesQ.data, promotionsQ.data, libelle]);

  const date = (iso?: string | null) =>
    iso ? new Date(iso).toLocaleDateString(langue === "en" ? "en-GB" : "fr-FR", { day: "numeric", month: "short" }) : null;

  const carte = ({ item: b, index }: { item: Banniere; index: number }) => {
    const statut = b.statut ?? "active";
    const debut = date(b.dateDebut);
    const fin = date(b.dateFin);
    return (
      <View testID={`banniere-admin-${index}`} style={styles.carte}>
        <BanniereVisuel banniere={b} compact />
        <View style={styles.ligneInfos}>
          <View style={styles.infos}>
            <Text style={[styles.statut, statut === "active" ? styles.statutActif : styles.statutInactif]}>
              {t(`bannieres.statut_${statut}` as CleTexte)}
            </Text>
            <Text style={styles.details} numberOfLines={2}>
              {[
                debut || fin ? [debut ?? "…", fin ?? "…"].join(" → ") : t("bannieres.sansDates"),
                b.lien ? t(`bannieres.lien_${b.lien.type}` as CleTexte) : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </Text>
          </View>
          <Switch
            testID={`switch-banniere-${index}`}
            accessibilityLabel={t("bannieres.active")}
            value={b.actif}
            onValueChange={(v) => {
              void basculer(b, v);
            }}
            trackColor={{ true: colors.success, false: colors.border }}
          />
        </View>
        <View style={styles.actions}>
          <Pressable
            testID={`btn-monter-banniere-${index}`}
            accessibilityLabel={t("bannieres.monter")}
            disabled={index === 0}
            onPress={() => deplacer(index, -1)}
            style={[styles.iconeBtn, index === 0 && styles.inactif]}
          >
            <Icone name="arrow-left" size={17} color={colors.brandPrimary} />
          </Pressable>
          <Pressable
            testID={`btn-descendre-banniere-${index}`}
            accessibilityLabel={t("bannieres.descendre")}
            disabled={index === liste.length - 1}
            onPress={() => deplacer(index, 1)}
            style={[styles.iconeBtn, index === liste.length - 1 && styles.inactif]}
          >
            <Icone name="arrow-right" size={17} color={colors.brandPrimary} />
          </Pressable>
          <View style={{ flex: 1 }} />
          <Pressable testID={`btn-modifier-banniere-${index}`} onPress={() => ouvrir(b)} style={styles.iconeBtn}>
            <Icone name="edit-2" size={17} color={colors.brandPrimary} />
          </Pressable>
          <Pressable testID={`btn-supprimer-banniere-${index}`} onPress={() => setASupprimer(b)} style={styles.iconeBtn}>
            <Icone name="trash-2" size={17} color={colors.error} />
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <View testID="ecran-admin-bannieres" style={styles.ecran}>
      {q.isLoading ? (
        <View style={styles.centre}>
          <Chargement taille={52} />
        </View>
      ) : (
        <FlatList
          data={liste}
          keyExtractor={(b) => b.id}
          renderItem={carte}
          refreshing={q.isRefetching}
          onRefresh={() => q.refetch()}
          contentContainerStyle={styles.liste}
          ListHeaderComponent={
            <View style={styles.entete}>
              <TitrePage
                titre={t("bannieres.titre")}
                sousTitre={t("bannieres.sousTitre")}
                actions={
                  <Pressable testID="btn-nouvelle-banniere" onPress={() => ouvrir(null)} style={styles.btnPrimaire}>
                    <Icone name="plus" size={16} color={colors.onBrandPrimary} />
                    <Text style={styles.btnPrimaireTexte}>{t("bannieres.nouvelle")}</Text>
                  </Pressable>
                }
              />
              <View style={styles.consigne}>
                <Icone name="image" size={18} color={colors.brandPrimary} />
                <Text style={styles.consigneTexte}>
                  {t("bannieres.format", { largeur: FORMAT_RECOMMANDE.largeur, hauteur: FORMAT_RECOMMANDE.hauteur })}
                </Text>
              </View>
            </View>
          }
          ListEmptyComponent={<Text style={styles.vide}>{t("bannieres.aucune")}</Text>}
        />
      )}

      <Modal visible={!!edition} animationType="slide" transparent onRequestClose={() => setEdition(null)}>
        <View style={styles.voile}>
          <Pressable style={{ flex: 1 }} onPress={() => setEdition(null)} />
          <View style={[styles.feuille, { paddingBottom: insets.bottom + spacing.lg }]}>
            <KeyboardAwareScrollView bottomOffset={60} contentContainerStyle={styles.feuilleContenu}>
              <Text style={styles.feuilleTitre}>
                {edition === "nouvelle" ? t("bannieres.nouvelle") : t("bannieres.modifier")}
              </Text>

              {aRecadrer ? (
                <RecadrageBanniere
                  uri={aRecadrer.uri}
                  largeurImage={aRecadrer.largeur}
                  hauteurImage={aRecadrer.hauteur}
                  envoi={envoiImage}
                  onValider={envoyerImage}
                  onAnnuler={() => setARecadrer(null)}
                />
              ) : (
                <>
                  <Text style={styles.label}>{t("bannieres.apercu")}</Text>
                  <BanniereVisuel banniere={f} />
                  <Text style={styles.aide}>
                    {t("bannieres.format", { largeur: FORMAT_RECOMMANDE.largeur, hauteur: FORMAT_RECOMMANDE.hauteur })}
                  </Text>
                  <View style={styles.boutonsImage}>
                    <Bouton
                      testID="btn-choisir-image-banniere"
                      label={f.imageUrl ? t("bannieres.remplacerImage") : t("bannieres.choisirImage")}
                      icone="image-plus"
                      variant="secondaire"
                      petit
                      onPress={choisirImage}
                    />
                    {f.imageUrl ? (
                      <Bouton
                        testID="btn-retirer-image-banniere"
                        label={t("catalogue.retirer")}
                        icone="trash-2"
                        variant="danger"
                        petit
                        onPress={() => maj({ imageUrl: null, imageMobileUrl: null })}
                      />
                    ) : null}
                  </View>
                  {!f.imageUrl ? <Text style={styles.aide}>{t("bannieres.sansImage")}</Text> : null}
                </>
              )}

              <Champ label={t("bannieres.titreFr")} testID="input-banniere-titre" value={f.titre} onChangeText={(v) => maj({ titre: v })} />
              <Champ label={t("bannieres.titreEn")} testID="input-banniere-titre-en" value={f.titreEn} onChangeText={(v) => maj({ titreEn: v })} />
              <Champ
                label={t("bannieres.sousTitreFr")}
                testID="input-banniere-sous-titre"
                value={f.sousTitre}
                onChangeText={(v) => maj({ sousTitre: v })}
              />
              <Champ
                label={t("bannieres.sousTitreEn")}
                testID="input-banniere-sous-titre-en"
                value={f.sousTitreEn}
                onChangeText={(v) => maj({ sousTitreEn: v })}
              />

              <Text style={styles.label}>{t("bannieres.couleurTexte")}</Text>
              <View style={styles.couleurs}>
                {COULEURS.map((c) => {
                  const actif = f.couleurTexte.toUpperCase() === c;
                  return (
                    <Pressable
                      key={c}
                      testID={`couleur-${c}`}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: actif }}
                      accessibilityLabel={c}
                      onPress={() => maj({ couleurTexte: c })}
                      style={styles.couleurZone}
                    >
                      <View style={[styles.couleur, { backgroundColor: c }, actif && styles.couleurActive]} />
                    </Pressable>
                  );
                })}
                <TextInput
                  testID="input-banniere-couleur"
                  value={f.couleurTexte}
                  onChangeText={(v) => maj({ couleurTexte: v.startsWith("#") ? v : `#${v}` })}
                  autoCapitalize="characters"
                  maxLength={7}
                  style={styles.hex}
                />
              </View>

              <Text style={styles.label}>{t("bannieres.position")}</Text>
              <Choix
                testID="position"
                options={POSITIONS}
                valeur={f.positionTexte}
                onChange={(positionTexte) => maj({ positionTexte })}
                libelle={(o) => t(`bannieres.position_${o}` as CleTexte)}
              />

              <Text style={styles.label}>{t("bannieres.lien")}</Text>
              <Choix
                testID="lien"
                options={[...LIENS]}
                valeur={f.lienType}
                onChange={(lienType) => {
                  maj({ lienType, lienValeur: "" });
                  setRecherche("");
                }}
                libelle={(o) => t(`bannieres.lien_${o}` as CleTexte)}
              />
              {f.lienType === "produit" ? (
                <TextInput
                  testID="input-banniere-recherche"
                  value={recherche}
                  onChangeText={setRecherche}
                  placeholder={t("promotions.rechercherProduit")}
                  placeholderTextColor={colors.muted}
                  style={styles.recherche}
                />
              ) : null}
              {f.lienType !== "aucun" ? (
                optionsLien.length ? (
                  <Choix
                    testID="cible-lien"
                    options={optionsLien.map((o) => o.id)}
                    valeur={f.lienValeur}
                    onChange={(lienValeur) => maj({ lienValeur })}
                    libelle={(id) => optionsLien.find((o) => o.id === id)?.libelle ?? id}
                  />
                ) : (
                  <Text style={styles.aide}>{t("bannieres.aucuneCible")}</Text>
                )
              ) : null}
              {f.lienType === "promotion" ? <Text style={styles.aide}>{t("bannieres.lienPromotionAide")}</Text> : null}

              <View style={styles.duo}>
                <View style={styles.duoCol}>
                  <Champ
                    label={t("promotions.debut")}
                    testID="input-banniere-debut"
                    value={f.dateDebut}
                    onChangeText={(v) => maj({ dateDebut: v })}
                    placeholder="2026-11-01 08:00"
                    autoCapitalize="none"
                  />
                </View>
                <View style={styles.duoCol}>
                  <Champ
                    label={t("promotions.fin")}
                    testID="input-banniere-fin"
                    value={f.dateFin}
                    onChangeText={(v) => maj({ dateFin: v })}
                    placeholder="2026-11-30 23:59"
                    autoCapitalize="none"
                  />
                </View>
              </View>
              <Text style={styles.aide}>{t("promotions.datesAide")}</Text>

              <Interrupteur
                testID="switch-banniere-active"
                label={t("bannieres.active")}
                aide={t("bannieres.activeAide")}
                value={f.actif}
                onChange={(v) => maj({ actif: v })}
              />

              <Bouton
                testID="btn-enregistrer-banniere"
                label={t("commun.enregistrer")}
                loading={envoi}
                disabled={!!aRecadrer}
                onPress={enregistrer}
              />
              <Bouton testID="btn-annuler-banniere" label={t("commun.annuler")} variant="contour" onPress={() => setEdition(null)} />
            </KeyboardAwareScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={!!aSupprimer} animationType="fade" transparent onRequestClose={() => setASupprimer(null)}>
        <View style={styles.voileCentre}>
          <View testID="dialogue-supprimer-banniere" style={styles.dialogue}>
            <Text style={styles.feuilleTitre}>{t("bannieres.supprimerTitre")}</Text>
            <Text style={styles.aide}>{t("bannieres.supprimerTexte")}</Text>
            <Bouton testID="btn-confirmer-suppression-banniere" label={t("commun.supprimer")} variant="danger" onPress={supprimer} />
            <Bouton label={t("commun.annuler")} variant="contour" onPress={() => setASupprimer(null)} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = stylesDynamiques(() =>
  StyleSheet.create({
    ecran: { flex: 1, backgroundColor: colors.surfaceSecondary },
    centre: { flex: 1, alignItems: "center", justifyContent: "center" },
    liste: { ...LARGEUR_LARGE, padding: spacing.xl, gap: spacing.lg, paddingBottom: spacing.xxxl },
    entete: { gap: spacing.md },
    consigne: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      padding: spacing.md,
      borderRadius: radius.lg,
      backgroundColor: colors.brandTertiary,
    },
    consigneTexte: { flex: 1, fontFamily: fonts.text, fontSize: 13, fontWeight: "700", color: colors.onSurface },
    vide: { fontFamily: fonts.text, fontSize: 14, color: colors.muted, textAlign: "center", paddingVertical: spacing.xl },
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
      gap: spacing.sm,
      padding: spacing.md,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      maxWidth: 760,
      width: "100%",
      alignSelf: "center",
    },
    ligneInfos: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    infos: { flex: 1, gap: 2 },
    statut: { fontFamily: fonts.text, fontSize: 12, fontWeight: "800" },
    statutActif: { color: colors.success },
    statutInactif: { color: colors.muted },
    details: { fontFamily: fonts.text, fontSize: 12, color: colors.muted },
    actions: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
    iconeBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
    inactif: { opacity: 0.3 },
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
      maxWidth: 440,
      backgroundColor: colors.surface,
      borderRadius: radius.xl,
      padding: spacing.xl,
      gap: spacing.md,
    },
    feuille: {
      ...LARGEUR_FEUILLE,
      backgroundColor: colors.surface,
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      maxHeight: "94%",
    },
    feuilleContenu: { padding: spacing.xl, gap: spacing.md },
    feuilleTitre: { fontFamily: fonts.display, fontSize: 21, color: colors.onSurface },
    label: { fontFamily: fonts.text, fontSize: 13, fontWeight: "700", color: colors.muted },
    aide: { fontFamily: fonts.text, fontSize: 12, color: colors.muted },
    boutonsImage: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    couleurs: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.xs },
    couleurZone: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
    couleur: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: colors.border },
    couleurActive: { borderWidth: 3, borderColor: colors.brandPrimary },
    hex: {
      minHeight: 44,
      width: 110,
      paddingHorizontal: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      fontFamily: fonts.text,
      fontSize: 14,
      color: colors.onSurface,
    },
    recherche: {
      minHeight: 44,
      paddingHorizontal: spacing.md,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      fontFamily: fonts.text,
      fontSize: 13,
      color: colors.onSurface,
    },
    duo: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
    duoCol: { flexGrow: 1, flexBasis: 180 },
  }),
);
