import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { Platform } from "react-native";

import type { ErreurGps, EtatPermission, Fix, TextesFond } from "@/src/plateforme/types";
import { CLE_JETON } from "@/src/prefs";
import { storage } from "@/src/utils/storage";

/**
 * Position du livreur — iOS / Android (expo-location). Même API que position.web.ts.
 *
 * Partage écran verrouillé, pendant une course « en route » uniquement :
 * - iOS : autorisation « Toujours », mode d'arrière-plan `location` ;
 * - Android : JAMAIS d'autorisation d'arrière-plan (ACCESS_BACKGROUND_LOCATION
 *   est bloquée dans app.json). Le partage tourne dans un service de premier
 *   plan (notification permanente), démarré app ouverte avec la seule
 *   autorisation « pendant l'utilisation ».
 */
export type { ErreurGps, EtatPermission, Fix };

const android = Platform.OS === "android";
const TACHE_POSITION = "pinkberry-position-livreur";
/** Android : explication du partage écran verrouillé déjà acceptée sur cet appareil. */
const CLE_PARTAGE_ACCEPTE = "pb_partage_fond_accepte";
const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;

/** Le partage continue écran verrouillé (web : non, l'écran reste allumé). */
export const partageFondDisponible = true;

/** Android n'a pas d'autorisation « Toujours » : pas de consigne à donner. */
export const textesFond: TextesFond = android
  ? { explication: "livreur.fondExplicationAndroid", consigne: null }
  : { explication: "livreur.fondExplication", consigne: "livreur.fondConsigne" };

const versFix = (c: { latitude: number; longitude: number; accuracy?: number | null }, at: number): Fix => ({
  lat: c.latitude,
  lng: c.longitude,
  precision: c.accuracy ?? null,
  at,
});

// ------------------------------------------------------------ premier plan

export async function lirePermission(): Promise<EtatPermission> {
  try {
    const p = await Location.getForegroundPermissionsAsync();
    if (p.granted) return "accordee";
    return p.canAskAgain ? "a_demander" : "refusee";
  } catch {
    return "indisponible";
  }
}

/** Position actuelle, en demandant l'autorisation si besoin (fenêtre du système). */
export async function positionActuelle(delaiMs = 15000): Promise<Fix> {
  const p = await Location.requestForegroundPermissionsAsync();
  if (!p.granted) throw "refusee" satisfies ErreurGps;
  const pos = await Promise.race([
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
    new Promise<never>((_, rej) => setTimeout(() => rej("delai" satisfies ErreurGps), delaiMs)),
  ]);
  return versFix(pos.coords, pos.timestamp || Date.now());
}

/** Suivi continu. Renvoie la fonction d'arrêt. */
export async function suivrePosition(onFix: (f: Fix) => void, onErreur: (e: ErreurGps) => void): Promise<() => void> {
  const abo = await Location.watchPositionAsync(
    { accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 10 },
    (p) => onFix(versFix(p.coords, p.timestamp || Date.now())),
    () => onErreur("indisponible"),
  );
  return () => abo.remove();
}

/** Natif : aucun évènement ; l'autorisation rendue dans les réglages est relue par l'appelant. */
export async function surChangementPermission(_cb: (etat: EtatPermission) => void): Promise<() => void> {
  return () => undefined;
}

/** Natif : inutile, le partage écran verrouillé prend le relais. */
export function garderEcranAllume(): () => void {
  return () => undefined;
}

// ------------------------------------------------------- écran verrouillé

// La tâche doit être déclarée au chargement du module, avant tout démarrage.
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

/**
 * Partage écran verrouillé : accordé, à proposer (explication à afficher), ou refusé.
 * iOS : autorisation « Toujours ». Android : explication acceptée une fois (aucune
 * autorisation supplémentaire, le service de premier plan suffit).
 */
export async function etatPermissionFond(): Promise<EtatPermission> {
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
  try {
    if (await Location.hasStartedLocationUpdatesAsync(TACHE_POSITION)) {
      await Location.stopLocationUpdatesAsync(TACHE_POSITION);
    }
  } catch {
    /* déjà arrêté */
  }
}
