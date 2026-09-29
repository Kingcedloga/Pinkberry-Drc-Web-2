import { Platform } from "react-native";

/**
 * Enregistre le service worker (PWA installable, notifications web). Les
 * balises du <head> (manifeste, icônes, Open Graph) sont dans public/index.html.
 */
export function initialiserWeb(): void {
  if (Platform.OS !== "web" || typeof navigator === "undefined") return;
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }
}
