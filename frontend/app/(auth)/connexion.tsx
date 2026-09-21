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
import { useConfigApp } from "@/src/taux";
import { useToast } from "@/src/toast";

export default function Connexion() {
  useTheme();
  const router = useRouter();
  const { connexion, connexionGoogle } = useAuth();
  const toast = useToast();
  const { demo } = useConfigApp();

  const [telephone, setTelephone] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [loading, setLoading] = useState(false);

  const valider = async () => {
    setLoading(true);
    try {
      const u = await connexion(telephone, motDePasse);
      toast.show(`Bonjour ${u.nom} !`, "succes");
      router.replace(
        u.role === "admin" || u.role === "superadmin"
          ? "/dashboard"
          : u.role === "livreur"
            ? "/courses"
            : "/accueil",
      );
    } catch (e: any) {
      toast.show(e.message, "erreur");
    } finally {
      setLoading(false);
    }
  };

  return (
    <CarteAuth testID="ecran-connexion">
      <KeyboardAwareScrollView bottomOffset={100} contentContainerStyle={styles.contenu}>
        <EnteteMarque taille={30} />

        <View style={styles.titres}>
          <Text style={styles.titre}>Connexion</Text>
          <Text style={styles.sous}>Téléphone et mot de passe</Text>
        </View>

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
            placeholder="••••••••••••"
            secureTextEntry
          />
        </View>

        <Bouton testID="btn-valider-connexion" label="Se connecter" loading={loading} onPress={valider} />

        <View style={styles.separateurRow}>
          <View style={styles.trait} />
          <Text style={styles.ou}>ou</Text>
          <View style={styles.trait} />
        </View>

        <BoutonGoogle
          testID="btn-google-connexion"
          onPress={async () => {
            try {
              await connexionGoogle();
              router.replace("/");
            } catch (e: any) {
              toast.show(e.message ?? "Connexion Google impossible", "erreur");
            }
          }}
        />

        {demo ? (
          <View testID="bloc-comptes-demo" style={styles.demo}>
            <View style={styles.demoTitre}>
              <Icone name="key" size={15} color={colors.brandPrimary} />
              <Text style={styles.demoTitreTexte}>Comptes de démonstration</Text>
            </View>
            <Text style={styles.demoTexte}>Client : 0990000001 / client123</Text>
            <Text style={styles.demoTexte}>Livreur : 0820000001 / livreur123</Text>
            <Text style={styles.demoTexte}>Admin : 0810000000 / admin123</Text>
          </View>
        ) : null}

        <Pressable testID="lien-inscription" onPress={() => router.replace("/inscription")} style={styles.lien}>
          <Text style={styles.lienTexte}>Créer un compte</Text>
        </Pressable>
      </KeyboardAwareScrollView>

      <Pressable testID="btn-retour-connexion" onPress={() => router.back()} style={styles.retour} hitSlop={10}>
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
  demo: { backgroundColor: colors.brandTertiary, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.xs },
  demoTitre: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.xs },
  demoTitreTexte: { fontFamily: fonts.text, fontSize: 13, fontWeight: poids.fort, color: colors.brandPrimary },
  demoTexte: { fontFamily: fonts.text, fontSize: 12, color: colors.onSurface },
  lien: { alignItems: "center", minHeight: 44, justifyContent: "center" },
  lienTexte: { fontFamily: fonts.text, fontSize: 14, fontWeight: poids.fort, color: colors.brandPrimary },
}));
