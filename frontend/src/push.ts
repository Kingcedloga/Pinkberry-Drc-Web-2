import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;

/**
 * Demande l'autorisation puis enregistre le token natif du device auprès du
 * backend. À appeler après connexion et à chaque ouverture de l'app (les
 * tokens tournent). Ne bloque jamais le reste de l'app.
 */
export async function enregistrerPush(userId: string): Promise<boolean> {
  if (Platform.OS === "web" || !Device.isDevice) return false;
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== "granted") return false;

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
