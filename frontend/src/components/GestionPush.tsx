import * as Linking from "expo-linking";
import * as Notifications from "expo-notifications";
import React, { useCallback, useEffect, useState } from "react";
import { AppState, Linking as RNLinking, Modal, Platform, StyleSheet, Text, View } from "react-native";

import { useAuth } from "@/src/auth";
import { Bouton } from "@/src/components/Bouton";
import { Icone } from "@/src/components/Icone";
import { enregistrerPush } from "@/src/push";
import { colors, fonts, radius, spacing } from "@/src/theme";
import { storage } from "@/src/utils/storage";

const CLE_NUDGE = "pushNudgeAt";
const UNE_SEMAINE = 7 * 24 * 60 * 60 * 1000;

/**
 * Enregistre le device pour les notifications push (à la connexion et à chaque
 * retour au premier plan) et relance gentiment l'utilisateur qui a refusé.
 */
export function GestionPush() {
  const { user } = useAuth();
  const [nudge, setNudge] = useState(false);

  const enregistrer = useCallback(async () => {
    if (!user || Platform.OS === "web") return;
    await enregistrerPush(user.id);
  }, [user]);

  useEffect(() => {
    enregistrer();
    const sub = AppState.addEventListener("change", (etat) => {
      if (etat === "active") enregistrer();
    });
    return () => sub.remove();
  }, [enregistrer]);

  useEffect(() => {
    if (!user || Platform.OS === "web") return;
    (async () => {
      const { status, canAskAgain } = await Notifications.getPermissionsAsync();
      if (status !== "denied" || canAskAgain) return;
      const dernier = await storage.getItem<string>(CLE_NUDGE, "");
      if (dernier && Date.now() - Number(dernier) <= UNE_SEMAINE) return;
      setNudge(true);
    })();
  }, [user]);

  const fermer = async (ouvrirReglages: boolean) => {
    await storage.setItem(CLE_NUDGE, String(Date.now()));
    setNudge(false);
    if (ouvrirReglages) RNLinking.openSettings();
  };

  return (
    <Modal visible={nudge} transparent animationType="fade" onRequestClose={() => fermer(false)}>
      <View style={styles.voile}>
        <View testID="modal-nudge-push" style={styles.dialogue}>
          <Icone name="phone" size={28} color={colors.brandPrimary} />
          <Text style={styles.titre}>Suivez vos commandes</Text>
          <Text style={styles.texte}>
            Activez les notifications pour être prévenu quand votre livreur part et quand il arrive.
          </Text>
          <Bouton testID="btn-nudge-reglages" label="Ouvrir les réglages" onPress={() => fermer(true)} />
          <Bouton testID="btn-nudge-plus-tard" label="Plus tard" variant="contour" onPress={() => fermer(false)} />
        </View>
      </View>
    </Modal>
  );
}

/** Ouvre l'écran ciblé quand l'utilisateur tape une notification. */
export function ouvrirDepuisNotification(
  data: Record<string, any> | undefined,
  push: (href: string) => void,
) {
  const url = data?.deeplink || data?.action_url;
  if (!url) return;
  if (String(url).startsWith("http")) Linking.openURL(String(url));
  else push(String(url));
}

const styles = StyleSheet.create({
  voile: {
    flex: 1,
    backgroundColor: "rgba(42,23,33,0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  dialogue: {
    width: "100%",
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    gap: spacing.md,
    alignItems: "center",
  },
  titre: { fontFamily: fonts.display, fontSize: 20, color: colors.onSurface, textAlign: "center" },
  texte: { fontFamily: fonts.text, fontSize: 13, color: colors.muted, textAlign: "center" },
});
