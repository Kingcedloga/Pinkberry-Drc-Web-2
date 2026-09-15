import * as Linking from "expo-linking";
import { useCallback, useEffect } from "react";
import { AppState, Platform } from "react-native";

import { useAuth } from "@/src/auth";
import { enregistrerToken, etatPush } from "@/src/push";

/**
 * Rafraîchit silencieusement le token push quand l'autorisation est déjà
 * accordée (les tokens natifs tournent). Aucune popup système ici : la demande
 * d'autorisation se fait depuis la carte « Notifications », après explication.
 */
export function GestionPush() {
  const { user } = useAuth();

  const rafraichir = useCallback(async () => {
    if (!user || Platform.OS === "web") return;
    const etat = await etatPush();
    if (etat.statut === "granted") await enregistrerToken(user.id);
  }, [user]);

  useEffect(() => {
    rafraichir();
    const sub = AppState.addEventListener("change", (etat) => {
      if (etat === "active") rafraichir();
    });
    return () => sub.remove();
  }, [rafraichir]);

  return null;
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
