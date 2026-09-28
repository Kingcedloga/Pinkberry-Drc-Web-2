import { Chargement } from "@/src/components/Chargement";
import { Icone } from "@/src/components/Icone";
import { BulkDeleteDialog, SelectionBar, SelectionHeader, ToggleSelection, useListeSelection } from "@/src/components/ListeSelection";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { apiFetch } from "@/src/api";
import { useAuth } from "@/src/auth";
import { CarteNotifications } from "@/src/components/CarteNotifications";
import { usd } from "@/src/money";
import { TitrePage } from "@/src/components/TitrePage";
import { useLangue } from "@/src/i18n";
import { LARGEUR_LARGE, useEcran } from "@/src/reactif";
import { colors, fonts, poids, radius, softShadow, spacing, stylesDynamiques } from "@/src/theme";
import { useTheme } from "@/src/theme-contexte";
import { useToast } from "@/src/toast";

export default function Courses() {
  useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const toast = useToast();
  const { t } = useLangue();
  const qc = useQueryClient();
  const { colonnes } = useEcran();
  const cols = Math.min(colonnes, 3);

  const q = useQuery({
    queryKey: ["livreur-courses"],
    queryFn: () => apiFetch<any[]>("/livreur/courses"),
    refetchInterval: 5000,
  });
  const [confirmerArchivageMultiple, setConfirmerArchivageMultiple] = useState(false);

  const archiver = async (id: string) => {
    try {
      await apiFetch(`/livreur/courses/${id}/archiver`, { method: "POST" });
      qc.invalidateQueries({ queryKey: ["livreur-courses"] });
      qc.invalidateQueries({ queryKey: ["livreur-archives"] });
      toast.show(t("livreur.archivee"), "succes");
    } catch (e: any) {
      toast.show(e.message, "erreur");
    }
  };

  const actives = (q.data ?? []).filter((c) => !["livree", "annulee"].includes(c.statut));
  const terminees = (q.data ?? []).filter((c) => ["livree", "annulee"].includes(c.statut));
  const toutes = [...actives, ...terminees];
  const selection = useListeSelection(terminees.map((c) => c.id));

  const archiverSelection = async () => {
    try {
      const count = selection.selectedIds.length;
      await apiFetch("/livreur/courses/bulk/archive", { method: "POST", body: { ids: selection.selectedIds } });
      selection.clear();
      setConfirmerArchivageMultiple(false);
      await qc.invalidateQueries({ queryKey: ["livreur-courses"] });
      await qc.invalidateQueries({ queryKey: ["livreur-archives"] });
      toast.show(`${count} course(s) archivée(s)`, "succes");
    } catch (e: any) {
      toast.show(e.message, "erreur");
    }
  };
  const reste = cols > 1 ? toutes.length % cols : 0;
  const donnees =
    reste === 0
      ? toutes
      : [...toutes, ...Array.from({ length: cols - reste }, (_, i) => ({ id: `vide-${i}`, vide: true }))];

  return (
    <View testID="ecran-livreur-courses" style={styles.ecran}>
      {q.isLoading ? (
        <View style={styles.centre}>
          <Chargement taille={52} />
        </View>
      ) : (
        <FlatList
          testID="liste-courses"
          data={donnees}
          keyExtractor={(c) => c.id}
          contentContainerStyle={[styles.liste, LARGEUR_LARGE]}
          key={`courses-${cols}`}
          numColumns={cols}
          columnWrapperStyle={cols > 1 ? styles.rangeeGrille : undefined}
          refreshing={q.isRefetching}
          onRefresh={() => q.refetch()}
          ListHeaderComponent={
            <View style={styles.enteteListe}>
              <TitrePage titre={t("livreur.courses")} sousTitre={user?.nom ?? undefined} />
              <View style={styles.kpis}>
                <View testID="kpi-actives" style={styles.kpi}>
                  <Text style={styles.kpiValeur}>{actives.length}</Text>
                  <Text style={styles.kpiLabel}>{t("livreur.coursEnCours")}</Text>
                </View>
                <View testID="kpi-terminees" style={styles.kpi}>
                  <Text style={[styles.kpiValeur, { color: colors.success }]}>{terminees.length}</Text>
                  <Text style={styles.kpiLabel}>{t("livreur.coursTerminees")}</Text>
                </View>
                <View testID="kpi-encaisse" style={styles.kpi}>
                  <Text style={styles.kpiValeur}>{usd(actives.reduce((t, c) => t + (c.total ?? 0), 0))}</Text>
                  <Text style={styles.kpiLabel}>{t("livreur.aEncaisser")}</Text>
                </View>
              </View>
              <CarteNotifications texte={t("livreur.notifications")} />
              {terminees.length > 0 ? (
                <SelectionHeader checked={selection.allSelected} onToggle={selection.toggleAll} count={terminees.length} />
              ) : null}
            </View>
          }
          ListEmptyComponent={
            <View style={styles.centre}>
              <Icone name="scooter" size={46} color={colors.brandTertiary} />
              <Text style={styles.vide}>{t("livreur.vide")}</Text>
              <Text style={styles.videSous}>{t("livreur.videDetail")}</Text>
            </View>
          }
          renderItem={({ item }) =>
            (item as any).vide ? (
              <View style={styles.carteGrille} />
            ) : (
            <Pressable
              testID={`course-${item.numero}`}
              onPress={() => router.push(`/livreur/course/${item.id}`)}
              style={({ pressed }) => [
                styles.carte,
                cols > 1 && styles.carteGrille,
                pressed && { backgroundColor: colors.brandTertiary },
              ]}
            >
              {terminees.some((c) => c.id === item.id) ? (
                <ToggleSelection
                  checked={selection.selectedIds.includes(item.id)}
                  onToggle={() => selection.toggle(item.id)}
                  testID={`selection-course-${item.numero}`}
                />
              ) : null}
              <View style={styles.carteHaut}>
                <Text style={styles.numero}>{item.numero}</Text>
                <View
                  style={[
                    styles.pastille,
                    {
                      backgroundColor:
                        item.statut === "en_route"
                          ? colors.success
                          : item.statut === "livree"
                            ? colors.success
                            : item.statut === "annulee"
                              ? colors.error
                              : colors.brandPrimary,
                    },
                  ]}
                >
                  <Text style={styles.pastilleTexte}>{t(`statut.${item.statut}` as any)}</Text>
                </View>
              </View>
              <Text style={styles.client}>{item.clientNom}</Text>
              <Text style={styles.adresse}>
                {item.adresse?.commune} — {item.adresse?.avenue} n° {item.adresse?.numero}
              </Text>
              <View style={styles.repereRow}>
                <Icone name="map-pin" size={13} color={colors.brandPrimary} />
                <Text style={styles.repere} numberOfLines={2}>
                  {item.adresse?.repere}
                </Text>
              </View>
              <View style={styles.carteBas}>
                <Text style={styles.items} numberOfLines={1}>
                  {item.items.map((i: any) => `${i.quantite}× ${i.nom}`).join(", ")}
                </Text>
                <Text style={styles.montant}>{usd(item.total)}</Text>
              </View>
              {["livree", "annulee"].includes(item.statut) ? (
                <Pressable
                  testID={`btn-archiver-course-${item.numero}`}
                  onPress={() => archiver(item.id)}
                  style={styles.archiver}
                >
                  <Icone name="archive" size={16} color={colors.brandPrimary} />
                  <Text style={styles.archiverTexte}>{t("commun.archiver")}</Text>
                </Pressable>
              ) : null}
            </Pressable>
            )
          }
        />
      )}
      <SelectionBar
        selectedCount={selection.selectedIds.length}
        onClear={selection.clear}
        deleteLabel={t("commun.archiver")}
        onDelete={() => setConfirmerArchivageMultiple(true)}
      />
      <BulkDeleteDialog
        visible={confirmerArchivageMultiple}
        count={selection.selectedIds.length}
        title={`Archiver ${selection.selectedIds.length} course${selection.selectedIds.length > 1 ? "s" : ""} ?`}
        confirmLabel="Archiver les courses"
        description="Seules les courses terminées peuvent être archivées. Elles resteront dans les rapports de la boutique."
        onCancel={() => setConfirmerArchivageMultiple(false)}
        onConfirm={archiverSelection}
      />
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
  titre: { fontFamily: fonts.display, fontSize: 24, color: colors.onSurface },
  sous: { fontFamily: fonts.text, fontSize: 12, color: colors.muted },
  iconeBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  centre: { alignItems: "center", justifyContent: "center", paddingVertical: spacing.xxxl, gap: spacing.xs },
  vide: { fontFamily: fonts.text, fontSize: 15, fontWeight: "700", color: colors.onSurface },
  videSous: { fontFamily: fonts.text, fontSize: 12, color: colors.muted },
  videEmoji: { fontSize: 46 },
  liste: { padding: spacing.xl, gap: spacing.md },
  enteteListe: { gap: spacing.lg, marginBottom: spacing.xs },
  kpis: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  kpi: {
    flexGrow: 1,
    flexBasis: 180,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  kpiValeur: { fontFamily: fonts.display, fontSize: 26, color: colors.brandPrimary },
  kpiLabel: { fontFamily: fonts.text, fontSize: 12, color: colors.muted, fontWeight: "700" },
  rangeeGrille: { gap: spacing.md, alignItems: "stretch" },
  carteGrille: { flex: 1 },
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
  pastille: { paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.pill },
  pastilleTexte: { fontFamily: fonts.text, fontSize: 11, fontWeight: "800", color: colors.onBrandPrimary },
  client: { fontFamily: fonts.text, fontSize: 14, fontWeight: "800", color: colors.onSurface },
  adresse: { fontFamily: fonts.text, fontSize: 12, color: colors.muted },
  repereRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  repere: { flex: 1, fontFamily: fonts.text, fontSize: 12, color: colors.brandPrimary, fontWeight: "700" },
  carteBas: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  items: { flex: 1, fontFamily: fonts.text, fontSize: 12, color: colors.onSurface },
  montant: { fontFamily: fonts.display, fontSize: 18, color: colors.brandPrimary },
  enteteActions: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  archiver: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    minHeight: 44,
    marginTop: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSecondary,
  },
  archiverTexte: { fontFamily: fonts.text, fontSize: 13, fontWeight: poids.fort, color: colors.brandPrimary },
}));
