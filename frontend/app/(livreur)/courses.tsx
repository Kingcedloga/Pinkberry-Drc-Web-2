import { Chargement } from "@/src/components/Chargement";
import { Icone } from "@/src/components/Icone";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { apiFetch } from "@/src/api";
import { useAuth } from "@/src/auth";
import { CarteNotifications } from "@/src/components/CarteNotifications";
import { usd } from "@/src/money";
import { colors, fonts, poids, radius, softShadow, spacing, stylesDynamiques } from "@/src/theme";
import { useTheme } from "@/src/theme-contexte";
import { useToast } from "@/src/toast";

const LIBELLES: Record<string, string> = {
  recue: "À récupérer",
  en_preparation: "À récupérer",
  recuperee: "Course récupérée",
  en_route: "En route",
  livree: "Livrée",
  annulee: "Annulée",
};

export default function Courses() {
  useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, deconnexion } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["livreur-courses"],
    queryFn: () => apiFetch<any[]>("/livreur/courses"),
    refetchInterval: 5000,
  });

  const archiver = async (id: string) => {
    try {
      await apiFetch(`/livreur/courses/${id}/archiver`, { method: "POST" });
      qc.invalidateQueries({ queryKey: ["livreur-courses"] });
      qc.invalidateQueries({ queryKey: ["livreur-archives"] });
      toast.show("Course archivée", "succes");
    } catch (e: any) {
      toast.show(e.message, "erreur");
    }
  };

  const actives = (q.data ?? []).filter((c) => !["livree", "annulee"].includes(c.statut));
  const terminees = (q.data ?? []).filter((c) => ["livree", "annulee"].includes(c.statut));

  return (
    <View testID="ecran-livreur-courses" style={styles.ecran}>
      <View style={[styles.entete, { paddingTop: insets.top + spacing.md }]}>
        <View>
          <Text style={styles.titre}>Mes courses</Text>
          <Text style={styles.sous}>{user?.nom}</Text>
        </View>
        <View style={styles.enteteActions}>
          <Pressable
            testID="btn-livreur-rapports"
            onPress={() => router.push("/livreur/rapports")}
            style={styles.iconeBtn}
          >
            <Icone name="download" size={20} color={colors.brandPrimary} />
          </Pressable>
          <Pressable
            testID="btn-livreur-archives"
            onPress={() => router.push("/livreur/archives")}
            style={styles.iconeBtn}
          >
            <Icone name="archive" size={20} color={colors.brandPrimary} />
          </Pressable>
          <Pressable
            testID="btn-livreur-parametres"
            onPress={() => router.push("/livreur/parametres")}
            style={styles.iconeBtn}
          >
            <Icone name="settings" size={20} color={colors.brandPrimary} />
          </Pressable>
          <Pressable
            testID="btn-livreur-deconnexion"
          onPress={async () => {
            await deconnexion();
            router.replace("/bienvenue");
          }}
            style={styles.iconeBtn}
          >
            <Icone name="log-out" size={20} color={colors.brandPrimary} />
          </Pressable>
        </View>
      </View>

      {q.isLoading ? (
        <View style={styles.centre}>
          <Chargement taille={52} />
        </View>
      ) : (
        <FlatList
          testID="liste-courses"
          data={[...actives, ...terminees]}
          keyExtractor={(c) => c.id}
          contentContainerStyle={styles.liste}
          refreshing={q.isRefetching}
          onRefresh={() => q.refetch()}
          ListHeaderComponent={
            <CarteNotifications texte="Activez-les pour recevoir vos nouvelles courses, même app fermée." />
          }
          ListEmptyComponent={
            <View style={styles.centre}>
              <Icone name="scooter" size={46} color={colors.brandTertiary} />
              <Text style={styles.vide}>Aucune course assignée</Text>
              <Text style={styles.videSous}>En attente d&apos;une assignation de l&apos;administrateur</Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              testID={`course-${item.numero}`}
              onPress={() => router.push(`/course/${item.id}`)}
              style={({ pressed }) => [styles.carte, pressed && { backgroundColor: colors.brandTertiary }]}
            >
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
                  <Text style={styles.pastilleTexte}>{LIBELLES[item.statut]}</Text>
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
                  <Text style={styles.archiverTexte}>Archiver</Text>
                </Pressable>
              ) : null}
            </Pressable>
          )}
        />
      )}
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
    backgroundColor: colors.surface,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
    ...softShadow,
  },
  titre: { fontFamily: fonts.display, fontSize: 24, color: colors.onSurface },
  sous: { fontFamily: fonts.text, fontSize: 12, color: colors.muted },
  iconeBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  centre: { alignItems: "center", justifyContent: "center", paddingVertical: spacing.xxxl, gap: spacing.xs },
  vide: { fontFamily: fonts.text, fontSize: 15, fontWeight: "700", color: colors.onSurface },
  videSous: { fontFamily: fonts.text, fontSize: 12, color: colors.muted },
  videEmoji: { fontSize: 46 },
  liste: { padding: spacing.lg, gap: spacing.md },
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
