import { Icone } from "@/src/components/Icone";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

import { useAuth } from "@/src/auth";
import { Bouton } from "@/src/components/Bouton";
import { BoutonGoogle } from "@/src/components/BoutonGoogle";
import { Champ } from "@/src/components/Champ";
import { CarteAuth, EnteteMarque } from "@/src/components/DecorAuth";
import { LARGEUR_ETROITE } from "@/src/reactif";
import { useLangue } from "@/src/i18n";
import { colors, fonts, poids, radius, spacing, stylesDynamiques } from "@/src/theme";
import { useTheme } from "@/src/theme-contexte";
import { useToast } from "@/src/toast";
import { useRetour } from "@/src/retour";

export default function Inscription() {
  useTheme();
  const router = useRouter();
  const retour = useRetour("/bienvenue");
  const { inscription, connexionGoogle } = useAuth();
  const { t } = useLangue();
  const toast = useToast();

  const [nom, setNom] = useState("");
  const [telephone, setTelephone] = useState("");
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [loading, setLoading] = useState(false);

  const valider = async () => {
    if (!nom.trim() || telephone.trim().length < 9 || !email.trim() || motDePasse.length < 6) {
      toast.show(t("auth.infosRequises"), "erreur");
      return;
    }
    setLoading(true);
    try {
      const r = await inscription({ nom, telephone, email: email || undefined, motDePasse });
      toast.show(r.emailEnvoye ? t("auth.codeEnvoye") : t("auth.codeGenere"), r.emailEnvoye ? "succes" : "info");
      router.push({ pathname: "/otp", params: { telephone, email, codeDemo: r.codeDemo, emailEnvoye: r.emailEnvoye ? "1" : "0" } });
    } catch (e: any) {
      toast.show(e.message, "erreur");
    } finally {
      setLoading(false);
    }
  };

  return (
    <CarteAuth testID="ecran-inscription">
      <KeyboardAwareScrollView bottomOffset={100} contentContainerStyle={styles.contenu}>
        <EnteteMarque taille={30} />

        <View style={styles.titres}>
          <Text style={styles.titre}>{t("auth.inscriptionTitre")}</Text>
          <Text style={styles.sous}>{t("auth.inscriptionSousTitre")}</Text>
        </View>

        <View style={styles.form}>
          <Champ
            label={t("auth.nomComplet")}
            testID="input-nom"
            value={nom}
            onChangeText={setNom}
            placeholder={t("auth.exempleNom")}
            autoCapitalize="words"
          />
          <Champ
            label={t("auth.telephone")}
            testID="input-telephone"
            value={telephone}
            onChangeText={setTelephone}
            placeholder="0990000001"
            keyboardType="phone-pad"
          />
          <Champ
            label={t("params.email")}
            testID="input-email"
            value={email}
            onChangeText={setEmail}
            placeholder={t("auth.exempleEmail")}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <Champ
            label={t("auth.motDePasse")}
            testID="input-motdepasse"
            value={motDePasse}
            onChangeText={setMotDePasse}
            placeholder={t("params.mdpCourt")}
            secureTextEntry
          />
        </View>

        <Bouton testID="btn-valider-inscription" label={t("auth.inscriptionTitre")} loading={loading} onPress={valider} />

        <View style={styles.acceptation}>
          <Text style={styles.acceptationTexte}>{t("inscription.acceptation")} </Text>
          <Pressable testID="lien-conditions-inscription" onPress={() => router.push("/legal/conditions")}>
            <Text style={styles.acceptationLien}>{t("params.conditions")}</Text>
          </Pressable>
          <Text style={styles.acceptationTexte}> {t("inscription.et")} </Text>
          <Pressable testID="lien-confidentialite-inscription" onPress={() => router.push("/legal/confidentialite")}>
            <Text style={styles.acceptationLien}>{t("params.confidentialite")}</Text>
          </Pressable>
          <Text style={styles.acceptationTexte}>.</Text>
        </View>

        <View style={styles.separateurRow}>
          <View style={styles.trait} />
          <Text style={styles.ou}>{t("auth.ou")}</Text>
          <View style={styles.trait} />
        </View>

        <BoutonGoogle
          testID="btn-google-inscription"
          label={t("auth.googleInscription")}
          onPress={async () => {
            try {
              await connexionGoogle();
              router.replace("/");
            } catch (e: any) {
              toast.show(e.message ?? t("auth.googleImpossible"), "erreur");
            }
          }}
        />

        <Pressable testID="lien-connexion" onPress={() => router.replace("/connexion")} style={styles.lien}>
          <Text style={styles.lienTexte}>{t("auth.compteExistant")}</Text>
        </Pressable>
      </KeyboardAwareScrollView>

      <Pressable testID="btn-retour" onPress={retour} style={styles.retour} hitSlop={10}>
        <Icone name="arrow-left" size={20} color={colors.onSurface} />
      </Pressable>
    </CarteAuth>
  );
}

const styles = stylesDynamiques(() => StyleSheet.create({
  contenu: { ...LARGEUR_ETROITE, paddingHorizontal: spacing.lg, paddingTop: spacing.xs, paddingBottom: spacing.xxl, gap: spacing.lg },
  retour: {
    position: "absolute",
    top: spacing.md,
    left: spacing.md,
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceSecondary,
  },
  titres: { alignItems: "center", gap: 4 },
  titre: { fontFamily: fonts.display, fontSize: 24, fontWeight: poids.fort, color: colors.onSurface },
  sous: { fontFamily: fonts.text, fontSize: 13, color: colors.muted, textAlign: "center" },
  form: { gap: spacing.md },
  acceptation: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", paddingHorizontal: spacing.sm },
  acceptationTexte: { fontFamily: fonts.text, fontSize: 12, lineHeight: 19, color: colors.muted, textAlign: "center" },
  acceptationLien: { fontFamily: fonts.text, fontSize: 12, lineHeight: 19, fontWeight: poids.fort, color: colors.brandPrimary, textDecorationLine: "underline" },
  separateurRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  trait: { flex: 1, height: 1, backgroundColor: colors.divider },
  ou: { fontFamily: fonts.text, fontSize: 12, color: colors.muted, fontWeight: poids.fort },
  lien: { alignItems: "center", minHeight: 44, justifyContent: "center" },
  lienTexte: { fontFamily: fonts.text, fontSize: 14, fontWeight: poids.fort, color: colors.brandPrimary },
}));
