import React from "react";
import { StyleSheet, Switch, Text, View } from "react-native";

import { CarteNotifications } from "@/src/components/CarteNotifications";
import { useLangue, type CleTexte, type Preferences } from "@/src/i18n";
import { colors, fonts, radius, spacing, stylesDynamiques } from "@/src/theme";
import { useToast } from "@/src/toast";

type Cle = Extract<keyof Preferences, `notif${string}`>;

/**
 * Section « Notifications » des paramètres (admin, livreur) : activation des
 * push sur cet appareil + types de notifications reçus. Le serveur applique ces
 * préférences à l'envoi (push et notifications internes).
 */
export function ReglagesNotifications({
  invite,
  types,
}: {
  invite: string;
  types: { cle: Cle; label: CleTexte; detail: CleTexte }[];
}) {
  const { t, prefs, enregistrerPrefs } = useLangue();
  const toast = useToast();

  const changer = async (cle: Cle, valeur: boolean) => {
    try {
      await enregistrerPrefs({ [cle]: valeur } as Partial<Preferences>);
      toast.show(t("params.enregistre"), "succes");
    } catch (e: any) {
      toast.show(e.message, "erreur");
    }
  };

  return (
    <View style={styles.section} testID="reglages-notifications">
      <Text style={styles.sectionTitre}>{t("params.notifications")}</Text>
      <CarteNotifications texte={invite} masquable={false} />
      <View style={styles.carte}>
        {types.map((type) => (
          <View key={type.cle} style={styles.ligne}>
            <View style={styles.texte}>
              <Text style={styles.label}>{t(type.label)}</Text>
              <Text style={styles.detail}>{t(type.detail)}</Text>
            </View>
            <Switch
              testID={`switch-${type.cle}`}
              value={prefs[type.cle] !== false}
              onValueChange={(v) => changer(type.cle, v)}
              trackColor={{ true: colors.brandPrimary, false: colors.border }}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = stylesDynamiques(() =>
  StyleSheet.create({
    section: { gap: spacing.sm },
    sectionTitre: {
      fontFamily: fonts.text,
      fontSize: 12,
      fontWeight: "800",
      color: colors.muted,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    carte: {
      backgroundColor: colors.surface,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.lg,
    },
    ligne: { flexDirection: "row", alignItems: "center", gap: spacing.md, minHeight: 64, paddingVertical: spacing.sm },
    texte: { flex: 1, gap: 2 },
    label: { fontFamily: fonts.text, fontSize: 15, fontWeight: "700", color: colors.onSurface },
    detail: { fontFamily: fonts.text, fontSize: 12, color: colors.muted },
  }),
);
