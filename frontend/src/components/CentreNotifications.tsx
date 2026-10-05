import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Bouton } from "@/src/components/Bouton";
import { Icone } from "@/src/components/Icone";
import { SelectionBar, SelectionHeader, ToggleSelection, useListeSelection } from "@/src/components/ListeSelection";
import { useLangue } from "@/src/i18n";
import {
  effacerNotifications,
  marquerLues,
  supprimerNotifications,
  useNotifications,
  type NotificationApp,
} from "@/src/notifications";
import { useEcran } from "@/src/reactif";
import { colors, fonts, radius, spacing, stylesDynamiques } from "@/src/theme";
import { useToast } from "@/src/toast";

type Donnees = { notifications: NotificationApp[]; nonLues: number };

const ICONES: Record<NotificationApp["type"], string> = {
  commande: "shopping-bag",
  paiement: "dollar-sign",
  promotion: "gift",
  admin: "receipt",
  course: "scooter",
};

/**
 * Cloche + centre de notifications (tous rôles). `cote` place le panneau près
 * de la cloche sur grand écran (barre latérale à gauche, en-tête à droite).
 */
export function CentreNotifications({ cote = "droite" }: { cote?: "gauche" | "droite" }) {
  const { t, langue } = useLangue();
  const router = useRouter();
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();
  const { bureau } = useEcran();
  const toast = useToast();
  const q = useNotifications();
  const [ouvert, setOuvert] = useState(false);
  const [modeSelection, setModeSelection] = useState(false);
  const [confirmation, setConfirmation] = useState<"tout" | "selection" | null>(null);
  const nonLues = q.data?.nonLues ?? 0;
  const liste = q.data?.notifications ?? [];
  const selection = useListeSelection(liste.map((n) => n.id));

  const fermer = () => {
    setOuvert(false);
    setModeSelection(false);
    setConfirmation(null);
    selection.clear();
  };

  // Mise à jour immédiate de l'écran ; le serveur fait foi (rechargement en cas d'échec).
  const modifierLocal = (maj: (liste: NotificationApp[]) => NotificationApp[]) =>
    qc.setQueryData<Donnees>(["notifications"], (d) => {
      if (!d) return d;
      const suivante = maj(d.notifications);
      return { notifications: suivante, nonLues: suivante.filter((n) => !n.lu).length };
    });

  const ilYA = (iso: string) => {
    // Référence : l'heure du dernier rafraîchissement (rendu pur, mis à jour toutes les 15 s).
    const minutes = Math.max(0, Math.round((q.dataUpdatedAt - new Date(iso).getTime()) / 60000));
    if (minutes < 1) return t("notifs.aLInstant");
    if (minutes < 60) return t("notifs.ilYAMin", { n: minutes });
    if (minutes < 24 * 60) return t("notifs.ilYAH", { n: Math.round(minutes / 60) });
    return new Date(iso).toLocaleDateString(langue === "en" ? "en-GB" : "fr-FR", { day: "numeric", month: "short" });
  };

  const rafraichir = () => qc.invalidateQueries({ queryKey: ["notifications"] });

  const ouvrir = (n: NotificationApp) => {
    if (modeSelection) {
      selection.toggle(n.id);
      return;
    }
    fermer();
    if (!n.lu) {
      modifierLocal((l) => l.map((x) => (x.id === n.id ? { ...x, lu: true } : x)));
      marquerLues([n.id]).then(rafraichir, rafraichir);
    }
    router.push(n.lien as any);
  };

  const toutLire = () => {
    modifierLocal((l) => l.map((x) => ({ ...x, lu: true })));
    marquerLues().then(rafraichir, rafraichir);
  };

  const supprimer = async (ids: string[]) => {
    if (!ids.length) return;
    const retirees = new Set(ids);
    modifierLocal((l) => l.filter((x) => !retirees.has(x.id)));
    selection.clear();
    try {
      await supprimerNotifications(ids);
      if (ids.length > 1) toast.show(t("notifs.supprimees", { n: ids.length }), "succes");
    } catch (e: any) {
      toast.show(e.message, "erreur");
    }
    rafraichir();
  };

  const toutEffacer = async () => {
    modifierLocal(() => []);
    setConfirmation(null);
    setModeSelection(false);
    try {
      await effacerNotifications();
      toast.show(t("notifs.toutEfface"), "succes");
    } catch (e: any) {
      toast.show(e.message, "erreur");
    }
    rafraichir();
  };

  return (
    <>
      <Pressable
        testID="btn-notifications"
        accessibilityRole="button"
        accessibilityLabel={nonLues ? t("notifs.titreNonLues", { n: nonLues }) : t("notifs.titre")}
        onPress={() => setOuvert(true)}
        hitSlop={6}
        style={({ pressed }) => [styles.cloche, pressed && { backgroundColor: colors.brandTertiary }]}
      >
        <Icone name="bell" size={20} color={colors.onSurface} />
        {nonLues > 0 ? (
          <View testID="badge-notifications" style={styles.badge}>
            <Text style={styles.badgeTexte}>{nonLues > 9 ? "9+" : nonLues}</Text>
          </View>
        ) : null}
      </Pressable>

      <Modal visible={ouvert} transparent animationType="fade" onRequestClose={fermer}>
        <Pressable style={styles.voile} onPress={fermer}>
          <Pressable
            testID="centre-notifications"
            onPress={() => undefined}
            style={[
              styles.panneau,
              bureau
                ? [styles.panneauBureau, cote === "gauche" ? styles.panneauGauche : styles.panneauDroite]
                : [styles.panneauMobile, { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom }],
            ]}
          >
            <View style={styles.entete}>
              <Text style={styles.titre}>{t("notifs.titre")}</Text>
              <Pressable testID="btn-fermer-notifications" onPress={fermer} style={styles.fermer}>
                <Icone name="x" size={20} color={colors.muted} />
              </Pressable>
            </View>

            {liste.length > 0 ? (
              <View style={styles.actions}>
                {modeSelection ? (
                  <>
                    <SelectionHeader
                      checked={selection.allSelected}
                      onToggle={selection.toggleAll}
                      totalCount={selection.totalCount}
                    />
                    <View style={{ flex: 1 }} />
                    <Pressable
                      testID="btn-terminer-selection"
                      onPress={() => {
                        setModeSelection(false);
                        selection.clear();
                      }}
                      style={styles.action}
                    >
                      <Text style={styles.lien}>{t("notifs.terminer")}</Text>
                    </Pressable>
                  </>
                ) : (
                  <>
                    {nonLues > 0 ? (
                      <Pressable testID="btn-tout-lire" onPress={toutLire} style={styles.action}>
                        <Text style={styles.lien}>{t("notifs.toutLire")}</Text>
                      </Pressable>
                    ) : null}
                    <Pressable testID="btn-selectionner-notifications" onPress={() => setModeSelection(true)} style={styles.action}>
                      <Text style={styles.lien}>{t("notifs.selectionner")}</Text>
                    </Pressable>
                    <Pressable testID="btn-tout-effacer" onPress={() => setConfirmation("tout")} style={styles.action}>
                      <Text style={[styles.lien, { color: colors.error }]}>{t("notifs.toutEffacer")}</Text>
                    </Pressable>
                  </>
                )}
              </View>
            ) : null}

            {confirmation ? (
              <View testID="confirmation-notifications" style={styles.confirmation}>
                <Text style={styles.confirmationTexte}>
                  {confirmation === "tout"
                    ? t("notifs.confirmerToutEffacer")
                    : t("notifs.confirmerSelection", { n: selection.selectedIds.length })}
                </Text>
                <View style={styles.confirmationBoutons}>
                  <Bouton label={t("commun.annuler")} variant="contour" petit onPress={() => setConfirmation(null)} />
                  <Bouton
                    testID="btn-confirmer-suppression-notifications"
                    label={confirmation === "tout" ? t("notifs.toutEffacer") : t("commun.supprimer")}
                    variant="danger"
                    petit
                    onPress={() => {
                      if (confirmation === "tout") void toutEffacer();
                      else {
                        setConfirmation(null);
                        void supprimer(selection.selectedIds);
                      }
                    }}
                  />
                </View>
              </View>
            ) : null}

            <FlatList
              data={liste}
              keyExtractor={(n) => n.id}
              contentContainerStyle={[styles.liste, modeSelection && { paddingBottom: 140 }]}
              ListEmptyComponent={<Text style={styles.vide}>{t("notifs.vide")}</Text>}
              renderItem={({ item: n }) => (
                <Pressable
                  testID={`notification-${n.id}`}
                  onPress={() => ouvrir(n)}
                  style={({ pressed }) => [styles.item, !n.lu && styles.itemNonLu, pressed && { opacity: 0.8 }]}
                >
                  {modeSelection ? (
                    <ToggleSelection
                      checked={selection.selectedIds.includes(n.id)}
                      onToggle={() => selection.toggle(n.id)}
                      testID={`selection-notification-${n.id}`}
                    />
                  ) : (
                    <View style={styles.icone}>
                      <Icone name={ICONES[n.type] ?? "info"} size={16} color={colors.brandPrimary} />
                    </View>
                  )}
                  <View style={styles.texte}>
                    <Text style={styles.itemTitre}>{n.titre}</Text>
                    <Text style={styles.itemMessage}>{n.message}</Text>
                    <Text style={styles.itemDate}>{ilYA(n.createdAt)}</Text>
                  </View>
                  {!n.lu ? <View style={styles.point} /> : null}
                  {!modeSelection ? (
                    <Pressable
                      testID={`btn-supprimer-notification-${n.id}`}
                      accessibilityLabel={t("notifs.supprimer")}
                      onPress={(e) => {
                        e.stopPropagation();
                        void supprimer([n.id]);
                      }}
                      style={styles.corbeille}
                    >
                      <Icone name="trash-2" size={16} color={colors.muted} />
                    </Pressable>
                  ) : null}
                </Pressable>
              )}
            />
            {modeSelection ? (
              <SelectionBar
                selectedCount={selection.selectedIds.length}
                onClear={selection.clear}
                onDelete={() => setConfirmation("selection")}
                bottomOffset={spacing.md + (bureau ? 0 : insets.bottom)}
              />
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = stylesDynamiques(() =>
  StyleSheet.create({
    cloche: {
      width: 44,
      height: 44,
      borderRadius: radius.pill,
      alignItems: "center",
      justifyContent: "center",
    },
    badge: {
      position: "absolute",
      top: 3,
      right: 2,
      minWidth: 18,
      height: 18,
      paddingHorizontal: 4,
      borderRadius: 9,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.brandPrimary,
      borderWidth: 2,
      borderColor: colors.surface,
    },
    badgeTexte: { fontFamily: fonts.text, fontSize: 9, fontWeight: "800", color: colors.onBrandPrimary },
    voile: { flex: 1, backgroundColor: "rgba(42,23,33,0.35)" },
    panneau: { backgroundColor: colors.surface, overflow: "hidden" },
    panneauBureau: {
      position: "absolute",
      top: 64,
      width: 380,
      maxHeight: "75%",
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.border,
    },
    panneauDroite: { right: spacing.xl },
    panneauGauche: { left: 264, top: spacing.lg },
    panneauMobile: { flex: 1, marginTop: 0 },
    entete: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.md,
      paddingTop: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    titre: { flex: 1, fontFamily: fonts.display, fontSize: 18, color: colors.onSurface },
    fermer: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
    actions: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      columnGap: spacing.md,
      paddingHorizontal: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    action: { minHeight: 44, justifyContent: "center" },
    confirmation: {
      margin: spacing.md,
      padding: spacing.md,
      gap: spacing.sm,
      borderRadius: radius.lg,
      backgroundColor: colors.errorSoft,
    },
    confirmationTexte: { fontFamily: fonts.text, fontSize: 13, fontWeight: "700", color: colors.onSurface },
    confirmationBoutons: { flexDirection: "row", justifyContent: "flex-end", gap: spacing.sm },
    corbeille: { width: 44, height: 44, alignItems: "center", justifyContent: "center", marginRight: -spacing.sm },
    lien: { fontFamily: fonts.text, fontSize: 12, fontWeight: "800", color: colors.brandPrimary },
    liste: { padding: spacing.sm, gap: spacing.xs },
    vide: { fontFamily: fonts.text, fontSize: 13, color: colors.muted, textAlign: "center", padding: spacing.xl },
    item: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: spacing.md,
      padding: spacing.md,
      borderRadius: radius.lg,
    },
    itemNonLu: { backgroundColor: colors.brandTertiary },
    icone: {
      width: 32,
      height: 32,
      borderRadius: radius.pill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceSecondary,
    },
    texte: { flex: 1, gap: 2 },
    itemTitre: { fontFamily: fonts.text, fontSize: 14, fontWeight: "800", color: colors.onSurface },
    itemMessage: { fontFamily: fonts.text, fontSize: 13, color: colors.onSurface },
    itemDate: { fontFamily: fonts.text, fontSize: 11, color: colors.muted },
    point: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brandPrimary, marginTop: 6 },
  }),
);
