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
import { colors, fonts, poids, radius, spacing, stylesDynamiques } from "@/src/theme";
import { useTheme } from "@/src/theme-contexte";
import { useToast } from "@/src/toast";

export default function Inscription() {
  useTheme();
  const router = useRouter();
  const { inscription, connexionGoogle } = useAuth();
  const toast = useToast();

  const [nom, setNom] = useState("");
  const [telephone, setTelephone] = useState("");
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [loading, setLoading] = useState(false);

  const valider = async () => {
    if (!nom.trim() || telephone.trim().length < 9 || motDePasse.length < 6) {
      toast.show("Nom, téléphone (9 chiffres) et mot de passe (6 caractères) requis", "erreur");
      return;
    }
    setLoading(true);
    try {
      const r = await inscription({ nom, telephone, email: email || undefined, motDePasse });
      toast.show(r.emailEnvoye ? "Code envoyé par email" : "Code généré", "succes");
      router.push({ pathname: "/otp", params: { telephone, codeDemo: r.codeDemo } });
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
          <Text style={styles.titre}>Créer mon compte</Text>
          <Text style={styles.sous}>Votre numéro sert d&apos;identifiant. L&apos;email est facultatif.</Text>
        </View>

        <View style={styles.form}>
          <Champ
            label="Nom complet"
            testID="input-nom"
            value={nom}
            onChangeText={setNom}
            placeholder="Ex. Grace Kabila"
            autoCapitalize="words"
          />
          <Champ
            label="Téléphone"
            testID="input-telephone"
            value={telephone}
            onChangeText={setTelephone}
            placeholder="0990000001"
            keyboardType="phone-pad"
          />
          <Champ
            label="Email (facultatif)"
            testID="input-email"
            value={email}
            onChangeText={setEmail}
            placeholder="vous@email.com"
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <Champ
            label="Mot de passe"
            testID="input-motdepasse"
            value={motDePasse}
            onChangeText={setMotDePasse}
            placeholder="6 caractères minimum"
            secureTextEntry
          />
        </View>

        <Bouton testID="btn-valider-inscription" label="Créer mon compte" loading={loading} onPress={valider} />

        <View style={styles.separateurRow}>
          <View style={styles.trait} />
          <Text style={styles.ou}>ou</Text>
          <View style={styles.trait} />
        </View>

        <BoutonGoogle
          testID="btn-google-inscription"
          label="S'inscrire avec Google"
          onPress={async () => {
            try {
              await connexionGoogle();
              router.replace("/");
            } catch (e: any) {
              toast.show(e.message ?? "Connexion Google impossible", "erreur");
            }
          }}
        />

        <Pressable testID="lien-connexion" onPress={() => router.replace("/connexion")} style={styles.lien}>
          <Text style={styles.lienTexte}>J&apos;ai déjà un compte</Text>
        </Pressable>
      </KeyboardAwareScrollView>

      <Pressable testID="btn-retour" onPress={() => router.back()} style={styles.retour} hitSlop={10}>
        <Icone name="arrow-left" size={20} color={colors.onSurface} />
      </Pressable>
    </CarteAuth>
  );
}

const styles = stylesDynamiques(() => StyleSheet.create({
  contenu: { paddingHorizontal: spacing.lg, paddingTop: spacing.xs, paddingBottom: spacing.xxl, gap: spacing.lg },
  retour: {
    position: "absolute",
    top: spacing.md,
    left: spacing.md,
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceSecondary,
  },
  titres: { alignItems: "center", gap: 4 },
  titre: { fontFamily: fonts.display, fontSize: 24, fontWeight: poids.fort, color: colors.onSurface },
  sous: { fontFamily: fonts.text, fontSize: 13, color: colors.muted, textAlign: "center" },
  form: { gap: spacing.md },
  separateurRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  trait: { flex: 1, height: 1, backgroundColor: colors.divider },
  ou: { fontFamily: fonts.text, fontSize: 12, color: colors.muted, fontWeight: poids.fort },
  lien: { alignItems: "center", minHeight: 44, justifyContent: "center" },
  lienTexte: { fontFamily: fonts.text, fontSize: 14, fontWeight: poids.fort, color: colors.brandPrimary },
}));
