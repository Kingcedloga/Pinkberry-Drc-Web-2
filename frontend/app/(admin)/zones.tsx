import { useQuery, useQueryClient } from "@tanstack/react-query";
import React from "react";
import { ActivityIndicator, FlatList, StyleSheet, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { apiFetch } from "@/src/api";
import { hauteurOngletsNatifs } from "@/src/nav";
import { colors, fonts, radius, softShadow, spacing } from "@/src/theme";
import { useToast } from "@/src/toast";

export default function Zones() {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["zones"], queryFn: () => apiFetch<any[]>("/zones") });

  const basculer = async (zone: any, active: boolean) => {
    try {
      await apiFetch(`/admin/zones/${zone.id}`, { method: "PUT", body: { active } });
      qc.invalidateQueries({ queryKey: ["zones"] });
      toast.show(active ? `On livre maintenant à ${zone.commune}` : `Livraison suspendue à ${zone.commune}`, "succes");
    } catch (e: any) {
      toast.show(e.message, "erreur");
    }
  };

  return (
    <View testID="ecran-admin-zones" style={styles.ecran}>
      <View style={[styles.entete, { paddingTop: insets.top + spacing.lg }]}>
        <Text style={styles.titre}>Zones de livraison</Text>
        <Text style={styles.sous}>Cochez les communes couvertes. Les autres sont refusées automatiquement.</Text>
      </View>

      {q.isLoading ? (
        <View style={styles.centre}>
          <ActivityIndicator color={colors.brandPrimary} size="large" />
        </View>
      ) : (
        <FlatList
          testID="liste-zones"
          data={q.data ?? []}
          keyExtractor={(z) => z.id}
          contentContainerStyle={[styles.liste, { paddingBottom: spacing.xl + hauteurOngletsNatifs(insets.bottom) }]}
          refreshing={q.isRefetching}
          onRefresh={() => q.refetch()}
          renderItem={({ item }) => (
            <View testID={`zone-${item.commune}`} style={styles.carte}>
              <View style={styles.texte}>
                <Text style={styles.nom}>{item.commune}</Text>
                <Text style={[styles.etat, { color: item.active ? colors.success : colors.muted }]}>
                  {item.active ? "Couverte" : "Non couverte"}
                </Text>
              </View>
              <Switch
                testID={`switch-zone-${item.commune}`}
                value={item.active}
                onValueChange={(v) => basculer(item, v)}
                trackColor={{ true: colors.success, false: colors.border }}
              />
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: colors.surfaceSecondary },
  entete: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.xs },
  titre: { fontFamily: fonts.display, fontSize: 26, color: colors.onSurface },
  sous: { fontFamily: fonts.text, fontSize: 12, color: colors.muted },
  centre: { alignItems: "center", justifyContent: "center", paddingVertical: spacing.xxxl },
  liste: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: spacing.sm },
  carte: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...softShadow,
  },
  texte: { gap: 2 },
  nom: { fontFamily: fonts.display, fontSize: 16, color: colors.onSurface },
  etat: { fontFamily: fonts.text, fontSize: 11, fontWeight: "800" },
});
