import { Chargement } from "@/src/components/Chargement";
import { Icone } from "@/src/components/Icone";
import { useDetailLigne, useLibelle } from "@/src/catalogue-i18n";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Location from "expo-location";
import { useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { Linking, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { apiFetch } from "@/src/api";
import { Bouton } from "@/src/components/Bouton";
import { Carte } from "@/src/components/Carte";
import { distanceLisible, dureeLisible, useItineraire } from "@/src/itineraire";
import { TitrePage } from "@/src/components/TitrePage";
import { champsAdresse, useLangue } from "@/src/i18n";
import { LARGEUR_CONTENU, useEcran } from "@/src/reactif";
import { colors, fonts, radius, softShadow, spacing, stylesDynamiques } from "@/src/theme";
import { useTheme } from "@/src/theme-contexte";
import { useMontant } from "@/src/taux";
import { useToast } from "@/src/toast";

export default function DetailCourse() {
  useTheme();
  const insets = useSafeAreaInsets();
  const { bureau } = useEcran();
  const toast = useToast();
  const { t } = useLangue();
  const libelle = useLibelle();
  const detail = useDetailLigne();
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
  const positionClient = { lat: cmd?.adresse?.lat ?? -4.325, lng: cmd?.adresse?.lng ?? 15.322 };
  const positionLivreur = cmd?.positionLivreur
    ? { lat: cmd.positionLivreur.lat, lng: cmd.positionLivreur.lng }
    : null;
  const itineraire = useItineraire(positionLivreur, positionClient, !!cmd && cmd.statut !== "livree");

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
      toast.show(t("livreur.gpsRefuse"), "erreur");
      return;
    }
    setGpsBloque(false);
    abonnement.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, timeInterval: 6000, distanceInterval: 20 },
      (pos) => envoyerPosition(pos.coords.latitude, pos.coords.longitude),
    );
    setPartageGps(true);
    toast.show(t("livreur.gpsActif"), "succes");
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
    toast.show(t("livreur.positionAvancee"), "succes");
  };

  const changerStatut = async (statut: string) => {
    try {
      await apiFetch(`/livreur/courses/${id}/statut`, { method: "PATCH", body: { statut } });
      qc.invalidateQueries({ queryKey: ["course", id] });
      qc.invalidateQueries({ queryKey: ["livreur-courses"] });
      if (statut === "en_route" && !partageGps) demarrerPartage();
      toast.show(t("livreur.statutOk"), "succes");
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
      toast.show(t("livreur.cashEncaisse"), "succes");
    } catch (e: any) {
      toast.show(e.message, "erreur");
    }
  };

  if (q.isLoading || !cmd) {
    return (
      <View style={[styles.ecran, styles.centre]}>
        <Chargement taille={52} />
      </View>
    );
  }

  return (
    <View testID="ecran-course-detail" style={styles.ecran}>
      <ScrollView
        contentContainerStyle={[
          styles.contenu,
          bureau && styles.contenuBureau,
          { paddingBottom: insets.bottom + spacing.xxl },
        ]}
      >
        <TitrePage titre={`${t("livreur.courseRecuperee")} ${cmd.numero}`} sousTitre={cmd.adresse?.commune} retour="/livreur" />

        <View style={bureau ? styles.colonnes : styles.pile}>
          <View style={bureau ? styles.colGauche : styles.pile}>
        <Carte
          client={positionClient}
          livreur={positionLivreur}
          itineraire={itineraire.data?.points ?? null}
          hauteur={bureau ? 400 : 240}
        />

        {itineraire.data?.etaSecondes ? (
          <View testID="bloc-eta-livreur" style={styles.etaBloc}>
            <Icone name="clock" size={16} color={colors.brandPrimary} />
            <Text style={styles.etaTexte}>
              {t("livreur.arriveeEstimee", { duree: dureeLisible(itineraire.data.etaSecondes) ?? "" })}
              {distanceLisible(itineraire.data.distanceMetres)
                ? ` · ${distanceLisible(itineraire.data.distanceMetres)}`
                : ""}
            </Text>
          </View>
        ) : null}

        <View style={styles.carte}>
          <Text style={styles.carteTitre}>{t("livreur.client")}</Text>
          <Text style={styles.nom}>{cmd.clientNom}</Text>
          <Text style={styles.ligne}>
            {t("commun.adresse", champsAdresse(cmd.adresse))}
          </Text>
          <Text style={styles.repere}>{t("livreur.repere", { repere: cmd.adresse?.repere ?? "" })}</Text>
          <View style={styles.boutonsRow}>
            <Bouton
              testID="btn-appeler-client"
              label={t("livreur.appeler")}
              icone="phone"
              variant="succes"
              petit
              onPress={() => Linking.openURL(`tel:${cmd.adresse?.telephone ?? cmd.clientTelephone}`)}
              style={{ flex: 1 }}
            />
            <Bouton
              testID="btn-navigation"
              label={t("livreur.itineraire")}
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
          <Text style={styles.carteTitre}>{t("livreur.cashAEncaisser")}</Text>
          <Text testID="montant-a-encaisser" style={styles.montant}>
            {fc(cmd.total)}
          </Text>
          <Text style={styles.montantFc}>≈ {usd(cmd.total)}</Text>
          {cmd.items.map((i: any, idx: number) => (
            <Text key={idx} style={styles.ligne}>
              {i.quantite}× {libelle(i.nom, i.nomEn)}
              {detail.options(i) ? ` (${detail.options(i)})` : ""}
            </Text>
          ))}
        </View>

          </View>

          <View style={bureau ? styles.colDroite : styles.pile}>
        <View style={styles.carte}>
          <Text style={styles.carteTitre}>{t("livreur.changerStatut")}</Text>
          {cmd.statut === "recue" || cmd.statut === "en_preparation" ? (
            <Bouton testID="btn-course-recuperee" label={t("livreur.courseRecuperee")} icone="package" onPress={() => changerStatut("recuperee")} />
          ) : null}
          {cmd.statut === "recuperee" ? (
            <Bouton testID="btn-en-route" label={t("livreur.jeSuisEnRoute")} icone="navigation" onPress={() => changerStatut("en_route")} />
          ) : null}
          {cmd.statut === "en_route" ? (
            <>
              <Bouton
                testID="btn-partage-gps"
                label={partageGps ? t("livreur.partageGpsArreter") : t("livreur.partagerPosition")}
                icone="crosshair"
                variant={partageGps ? "succes" : "secondaire"}
                onPress={partageGps ? arreterPartage : demarrerPartage}
              />
              {gpsBloque ? (
                <Bouton
                  testID="btn-reglages-gps"
                  label={t("livreur.ouvrirReglages")}
                  variant="contour"
                  petit
                  onPress={() => Linking.openSettings()}
                />
              ) : null}
              <Bouton
                testID="btn-simuler-trajet"
                label={t("livreur.avancerDemo")}
                icone="fast-forward"
                variant="contour"
                onPress={avancerDemo}
              />
              <Bouton testID="btn-livre" label={t("livreur.marquerLivree")} icone="check" variant="succes" onPress={() => changerStatut("livree")} />
            </>
          ) : null}
          {cmd.statut === "livree" && !cmd.cashEncaisse ? (
            <Bouton testID="btn-encaisser" label={t("livreur.cashCloture")} icone="dollar-sign" variant="succes" onPress={encaisser} />
          ) : null}
          {cmd.cashEncaisse ? (
            <View style={styles.termine}>
              <Icone name="check-circle" size={18} color={colors.success} />
              <Text style={styles.termineTexte}>{t("livreur.termineeCash")}</Text>
            </View>
          ) : null}
        </View>
          </View>
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
  contenu: { ...LARGEUR_CONTENU, padding: spacing.lg, gap: spacing.md },
  contenuBureau: { maxWidth: 1160, padding: spacing.xl },
  pile: { gap: spacing.md },
  colonnes: { flexDirection: "row", alignItems: "flex-start", gap: spacing.xl },
  colGauche: { flex: 1.25, gap: spacing.md, minWidth: 0 },
  colDroite: { flex: 1, gap: spacing.md, minWidth: 0 },
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
  etaBloc: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.brandTertiary,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  etaTexte: { fontFamily: fonts.text, fontSize: 13, fontWeight: "800", color: colors.brandPrimary },
  nom: { fontFamily: fonts.text, fontSize: 15, fontWeight: "800", color: colors.onSurface },
  ligne: { fontFamily: fonts.text, fontSize: 13, color: colors.onSurface },
  repere: { fontFamily: fonts.text, fontSize: 13, fontWeight: "800", color: colors.brandPrimary },
  boutonsRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs },
  montant: { fontFamily: fonts.display, fontSize: 34, color: colors.brandPrimary },
  montantFc: { fontFamily: fonts.text, fontSize: 12, color: colors.muted, marginTop: -spacing.xs },
  termine: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  termineTexte: { fontFamily: fonts.text, fontSize: 14, fontWeight: "800", color: colors.success },
}));
