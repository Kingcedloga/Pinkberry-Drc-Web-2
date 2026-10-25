import type { ErreurGps, EtatPermission, Fix, TextesFond } from "@/src/plateforme/types";

/**
 * Position du livreur — web / PWA (API Geolocation du navigateur, qui remonte
 * les erreurs que l'implémentation web d'expo-location tait : refus, GPS coupé).
 * Même API que position.ts. Pas de partage écran verrouillé : l'écran reste
 * allumé pendant la course.
 */
export type { ErreurGps, EtatPermission, Fix };

export const partageFondDisponible = false;
export const textesFond: TextesFond = { explication: "livreur.fondExplication", consigne: null };

const geo = () => (typeof navigator !== "undefined" ? navigator.geolocation : undefined);

const versFix = (c: { latitude: number; longitude: number; accuracy?: number | null }, at: number): Fix => ({
  lat: c.latitude,
  lng: c.longitude,
  precision: c.accuracy ?? null,
  at,
});

const erreurWeb = (e: GeolocationPositionError): ErreurGps =>
  e.code === e.PERMISSION_DENIED ? "refusee" : e.code === e.TIMEOUT ? "delai" : "indisponible";

const versEtat = (state: PermissionState): EtatPermission =>
  state === "granted" ? "accordee" : state === "denied" ? "refusee" : "a_demander";

export async function lirePermission(): Promise<EtatPermission> {
  if (!geo()) return "indisponible";
  try {
    return versEtat((await navigator.permissions.query({ name: "geolocation" as PermissionName })).state);
  } catch {
    return "a_demander"; // navigateur sans API Permissions : on saura à la demande
  }
}

/** Position actuelle, en demandant l'autorisation si besoin (fenêtre du navigateur). */
export function positionActuelle(delaiMs = 15000): Promise<Fix> {
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

/** Suivi continu. Renvoie la fonction d'arrêt. */
export async function suivrePosition(onFix: (f: Fix) => void, onErreur: (e: ErreurGps) => void): Promise<() => void> {
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

/** Prévient quand l'utilisateur retire (ou rend) l'autorisation pendant une course. */
export async function surChangementPermission(cb: (etat: EtatPermission) => void): Promise<() => void> {
  try {
    const p = await navigator.permissions.query({ name: "geolocation" as PermissionName });
    const ecouter = () => cb(versEtat(p.state));
    p.addEventListener("change", ecouter);
    return () => p.removeEventListener("change", ecouter);
  } catch {
    return () => undefined;
  }
}

/**
 * Garde l'écran allumé pendant une course (le navigateur suspend le GPS d'une
 * page en arrière-plan). Renvoie la fonction de libération.
 */
export function garderEcranAllume(): () => void {
  const wl = typeof navigator !== "undefined" ? (navigator as any).wakeLock : null;
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

// Pas de partage écran verrouillé sur le web (partageFondDisponible = false).
export async function etatPermissionFond(): Promise<EtatPermission> {
  return "indisponible";
}
export async function demarrerSuiviFond(_notification: { titre: string; texte: string }): Promise<boolean> {
  return false;
}
export async function arreterSuiviFond(): Promise<void> {}
