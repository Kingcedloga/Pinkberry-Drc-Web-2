import * as Location from "expo-location";
import { Platform } from "react-native";

/**
 * Géolocalisation du livreur, web (PWA) et natif. Sur le web on passe par l'API
 * du navigateur (watchPosition) pour récupérer les erreurs, que l'implémentation
 * web d'expo-location ne remonte pas (refus, GPS coupé).
 */
export type Fix = { lat: number; lng: number; precision: number | null; at: number };
/** `a_demander` : jamais demandée ; `refusee` : refusée ou retirée ; `indisponible` : pas de GPS. */
export type EtatPermission = "accordee" | "a_demander" | "refusee" | "indisponible";
export type ErreurGps = "refusee" | "indisponible" | "delai";

const web = Platform.OS === "web";
const geo = () => (typeof navigator !== "undefined" ? navigator.geolocation : undefined);

const versFix = (c: { latitude: number; longitude: number; accuracy?: number | null }, at: number): Fix => ({
  lat: c.latitude,
  lng: c.longitude,
  precision: c.accuracy ?? null,
  at,
});

const erreurWeb = (e: GeolocationPositionError): ErreurGps =>
  e.code === e.PERMISSION_DENIED ? "refusee" : e.code === e.TIMEOUT ? "delai" : "indisponible";

export async function lirePermission(): Promise<EtatPermission> {
  if (web) {
    if (!geo()) return "indisponible";
    try {
      const p = await navigator.permissions.query({ name: "geolocation" as PermissionName });
      return p.state === "granted" ? "accordee" : p.state === "denied" ? "refusee" : "a_demander";
    } catch {
      return "a_demander"; // navigateur sans API Permissions : on saura à la demande
    }
  }
  try {
    const p = await Location.getForegroundPermissionsAsync();
    if (p.granted) return "accordee";
    return p.canAskAgain ? "a_demander" : "refusee";
  } catch {
    return "indisponible";
  }
}

/** Position actuelle, en demandant l'autorisation si besoin (fenêtre du système). */
export function positionActuelle(delaiMs = 15000): Promise<Fix> {
  if (web) {
    return new Promise((resolve, reject) => {
      const g = geo();
      if (!g) return reject("indisponible" satisfies ErreurGps);
      g.getCurrentPosition(
        (p) => resolve(versFix(p.coords, p.timestamp || Date.now())),
        (e) => reject(erreurWeb(e)),
        { enableHighAccuracy: true, timeout: delaiMs, maximumAge: 5000 },
      );
    });
  }
  return (async () => {
    const p = await Location.requestForegroundPermissionsAsync();
    if (!p.granted) throw "refusee" satisfies ErreurGps;
    const pos = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
      new Promise<never>((_, rej) => setTimeout(() => rej("delai" satisfies ErreurGps), delaiMs)),
    ]);
    return versFix(pos.coords, pos.timestamp || Date.now());
  })();
}

/** Suivi continu. Renvoie la fonction d'arrêt. */
export async function suivrePosition(onFix: (f: Fix) => void, onErreur: (e: ErreurGps) => void): Promise<() => void> {
  if (web) {
    const g = geo();
    if (!g) {
      onErreur("indisponible");
      return () => undefined;
    }
    const id = g.watchPosition(
      (p) => onFix(versFix(p.coords, p.timestamp || Date.now())),
      (e) => onErreur(erreurWeb(e)),
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 20000 },
    );
    return () => g.clearWatch(id);
  }
  const abo = await Location.watchPositionAsync(
    { accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 10 },
    (p) => onFix(versFix(p.coords, p.timestamp || Date.now())),
    () => onErreur("indisponible"),
  );
  return () => abo.remove();
}

/** Web : prévient quand l'utilisateur retire (ou rend) l'autorisation pendant une course. */
export async function surChangementPermission(cb: (etat: EtatPermission) => void): Promise<() => void> {
  if (!web) return () => undefined;
  try {
    const p = await navigator.permissions.query({ name: "geolocation" as PermissionName });
    const ecouter = () => cb(p.state === "granted" ? "accordee" : p.state === "denied" ? "refusee" : "a_demander");
    p.addEventListener("change", ecouter);
    return () => p.removeEventListener("change", ecouter);
  } catch {
    return () => undefined;
  }
}

/** Distance en mètres entre deux points (formule de haversine). */
export function distanceMetres(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const r = (d: number) => (d * Math.PI) / 180;
  const h =
    Math.sin(r(b.lat - a.lat) / 2) ** 2 +
    Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

/**
 * Web : garde l'écran allumé pendant une course (le navigateur suspend le GPS
 * d'une page en arrière-plan). Renvoie la fonction de libération.
 */
export function garderEcranAllume(): () => void {
  const wl = web && typeof navigator !== "undefined" ? (navigator as any).wakeLock : null;
  if (!wl) return () => undefined;
  let verrou: any = null;
  let actif = true;
  const demander = async () => {
    try {
      if (actif && document.visibilityState === "visible") verrou = await wl.request("screen");
    } catch {
      /* refusé (économie d'énergie) : sans conséquence */
    }
  };
  // Le verrou tombe quand la page est masquée : on le reprend au retour.
  const visibilite = () => void demander();
  document.addEventListener("visibilitychange", visibilite);
  void demander();
  return () => {
    actif = false;
    document.removeEventListener("visibilitychange", visibilite);
    verrou?.release?.().catch?.(() => undefined);
  };
}
