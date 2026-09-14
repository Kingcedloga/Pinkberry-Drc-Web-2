import { Icone } from "@/src/components/Icone";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { ActivityIndicator, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { apiFetch } from "@/src/api";
import { useAuth } from "@/src/auth";
import { Bouton } from "@/src/components/Bouton";
import { Logo } from "@/src/components/Logo";
import { usd } from "@/src/money";
import { colors, fonts, radius, softShadow, spacing } from "@/src/theme";
import { useToast } from "@/src/toast";

const LIBELLES: Record<string, string> = {
  recue: "Reçue",
  en_preparation: "En préparation",
  recuperee: "Récupérée",
  en_route: "En route",
  livree: "Livrée",
  annulee: "Annulée",
};

const SUIVANTS: Record<string, string[]> = {
  recue: ["en_preparation", "annulee"],
  en_preparation: ["en_route", "annulee"],
  recuperee: ["en_route"],
  en_route: ["livree"],
};

export default function Dashboard() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();
  const { deconnexion } = useAuth();
  const [ouverte, setOuverte] = useState<any>(null);

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

  const rafraichir = () => {
    qc.invalidateQueries({ queryKey: ["admin-commandes"] });
    qc.invalidateQueries({ queryKey: ["admin-stats"] });
  };

  const assigner = async (livreurId: string) => {
    try {
      const maj = await apiFetch<any>(`/admin/commandes/${ouverte.id}/assigner`, {
        method: "POST",
        body: { livreurId },
      });
      setOuverte(maj);
      rafraichir();
      toast.show("Livreur assigné", "succes");
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
      toast.show(`Statut : ${LIBELLES[statut]}`, "succes");
    } catch (e: any) {
      toast.show(e.message, "erreur");
    }
  };

  const stats = statsQ.data;

  return (
    <View testID="ecran-admin-dashboard" style={styles.ecran}>
      <View style={[styles.entete, { paddingTop: insets.top + spacing.md }]}>
        <View>
          <Logo taille={20} />
          <Text style={styles.sousTitre}>Back office administrateur</Text>
        </View>
        <Pressable
          testID="btn-admin-deconnexion"
          onPress={async () => {
            await deconnexion();
            router.replace("/bienvenue");
          }}
          style={styles.iconeBtn}
        >
          <Icone name="log-out" size={20} color={colors.brandPrimary} />
        </Pressable>
      </View>

      {commandesQ.isLoading ? (
        <View style={styles.centre}>
          <ActivityIndicator color={colors.brandPrimary} size="large" />
        </View>
      ) : (
        <FlatList
          testID="liste-admin-commandes"
          data={commandesQ.data ?? []}
          keyExtractor={(c) => c.id}
          contentContainerStyle={styles.liste}
          refreshing={commandesQ.isRefetching}
          onRefresh={rafraichir}
          ListHeaderComponent={
            <View style={styles.statsRow}>
              {[
                { l: "En cours", v: stats?.enCours ?? 0, c: colors.brandPrimary },
                { l: "Livrées", v: stats?.livrees ?? 0, c: colors.success },
                { l: "Revenus", v: usd(stats?.revenus ?? 0), c: colors.onSurface },
              ].map((s) => (
                <View key={s.l} testID={`stat-${s.l}`} style={styles.statCarte}>
                  <Text style={[styles.statValeur, { color: s.c }]}>{s.v}</Text>
                  <Text style={styles.statLabel}>{s.l}</Text>
                </View>
              ))}
            </View>
          }
          ListEmptyComponent={
            <View style={styles.centre}>
              <Text style={styles.vide}>Aucune commande pour l&apos;instant</Text>
            </View>
          }
          renderItem={({ item }) => (
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
                  <Text style={styles.pastilleTexte}>{LIBELLES[item.statut]}</Text>
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
                    {item.livreur ? item.livreur.nom : "Aucun livreur assigné"}
                  </Text>
                </View>
                <Text style={styles.total}>{usd(item.total)}</Text>
              </View>
            </Pressable>
          )}
        />
      )}

      <Modal visible={!!ouverte} animationType="slide" transparent onRequestClose={() => setOuverte(null)}>
        <View style={styles.voile}>
          <Pressable style={{ flex: 1 }} onPress={() => setOuverte(null)} />
          <View style={[styles.feuille, { paddingBottom: insets.bottom + spacing.lg }]}>
            <ScrollView contentContainerStyle={styles.feuilleContenu}>
              <Text style={styles.feuilleTitre}>Commande {ouverte?.numero}</Text>
              <Text style={styles.feuilleSous}>
                {ouverte?.clientNom} · {ouverte?.clientTelephone}
              </Text>

              <View style={styles.blocInfo}>
                <Text style={styles.blocTitre}>Adresse</Text>
                <Text style={styles.blocTexte}>
                  {ouverte?.adresse?.avenue} n° {ouverte?.adresse?.numero}, {ouverte?.adresse?.commune}
                </Text>
                <Text style={styles.blocRepere}>Repère : {ouverte?.adresse?.repere}</Text>
              </View>

              <View style={styles.blocInfo}>
                <Text style={styles.blocTitre}>Articles</Text>
                {ouverte?.items?.map((i: any, idx: number) => (
                  <Text key={idx} style={styles.blocTexte}>
                    {i.quantite}× {i.nom} {i.taille ? `(${i.taille})` : ""} — {usd(i.prixUnitaire * i.quantite)}
                  </Text>
                ))}
                <Text style={styles.blocTotal}>Total cash : {usd(ouverte?.total ?? 0)}</Text>
              </View>

              <View style={styles.blocInfo}>
                <Text style={styles.blocTitre}>Assigner un livreur</Text>
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
                <Text style={styles.blocTitre}>Changer le statut</Text>
                {(SUIVANTS[ouverte?.statut] ?? []).map((s) => (
                  <Bouton
                    key={s}
                    testID={`statut-${s}`}
                    label={LIBELLES[s]}
                    variant={s === "annulee" ? "danger" : "primaire"}
                    petit
                    onPress={() => changerStatut(s)}
                    style={{ marginTop: spacing.sm }}
                  />
                ))}
              </View>

              <Bouton testID="btn-fermer-detail" label="Fermer" variant="contour" onPress={() => setOuverte(null)} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
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
  sousTitre: { fontFamily: fonts.text, fontSize: 11, color: colors.muted, marginTop: 2 },
  iconeBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  centre: { alignItems: "center", justifyContent: "center", paddingVertical: spacing.xxxl, gap: spacing.sm },
  vide: { fontFamily: fonts.text, fontSize: 14, color: colors.muted },
  liste: { padding: spacing.lg, gap: spacing.md },
  statsRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.xs },
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
  pastille: { paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.pill },
  pastilleTexte: { fontFamily: fonts.text, fontSize: 11, fontWeight: "800", color: colors.onBrandPrimary },
  client: { fontFamily: fonts.text, fontSize: 13, fontWeight: "700", color: colors.onSurface },
  adresse: { fontFamily: fonts.text, fontSize: 12, color: colors.muted },
  carteBas: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.xs },
  livreurTagRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, flex: 1 },
  livreurTag: { fontFamily: fonts.text, fontSize: 12, color: colors.brandPrimary, fontWeight: "700" },
  total: { fontFamily: fonts.display, fontSize: 17, color: colors.onSurface },
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
});
