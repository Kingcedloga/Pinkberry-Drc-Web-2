import React, { useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { apiFetch } from "@/src/api";
import { useAuth } from "@/src/auth";
import { Bouton } from "@/src/components/Bouton";
import { Champ } from "@/src/components/Champ";
import { Icone } from "@/src/components/Icone";
import { useT } from "@/src/i18n";
import { LARGEUR_CONTENU } from "@/src/reactif";
import { colors, fonts, poids, radius, spacing, stylesDynamiques } from "@/src/theme";
import { useTheme } from "@/src/theme-contexte";
import { useRetour } from "@/src/retour";

type Etape = "formulaire" | "confirmation" | "termine";

/**
 * Page publique de suppression de compte (exigence Google Play : un lien web,
 * utilisable sans installer l'app). Identification par téléphone + mot de
 * passe, puis confirmation explicite. Les comptes Google et le personnel sont
 * orientés vers l'app ou le contact.
 */
export default function SuppressionCompte() {
  useTheme();
  const t = useT();
  const retour = useRetour();
  const insets = useSafeAreaInsets();
  const { user, deconnexion } = useAuth();
  const [etape, setEtape] = useState<Etape>("formulaire");
  const [telephone, setTelephone] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [compte, setCompte] = useState<{ jeton: string; nom: string; id: string } | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const contact = t("legal.contact");

  const verifier = async () => {
    setErreur(null);
    if (telephone.trim().length < 9 || motDePasse.length < 6) {
      setErreur(t("suppression.identifiantsRequis"));
      return;
    }
    setEnvoi(true);
    try {
      const r = await apiFetch<{ token: string; user: { id: string; nom: string; role: string } }>("/auth/connexion", {
        method: "POST",
        body: { telephone: telephone.trim(), motDePasse },
      });
      if (r.user.role !== "client") {
        setErreur(t("suppression.personnel"));
        return;
      }
      setCompte({ jeton: r.token, nom: r.user.nom, id: r.user.id });
      setEtape("confirmation");
    } catch (e: any) {
      setErreur(e.message);
    } finally {
      setEnvoi(false);
    }
  };

  const supprimer = async () => {
    if (!compte) return;
    setEnvoi(true);
    setErreur(null);
    try {
      await apiFetch("/auth/moi", { method: "DELETE", jeton: compte.jeton });
      // Compte ouvert sur cet appareil : la session disparaît avec lui.
      if (user?.id === compte.id) await deconnexion();
      setCompte(null);
      setMotDePasse("");
      setEtape("termine");
    } catch (e: any) {
      setErreur(e.message);
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <View testID="page-suppression-compte" style={styles.ecran}>
      <View style={[styles.entete, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="btn-retour-suppression" accessibilityLabel={t("commun.annuler")} onPress={retour} style={styles.retour}>
          <Icone name="arrow-left" size={20} color={colors.brandPrimary} />
        </Pressable>
        <Text style={styles.marque}>{t("commun.marque")}</Text>
      </View>
      <ScrollView contentContainerStyle={[styles.contenu, { paddingBottom: insets.bottom + spacing.xxxl }]}>
        <Text style={styles.titre}>{t("suppression.titre")}</Text>
        <Text style={styles.sousTitre}>{t("suppression.intro")}</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitre}>{t("suppression.effaceTitre")}</Text>
          <Text style={styles.paragraphe}>{t("suppression.efface")}</Text>
          <Text style={styles.sectionTitre}>{t("suppression.conserveTitre")}</Text>
          <Text style={styles.paragraphe}>{t("suppression.conserve")}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitre}>{t("suppression.dansAppTitre")}</Text>
          <Text style={styles.paragraphe}>{t("suppression.dansApp")}</Text>
        </View>

        <View testID="bloc-suppression" style={styles.carte}>
          <Text style={styles.carteTitre}>{t("suppression.iciTitre")}</Text>
          {etape === "formulaire" ? (
            <>
              <Text style={styles.aide}>{t("suppression.ici")}</Text>
              <Champ
                label={t("auth.telephone")}
                testID="input-suppression-telephone"
                value={telephone}
                onChangeText={setTelephone}
                keyboardType="phone-pad"
                placeholder="0990000000"
              />
              <Champ
                label={t("auth.motDePasse")}
                testID="input-suppression-motdepasse"
                value={motDePasse}
                onChangeText={setMotDePasse}
                secureTextEntry
              />
              <Bouton testID="btn-suppression-continuer" label={t("compte.continuer")} loading={envoi} onPress={verifier} />
            </>
          ) : etape === "confirmation" && compte ? (
            <>
              <Text style={styles.paragraphe}>{t("suppression.confirmer", { nom: compte.nom })}</Text>
              <Text style={styles.avertissement}>{t("compte.confirmationTexte")}</Text>
              <Bouton
                testID="btn-suppression-definitive"
                label={t("compte.supprimerDefinitivement")}
                variant="danger"
                loading={envoi}
                onPress={supprimer}
              />
              <Bouton
                testID="btn-suppression-annuler"
                label={t("commun.annuler")}
                variant="contour"
                onPress={() => {
                  setCompte(null);
                  setEtape("formulaire");
                }}
              />
            </>
          ) : (
            <View testID="suppression-terminee" style={styles.termine}>
              <Icone name="check-circle" size={22} color={colors.success} />
              <Text style={styles.termineTexte}>{t("compte.suppressionOk")}</Text>
            </View>
          )}
          {erreur ? (
            <Text testID="erreur-suppression" style={styles.erreur} accessibilityLiveRegion="polite">
              {erreur}
            </Text>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitre}>{t("suppression.autreTitre")}</Text>
          <Text style={styles.paragraphe}>{t("suppression.autre")}</Text>
          <Pressable
            testID="lien-contact-suppression"
            onPress={() => Linking.openURL(`mailto:${contact}?subject=${encodeURIComponent(t("suppression.objetMail"))}`)}
            style={styles.contact}
          >
            <Icone name="mail" size={18} color={colors.brandPrimary} />
            <Text style={styles.contactTexte}>{contact}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = stylesDynamiques(() =>
  StyleSheet.create({
    ecran: { flex: 1, backgroundColor: colors.surfaceSecondary },
    entete: {
      ...LARGEUR_CONTENU,
      width: "100%",
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.md,
      gap: spacing.md,
    },
    retour: {
      width: 44,
      height: 44,
      borderRadius: radius.pill,
      backgroundColor: colors.brandTertiary,
      alignItems: "center",
      justifyContent: "center",
    },
    marque: { fontFamily: fonts.display, fontSize: 22, fontWeight: poids.fort, color: colors.brandPrimary },
    contenu: { ...LARGEUR_CONTENU, paddingHorizontal: spacing.lg, gap: spacing.lg },
    titre: { fontFamily: fonts.display, fontSize: 30, lineHeight: 36, fontWeight: poids.fort, color: colors.onSurface },
    sousTitre: { fontFamily: fonts.text, fontSize: 14, lineHeight: 21, color: colors.muted },
    section: { gap: spacing.sm },
    sectionTitre: { fontFamily: fonts.display, fontSize: 19, lineHeight: 25, color: colors.brandPrimary },
    paragraphe: { fontFamily: fonts.text, fontSize: 15, lineHeight: 24, color: colors.onSurface },
    carte: {
      gap: spacing.md,
      padding: spacing.lg,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    carteTitre: { fontFamily: fonts.display, fontSize: 19, color: colors.onSurface },
    aide: { fontFamily: fonts.text, fontSize: 13, lineHeight: 20, color: colors.muted },
    avertissement: { fontFamily: fonts.text, fontSize: 13, lineHeight: 20, fontWeight: "700", color: colors.error },
    erreur: { fontFamily: fonts.text, fontSize: 13, fontWeight: "700", color: colors.error },
    termine: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    termineTexte: { flex: 1, fontFamily: fonts.text, fontSize: 15, fontWeight: "800", color: colors.success },
    contact: { flexDirection: "row", alignItems: "center", gap: spacing.sm, alignSelf: "flex-start", paddingVertical: spacing.sm },
    contactTexte: { fontFamily: fonts.text, fontSize: 15, fontWeight: "800", color: colors.brandPrimary },
  }),
);
