import { isRunningInExpoGo } from "expo";
import * as Device from "expo-device";
import type * as ModuleNotifs from "expo-notifications";
import { Platform } from "react-native";

import i18n from "i18next";

import { obtenirToken } from "@/src/api";
import type { StatutNotifs } from "@/src/plateforme/types";

/**
 * Notifications système — iOS / Android (APNs / FCM via jeton natif).
 * Même API que notifications.web.ts.
 */
export type { StatutNotifs };

/** Les notifications se coupent dans l'app (sinon : réglages de l'appareil). */
export const desactivationDansApp = false;

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;

/**
 * Expo Go Android n'embarque pas le module natif ExpoTopicSubscriptionModule :
 * importer expo-notifications y plante au chargement de toute l'app. Le push
 * n'y fonctionne de toute façon pas (build de développement requis) : le module
 * n'est donc chargé qu'ailleurs, et l'adaptateur répond « non_supporte ».
 */
const Notifications: typeof ModuleNotifs | null =
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- chargement conditionnel voulu
  Platform.OS === "android" && isRunningInExpoGo() ? null : require("expo-notifications");

function versStatut(status: ModuleNotifs.PermissionStatus, canAskAgain: boolean): StatutNotifs {
  if (status === "granted") return "actives";
  return canAskAgain ? "a_demander" : "bloquees";
}

export async function lireStatutNotifs(): Promise<StatutNotifs> {
  if (!Notifications || !Device.isDevice) return "non_supporte";
  const { status, canAskAgain } = await Notifications.getPermissionsAsync();
  return versStatut(status, canAskAgain);
}

/** Envoie le jeton natif au backend. Ne bloque jamais le reste de l'app. */
async function enregistrerAppareil(userId: string): Promise<boolean> {
  const session = obtenirToken();
  if (!Notifications || !Device.isDevice || !session) return false;
  try {
    const token = await Notifications.getDevicePushTokenAsync();
    const res = await fetch(`${BASE}/api/register-push`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session}` },
      body: JSON.stringify({ user_id: userId, platform: Platform.OS, device_token: token.data }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Demande l'autorisation (après l'explication de l'app) puis enregistre l'appareil. */
export async function activerNotifs(userId: string): Promise<StatutNotifs> {
  const avant = await lireStatutNotifs();
  if (avant === "actives") await enregistrerAppareil(userId);
  if (avant !== "a_demander" || !Notifications) return avant;
  const { status, canAskAgain } = await Notifications.requestPermissionsAsync();
  const apres = versStatut(status, canAskAgain);
  if (apres === "actives") await enregistrerAppareil(userId);
  return apres;
}

/** Natif : rien à couper dans l'app (desactivationDansApp = false). */
export async function desactiverNotifs(): Promise<StatutNotifs> {
  return lireStatutNotifs();
}

/** Réenregistre l'appareil si déjà autorisé (les jetons tournent). Jamais de popup. */
export async function synchroniserNotifs(userId: string): Promise<void> {
  if ((await lireStatutNotifs()) === "actives") await enregistrerAppareil(userId);
}

/** À appeler une fois au chargement : affichage app ouverte, canal Android. */
export function preparerNotifications(): void {
  if (!Notifications) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
  // Canal Android créé avant toute réception de notification.
  if (Platform.OS === "android") {
    Notifications.setNotificationChannelAsync("default", {
      name: i18n.t("notifs.canalAndroid"),
      importance: Notifications.AndroidImportance.MAX,
      sound: "default",
    });
  }
}

type Donnees = Record<string, any> | undefined;

/** Une notification arrive alors que l'app est ouverte. Renvoie la fonction d'arrêt. */
export function surNotificationRecue(cb: () => void): () => void {
  if (!Notifications) return () => {};
  const abo = Notifications.addNotificationReceivedListener(() => cb());
  return () => abo.remove();
}

/** L'utilisateur touche une notification (app ouverte, ou démarrage à froid). */
export function surNotificationTouchee(cb: (donnees: Donnees) => void): () => void {
  if (!Notifications) return () => {};
  const abo = Notifications.addNotificationResponseReceivedListener((r) => cb(r.notification.request.content.data as Donnees));
  Notifications.getLastNotificationResponseAsync().then((r) => {
    if (r) cb(r.notification.request.content.data as Donnees);
  });
  return () => abo.remove();
}
