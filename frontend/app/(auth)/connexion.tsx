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
import { colors, fonts, radius, spacing } from "@/src/theme";
import { useToast } from "@/src/toast";

export default function Connexion() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { connexion } = useAuth();
  const toast = useToast();

  const [telephone, setTelephone] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [loading, setLoading] = useState(false);

  const valider = async () => {
    setLoading(true);
    try {
      const u = await connexion(telephone, motDePasse);
      toast.show(`Bonjour ${u.nom} !`, "succes");
      router.replace(u.role === "admin" ? "/dashboard" : u.role === "livreur" ? "/courses" : "/accueil");
    } catch (e: any) {
      toast.show(e.message, "erreur");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View testID="ecran-connexion" style={styles.ecran}>
      <KeyboardAwareScrollView
        bottomOffset={100}
        contentContainerStyle={[
          styles.contenu,
          { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.xxl },
        ]}
      >
        <Pressable testID="btn-retour-connexion" onPress={() => router.back()} style={styles.retour} hitSlop={10}>
          <Feather name="arrow-left" size={22} color={colors.onSurface} />
        </Pressable>

        <Logo taille={26} />
        <Text style={styles.titre}>Connexion</Text>
        <Text style={styles.sous}>Téléphone et mot de passe</Text>

        <View style={styles.form}>
          <Champ
            label="Téléphone"
            testID="input-connexion-telephone"
            value={telephone}
            onChangeText={setTelephone}
            placeholder="0990000001"
            keyboardType="phone-pad"
          />
          <Champ
            label="Mot de passe"
            testID="input-connexion-motdepasse"
            value={motDePasse}
            onChangeText={setMotDePasse}
            placeholder="••••••"
            secureTextEntry
          />
        </View>

        <Bouton testID="btn-valider-connexion" label="Se connecter" loading={loading} onPress={valider} />

        <View testID="bloc-comptes-demo" style={styles.demo}>
          <View style={styles.demoTitre}>
            <Feather name="key" size={15} color={colors.brandPrimary} />
            <Text style={styles.demoTitreTexte}>Comptes de démonstration</Text>
          </View>
          <Text style={styles.demoTexte}>Client : 0990000001 / client123</Text>
          <Text style={styles.demoTexte}>Livreur : 0820000001 / livreur123</Text>
          <Text style={styles.demoTexte}>Admin : 0810000000 / admin123</Text>
        </View>

        <Pressable testID="lien-inscription" onPress={() => router.replace("/inscription")} style={styles.lien}>
          <Text style={styles.lienTexte}>Créer un compte</Text>
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
  demo: { backgroundColor: colors.brandTertiary, borderRadius: radius.md, padding: spacing.lg, gap: spacing.xs },
  demoTitre: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.xs },
  demoTitreTexte: { fontFamily: fonts.text, fontSize: 13, fontWeight: "800", color: colors.brandPrimary },
  demoTexte: { fontFamily: fonts.text, fontSize: 12, color: colors.onSurface },
  lien: { alignItems: "center", minHeight: 44, justifyContent: "center" },
  lienTexte: { fontFamily: fonts.text, fontSize: 14, fontWeight: "700", color: colors.brandPrimary },
});
