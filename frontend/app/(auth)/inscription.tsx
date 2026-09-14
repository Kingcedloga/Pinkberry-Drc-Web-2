import Feather from "@react-native-vector-icons/feather";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/src/auth";
import { Bouton } from "@/src/components/Bouton";
import { Champ } from "@/src/components/Champ";
import { Logo } from "@/src/components/Logo";
import { colors, fonts, spacing } from "@/src/theme";
import { useToast } from "@/src/toast";

export default function Inscription() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { inscription } = useAuth();
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
    <View testID="ecran-inscription" style={styles.ecran}>
      <KeyboardAwareScrollView
        bottomOffset={100}
        contentContainerStyle={[
          styles.contenu,
          { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.xxl },
        ]}
      >
        <Pressable testID="btn-retour" onPress={() => router.back()} style={styles.retour} hitSlop={10}>
          <Feather name="arrow-left" size={22} color={colors.onSurface} />
        </Pressable>

        <Logo taille={26} />
        <Text style={styles.titre}>Créer mon compte</Text>
        <Text style={styles.sous}>Votre numéro sert d&apos;identifiant. L&apos;email est facultatif.</Text>

        <View style={styles.form}>
          <Champ label="Nom complet" testID="input-nom" value={nom} onChangeText={setNom} placeholder="Ex. Grace Kabila" autoCapitalize="words" />
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

        <Pressable testID="lien-connexion" onPress={() => router.replace("/connexion")} style={styles.lien}>
          <Text style={styles.lienTexte}>J&apos;ai déjà un compte</Text>
        </Pressable>
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: colors.surfaceSecondary },
  contenu: { paddingHorizontal: spacing.xl, gap: spacing.lg },
  retour: { width: 44, height: 44, justifyContent: "center" },
  titre: { fontFamily: fonts.display, fontSize: 26, color: colors.onSurface },
  sous: { fontFamily: fonts.text, fontSize: 14, color: colors.muted, marginTop: -spacing.md },
  form: { gap: spacing.md },
  lien: { alignItems: "center", minHeight: 44, justifyContent: "center" },
  lienTexte: { fontFamily: fonts.text, fontSize: 14, fontWeight: "700", color: colors.brandPrimary },
});
