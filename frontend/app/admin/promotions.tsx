import { useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useMemo, useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { apiFetch } from "@/src/api";
import { useLibelle } from "@/src/catalogue-i18n";
import { Bouton } from "@/src/components/Bouton";
import { Champ } from "@/src/components/Champ";
import { Chargement } from "@/src/components/Chargement";
import { Icone } from "@/src/components/Icone";
import { TitrePage } from "@/src/components/TitrePage";
import { useLangue, useT, type CleTexte } from "@/src/i18n";
import { versIso, versLocal } from "@/src/dates";
import { Choix, Interrupteur } from "@/src/components/ChoixAdmin";
import { useDescriptionPromo, type CiblePromo, type Promotion, type TypePromo } from "@/src/promotions";
import { LARGEUR_FEUILLE, LARGEUR_LARGE } from "@/src/reactif";
import { colors, fonts, radius, spacing, stylesDynamiques } from "@/src/theme";
import { useTheme } from "@/src/theme-contexte";
import { useToast } from "@/src/toast";

type Formulaire = {
  nom: string;
  nomEn: string;
  type: TypePromo;
  valeur: string;
  automatique: boolean;
  code: string;
  cible: CiblePromo;
  cibleValeur: string;
  montantMin: string;
  dateDebut: string;
  dateFin: string;
  limiteTotale: string;
  limiteParClient: string;
  cumulable: boolean;
  actif: boolean;
  notifierClients: boolean;
  afficherBanniere: boolean;
};

const VIDE: Formulaire = {
  nom: "",
  nomEn: "",
  type: "pourcentage",
  valeur: "",
  automatique: true,
  code: "",
  cible: "commande",
  cibleValeur: "",
  montantMin: "",
  dateDebut: "",
  dateFin: "",
  limiteTotale: "",
  limiteParClient: "",
  cumulable: false,
  actif: true,
  notifierClients: true,
  afficherBanniere: true,
};

const TYPES: TypePromo[] = ["pourcentage", "montant", "livraison"];
const CIBLES: CiblePromo[] = ["commande", "categorie", "produit", "premiere_commande"];

const entier = (v: string) => {
  const n = parseInt(v.replace(/\s/g, ""), 10);
  return isNaN(n) ? null : n;
};

const COULEURS_STATUT = () => ({
  active: { fond: colors.successSoft, texte: colors.success },
  programmee: { fond: colors.brandTertiary, texte: colors.brandPrimary },
  expiree: { fond: colors.surfaceSecondary, texte: colors.muted },
  epuisee: { fond: colors.surfaceSecondary, texte: colors.muted },
  desactivee: { fond: colors.errorSoft, texte: colors.error },
});

export default function PromotionsAdmin() {
  useTheme();
  const t = useT();
  const { langue } = useLangue();
  const libelle = useLibelle();
  const decrire = useDescriptionPromo();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin-promotions"], queryFn: () => apiFetch<Promotion[]>("/admin/promotions") });
  const categoriesQ = useQuery({
    queryKey: ["admin-categories"],
    queryFn: () => apiFetch<{ id: string; nom: string; nomEn?: string | null }[]>("/admin/categories"),
  });
  const produitsQ = useQuery({ queryKey: ["produits"], queryFn: () => apiFetch<any[]>("/produits") });

  const [edition, setEdition] = useState<Promotion | "nouvelle" | null>(null);
  const [f, setF] = useState<Formulaire>(VIDE);
  const [rechercheProduit, setRechercheProduit] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [aSupprimer, setASupprimer] = useState<Promotion | null>(null);
  const maj = (champs: Partial<Formulaire>) => setF((courant) => ({ ...courant, ...champs }));

  const produitsFiltres = useMemo(() => {
    const texte = rechercheProduit.trim().toLowerCase();
    return (produitsQ.data ?? [])
      .filter((p) => !texte || [p.nom, p.nomEn].some((v) => String(v ?? "").toLowerCase().includes(texte)))
      .slice(0, 40);
  }, [produitsQ.data, rechercheProduit]);

  const rafraichir = async () => {
    await qc.invalidateQueries({ queryKey: ["admin-promotions"] });
    qc.invalidateQueries({ queryKey: ["promotions-actives"] });
  };

  const ouvrir = (p: Promotion | null) => {
    setEdition(p ?? "nouvelle");
    setRechercheProduit("");
    setF(
      p
        ? {
            nom: p.nom,
            nomEn: p.nomEn ?? "",
            type: p.type,
            valeur: p.type === "livraison" ? "" : String(p.valeur),
            automatique: p.automatique,
            code: p.code ?? "",
            cible: p.cible,
            cibleValeur: p.cibleValeur ?? "",
            montantMin: p.montantMin ? String(p.montantMin) : "",
            dateDebut: versLocal(p.dateDebut),
            dateFin: versLocal(p.dateFin),
            limiteTotale: p.limiteTotale ? String(p.limiteTotale) : "",
            limiteParClient: p.limiteParClient ? String(p.limiteParClient) : "",
            cumulable: p.cumulable,
            actif: p.actif,
            notifierClients: p.notifierClients !== false,
            afficherBanniere: p.afficherBanniere !== false,
          }
        : VIDE,
    );
  };

  const enregistrer = async () => {
    const dateDebut = versIso(f.dateDebut);
    const dateFin = versIso(f.dateFin);
    if (dateDebut === undefined || dateFin === undefined) {
      toast.show(t("promotions.dateInvalide"), "erreur");
      return;
    }
    const body = {
      nom: f.nom,
      nomEn: f.nomEn.trim() || null,
      type: f.type,
      valeur: f.type === "livraison" ? 0 : parseFloat(f.valeur.replace(",", ".")) || 0,
      automatique: f.automatique,
      code: f.automatique ? null : f.code.trim().toUpperCase(),
      cible: f.cible,
      cibleValeur: f.cible === "categorie" || f.cible === "produit" ? f.cibleValeur || null : null,
      montantMin: entier(f.montantMin) ?? 0,
      dateDebut,
      dateFin,
      limiteTotale: entier(f.limiteTotale),
      limiteParClient: entier(f.limiteParClient),
      cumulable: f.cumulable,
      actif: f.actif,
      notifierClients: f.notifierClients,
      afficherBanniere: f.automatique || f.afficherBanniere,
    };
    setEnvoi(true);
    try {
      if (edition === "nouvelle") await apiFetch("/admin/promotions", { method: "POST", body });
      else if (edition) await apiFetch(`/admin/promotions/${edition.id}`, { method: "PUT", body });
      await rafraichir();
      setEdition(null);
      toast.show(t("promotions.enregistree"), "succes");
    } catch (e: any) {
      toast.show(e.message, "erreur");
    } finally {
      setEnvoi(false);
    }
  };

  const basculer = async (p: Promotion, actif: boolean) => {
    try {
      await apiFetch(`/admin/promotions/${p.id}/actif`, { method: "PATCH", body: { actif } });
      await rafraichir();
    } catch (e: any) {
      toast.show(e.message, "erreur");
    }
  };

  const supprimer = async () => {
    if (!aSupprimer) return;
    try {
      await apiFetch(`/admin/promotions/${aSupprimer.id}`, { method: "DELETE" });
      await rafraichir();
      toast.show(t("promotions.supprimee"), "succes");
    } catch (e: any) {
      toast.show(e.message, "erreur");
    } finally {
      setASupprimer(null);
    }
  };

  const couleurs = COULEURS_STATUT();
  const date = (iso?: string | null) =>
    iso
      ? new Date(iso).toLocaleString(langue === "en" ? "en-GB" : "fr-FR", {
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        })
      : null;

  const carte = ({ item: p }: { item: Promotion }) => {
    const statut = p.statut ?? "active";
    const debut = date(p.dateDebut);
    const fin = date(p.dateFin);
    return (
      <View testID={`promotion-${p.nom}`} style={styles.carte}>
        <View style={styles.carteEntete}>
          <View style={styles.carteTitreBloc}>
            <Text style={styles.carteTitre}>{libelle(p.nom, p.nomEn)}</Text>
            <Text style={styles.carteRemise}>{decrire(p)}</Text>
          </View>
          <Switch
            testID={`switch-promotion-${p.nom}`}
            accessibilityLabel={t("promotions.actif")}
            value={p.actif}
            onValueChange={(v) => {
              void basculer(p, v);
            }}
            trackColor={{ true: colors.success, false: colors.border }}
          />
        </View>
        <View style={styles.badges}>
          <Text style={[styles.badge, { backgroundColor: couleurs[statut].fond, color: couleurs[statut].texte }]}>
            {t(`promotions.statut_${statut}` as CleTexte)}
          </Text>
          <Text style={styles.badgeNeutre}>
            {p.automatique ? t("promotions.automatique") : t("promotions.codeBadge", { code: p.code ?? "" })}
          </Text>
          {!p.automatique && p.afficherBanniere === false ? (
            <Text style={styles.badgeNeutre}>{t("promotions.codePrive")}</Text>
          ) : null}
          {p.cumulable ? <Text style={styles.badgeNeutre}>{t("promotions.cumulable")}</Text> : null}
        </View>
        <Text style={styles.details}>
          {t("promotions.utilisations", {
            n: p.nombreUtilisations ?? 0,
            limite: p.limiteTotale ?? "∞",
          })}
          {p.limiteParClient ? ` · ${t("promotions.parClientCourt", { n: p.limiteParClient })}` : ""}
          {debut || fin ? ` · ${[debut ?? "…", fin ?? "…"].join(" → ")}` : ""}
        </Text>
        <View style={styles.actions}>
          <Pressable testID={`btn-modifier-promotion-${p.nom}`} onPress={() => ouvrir(p)} style={styles.iconeBtn}>
            <Icone name="edit-2" size={17} color={colors.brandPrimary} />
          </Pressable>
          <Pressable
            testID={`btn-supprimer-promotion-${p.nom}`}
            onPress={() => setASupprimer(p)}
            style={styles.iconeBtn}
          >
            <Icone name="trash-2" size={17} color={colors.error} />
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <View testID="ecran-admin-promotions" style={styles.ecran}>
      {q.isLoading ? (
        <View style={styles.centre}>
          <Chargement taille={52} />
        </View>
      ) : (
        <FlatList
          data={q.data ?? []}
          keyExtractor={(p) => p.id}
          renderItem={carte}
          refreshing={q.isRefetching}
          onRefresh={() => q.refetch()}
          contentContainerStyle={styles.liste}
          ListHeaderComponent={
            <TitrePage
              titre={t("promotions.titre")}
              sousTitre={t("promotions.sousTitre")}
              actions={
                <Pressable testID="btn-nouvelle-promotion" onPress={() => ouvrir(null)} style={styles.btnPrimaire}>
                  <Icone name="plus" size={16} color={colors.onBrandPrimary} />
                  <Text style={styles.btnPrimaireTexte}>{t("promotions.nouvelle")}</Text>
                </Pressable>
              }
            />
          }
          ListEmptyComponent={<Text style={styles.vide}>{t("promotions.aucune")}</Text>}
        />
      )}

      <Modal visible={!!edition} animationType="slide" transparent onRequestClose={() => setEdition(null)}>
        <View style={styles.voile}>
          <Pressable style={{ flex: 1 }} onPress={() => setEdition(null)} />
          <View style={[styles.feuille, { paddingBottom: insets.bottom + spacing.lg }]}>
            <KeyboardAwareScrollView bottomOffset={60} contentContainerStyle={styles.feuilleContenu}>
              <Text style={styles.feuilleTitre}>
                {edition === "nouvelle" ? t("promotions.nouvelle") : t("promotions.modifier")}
              </Text>

              <Champ label={t("promotions.nom")} testID="input-promo-nom" value={f.nom} onChangeText={(v) => maj({ nom: v })} />
              <Champ
                label={t("promotions.nomEn")}
                testID="input-promo-nom-en"
                value={f.nomEn}
                onChangeText={(v) => maj({ nomEn: v })}
              />

              <Text style={styles.label}>{t("promotions.type")}</Text>
              <Choix
                testID="type"
                options={TYPES}
                valeur={f.type}
                onChange={(type) => maj({ type })}
                libelle={(o) => t(`promotions.type_${o}` as CleTexte)}
              />
              {f.type !== "livraison" ? (
                <Champ
                  label={f.type === "pourcentage" ? t("promotions.valeurPourcentage") : t("promotions.valeurMontant")}
                  testID="input-promo-valeur"
                  value={f.valeur}
                  onChangeText={(v) => maj({ valeur: v })}
                  keyboardType="decimal-pad"
                />
              ) : null}

              <Text style={styles.label}>{t("promotions.application")}</Text>
              <Choix
                testID="mode"
                options={["auto", "code"]}
                valeur={f.automatique ? "auto" : "code"}
                onChange={(m) => maj({ automatique: m === "auto" })}
                libelle={(o) => (o === "auto" ? t("promotions.automatique") : t("promotions.avecCode"))}
              />
              {!f.automatique ? (
                <Champ
                  label={t("promotions.code")}
                  testID="input-promo-code"
                  value={f.code}
                  onChangeText={(v) => maj({ code: v.toUpperCase().replace(/\s/g, "") })}
                  autoCapitalize="characters"
                  placeholder="BIENVENUE"
                />
              ) : null}

              <Text style={styles.label}>{t("promotions.cible")}</Text>
              <Choix
                testID="cible"
                options={CIBLES}
                valeur={f.cible}
                onChange={(cible) => maj({ cible, cibleValeur: "" })}
                libelle={(o) => t(`promotions.cible_${o}` as CleTexte)}
              />
              {f.cible === "categorie" ? (
                <Choix
                  testID="cible-categorie"
                  options={(categoriesQ.data ?? []).map((c) => c.nom)}
                  valeur={f.cibleValeur}
                  onChange={(v) => maj({ cibleValeur: v })}
                  libelle={(nom) => libelle(nom, categoriesQ.data?.find((c) => c.nom === nom)?.nomEn)}
                />
              ) : null}
              {f.cible === "produit" ? (
                <>
                  <TextInput
                    testID="input-promo-recherche-produit"
                    value={rechercheProduit}
                    onChangeText={setRechercheProduit}
                    placeholder={t("promotions.rechercherProduit")}
                    placeholderTextColor={colors.muted}
                    style={styles.recherche}
                  />
                  <Choix
                    testID="cible-produit"
                    options={produitsFiltres.map((p) => p.id as string)}
                    valeur={f.cibleValeur}
                    onChange={(v) => maj({ cibleValeur: v })}
                    libelle={(id) => {
                      const p = produitsQ.data?.find((x) => x.id === id);
                      return p ? `${libelle(p.nom, p.nomEn)}${p.sousCategorie ? ` · ${p.sousCategorie}` : ""}` : id;
                    }}
                  />
                </>
              ) : null}

              <Text style={styles.label}>{t("promotions.conditions")}</Text>
              <Champ
                label={t("promotions.montantMin")}
                testID="input-promo-montant-min"
                value={f.montantMin}
                onChangeText={(v) => maj({ montantMin: v })}
                keyboardType="number-pad"
                placeholder="0"
              />
              <View style={styles.duo}>
                <View style={styles.duoCol}>
                  <Champ
                    label={t("promotions.debut")}
                    testID="input-promo-debut"
                    value={f.dateDebut}
                    onChangeText={(v) => maj({ dateDebut: v })}
                    placeholder="2026-11-01 08:00"
                    autoCapitalize="none"
                  />
                </View>
                <View style={styles.duoCol}>
                  <Champ
                    label={t("promotions.fin")}
                    testID="input-promo-fin"
                    value={f.dateFin}
                    onChangeText={(v) => maj({ dateFin: v })}
                    placeholder="2026-11-30 23:59"
                    autoCapitalize="none"
                  />
                </View>
              </View>
              <Text style={styles.aide}>{t("promotions.datesAide")}</Text>
              <View style={styles.duo}>
                <View style={styles.duoCol}>
                  <Champ
                    label={t("promotions.limiteTotale")}
                    testID="input-promo-limite-totale"
                    value={f.limiteTotale}
                    onChangeText={(v) => maj({ limiteTotale: v })}
                    keyboardType="number-pad"
                    placeholder="∞"
                  />
                </View>
                <View style={styles.duoCol}>
                  <Champ
                    label={t("promotions.limiteParClient")}
                    testID="input-promo-limite-client"
                    value={f.limiteParClient}
                    onChangeText={(v) => maj({ limiteParClient: v })}
                    keyboardType="number-pad"
                    placeholder="∞"
                  />
                </View>
              </View>

              <Interrupteur
                testID="switch-promo-cumulable"
                label={t("promotions.cumulable")}
                aide={t("promotions.cumulableAide")}
                value={f.cumulable}
                onChange={(v) => maj({ cumulable: v })}
              />
              {!f.automatique ? (
                <Interrupteur
                  testID="switch-promo-banniere"
                  label={t("promotions.afficherBanniere")}
                  aide={t("promotions.afficherBanniereAide")}
                  value={f.afficherBanniere}
                  onChange={(v) => maj({ afficherBanniere: v })}
                />
              ) : null}
              {f.automatique || f.afficherBanniere ? (
                <Interrupteur
                  testID="switch-promo-notifier"
                  label={t("promotions.notifierClients")}
                  aide={t("promotions.notifierClientsAide")}
                  value={f.notifierClients}
                  onChange={(v) => maj({ notifierClients: v })}
                />
              ) : null}
              <Interrupteur
                testID="switch-promo-actif"
                label={t("promotions.actif")}
                aide={t("promotions.actifAide")}
                value={f.actif}
                onChange={(v) => maj({ actif: v })}
              />

              <Bouton testID="btn-enregistrer-promotion" label={t("commun.enregistrer")} loading={envoi} onPress={enregistrer} />
              <Bouton testID="btn-annuler-promotion" label={t("commun.annuler")} variant="contour" onPress={() => setEdition(null)} />
            </KeyboardAwareScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={!!aSupprimer} animationType="fade" transparent onRequestClose={() => setASupprimer(null)}>
        <View style={styles.voileCentre}>
          <View testID="dialogue-supprimer-promotion" style={styles.dialogue}>
            <Text style={styles.feuilleTitre}>{t("promotions.supprimerTitre")}</Text>
            <Text style={styles.aide}>{t("promotions.supprimerTexte", { nom: aSupprimer?.nom ?? "" })}</Text>
            <Bouton testID="btn-confirmer-suppression-promotion" label={t("commun.supprimer")} variant="danger" onPress={supprimer} />
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
    liste: { ...LARGEUR_LARGE, padding: spacing.xl, gap: spacing.md, paddingBottom: spacing.xxxl },
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
      padding: spacing.lg,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    carteEntete: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
    carteTitreBloc: { flex: 1, gap: 2 },
    carteTitre: { fontFamily: fonts.display, fontSize: 17, color: colors.onSurface },
    carteRemise: { fontFamily: fonts.text, fontSize: 14, fontWeight: "800", color: colors.brandPrimary },
    badges: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
    badge: {
      fontFamily: fonts.text,
      fontSize: 11,
      fontWeight: "800",
      paddingHorizontal: spacing.sm,
      paddingVertical: 3,
      borderRadius: radius.pill,
      overflow: "hidden",
    },
    badgeNeutre: {
      fontFamily: fonts.text,
      fontSize: 11,
      fontWeight: "800",
      color: colors.onSurface,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: radius.pill,
    },
    details: { fontFamily: fonts.text, fontSize: 12, color: colors.muted },
    actions: { flexDirection: "row", justifyContent: "flex-end", gap: spacing.xs },
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
      maxHeight: "92%",
    },
    feuilleContenu: { padding: spacing.xl, gap: spacing.md },
    feuilleTitre: { fontFamily: fonts.display, fontSize: 21, color: colors.onSurface },
    label: { fontFamily: fonts.text, fontSize: 13, fontWeight: "700", color: colors.muted },
    aide: { fontFamily: fonts.text, fontSize: 12, color: colors.muted },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
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
    switchRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing.md,
      minHeight: 52,
      backgroundColor: colors.surfaceSecondary,
      borderRadius: radius.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
    },
    switchTexte: { flex: 1 },
    switchLabel: { fontFamily: fonts.text, fontSize: 14, fontWeight: "700", color: colors.onSurface },
  }),
);
