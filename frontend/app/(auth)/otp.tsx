import { Icone } from "@/src/components/Icone";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { apiFetch } from "@/src/api";
import { useAuth } from "@/src/auth";
import { Bouton } from "@/src/components/Bouton";
import { Logo } from "@/src/components/Logo";
import { colors, fonts, radius, spacing, stylesDynamiques } from "@/src/theme";
import { useTheme } from "@/src/theme-contexte";
import { useToast } from "@/src/toast";

export default function VerificationOtp() {
  useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { verifierOtp } = useAuth();
  const toast = useToast();
  const params = useLocalSearchParams<{
    telephone?: string;
    email?: string;
    emailEnvoye?: string;
  }>();
  const telephone = params.telephone ?? "";
  const email = params.email ?? "";

  const [code, setCode] = useState("");
  const [envoiEchoue, setEnvoiEchoue] = useState(params.emailEnvoye === "0");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const valider = async () => {
    if (code.length !== 4) {
      toast.show("Entrez les 4 chiffres du code", "erreur");
      return;
    }
    setLoading(true);
    try {
      const u = await verifierOtp(telephone, code);
      toast.show("Compte vérifié, bienvenue !", "succes");
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

  const renvoyer = async () => {
    try {
      const r = await apiFetch<{ emailEnvoye?: boolean }>("/auth/renvoyer-otp", {
        method: "POST",
        body: { telephone, motDePasse: "" },
      });
      setEnvoiEchoue(r.emailEnvoye === false);
      toast.show(
        r.emailEnvoye ? "Nouveau code envoyé par email" : "Envoi impossible, réessayez",
        r.emailEnvoye ? "succes" : "erreur",
      );
    } catch (e: any) {
      toast.show(e.message, "erreur");
    }
  };

  const cases = [0, 1, 2, 3];

  return (
    <View testID="ecran-otp" style={styles.ecran}>
      <KeyboardAwareScrollView
        bottomOffset={100}
        contentContainerStyle={[
          styles.contenu,
          { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.xxl },
        ]}
      >
        <Pressable testID="btn-retour-otp" onPress={() => router.back()} style={styles.retour} hitSlop={10}>
          <Icone name="arrow-left" size={22} color={colors.onSurface} />
        </Pressable>

        <Logo taille={26} />
        <Text style={styles.titre}>Vérification</Text>
        <Text style={styles.sous}>Entrez le code à 4 chiffres envoyé à {email || "votre adresse email"}</Text>

        <Pressable style={styles.cases} onPress={() => inputRef.current?.focus()}>
          {cases.map((i) => (
            <View key={i} testID={`case-otp-${i}`} style={[styles.case, code.length === i && styles.caseActive]}>
              <Text style={styles.caseTexte}>{code[i] ?? ""}</Text>
            </View>
          ))}
        </Pressable>

        <TextInput
          ref={inputRef}
          testID="input-otp"
          value={code}
          onChangeText={(v) => setCode(v.replace(/[^0-9]/g, "").slice(0, 4))}
          keyboardType="number-pad"
          maxLength={4}
          style={styles.inputCache}
          autoFocus
        />

        {envoiEchoue ? (
          <View testID="bloc-email-echoue" style={styles.alerte}>
            <Icone name="alert-circle" size={16} color={colors.error} />
            <Text style={styles.alerteTexte}>
              L&apos;email n&apos;a pas pu être envoyé. Touchez « Renvoyer le code » dans quelques instants.
            </Text>
          </View>
        ) : null}

        <Bouton testID="btn-valider-otp" label="Vérifier mon email" loading={loading} onPress={valider} />

        <Pressable testID="btn-renvoyer-otp" onPress={renvoyer} style={styles.lien}>
          <Text style={styles.lienTexte}>Renvoyer le code</Text>
        </Pressable>
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = stylesDynamiques(() => StyleSheet.create({
  ecran: { flex: 1, backgroundColor: colors.surfaceSecondary },
  contenu: { paddingHorizontal: spacing.xl, gap: spacing.lg },
  retour: { width: 44, height: 44, justifyContent: "center" },
  titre: { fontFamily: fonts.display, fontSize: 26, color: colors.onSurface },
  sous: { fontFamily: fonts.text, fontSize: 14, color: colors.muted, marginTop: -spacing.md },
  cases: { flexDirection: "row", gap: spacing.md, justifyContent: "center", marginVertical: spacing.md },
  case: {
    width: 60,
    height: 68,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  caseActive: { borderColor: colors.borderStrong },
  caseTexte: { fontFamily: fonts.display, fontSize: 28, color: colors.onSurface },
  inputCache: { height: 1, opacity: 0, position: "absolute" },
  alerte: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.errorSoft,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  alerteTexte: { flex: 1, fontFamily: fonts.text, fontSize: 12, fontWeight: "700", color: colors.error },
  lien: { alignItems: "center", minHeight: 44, justifyContent: "center" },
  lienTexte: { fontFamily: fonts.text, fontSize: 14, fontWeight: "700", color: colors.brandPrimary },
}));
