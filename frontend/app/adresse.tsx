import Feather from "@react-native-vector-icons/feather";
import { useQuery } from "@tanstack/react-query";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { KeyboardAwareScrollView, KeyboardStickyView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { apiFetch } from "@/src/api";
import { useAuth } from "@/src/auth";
import { Bouton } from "@/src/components/Bouton";
import { Champ } from "@/src/components/Champ";
import { usePanier } from "@/src/panier";
import { colors, fonts, radius, softShadow, spacing } from "@/src/theme";
import { useToast } from "@/src/toast";

type Zone = { id: string; commune: string; active: boolean };

export default function FormulaireAdresse() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
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

  const zoneChoisie = zones.find((z) => z.commune === commune);
  const couverte = !!zoneChoisie?.active;
  const peutContinuer = couverte && avenue.trim() && numero.trim() && repere.trim() && telephone.trim().length >= 9;

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
        toast.show("Position refusée, saisissez l'adresse manuellement", "erreur");
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      setGpsRefuse(false);
      toast.show("Position GPS enregistrée", "succes");
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
          <Feather name="arrow-left" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.titre}>Adresse de livraison</Text>
        <View style={styles.iconeBtn} />
      </View>

      <KeyboardAwareScrollView bottomOffset={120} contentContainerStyle={styles.contenu}>
        <Bouton
          testID="btn-position-gps"
          label={coords ? "Position GPS enregistrée" : "Utiliser ma position actuelle"}
          icone="crosshair"
          variant={coords ? "succes" : "secondaire"}
          loading={gpsEnCours}
          onPress={utiliserMaPosition}
        />

        {gpsRefuse ? (
          <View testID="bloc-gps-refuse" style={styles.alerteRouge}>
            <Text style={styles.alerteRougeTexte}>
              L&apos;accès à la position est bloqué. Activez-le dans les réglages ou saisissez l&apos;adresse à la main.
            </Text>
            <Bouton
              testID="btn-ouvrir-reglages"
              label="Ouvrir les réglages"
              variant="contour"
              petit
              onPress={() => Linking.openSettings()}
            />
          </View>
        ) : null}

        <View style={styles.bloc}>
          <Text style={styles.label}>Commune</Text>
          <Pressable testID="select-commune" onPress={() => setListeOuverte(true)} style={styles.select}>
            <Text style={[styles.selectTexte, !commune && { color: colors.muted }]}>
              {commune || "Choisir votre commune"}
            </Text>
            <Feather name="chevron-down" size={20} color={colors.muted} />
          </Pressable>
        </View>

        {commune ? (
          couverte ? (
            <View testID="zone-couverte" style={styles.alerteVerte}>
              <Feather name="check-circle" size={18} color={colors.success} />
              <Text style={styles.alerteVerteTexte}>Super, on livre à {commune} !</Text>
            </View>
          ) : (
            <View testID="zone-non-couverte" style={styles.alerteRouge}>
              <Text style={styles.alerteRougeTitre}>Désolé, on ne livre pas encore à {commune}.</Text>
              <Text style={styles.alerteRougeTexte}>Zones couvertes : {couvertes.join(", ")}</Text>
            </View>
          )
        ) : null}

        <Champ label="Avenue / Rue" testID="input-avenue" value={avenue} onChangeText={setAvenue} placeholder="Av. de la Justice" />
        <Champ label="Numéro" testID="input-numero" value={numero} onChangeText={setNumero} placeholder="12B" />

        <View style={styles.bloc}>
          <Text style={styles.label}>Nom de l&apos;adresse</Text>
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
          label="Point de repère (important)"
          testID="input-repere"
          value={repere}
          onChangeText={setRepere}
          placeholder="Ex. près de la pharmacie Kin, en face de l'école"
          multiline
        />
        <Champ
          label="Téléphone de contact"
          testID="input-telephone-contact"
          value={telephone}
          onChangeText={setTelephone}
          placeholder="0990000001"
          keyboardType="phone-pad"
        />
      </KeyboardAwareScrollView>

      <KeyboardStickyView offset={{ closed: 0, opened: spacing.lg }}>
        <View style={[styles.pied, { paddingBottom: insets.bottom + spacing.lg }]}>
          <Bouton testID="btn-continuer-adresse" label="Continuer" disabled={!peutContinuer} onPress={continuer} />
        </View>
      </KeyboardStickyView>

      <Modal visible={listeOuverte} animationType="slide" transparent onRequestClose={() => setListeOuverte(false)}>
        <View style={styles.voile}>
          <Pressable style={{ flex: 1 }} onPress={() => setListeOuverte(false)} />
          <View style={[styles.feuille, { paddingBottom: insets.bottom + spacing.lg }]}>
            <Text style={styles.feuilleTitre}>Choisir la commune</Text>
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
                      <Text style={styles.tagVertTexte}>Couverte</Text>
                    </View>
                  ) : (
                    <View style={styles.tagGris}>
                      <Text style={styles.tagGrisTexte}>Non couverte</Text>
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
  iconeBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  titre: { fontFamily: fonts.display, fontSize: 19, color: colors.onSurface },
  contenu: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  bloc: { gap: spacing.xs },
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
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    ...softShadow,
  },
  voile: { flex: 1, backgroundColor: "rgba(42,23,33,0.45)", justifyContent: "flex-end" },
  feuille: {
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
});
