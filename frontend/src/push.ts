import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;

export type EtatPush = {
  /** Le device peut recevoir des push (jamais le cas sur le web ni en simulateur). */
  supporte: boolean;
  statut: Notifications.PermissionStatus | "non_supporte";
  peutRedemander: boolean;
};

export async function etatPush(): Promise<EtatPush> {
  if (Platform.OS === "web" || !Device.isDevice) {
    return { supporte: false, statut: "non_supporte", peutRedemander: false };
  }
  const { status, canAskAgain } = await Notifications.getPermissionsAsync();
  return { supporte: true, statut: status, peutRedemander: canAskAgain };
}

/** Envoie le token natif du device au backend. Les tokens tournent : à rappeler
 *  à chaque retour au premier plan. Ne bloque jamais le reste de l'app. */
export async function enregistrerToken(userId: string): Promise<boolean> {
  if (Platform.OS === "web" || !Device.isDevice) return false;
  try {
    const token = await Notifications.getDevicePushTokenAsync();
    const res = await fetch(`${BASE}/api/register-push`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, platform: Platform.OS, device_token: token.data }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Demande l'autorisation (après une explication affichée par l'appelant) puis
 *  enregistre le device. Renvoie l'état final des permissions. */
export async function demanderPush(userId: string): Promise<EtatPush> {
  const avant = await etatPush();
  if (!avant.supporte) return avant;
  if (avant.statut === "granted") {
    await enregistrerToken(userId);
    return avant;
  }
  if (!avant.peutRedemander) return avant;

  const { status, canAskAgain } = await Notifications.requestPermissionsAsync();
  if (status === "granted") await enregistrerToken(userId);
  return { supporte: true, statut: status, peutRedemander: canAskAgain };
}
