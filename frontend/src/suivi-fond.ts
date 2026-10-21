import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { Platform } from "react-native";

import { CLE_JETON } from "@/src/prefs";
import { storage } from "@/src/utils/storage";

/**
 * Applis natives (iOS / Android) : partage de la position du livreur même
 * écran verrouillé, pendant une course « en route » uniquement.
 * - iOS : autorisation « Toujours », mode d'arrière-plan `location`.
 * - Android : JAMAIS d'autorisation d'arrière-plan (ACCESS_BACKGROUND_LOCATION
 *   est bloquée dans app.json). Le partage tourne dans un service de premier
 *   plan (notification permanente), démarré app ouverte avec la seule
 *   autorisation « pendant l'utilisation ».
 * Le web (PWA) ne permet pas ce mode : l'écran y reste allumé pendant la course
 * (voir src/geoloc.ts).
 */
export const TACHE_POSITION = "pinkberry-position-livreur";
const natif = Platform.OS !== "web";
const android = Platform.OS === "android";
/** Android : explication du partage écran verrouillé déjà acceptée sur cet appareil. */
const CLE_PARTAGE_ACCEPTE = "pb_partage_fond_accepte";
const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;

// La tâche doit être déclarée au chargement du module, avant tout démarrage.
if (natif) {
  TaskManager.defineTask(TACHE_POSITION, async ({ data, error }) => {
    if (error || !data) return;
    const positions = (data as { locations?: Location.LocationObject[] }).locations ?? [];
    const derniere = positions[positions.length - 1];
    if (!derniere) return;
    const jeton = await storage.secureGet<string>(CLE_JETON, "");
    if (!jeton) return;
    try {
      await fetch(`${BASE}/api/livreur/position`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${jeton}` },
        body: JSON.stringify({ lat: derniere.coords.latitude, lng: derniere.coords.longitude }),
      });
    } catch {
      /* réseau coupé : la position suivante sera envoyée */
    }
  });
}

/**
 * Partage écran verrouillé : accordé, à proposer (explication à afficher), ou refusé.
 * iOS : autorisation « Toujours ». Android : explication acceptée une fois (aucune
 * autorisation supplémentaire, le service de premier plan suffit).
 */
export async function etatPermissionFond(): Promise<"accordee" | "a_demander" | "refusee" | "indisponible"> {
  if (!natif) return "indisponible";
  if (android) return (await storage.getItem<string>(CLE_PARTAGE_ACCEPTE, "")) ? "accordee" : "a_demander";
  try {
    const p = await Location.getBackgroundPermissionsAsync();
    if (p.granted) return "accordee";
    return p.canAskAgain ? "a_demander" : "refusee";
  } catch {
    return "indisponible";
  }
}

/** Demande l'autorisation (après l'explication affichée par l'app) puis démarre le partage. */
export async function demarrerSuiviFond(notification: { titre: string; texte: string }): Promise<boolean> {
  if (!natif) return false;
  try {
    const avant = await Location.getForegroundPermissionsAsync();
    if (!avant.granted && !(await Location.requestForegroundPermissionsAsync()).granted) return false;
    // iOS seulement : Android n'a pas (et ne demande jamais) l'autorisation d'arrière-plan.
    if (!android) {
      const fond = await Location.getBackgroundPermissionsAsync();
      if (!fond.granted && !(await Location.requestBackgroundPermissionsAsync()).granted) return false;
    }
    if (await Location.hasStartedLocationUpdatesAsync(TACHE_POSITION)) return true;
    await Location.startLocationUpdatesAsync(TACHE_POSITION, {
      accuracy: Location.Accuracy.High,
      timeInterval: 5000,
      distanceInterval: 25,
      deferredUpdatesInterval: 5000,
      pausesUpdatesAutomatically: false,
      activityType: Location.ActivityType.AutomotiveNavigation,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: notification.titre,
        notificationBody: notification.texte,
        notificationColor: "#E6156F",
      },
    });
    if (android) await storage.setItem(CLE_PARTAGE_ACCEPTE, "1");
    return true;
  } catch {
    return false;
  }
}

/** Arrêt complet (fin de course, déconnexion). */
export async function arreterSuiviFond(): Promise<void> {
  if (!natif) return;
  try {
    if (await Location.hasStartedLocationUpdatesAsync(TACHE_POSITION)) {
      await Location.stopLocationUpdatesAsync(TACHE_POSITION);
    }
  } catch {
    /* déjà arrêté */
  }
}
