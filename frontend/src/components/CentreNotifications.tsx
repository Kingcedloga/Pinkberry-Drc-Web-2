import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icone } from "@/src/components/Icone";
import { useLangue } from "@/src/i18n";
import { marquerLues, useNotifications, type NotificationApp } from "@/src/notifications";
import { useEcran } from "@/src/reactif";
import { colors, fonts, radius, spacing, stylesDynamiques } from "@/src/theme";

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
  const q = useNotifications();
  const [ouvert, setOuvert] = useState(false);
  const nonLues = q.data?.nonLues ?? 0;
  const liste = q.data?.notifications ?? [];

  const ilYA = (iso: string) => {
    // Référence : l'heure du dernier rafraîchissement (rendu pur, mis à jour toutes les 15 s).
    const minutes = Math.max(0, Math.round((q.dataUpdatedAt - new Date(iso).getTime()) / 60000));
    if (minutes < 1) return t("notifs.aLInstant");
    if (minutes < 60) return t("notifs.ilYAMin", { n: minutes });
    if (minutes < 24 * 60) return t("notifs.ilYAH", { n: Math.round(minutes / 60) });
    return new Date(iso).toLocaleDateString(langue === "en" ? "en-GB" : "fr-FR", { day: "numeric", month: "short" });
  };

  const rafraichir = () => qc.invalidateQueries({ queryKey: ["notifications"] });

  const ouvrir = async (n: NotificationApp) => {
    setOuvert(false);
    if (!n.lu) marquerLues([n.id]).then(rafraichir, () => undefined);
    router.push(n.lien as any);
  };

  const toutLire = async () => {
    await marquerLues().catch(() => undefined);
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

      <Modal visible={ouvert} transparent animationType="fade" onRequestClose={() => setOuvert(false)}>
        <Pressable style={styles.voile} onPress={() => setOuvert(false)}>
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
              {nonLues > 0 ? (
                <Pressable testID="btn-tout-lire" onPress={toutLire} hitSlop={6}>
                  <Text style={styles.lien}>{t("notifs.toutLire")}</Text>
                </Pressable>
              ) : null}
              <Pressable testID="btn-fermer-notifications" onPress={() => setOuvert(false)} hitSlop={8}>
                <Icone name="x" size={20} color={colors.muted} />
              </Pressable>
            </View>
            <FlatList
              data={liste}
              keyExtractor={(n) => n.id}
              contentContainerStyle={styles.liste}
              ListEmptyComponent={<Text style={styles.vide}>{t("notifs.vide")}</Text>}
              renderItem={({ item: n }) => (
                <Pressable
                  testID={`notification-${n.id}`}
                  onPress={() => ouvrir(n)}
                  style={({ pressed }) => [styles.item, !n.lu && styles.itemNonLu, pressed && { opacity: 0.8 }]}
                >
                  <View style={styles.icone}>
                    <Icone name={ICONES[n.type] ?? "info"} size={16} color={colors.brandPrimary} />
                  </View>
                  <View style={styles.texte}>
                    <Text style={styles.itemTitre}>{n.titre}</Text>
                    <Text style={styles.itemMessage}>{n.message}</Text>
                    <Text style={styles.itemDate}>{ilYA(n.createdAt)}</Text>
                  </View>
                  {!n.lu ? <View style={styles.point} /> : null}
                </Pressable>
              )}
            />
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
