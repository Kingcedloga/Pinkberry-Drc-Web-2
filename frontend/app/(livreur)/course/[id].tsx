import { Icone } from "@/src/components/Icone";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { apiFetch } from "@/src/api";
import { Bouton } from "@/src/components/Bouton";
import { Carte } from "@/src/components/Carte";
import { colors, fonts, radius, softShadow, spacing, stylesDynamiques } from "@/src/theme";
import { useTheme } from "@/src/theme-contexte";
import { useMontant } from "@/src/taux";
import { useToast } from "@/src/toast";

export default function DetailCourse() {
  useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();
  const { usd, fc } = useMontant();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [partageGps, setPartageGps] = useState(false);
  const [gpsBloque, setGpsBloque] = useState(false);
  const abonnement = useRef<Location.LocationSubscription | null>(null);

  const q = useQuery({
    queryKey: ["course", id],
    queryFn: () => apiFetch<any>(`/commandes/${id}`),
    refetchInterval: 5000,
  });
  const cmd = q.data;

  const envoyerPosition = async (lat: number, lng: number) => {
    try {
      await apiFetch("/livreur/position", { method: "POST", body: { lat, lng } });
      qc.invalidateQueries({ queryKey: ["course", id] });
    } catch {
      /* silencieux : le partage continue */
    }
  };

  const demarrerPartage = async () => {
    const actuelle = await Location.getForegroundPermissionsAsync();
    let statut = actuelle.status;
    if (statut !== "granted") {
      if (actuelle.canAskAgain) {
        const demande = await Location.requestForegroundPermissionsAsync();
        statut = demande.status;
        if (demande.status !== "granted" && !demande.canAskAgain) setGpsBloque(true);
      } else {
        setGpsBloque(true);
      }
    }
    if (statut !== "granted") {
      toast.show("Position refusée : utilisez la simulation de trajet", "erreur");
      return;
    }
    setGpsBloque(false);
    abonnement.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, timeInterval: 6000, distanceInterval: 20 },
      (pos) => envoyerPosition(pos.coords.latitude, pos.coords.longitude),
    );
    setPartageGps(true);
    toast.show("Partage de position activé", "succes");
  };

  const arreterPartage = () => {
    abonnement.current?.remove();
    abonnement.current = null;
    setPartageGps(false);
  };

  useEffect(() => () => abonnement.current?.remove(), []);

  const avancerDemo = async () => {
    const dest = { lat: cmd?.adresse?.lat ?? -4.325, lng: cmd?.adresse?.lng ?? 15.322 };
    const dep = cmd?.positionLivreur ?? { lat: -4.3178, lng: 15.3136 };
    const lat = dep.lat + (dest.lat - dep.lat) * 0.35;
    const lng = dep.lng + (dest.lng - dep.lng) * 0.35;
    await envoyerPosition(lat, lng);
    toast.show("Position avancée vers le client", "succes");
  };

  const changerStatut = async (statut: string) => {
    try {
      await apiFetch(`/livreur/courses/${id}/statut`, { method: "PATCH", body: { statut } });
      qc.invalidateQueries({ queryKey: ["course", id] });
      qc.invalidateQueries({ queryKey: ["livreur-courses"] });
      if (statut === "en_route" && !partageGps) demarrerPartage();
      toast.show("Statut mis à jour", "succes");
    } catch (e: any) {
      toast.show(e.message, "erreur");
    }
  };

  const encaisser = async () => {
    try {
      await apiFetch(`/livreur/courses/${id}/encaisser`, { method: "POST" });
      arreterPartage();
      qc.invalidateQueries({ queryKey: ["course", id] });
      qc.invalidateQueries({ queryKey: ["livreur-courses"] });
      toast.show("Cash encaissé, course clôturée", "succes");
    } catch (e: any) {
      toast.show(e.message, "erreur");
    }
  };

  if (q.isLoading || !cmd) {
    return (
      <View style={[styles.ecran, styles.centre]}>
        <ActivityIndicator color={colors.brandPrimary} size="large" />
      </View>
    );
  }

  return (
    <View testID="ecran-course-detail" style={styles.ecran}>
      <View style={[styles.entete, { paddingTop: insets.top + spacing.md }]}>
        <Pressable testID="btn-retour-course" onPress={() => router.back()} style={styles.iconeBtn} hitSlop={8}>
          <Icone name="arrow-left" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.titre}>Course {cmd.numero}</Text>
        <View style={styles.iconeBtn} />
      </View>

      <ScrollView contentContainerStyle={[styles.contenu, { paddingBottom: insets.bottom + spacing.xxl }]}>
        <Carte
          client={{ lat: cmd.adresse?.lat ?? -4.325, lng: cmd.adresse?.lng ?? 15.322 }}
          livreur={cmd.positionLivreur ? { lat: cmd.positionLivreur.lat, lng: cmd.positionLivreur.lng } : null}
          hauteur={240}
        />

        <View style={styles.carte}>
          <Text style={styles.carteTitre}>Client</Text>
          <Text style={styles.nom}>{cmd.clientNom}</Text>
          <Text style={styles.ligne}>
            {cmd.adresse?.avenue} n° {cmd.adresse?.numero}, {cmd.adresse?.commune}
          </Text>
          <Text style={styles.repere}>Repère : {cmd.adresse?.repere}</Text>
          <View style={styles.boutonsRow}>
            <Bouton
              testID="btn-appeler-client"
              label="Appeler"
              icone="phone"
              variant="succes"
              petit
              onPress={() => Linking.openURL(`tel:${cmd.adresse?.telephone ?? cmd.clientTelephone}`)}
              style={{ flex: 1 }}
            />
            <Bouton
              testID="btn-navigation"
              label="Itinéraire"
              icone="navigation"
              variant="secondaire"
              petit
              onPress={() =>
                Linking.openURL(
                  `https://www.openstreetmap.org/directions?to=${cmd.adresse?.lat ?? -4.325},${cmd.adresse?.lng ?? 15.322}`,
                )
              }
              style={{ flex: 1 }}
            />
          </View>
        </View>

        <View style={styles.carte}>
          <Text style={styles.carteTitre}>À encaisser en cash</Text>
          <Text testID="montant-a-encaisser" style={styles.montant}>
            {usd(cmd.total)}
          </Text>
          <Text style={styles.montantFc}>≈ {fc(cmd.total)}</Text>
          {cmd.items.map((i: any, idx: number) => (
            <Text key={idx} style={styles.ligne}>
              {i.quantite}× {i.nom} {i.taille ? `(${i.taille})` : ""}
            </Text>
          ))}
        </View>

        <View style={styles.carte}>
          <Text style={styles.carteTitre}>Mise à jour du statut</Text>
          {cmd.statut === "recue" || cmd.statut === "en_preparation" ? (
            <Bouton testID="btn-course-recuperee" label="Course récupérée" icone="package" onPress={() => changerStatut("recuperee")} />
          ) : null}
          {cmd.statut === "recuperee" ? (
            <Bouton testID="btn-en-route" label="Je suis en route" icone="navigation" onPress={() => changerStatut("en_route")} />
          ) : null}
          {cmd.statut === "en_route" ? (
            <>
              <Bouton
                testID="btn-partage-gps"
                label={partageGps ? "Partage GPS actif — arrêter" : "Partager ma position"}
                icone="crosshair"
                variant={partageGps ? "succes" : "secondaire"}
                onPress={partageGps ? arreterPartage : demarrerPartage}
              />
              {gpsBloque ? (
                <Bouton
                  testID="btn-reglages-gps"
                  label="Ouvrir les réglages"
                  variant="contour"
                  petit
                  onPress={() => Linking.openSettings()}
                />
              ) : null}
              <Bouton
                testID="btn-simuler-trajet"
                label="Avancer vers le client (démo)"
                icone="fast-forward"
                variant="contour"
                onPress={avancerDemo}
              />
              <Bouton testID="btn-livre" label="Marquer comme livré" icone="check" variant="succes" onPress={() => changerStatut("livree")} />
            </>
          ) : null}
          {cmd.statut === "livree" && !cmd.cashEncaisse ? (
            <Bouton testID="btn-encaisser" label="J'ai reçu le cash — clôturer" icone="dollar-sign" variant="succes" onPress={encaisser} />
          ) : null}
          {cmd.cashEncaisse ? (
            <View style={styles.termine}>
              <Icone name="check-circle" size={18} color={colors.success} />
              <Text style={styles.termineTexte}>Course terminée, cash encaissé</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = stylesDynamiques(() => StyleSheet.create({
  ecran: { flex: 1, backgroundColor: colors.surfaceSecondary },
  centre: { alignItems: "center", justifyContent: "center" },
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
  iconeBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  titre: { fontFamily: fonts.display, fontSize: 19, color: colors.onSurface },
  contenu: { padding: spacing.lg, gap: spacing.md },
  carte: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    ...softShadow,
  },
  carteTitre: { fontFamily: fonts.display, fontSize: 17, color: colors.onSurface },
  nom: { fontFamily: fonts.text, fontSize: 15, fontWeight: "800", color: colors.onSurface },
  ligne: { fontFamily: fonts.text, fontSize: 13, color: colors.onSurface },
  repere: { fontFamily: fonts.text, fontSize: 13, fontWeight: "800", color: colors.brandPrimary },
  boutonsRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs },
  montant: { fontFamily: fonts.display, fontSize: 34, color: colors.brandPrimary },
  montantFc: { fontFamily: fonts.text, fontSize: 12, color: colors.muted, marginTop: -spacing.xs },
  termine: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  termineTexte: { fontFamily: fonts.text, fontSize: 14, fontWeight: "800", color: colors.success },
}));
