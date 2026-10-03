import { useRouter } from "expo-router";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/src/auth";
import { Bouton } from "@/src/components/Bouton";
import { ChoixTheme } from "@/src/components/ChoixTheme";
import { Icone } from "@/src/components/Icone";
import { LiensLegaux } from "@/src/components/LiensLegaux";
import { ReglagesNotifications } from "@/src/components/ReglagesNotifications";
import { useLangue, type Langue } from "@/src/i18n";
import { LARGEUR_CONTENU } from "@/src/reactif";
import { colors, fonts, poids, radius, softShadow, spacing, stylesDynamiques } from "@/src/theme";
import { useTheme } from "@/src/theme-contexte";
import { useToast } from "@/src/toast";

export default function ParametresLivreur() {
  useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { user, deconnexion } = useAuth();
  const { langue, t, enregistrerPrefs } = useLangue();

  return (
    <View testID="ecran-parametres-livreur" style={styles.ecran}>
      <View style={[styles.entete, { paddingTop: spacing.lg }]}>
        <Pressable testID="btn-retour-parametres-livreur" onPress={() => router.back()} style={styles.iconeBtn}>
          <Icone name="arrow-left" size={20} color={colors.brandPrimary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.titre}>{t("params.titre")}</Text>
          <Text style={styles.sousTitre}>{user?.nom}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.contenu, { paddingBottom: insets.bottom + spacing.xxxl }]}>
        <View style={styles.section}>
          <Text style={styles.sectionTitre}>{t("params.theme")}</Text>
          <View style={styles.carte}>
            <ChoixTheme onChange={() => toast.show(t("params.enregistre"), "succes")} />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitre}>{t("params.langue")}</Text>
          <View style={styles.carte}>
            <View style={styles.langues}>
              {(["fr", "en"] as Langue[]).map((code) => {
                const actif = langue === code;
                return (
                  <Pressable
                    key={code}
                    testID={`btn-langue-livreur-${code}`}
                    onPress={async () => {
                      try {
                        await enregistrerPrefs({ langue: code });
                        toast.show(t("params.enregistre"), "succes");
                      } catch (e: any) {
                        toast.show(e.message, "erreur");
                      }
                    }}
                    style={[styles.langue, actif && styles.langueActive]}
                  >
                    <Text style={[styles.langueTexte, actif && styles.langueTexteActif]}>
                      {code === "fr" ? "Français" : "English"}
                    </Text>
                    {actif ? <Icone name="check" size={16} color={colors.onBrandPrimary} /> : null}
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>

        <ReglagesNotifications
          invite={t("livreur.notifications")}
          types={[{ cle: "notifCourses", label: "notifs.typeCourses", detail: "notifs.typeCoursesDetail" }]}
        />

        <LiensLegaux />

        <Bouton
          testID="btn-deconnexion-livreur"
          label={t("compte.deconnexion")}
          variant="danger"
          icone="log-out"
          onPress={async () => {
            await deconnexion();
            router.replace("/bienvenue");
          }}
        />
      </ScrollView>
    </View>
  );
}

const styles = stylesDynamiques(() => StyleSheet.create({
  ecran: { flex: 1, backgroundColor: colors.surfaceSecondary },
  entete: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  iconeBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  titre: { fontFamily: fonts.display, fontSize: 21, fontWeight: poids.fort, color: colors.onSurface },
  sousTitre: { fontFamily: fonts.text, fontSize: 12, fontWeight: poids.corps, color: colors.muted },
  contenu: { ...LARGEUR_CONTENU, paddingHorizontal: spacing.lg, gap: spacing.lg },
  section: { gap: spacing.sm },
  sectionTitre: {
    fontFamily: fonts.text,
    fontSize: 12,
    fontWeight: poids.fort,
    color: colors.muted,
    textTransform: "uppercase",
  },
  carte: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    ...softShadow,
  },
  langues: { flexDirection: "row", gap: spacing.sm, padding: spacing.md },
  langue: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    minHeight: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.brandTertiary,
  },
  langueActive: { backgroundColor: colors.brandPrimary },
  langueTexte: { fontFamily: fonts.text, fontSize: 14, fontWeight: poids.fort, color: colors.brandPrimary },
  langueTexteActif: { color: colors.onBrandPrimary },
}));
