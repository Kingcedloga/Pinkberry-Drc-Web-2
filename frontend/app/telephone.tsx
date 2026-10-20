import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/src/auth";
import { Bouton } from "@/src/components/Bouton";
import { Champ } from "@/src/components/Champ";
import { Garde, TOUS_ROLES } from "@/src/components/Garde";
import { Icone } from "@/src/components/Icone";
import { Logo } from "@/src/components/Logo";
import { useLangue } from "@/src/i18n";
import { CLE_TEL_REPORTE } from "@/src/prefs";
import { LARGEUR_ETROITE } from "@/src/reactif";
import { colors, fonts, radius, spacing, stylesDynamiques } from "@/src/theme";
import { useTheme } from "@/src/theme-contexte";
import { useToast } from "@/src/toast";
import { storage } from "@/src/utils/storage";

export default function DemandeTelephone() {
  useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { user, enregistrerTelephone } = useAuth();
  const { t } = useLangue();

  const [telephone, setTelephone] = useState("");
  const [loading, setLoading] = useState(false);

  const valider = async () => {
    if (telephone.trim().length < 9) {
      toast.show(t("auth.telephoneRequis"), "erreur");
      return;
    }
    setLoading(true);
    try {
      await enregistrerTelephone(telephone);
      await storage.removeItem(CLE_TEL_REPORTE);
      toast.show(t("auth.numeroEnregistre"), "succes");
      router.replace("/");
    } catch (e: any) {
      toast.show(e.message, "erreur");
    } finally {
      setLoading(false);
    }
  };

  const plusTard = async () => {
    await storage.setItem(CLE_TEL_REPORTE, "1");
    router.replace("/");
  };

  return (
    <Garde roles={TOUS_ROLES}>
    <View testID="ecran-telephone" style={styles.ecran}>
      <KeyboardAwareScrollView
        bottomOffset={100}
        contentContainerStyle={[
          styles.contenu,
          { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.xxl },
        ]}
      >
        <Logo taille={26} />
        <Text style={styles.titre}>{t("auth.bonjour", { nom: user?.nom?.split(" ")[0] ?? "" })}</Text>
        <Text style={styles.sous}>{t("auth.paragrapheTelephone")}</Text>

        <View style={styles.info}>
          <Icone name="phone" size={16} color={colors.brandPrimary} />
          <Text style={styles.infoTexte}>{t("auth.telephoneInfo")}</Text>
        </View>

        <Champ
          label={t("auth.telephone")}
          testID="input-telephone-compte"
          value={telephone}
          onChangeText={setTelephone}
          placeholder="0990000001"
          keyboardType="phone-pad"
        />

        <Bouton testID="btn-valider-telephone" label={t("commun.enregistrer")} loading={loading} onPress={valider} />

        <Pressable testID="btn-telephone-plus-tard" onPress={plusTard} style={styles.lien}>
          <Text style={styles.lienTexte}>{t("auth.plusTard")}</Text>
        </Pressable>
      </KeyboardAwareScrollView>
    </View>
    </Garde>
  );
}

const styles = stylesDynamiques(() => StyleSheet.create({
  ecran: { flex: 1, backgroundColor: colors.surfaceSecondary },
  contenu: { ...LARGEUR_ETROITE, paddingHorizontal: spacing.xl, gap: spacing.lg },
  titre: { fontFamily: fonts.display, fontSize: 26, color: colors.onSurface },
  sous: { fontFamily: fonts.text, fontSize: 14, color: colors.muted, marginTop: -spacing.md },
  info: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.brandTertiary,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  infoTexte: { fontFamily: fonts.text, fontSize: 13, fontWeight: "700", color: colors.brandPrimary },
  lien: { alignItems: "center", minHeight: 44, justifyContent: "center" },
  lienTexte: { fontFamily: fonts.text, fontSize: 14, fontWeight: "700", color: colors.brandPrimary },
}));
