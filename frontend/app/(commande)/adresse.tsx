import { Icone } from "@/src/components/Icone";
import { useQuery } from "@tanstack/react-query";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { KeyboardAwareScrollView, KeyboardStickyView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { apiFetch } from "@/src/api";
import { useAuth } from "@/src/auth";
import { Bouton } from "@/src/components/Bouton";
import { Carte } from "@/src/components/Carte";
import { Champ } from "@/src/components/Champ";
import { useT } from "@/src/i18n";
import { usePanier } from "@/src/panier";
import { LARGEUR_CONTENU, LARGEUR_FEUILLE, useEcran } from "@/src/reactif";
import { colors, fonts, radius, softShadow, spacing, stylesDynamiques } from "@/src/theme";
import { useTheme } from "@/src/theme-contexte";
import { useToast } from "@/src/toast";

type Zone = { id: string; commune: string; active: boolean };

type Suggestion = {
  id: string;
  libelle: string;
  detail?: string | null;
  commune?: string | null;
  avenue?: string | null;
  lat: number;
  lng: number;
};

export default function FormulaireAdresse() {
  useTheme();
  const insets = useSafeAreaInsets();
  const { bureau } = useEcran();
  const router = useRouter();
  const toast = useToast();
  const t = useT();
  const { user } = useAuth();
  const { setAdresse } = usePanier();

  const zonesQ = useQuery({ queryKey: ["zones"], queryFn: () => apiFetch<Zone[]>("/zones") });
  const zones = zonesQ.data ?? [];
  const couvertes = zones.filter((z) => z.active).map((z) => z.commune);

  const [commune, setCommune] = useState("");
  const [avenue, setAvenue] = useState("");
  const [numero, setNumero] = useState("");
  const [label, setLabel] = useState("Maison");
  const [repere, setRepere] = useState("");
  const [telephone, setTelephone] = useState(user?.telephone ?? "");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [listeOuverte, setListeOuverte] = useState(false);
  const [gpsRefuse, setGpsRefuse] = useState(false);
  const [gpsEnCours, setGpsEnCours] = useState(false);
  const [recherche, setRecherche] = useState("");
  const [terme, setTerme] = useState("");
  const [suggestionsFermees, setSuggestionsFermees] = useState(false);

  useEffect(() => {
    const minuteur = setTimeout(() => setTerme(recherche.trim()), 300);
    return () => clearTimeout(minuteur);
  }, [recherche]);

  const suggestionsQ = useQuery({
    queryKey: ["carte-recherche", terme],
    enabled: terme.length >= 3,
    staleTime: 60_000,
    retry: false,
    queryFn: () => apiFetch<{ resultats: Suggestion[] }>(`/carte/recherche?q=${encodeURIComponent(terme)}`),
  });
  const suggestions = suggestionsFermees ? [] : suggestionsQ.data?.resultats ?? [];

  const zoneGpsQ = useQuery({
    queryKey: ["carte-zone", coords?.lat, coords?.lng],
    enabled: !!coords,
    staleTime: 5 * 60_000,
    retry: false,
    queryFn: () =>
      apiFetch<{ commune: string | null; couverte: boolean }>(
        `/carte/zone?lat=${coords!.lat}&lng=${coords!.lng}`,
      ),
  });
  const zoneGps = zoneGpsQ.data;

  // La commune detectee par GPS prime sur la saisie manuelle.
  useEffect(() => {
    if (zoneGps?.couverte && zoneGps.commune && zoneGps.commune !== commune) setCommune(zoneGps.commune);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoneGps?.commune, zoneGps?.couverte]);

  const zoneChoisie = zones.find((z) => z.commune === commune);
  const couverte = !!zoneChoisie?.active;
  const peutContinuer = couverte && avenue.trim() && numero.trim() && repere.trim() && telephone.trim().length >= 9;

  const choisirSuggestion = (s: Suggestion) => {
    setAvenue(s.avenue || s.libelle);
    if (s.commune && zones.some((z) => z.commune === s.commune)) setCommune(s.commune);
    setCoords({ lat: s.lat, lng: s.lng });
    setRecherche(s.libelle);
    setSuggestionsFermees(true);
    toast.show(t("adresse.adresseLocalisee"), "succes");
  };

  const utiliserMaPosition = async () => {
    setGpsEnCours(true);
    try {
      const actuelle = await Location.getForegroundPermissionsAsync();
      let statut = actuelle.status;
      if (statut !== "granted" && actuelle.canAskAgain) {
        const demande = await Location.requestForegroundPermissionsAsync();
        statut = demande.status;
        if (demande.status !== "granted" && !demande.canAskAgain) setGpsRefuse(true);
      } else if (statut !== "granted" && !actuelle.canAskAgain) {
        setGpsRefuse(true);
      }
      if (statut !== "granted") {
        toast.show(t("adresse.gpsRefuse"), "erreur");
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      setGpsRefuse(false);
      toast.show(t("adresse.gpsOk"), "succes");
    } catch {
      toast.show("Impossible d'obtenir votre position", "erreur");
    } finally {
      setGpsEnCours(false);
    }
  };

  const continuer = () => {
    setAdresse({ label, commune, avenue, numero, repere, telephone, lat: coords?.lat, lng: coords?.lng });
    router.push("/confirmation");
  };

  return (
    <View testID="ecran-adresse" style={styles.ecran}>
      <View style={[styles.entete, { paddingTop: insets.top + spacing.md }]}>
        <Pressable testID="btn-retour-adresse" onPress={() => router.back()} style={styles.iconeBtn} hitSlop={8}>
          <Icone name="arrow-left" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.titre}>{t("adresse.titre")}</Text>
        <View style={styles.iconeBtn} />
      </View>

      <KeyboardAwareScrollView bottomOffset={120} contentContainerStyle={styles.contenu}>
        <View style={styles.bloc}>
          <Champ
            label={t("adresse.rechercher")}
            testID="input-recherche-adresse"
            value={recherche}
            onChangeText={(v) => {
              setRecherche(v);
              setSuggestionsFermees(false);
            }}
            placeholder="Av. de la Justice, Gombe"
          />
          {suggestions.length > 0 ? (
            <View testID="liste-suggestions" style={styles.suggestions}>
              {suggestions.map((s) => (
                <Pressable
                  key={s.id}
                  testID={`suggestion-${s.id}`}
                  onPress={() => choisirSuggestion(s)}
                  style={styles.suggestion}
                >
                  <Icone name="map-pin" size={16} color={colors.brandPrimary} />
                  <View style={styles.suggestionTexte}>
                    <Text style={styles.suggestionTitre} numberOfLines={1}>
                      {s.libelle}
                    </Text>
                    {s.commune ? (
                      <Text style={styles.suggestionDetail} numberOfLines={1}>
                        {s.commune}
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>

        <Bouton
          testID="btn-position-gps"
          label={coords ? t("adresse.gpsOk") : t("adresse.gpsUtiliser")}
          icone="crosshair"
          variant={coords ? "succes" : "secondaire"}
          loading={gpsEnCours}
          onPress={utiliserMaPosition}
        />

        {gpsRefuse ? (
          <View testID="bloc-gps-refuse" style={styles.alerteRouge}>
            <Text style={styles.alerteRougeTexte}>
              {t("adresse.gpsBloque")}
            </Text>
            <Bouton
              testID="btn-ouvrir-reglages"
              label={t("adresse.ouvrirReglages")}
              variant="contour"
              petit
              onPress={() => Linking.openSettings()}
            />
          </View>
        ) : null}

        <View style={styles.bloc}>
          <Text style={styles.label}>{t("adresse.commune")}</Text>
          <Pressable testID="select-commune" onPress={() => setListeOuverte(true)} style={styles.select}>
            <Text style={[styles.selectTexte, !commune && { color: colors.muted }]}>
              {commune || t("adresse.choisirCommune")}
            </Text>
            <Icone name="chevron-down" size={20} color={colors.muted} />
          </Pressable>
        </View>

        {commune ? (
          couverte ? (
            <View testID="zone-couverte" style={styles.alerteVerte}>
              <Icone name="check-circle" size={18} color={colors.success} />
              <Text style={styles.alerteVerteTexte}>{t("adresse.onLivre", { commune })}</Text>
            </View>
          ) : (
            <View testID="zone-non-couverte" style={styles.alerteRouge}>
              <Text style={styles.alerteRougeTitre}>{t("adresse.onLivrePas", { commune })}</Text>
              <Text style={styles.alerteRougeTexte}>{t("adresse.zonesCouvertes", { zones: couvertes.join(", ") })}</Text>
            </View>
          )
        ) : null}

        {coords ? (
          <View style={styles.bloc}>
            <Text style={styles.label}>{t("adresse.ajusterPin")}</Text>
            <Carte
              testID="carte-choix-adresse"
              client={coords}
              mode="choix"
              hauteur={bureau ? 360 : 220}
              onPosition={(p) => setCoords(p)}
            />
            {zoneGps && !zoneGps.couverte ? (
              <View testID="alerte-zone-gps" style={styles.alerteRouge}>
                <Text style={styles.alerteRougeTexte}>
                  {t("adresse.horsZoneGps", { commune: zoneGps.commune ?? "?" })}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        <Champ label={t("adresse.avenue")} testID="input-avenue" value={avenue} onChangeText={setAvenue} placeholder="Av. de la Justice" />
        <Champ label={t("adresse.numero")} testID="input-numero" value={numero} onChangeText={setNumero} placeholder="12B" />

        <View style={styles.bloc}>
          <Text style={styles.label}>{t("adresse.nomAdresse")}</Text>
          <View style={styles.labelsRow}>
            {["Maison", "Bureau", "Autre"].map((l) => (
              <Pressable
                key={l}
                testID={`label-${l}`}
                onPress={() => setLabel(l)}
                style={[styles.labelChip, label === l && styles.labelChipActif]}
              >
                <Text style={[styles.labelChipTexte, label === l && { color: colors.onBrandPrimary }]}>{l}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <Champ
          label={t("adresse.repere")}
          testID="input-repere"
          value={repere}
          onChangeText={setRepere}
          placeholder={t("adresse.reperePlaceholder")}
          multiline
        />
        <Champ
          label={t("adresse.telephone")}
          testID="input-telephone-contact"
          value={telephone}
          onChangeText={setTelephone}
          placeholder="0990000001"
          keyboardType="phone-pad"
        />
      </KeyboardAwareScrollView>

      <KeyboardStickyView offset={{ closed: 0, opened: spacing.lg }}>
        <View style={[styles.pied, { paddingBottom: insets.bottom + spacing.lg }]}>
          <Bouton testID="btn-continuer-adresse" label={t("adresse.continuer")} disabled={!peutContinuer} onPress={continuer} />
        </View>
      </KeyboardStickyView>

      <Modal visible={listeOuverte} animationType="slide" transparent onRequestClose={() => setListeOuverte(false)}>
        <View style={styles.voile}>
          <Pressable style={{ flex: 1 }} onPress={() => setListeOuverte(false)} />
          <View style={[styles.feuille, { paddingBottom: insets.bottom + spacing.lg }]}>
            <Text style={styles.feuilleTitre}>{t("adresse.choisirCommuneTitre")}</Text>
            <ScrollView>
              {zones.map((z) => (
                <Pressable
                  key={z.id}
                  testID={`commune-${z.commune}`}
                  onPress={() => {
                    setCommune(z.commune);
                    setListeOuverte(false);
                  }}
                  style={styles.communeLigne}
                >
                  <Text style={styles.communeNom}>{z.commune}</Text>
                  {z.active ? (
                    <View style={styles.tagVert}>
                      <Text style={styles.tagVertTexte}>{t("adresse.couverte")}</Text>
                    </View>
                  ) : (
                    <View style={styles.tagGris}>
                      <Text style={styles.tagGrisTexte}>{t("adresse.nonCouverte")}</Text>
                    </View>
                  )}
                </Pressable>
              ))}
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
  contenu: { ...LARGEUR_CONTENU, padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  bloc: { gap: spacing.xs },
  suggestions: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    marginTop: spacing.xs,
  },
  suggestion: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  suggestionTexte: { flex: 1 },
  suggestionTitre: { fontFamily: fonts.text, fontSize: 14, fontWeight: "700", color: colors.onSurface },
  suggestionDetail: { fontFamily: fonts.text, fontSize: 12, color: colors.muted },
  label: { fontFamily: fonts.text, fontSize: 13, fontWeight: "700", color: colors.muted },
  select: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
  },
  selectTexte: { fontFamily: fonts.text, fontSize: 15, color: colors.onSurface },
  alerteVerte: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.successSoft,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  alerteVerteTexte: { fontFamily: fonts.text, fontSize: 13, fontWeight: "800", color: "#5E8C1F" },
  alerteRouge: { backgroundColor: colors.errorSoft, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm },
  alerteRougeTitre: { fontFamily: fonts.text, fontSize: 13, fontWeight: "800", color: colors.error },
  alerteRougeTexte: { fontFamily: fonts.text, fontSize: 12, color: colors.error },
  labelsRow: { flexDirection: "row", gap: spacing.sm },
  labelChip: {
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  labelChipActif: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  labelChipTexte: { fontFamily: fonts.text, fontSize: 13, fontWeight: "700", color: colors.onSurface },
  pied: {
    ...LARGEUR_CONTENU,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    ...softShadow,
  },
  voile: { flex: 1, backgroundColor: "rgba(42,23,33,0.45)", justifyContent: "flex-end" },
  feuille: {
    ...LARGEUR_FEUILLE,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    maxHeight: "75%",
  },
  feuilleTitre: { fontFamily: fonts.display, fontSize: 20, color: colors.onSurface, marginBottom: spacing.md },
  communeLigne: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  communeNom: { fontFamily: fonts.text, fontSize: 15, fontWeight: "700", color: colors.onSurface },
  tagVert: { backgroundColor: colors.success, paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.pill },
  tagVertTexte: { fontFamily: fonts.text, fontSize: 11, fontWeight: "800", color: colors.onSuccess },
  tagGris: { backgroundColor: colors.surfaceTertiary, paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.pill },
  tagGrisTexte: { fontFamily: fonts.text, fontSize: 11, fontWeight: "800", color: colors.muted },
}));
