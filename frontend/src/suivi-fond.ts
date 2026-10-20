import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { Platform } from "react-native";

import { CLE_JETON } from "@/src/prefs";
import { storage } from "@/src/utils/storage";

/**
 * Applis natives (iOS / Android) : partage de la position du livreur même
 * écran verrouillé ou app en arrière-plan, pendant une course « en route »
 * uniquement. Android affiche une notification permanente tant que le partage
 * est actif (service de premier plan). Le web (PWA) ne permet pas ce mode :
 * l'écran y reste allumé pendant la course (voir src/geoloc.ts).
 */
export const TACHE_POSITION = "pinkberry-position-livreur";
const natif = Platform.OS !== "web";
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

/** Autorisation « toujours » : accordée, à demander, ou refusée définitivement. */
export async function etatPermissionFond(): Promise<"accordee" | "a_demander" | "refusee" | "indisponible"> {
  if (!natif) return "indisponible";
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
    const fond = await Location.getBackgroundPermissionsAsync();
    if (!fond.granted && !(await Location.requestBackgroundPermissionsAsync()).granted) return false;
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
