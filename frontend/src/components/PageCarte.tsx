import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icone } from "@/src/components/Icone";
import { useT } from "@/src/i18n";
import { VuePaiementCarte } from "@/src/plateforme/paiement-carte";
import { colors, fonts, poids, spacing, stylesDynamiques } from "@/src/theme";

/** Page de paiement par carte Flexpaie, plein écran dans l'app. Fermée au retour ou par le client. */
export function PageCarte({ url, retour, onFermee }: { url: string; retour: string; onFermee: () => void }) {
  const t = useT();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible animationType="slide" onRequestClose={onFermee}>
      <View testID="page-paiement-carte" style={[styles.ecran, { paddingBottom: insets.bottom }]}>
        <View style={[styles.entete, { paddingTop: insets.top + spacing.sm }]}>
          <Icone name="lock" size={16} color={colors.brandPrimary} />
          <Text style={styles.titre}>{t("paiement.pageCarte")}</Text>
          <Pressable
            testID="btn-fermer-page-carte"
            accessibilityRole="button"
            accessibilityLabel={t("paiement.fermer")}
            onPress={onFermee}
            style={styles.fermer}
          >
            <Icone name="x" size={22} color={colors.onSurface} />
          </Pressable>
        </View>
        <VuePaiementCarte url={url} retour={retour} onRetour={onFermee} />
      </View>
    </Modal>
  );
}

const styles = stylesDynamiques(() => StyleSheet.create({
  ecran: { flex: 1, backgroundColor: colors.surface },
  entete: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  titre: { flex: 1, fontFamily: fonts.display, fontSize: 16, fontWeight: poids.fort, color: colors.onSurface },
  fermer: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
}));
