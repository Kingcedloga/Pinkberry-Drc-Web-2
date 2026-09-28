import { Chargement } from "@/src/components/Chargement";
import { Icone } from "@/src/components/Icone";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { apiFetch } from "@/src/api";
import { Bouton } from "@/src/components/Bouton";
import { CarteNotifications } from "@/src/components/CarteNotifications";
import { TitrePage } from "@/src/components/TitrePage";
import { useLangue, type CleTexte } from "@/src/i18n";
import { LARGEUR_LARGE, useEcran } from "@/src/reactif";
import { colors, fonts, radius, softShadow, spacing, stylesDynamiques } from "@/src/theme";
import { useTheme } from "@/src/theme-contexte";
import { useMontant } from "@/src/taux";
import { useToast } from "@/src/toast";

const FILTRES: { cle: string; libelle: CleTexte }[] = [
  { cle: "tous", libelle: "admin.filtreToutes" },
  { cle: "en_cours", libelle: "admin.filtreEnCours" },
  { cle: "recue", libelle: "admin.filtreRecues" },
  { cle: "en_preparation", libelle: "admin.filtrePreparation" },
  { cle: "en_route", libelle: "admin.filtreRoute" },
  { cle: "livree", libelle: "admin.filtreLivrees" },
  { cle: "annulee", libelle: "admin.filtreAnnulees" },
];

const SUIVANTS: Record<string, string[]> = {
  recue: ["en_preparation", "annulee"],
  en_preparation: ["en_route", "annulee"],
  recuperee: ["en_route"],
  en_route: ["livree"],
};

const LIBELLES_PAIEMENT: Record<string, CleTexte> = {
  cash: "admin.paiementCash",
  mpesa: "admin.paiementMobile",
  airtel: "admin.paiementMobile",
  orange: "admin.paiementMobile",
};
const LIBELLES_STATUT_PAIEMENT: Record<string, CleTexte> = {
  a_la_livraison: "admin.paiementCash",
  attente: "admin.paiementAttente",
  paye: "admin.paiementPaye",
  echoue: "admin.paiementEchoue",
};

/** Mode et statut de paiement d'une commande, pour l'admin. */
function resumePaiement(cmd: any, t: (cle: CleTexte) => string) {
  const p = cmd?.paiement;
  if (!p || typeof p !== "object") return { mode: t("admin.paiementCash"), statut: t("admin.paiementCash"), paye: false };
  const cle = p.mode === "mobile" ? p.operateur : "cash";
  return {
    mode: t(LIBELLES_PAIEMENT[cle] ?? "admin.paiementMobile"),
    statut: t(LIBELLES_STATUT_PAIEMENT[p.statut] ?? "admin.paiementAttente"),
    paye: p.statut === "paye",
  };
}

export default function Dashboard() {
  useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();
  const { usd, fc } = useMontant();
  const { t } = useLangue();
  const { bureau } = useEcran();
  const [ouverte, setOuverte] = useState<any>(null);
  const [filtreStatut, setFiltreStatut] = useState("tous");
  const [recherche, setRecherche] = useState("");

  const commandesQ = useQuery({
    queryKey: ["admin-commandes"],
    queryFn: () => apiFetch<any[]>("/admin/commandes"),
    refetchInterval: 4000,
  });
  const statsQ = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => apiFetch<any>("/admin/stats"),
    refetchInterval: 8000,
  });
  const livreursQ = useQuery({ queryKey: ["admin-livreurs"], queryFn: () => apiFetch<any[]>("/admin/livreurs") });
  const ventesQ = useQuery({
    queryKey: ["admin-ventes"],
    queryFn: () => apiFetch<any>("/admin/ventes"),
    refetchInterval: 15000,
  });

  const rafraichir = () => {
    qc.invalidateQueries({ queryKey: ["admin-commandes"] });
    qc.invalidateQueries({ queryKey: ["admin-stats"] });
    qc.invalidateQueries({ queryKey: ["admin-ventes"] });
  };

  const assigner = async (livreurId: string) => {
    try {
      const maj = await apiFetch<any>(`/admin/commandes/${ouverte.id}/assigner`, {
        method: "POST",
        body: { livreurId },
      });
      setOuverte(maj);
      rafraichir();
      toast.show(t("admin.livreurAssigne"), "succes");
    } catch (e: any) {
      toast.show(e.message, "erreur");
    }
  };

  const changerStatut = async (statut: string) => {
    try {
      const maj = await apiFetch<any>(`/admin/commandes/${ouverte.id}/statut`, {
        method: "PATCH",
        body: { statut },
      });
      setOuverte(maj);
      rafraichir();
      toast.show(`${t("admin.statut")} : ${t(`statut.${statut}` as CleTexte)}`, "succes");
    } catch (e: any) {
      toast.show(e.message, "erreur");
    }
  };

  const archiver = async (cmd: any) => {
    try {
      await apiFetch(`/admin/commandes/${cmd.id}/archiver`, { method: "POST" });
      rafraichir();
      qc.invalidateQueries({ queryKey: ["admin-archives"] });
      toast.show(`${cmd.numero} ${t("commun.archiver").toLowerCase()}`, "succes");
    } catch (e: any) {
      toast.show(e.message, "erreur");
    }
  };

  const stats = statsQ.data;
  const ventes = ventesQ.data;

  const commandes = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return (commandesQ.data ?? []).filter((c: any) => {
      const okStatut =
        filtreStatut === "tous"
          ? true
          : filtreStatut === "en_cours"
            ? !["livree", "annulee"].includes(c.statut)
            : c.statut === filtreStatut;
      const okTexte =
        !q ||
        String(c.numero).toLowerCase().includes(q) ||
        String(c.clientNom ?? "").toLowerCase().includes(q) ||
        String(c.clientTelephone ?? "").toLowerCase().includes(q) ||
        String(c.adresse?.commune ?? "").toLowerCase().includes(q);
      return okStatut && okTexte;
    });
  }, [commandesQ.data, filtreStatut, recherche]);

  return (
    <View testID="ecran-admin-dashboard" style={styles.ecran}>
      {commandesQ.isLoading ? (
        <View style={styles.centre}>
          <Chargement taille={52} />
        </View>
      ) : (
        <FlatList
          testID="liste-admin-commandes"
          data={commandes}
          keyExtractor={(c) => c.id}
          contentContainerStyle={[styles.liste, LARGEUR_LARGE]}
          refreshing={commandesQ.isRefetching}
          onRefresh={rafraichir}
          ListHeaderComponent={
            <View style={styles.enteteListe}>
              <TitrePage
                titre={t("admin.commandes")}
                sousTitre={t("admin.suiviBoutique")}
                actions={
                  <Pressable
                    testID="btn-admin-parametres"
                    onPress={() => router.push("/admin/parametres")}
                    style={styles.boutonAction}
                  >
                    <Icone name="settings" size={16} color={colors.brandPrimary} />
                    <Text style={styles.boutonActionTexte}>{t("params.titre")}</Text>
                  </Pressable>
                }
              />
              <CarteNotifications texte={t("admin.notifications")} />
              <View style={bureau ? styles.grilleBureau : styles.enteteListe}>
              <View testID="carte-ventes-jour" style={[styles.ventesCarte, bureau && { flex: 2 }]}>
                <View style={styles.ventesHaut}>
                  <View>
                    <Text style={styles.ventesTitre}>{t("admin.ventesJour")}</Text>
                    <Text style={styles.ventesDate}>{ventes?.date ?? "—"} · {t("admin.commandesLivrees")}</Text>
                  </View>
                  <Icone name="dollar-sign" size={20} color={colors.brandPrimary} />
                </View>

                <Text testID="ventes-chiffre" style={styles.ventesChiffre}>
                  {usd(ventes?.chiffre ?? 0)}
                </Text>
                <Text style={styles.ventesChiffreFc}>≈ {fc(ventes?.chiffre ?? 0)}</Text>

                <View style={styles.ventesLigne}>
                  <View style={styles.ventesMini}>
                    <Text testID="ventes-nb-commandes" style={styles.ventesMiniValeur}>
                      {ventes?.nbCommandes ?? 0}
                    </Text>
                    <Text style={styles.ventesMiniLabel}>{t("admin.commandes")}</Text>
                  </View>
                  <View style={styles.ventesMini}>
                    <Text style={styles.ventesMiniValeur}>{usd(ventes?.panierMoyen ?? 0)}</Text>
                    <Text style={styles.ventesMiniLabel}>{t("admin.panierMoyen")}</Text>
                  </View>
                </View>

                <Text style={styles.topTitre}>{t("admin.plusCommandes")}</Text>
                {(ventes?.topProduits ?? []).length === 0 ? (
                  <Text style={styles.topVide}>{t("admin.aucuneVente")}</Text>
                ) : (
                  (ventes?.topProduits ?? []).map((p: any, i: number) => (
                    <View key={p.nom} testID={`top-produit-${i}`} style={styles.topLigne}>
                      <View style={styles.rang}>
                        <Text style={styles.rangTexte}>{i + 1}</Text>
                      </View>
                      <Text style={styles.topNom} numberOfLines={1}>
                        {p.nom}
                      </Text>
                      <Text style={styles.topQte}>×{p.quantite}</Text>
                      <Text style={styles.topMontant}>{usd(p.montant)}</Text>
                    </View>
                  ))
                )}
              </View>

              <View style={[styles.statsRow, bureau && styles.statsColonne]}>
                {[
                  { l: t("admin.enCours"), v: stats?.enCours ?? 0, c: colors.brandPrimary },
                  { l: t("admin.livrees"), v: stats?.livrees ?? 0, c: colors.success },
                  { l: t("admin.revenus"), v: usd(stats?.revenus ?? 0), c: colors.onSurface },
                ].map((s) => (
                  <View key={s.l} testID={`stat-${s.l}`} style={[styles.statCarte, bureau && styles.statCarteBureau]}>
                    <Text style={[styles.statValeur, { color: s.c }]}>{s.v}</Text>
                    <Text style={styles.statLabel}>{s.l}</Text>
                  </View>
                ))}
              </View>
              </View>

              <View style={styles.barreFiltres}>
                <View style={styles.rechercheWrap}>
                  <Icone name="search" size={16} color={colors.muted} />
                  <TextInput
                    testID="input-recherche-commandes"
                    value={recherche}
                    onChangeText={setRecherche}
                    placeholder={t("admin.rechercherCommandes")}
                    placeholderTextColor={colors.muted}
                    style={styles.rechercheChamp}
                  />
                </View>
                <View style={styles.filtresStatut}>
                  {FILTRES.map((f) => {
                    const actif = f.cle === filtreStatut;
                    return (
                      <Pressable
                        key={f.cle}
                        testID={`filtre-statut-${f.cle}`}
                        onPress={() => setFiltreStatut(f.cle)}
                        style={[styles.filtreChip, actif && styles.filtreChipActif]}
                      >
                        <Text style={[styles.filtreChipTexte, actif && { color: colors.onBrandPrimary }]}>
                          {t(f.libelle)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Text style={styles.compteur}>
                  {t(commandes.length === 1 ? "admin.uneCommande" : "admin.plusieursCommandes", { n: commandes.length })}
                </Text>
              </View>

              {bureau ? (
                <View testID="entete-tableau" style={styles.ligneEnteteTable}>
                  <Text style={[styles.celluleEntete, styles.colNumero]}>{t("admin.commande")}</Text>
                  <Text style={[styles.celluleEntete, styles.colClient]}>{t("admin.client")}</Text>
                  <Text style={[styles.celluleEntete, styles.colAdresse]}>{t("admin.adresse")}</Text>
                  <Text style={[styles.celluleEntete, styles.colLivreur]}>{t("admin.livreur")}</Text>
                  <Text style={[styles.celluleEntete, styles.colPaiement]}>{t("admin.paiement")}</Text>
                  <Text style={[styles.celluleEntete, styles.colStatut]}>{t("admin.statut")}</Text>
                  <Text style={[styles.celluleEntete, styles.colTotal]}>{t("admin.total")}</Text>
                </View>
              ) : null}
            </View>
          }
          ListEmptyComponent={
            <View style={styles.centre}>
              <Text style={styles.vide}>{t("admin.aucuneCommande")}</Text>
            </View>
          }
          renderItem={({ item }) =>
            bureau ? (
              <Pressable
                testID={`admin-commande-${item.numero}`}
                onPress={() => setOuverte(item)}
                style={({ pressed }) => [styles.ligneTable, pressed && { backgroundColor: colors.brandTertiary }]}
              >
                <Text style={[styles.cellule, styles.colNumero, styles.celluleForte]}>{item.numero}</Text>
                <View style={styles.colClient}>
                  <Text style={styles.celluleForte} numberOfLines={1}>
                    {item.clientNom}
                  </Text>
                  <Text style={styles.celluleFaible}>{item.clientTelephone}</Text>
                </View>
                <Text style={[styles.cellule, styles.colAdresse]} numberOfLines={2}>
                  {item.adresse?.commune} — {item.adresse?.avenue} n° {item.adresse?.numero}
                </Text>
                <Text
                  style={[styles.cellule, styles.colLivreur, !item.livreur && { color: colors.muted }]}
                  numberOfLines={1}
                >
                  {item.livreur ? item.livreur.nom : t("admin.nonAssigne")}
                </Text>
                <View testID={`paiement-${item.numero}`} style={styles.colPaiement}>
                  <Text style={styles.cellule} numberOfLines={1}>
                    {resumePaiement(item, t).mode}
                  </Text>
                  <Text
                    style={[
                      styles.celluleFaible,
                      resumePaiement(item, t).paye && { color: colors.success, fontWeight: "800" },
                    ]}
                  >
                    {resumePaiement(item, t).statut}
                  </Text>
                </View>
                <View style={styles.colStatut}>
                  <View
                    style={[
                      styles.pastille,
                      {
                        backgroundColor:
                          item.statut === "annulee"
                            ? colors.error
                            : item.statut === "livree"
                              ? colors.success
                              : colors.brandPrimary,
                      },
                    ]}
                  >
                    <Text style={styles.pastilleTexte}>{t(`statut.${item.statut}` as CleTexte)}</Text>
                  </View>
                  {item.statut === "livree" || item.statut === "annulee" ? (
                    <Pressable
                      testID={`btn-archiver-${item.numero}`}
                      onPress={() => archiver(item)}
                      style={({ pressed }) => [styles.archiverMini, pressed && { opacity: 0.7 }]}
                    >
                      <Icone name="package" size={13} color={colors.brandPrimary} />
                      <Text style={styles.archiverTexte}>{t("commun.archiver")}</Text>
                    </Pressable>
                  ) : null}
                </View>
                <Text style={[styles.total, styles.colTotal]}>{usd(item.total)}</Text>
              </Pressable>
            ) : (
            <Pressable
              testID={`admin-commande-${item.numero}`}
              onPress={() => setOuverte(item)}
              style={({ pressed }) => [styles.carte, pressed && { backgroundColor: colors.brandTertiary }]}
            >
              <View style={styles.carteHaut}>
                <Text style={styles.numero}>{item.numero}</Text>
                <View
                  style={[
                    styles.pastille,
                    { backgroundColor: item.statut === "annulee" ? colors.error : item.statut === "livree" ? colors.success : colors.brandPrimary },
                  ]}
                >
                  <Text style={styles.pastilleTexte}>{t(`statut.${item.statut}` as CleTexte)}</Text>
                </View>
              </View>
              <Text style={styles.client}>
                {item.clientNom} · {item.clientTelephone}
              </Text>
              <Text style={styles.adresse} numberOfLines={1}>
                {item.adresse?.commune} — {item.adresse?.avenue} n° {item.adresse?.numero}
              </Text>
              <View style={styles.carteBas}>
                <View style={styles.livreurTagRow}>
                  <Icone
                    name={item.livreur ? "scooter" : "user"}
                    size={13}
                    color={item.livreur ? colors.brandPrimary : colors.muted}
                  />
                  <Text style={[styles.livreurTag, !item.livreur && { color: colors.muted }]}>
                    {item.livreur ? item.livreur.nom : t("admin.aucunLivreur")}
                  </Text>
                </View>
                <Text style={styles.total}>{usd(item.total)}</Text>
              </View>
              <View testID={`paiement-${item.numero}`} style={styles.paiementRow}>
                <Icone
                  name={resumePaiement(item, t).paye ? "check-circle" : "credit-card"}
                  size={13}
                  color={resumePaiement(item, t).paye ? colors.success : colors.muted}
                />
                <Text style={styles.paiementTexte}>
                  {resumePaiement(item, t).mode} · {resumePaiement(item, t).statut}
                </Text>
              </View>
              {item.statut === "livree" || item.statut === "annulee" ? (
                <Pressable
                  testID={`btn-archiver-${item.numero}`}
                  onPress={() => archiver(item)}
                  style={({ pressed }) => [styles.archiver, pressed && { opacity: 0.7 }]}
                >
                  <Icone name="package" size={15} color={colors.brandPrimary} />
                  <Text style={styles.archiverTexte}>{t("commun.archiver")}</Text>
                </Pressable>
              ) : null}
            </Pressable>
            )
          }
        />
      )}

      <Modal visible={!!ouverte} animationType={bureau ? "fade" : "slide"} transparent onRequestClose={() => setOuverte(null)}>
        <View style={[styles.voile, bureau && styles.voileCentre]}>
          <Pressable style={bureau ? StyleSheet.absoluteFill : { flex: 1 }} onPress={() => setOuverte(null)} />
          <View
            style={[
              styles.feuille,
              { paddingBottom: bureau ? spacing.lg : insets.bottom + spacing.lg },
              bureau && styles.dialogue,
            ]}
          >
            <ScrollView contentContainerStyle={styles.feuilleContenu}>
              <Text style={styles.feuilleTitre}>{t("admin.commande")} {ouverte?.numero}</Text>
              <Text style={styles.feuilleSous}>
                {ouverte?.clientNom} · {ouverte?.clientTelephone}
              </Text>

              <View style={styles.blocInfo}>
                <Text style={styles.blocTitre}>{t("admin.adresse")}</Text>
                <Text style={styles.blocTexte}>
                  {ouverte?.adresse?.avenue} n° {ouverte?.adresse?.numero}, {ouverte?.adresse?.commune}
                </Text>
                <Text style={styles.blocRepere}>{t("admin.repere", { repere: ouverte?.adresse?.repere ?? "" })}</Text>
              </View>

              <View style={styles.blocInfo}>
                <Text style={styles.blocTitre}>{t("admin.paiement")}</Text>
                <Text style={styles.blocTexte}>
                  {resumePaiement(ouverte, t).mode} — {resumePaiement(ouverte, t).statut}
                </Text>
              </View>

              <View style={styles.blocInfo}>
                <Text style={styles.blocTitre}>{t("admin.articles")}</Text>
                {ouverte?.items?.map((i: any, idx: number) => (
                  <Text key={idx} style={styles.blocTexte}>
                    {i.quantite}× {i.nom} {i.taille ? `(${i.taille})` : ""} — {usd(i.prixUnitaire * i.quantite)}
                  </Text>
                ))}
                <Text style={styles.blocTotal}>{t("admin.totalCash", { montant: usd(ouverte?.total ?? 0) })}</Text>
              </View>

              <View style={styles.blocInfo}>
                <Text style={styles.blocTitre}>{t("admin.assignerLivreur")}</Text>
                <View style={styles.livreursRow}>
                  {(livreursQ.data ?? [])
                    .filter((l) => l.actif)
                    .map((l) => (
                      <Pressable
                        key={l.id}
                        testID={`assigner-${l.nom}`}
                        onPress={() => assigner(l.id)}
                        style={[styles.livreurChip, ouverte?.livreurId === l.id && styles.livreurChipActif]}
                      >
                        <Text
                          style={[
                            styles.livreurChipTexte,
                            ouverte?.livreurId === l.id && { color: colors.onBrandPrimary },
                          ]}
                        >
                          {l.nom}
                        </Text>
                      </Pressable>
                    ))}
                </View>
              </View>

              <View style={styles.blocInfo}>
                <Text style={styles.blocTitre}>{t("admin.changerStatut")}</Text>
                {(SUIVANTS[ouverte?.statut] ?? []).map((s) => (
                  <Bouton
                    key={s}
                    testID={`statut-${s}`}
                    label={t(`statut.${s}` as CleTexte)}
                    variant={s === "annulee" ? "danger" : "primaire"}
                    petit
                    onPress={() => changerStatut(s)}
                    style={{ marginTop: spacing.sm }}
                  />
                ))}
              </View>

              <Bouton testID="btn-fermer-detail" label={t("admin.fermer")} variant="contour" onPress={() => setOuverte(null)} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = stylesDynamiques(() => StyleSheet.create({
  ecran: { flex: 1, backgroundColor: colors.surfaceSecondary },
  entete: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
    ...softShadow,
  },
  enteteInterieur: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    maxWidth: 1280,
    alignSelf: "center",
  },
  sousTitre: { fontFamily: fonts.text, fontSize: 11, color: colors.muted, marginTop: 2 },
  titrePage: { fontFamily: fonts.display, fontSize: 26, color: colors.onSurface },
  iconeBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  centre: { alignItems: "center", justifyContent: "center", paddingVertical: spacing.xxxl, gap: spacing.sm },
  vide: { fontFamily: fonts.text, fontSize: 14, color: colors.muted },
  liste: { padding: spacing.xl, gap: spacing.md },
  boutonAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.brandTertiary,
  },
  boutonActionTexte: { fontFamily: fonts.text, fontSize: 13, fontWeight: "800", color: colors.brandPrimary },
  barreFiltres: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  rechercheWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    height: 44,
    minWidth: 260,
    flexGrow: 1,
    flexBasis: 260,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rechercheChamp: { flex: 1, fontFamily: fonts.text, fontSize: 13, color: colors.onSurface, outlineStyle: "none" } as any,
  filtresStatut: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  filtreChip: {
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filtreChipActif: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  filtreChipTexte: { fontFamily: fonts.text, fontSize: 12, fontWeight: "700", color: colors.onSurface },
  compteur: { fontFamily: fonts.text, fontSize: 12, fontWeight: "700", color: colors.muted },
  statsRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.xs },
  statsColonne: { flexDirection: "column", flex: 1, marginBottom: 0 },
  grilleBureau: { flexDirection: "row", gap: spacing.md, alignItems: "stretch" },
  ligneEnteteTable: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  celluleEntete: { fontFamily: fonts.text, fontSize: 11, fontWeight: "800", color: colors.muted, textTransform: "uppercase" },
  ligneTable: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cellule: { fontFamily: fonts.text, fontSize: 13, color: colors.onSurface },
  celluleForte: { fontFamily: fonts.text, fontSize: 13, fontWeight: "800", color: colors.onSurface },
  celluleFaible: { fontFamily: fonts.text, fontSize: 11, color: colors.muted },
  colNumero: { width: 92 },
  colClient: { flex: 1.3 },
  colAdresse: { flex: 2 },
  colLivreur: { flex: 1.1 },
  colPaiement: { flex: 1.2 },
  colStatut: { width: 132, gap: 4, alignItems: "flex-start" },
  colTotal: { width: 88, textAlign: "right" },
  archiverMini: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.brandTertiary,
  },
  voileCentre: { justifyContent: "center", alignItems: "center", padding: spacing.xl },
  dialogue: { borderRadius: radius.xl, maxWidth: 680, width: "100%", maxHeight: "86%" },
  enteteListe: { gap: spacing.md },
  ventesCarte: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
    ...softShadow,
  },
  ventesHaut: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  ventesTitre: { fontFamily: fonts.display, fontSize: 18, color: colors.onSurface },
  ventesDate: { fontFamily: fonts.text, fontSize: 11, color: colors.muted },
  ventesChiffre: { fontFamily: fonts.display, fontSize: 34, color: colors.brandPrimary, marginTop: spacing.sm },
  ventesChiffreFc: { fontFamily: fonts.text, fontSize: 12, color: colors.muted },
  ventesLigne: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  ventesMini: {
    flex: 1,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  ventesMiniValeur: { fontFamily: fonts.display, fontSize: 17, color: colors.onSurface },
  ventesMiniLabel: { fontFamily: fonts.text, fontSize: 11, color: colors.muted },
  topTitre: { fontFamily: fonts.display, fontSize: 15, color: colors.onSurface, marginTop: spacing.lg },
  topVide: { fontFamily: fonts.text, fontSize: 12, color: colors.muted },
  topLigne: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm },
  rang: {
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  rangTexte: { fontFamily: fonts.display, fontSize: 12, color: colors.brandPrimary },
  topNom: { flex: 1, fontFamily: fonts.text, fontSize: 13, fontWeight: "700", color: colors.onSurface },
  topQte: { fontFamily: fonts.text, fontSize: 12, color: colors.muted, fontWeight: "700" },
  topMontant: { fontFamily: fonts.display, fontSize: 14, color: colors.onSurface, minWidth: 54, textAlign: "right" },
  statCarte: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  statValeur: { fontFamily: fonts.display, fontSize: 19 },
  statCarteBureau: {
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: "auto",
    alignItems: "flex-start",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    ...softShadow,
  },
  statLabel: { fontFamily: fonts.text, fontSize: 11, color: colors.muted },
  carte: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    ...softShadow,
  },
  carteHaut: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  numero: { fontFamily: fonts.display, fontSize: 17, color: colors.onSurface },
  paiementRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  paiementTexte: { fontFamily: fonts.text, fontSize: 12, fontWeight: "700", color: colors.muted },
  pastille: { paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.pill },
  pastilleTexte: { fontFamily: fonts.text, fontSize: 11, fontWeight: "800", color: colors.onBrandPrimary },
  client: { fontFamily: fonts.text, fontSize: 13, fontWeight: "700", color: colors.onSurface },
  adresse: { fontFamily: fonts.text, fontSize: 12, color: colors.muted },
  carteBas: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.xs },
  livreurTagRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, flex: 1 },
  livreurTag: { fontFamily: fonts.text, fontSize: 12, color: colors.brandPrimary, fontWeight: "700" },
  total: { fontFamily: fonts.display, fontSize: 17, color: colors.onSurface },
  archiver: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 44,
    marginTop: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.brandTertiary,
  },
  archiverTexte: { fontFamily: fonts.text, fontSize: 13, fontWeight: "700", color: colors.brandPrimary },
  voile: { flex: 1, backgroundColor: "rgba(42,23,33,0.45)", justifyContent: "flex-end" },
  feuille: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: "88%",
  },
  feuilleContenu: { padding: spacing.xl, gap: spacing.md },
  feuilleTitre: { fontFamily: fonts.display, fontSize: 22, color: colors.onSurface },
  feuilleSous: { fontFamily: fonts.text, fontSize: 13, color: colors.muted, marginTop: -spacing.sm },
  blocInfo: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  blocTitre: { fontFamily: fonts.display, fontSize: 15, color: colors.onSurface, marginBottom: spacing.xs },
  blocTexte: { fontFamily: fonts.text, fontSize: 13, color: colors.onSurface },
  blocRepere: { fontFamily: fonts.text, fontSize: 13, fontWeight: "800", color: colors.brandPrimary },
  blocTotal: { fontFamily: fonts.display, fontSize: 16, color: colors.brandPrimary, marginTop: spacing.sm },
  livreursRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  livreurChip: {
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  livreurChipActif: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  livreurChipTexte: { fontFamily: fonts.text, fontSize: 13, fontWeight: "700", color: colors.onSurface },
}));
