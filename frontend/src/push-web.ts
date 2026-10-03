import { Platform } from "react-native";

import { apiFetch } from "@/src/api";

/**
 * Notifications push web (API Push + Service Worker + VAPID).
 * Ce sont des notifications système : elles arrivent même si l'onglet ou l'app
 * est fermé — à ne pas confondre avec les toasts internes (src/toast.tsx).
 */

export type EtatPushWeb = {
  /** Le navigateur gère l'API Push (HTTPS + service worker requis). */
  supporte: boolean;
  /** Autorisation du navigateur. */
  permission: "default" | "granted" | "denied" | "non_supporte";
  /** Ce navigateur est abonné (abonnement actif). */
  abonne: boolean;
};

const ETAT_NON_SUPPORTE: EtatPushWeb = { supporte: false, permission: "non_supporte", abonne: false };

export function pushWebDisponible(): boolean {
  return (
    Platform.OS === "web" &&
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** iPhone / iPad (y compris iPadOS qui se présente comme un Mac tactile). */
export function estIOS(): boolean {
  if (Platform.OS !== "web" || typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

/** Lancée depuis l'écran d'accueil (PWA installée). */
export function estInstallee(): boolean {
  if (Platform.OS !== "web" || typeof window === "undefined") return false;
  return window.matchMedia?.("(display-mode: standalone)").matches || (navigator as any).standalone === true;
}

/**
 * Sur iPhone, le push web n'existe que pour une PWA installée (iOS ≥ 16.4) :
 * dans Safari, l'API Push est absente. Android et ordinateur : aucun prérequis.
 */
export function iosSansInstallation(): boolean {
  return estIOS() && !estInstallee();
}

/** « Chrome · Android » : aide l'utilisateur à reconnaître ses appareils abonnés. */
function decrireAppareil(): string {
  const ua = navigator.userAgent;
  const navigateur = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Navigateur";
  const systeme = /Android/.test(ua) ? "Android" : estIOS() ? "iOS" : /Windows/.test(ua) ? "Windows" : /Mac OS X/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "";
  return [navigateur, systeme].filter(Boolean).join(" · ");
}

function base64UrlVersOctets(valeur: string): Uint8Array {
  const bourrage = "=".repeat((4 - (valeur.length % 4)) % 4);
  const base64 = (valeur + bourrage).replace(/-/g, "+").replace(/_/g, "/");
  const brut = atob(base64);
  return Uint8Array.from(brut, (c) => c.charCodeAt(0));
}

/** Attend le service worker sans bloquer l'interface (l'enregistrement peut tarder). */
async function serviceWorkerPret(delaiMs = 8000): Promise<ServiceWorkerRegistration | null> {
  const attente = new Promise<null>((r) => setTimeout(() => r(null), delaiMs));
  return Promise.race([navigator.serviceWorker.ready, attente]);
}

async function abonnementCourant(): Promise<PushSubscription | null> {
  const registration = await serviceWorkerPret();
  if (!registration) return null;
  return registration.pushManager.getSubscription();
}

export async function etatPushWeb(): Promise<EtatPushWeb> {
  if (!pushWebDisponible()) return ETAT_NON_SUPPORTE;
  try {
    const abo = await abonnementCourant();
    return {
      supporte: true,
      permission: Notification.permission as EtatPushWeb["permission"],
      abonne: !!abo,
    };
  } catch {
    return ETAT_NON_SUPPORTE;
  }
}

/**
 * Demande l'autorisation du navigateur puis enregistre l'abonnement côté serveur.
 * À appeler UNIQUEMENT depuis un geste utilisateur (après notre propre invite).
 */
export async function abonnerPushWeb(): Promise<EtatPushWeb> {
  if (!pushWebDisponible()) return ETAT_NON_SUPPORTE;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return { supporte: true, permission: permission as EtatPushWeb["permission"], abonne: false };
  }

  const { clePublique, actif } = await apiFetch<{ clePublique: string; actif: boolean }>(
    "/push/web/cle-publique",
  );
  if (!actif || !clePublique) return { supporte: true, permission: "granted", abonne: false };

  const registration = await serviceWorkerPret(12000);
  if (!registration) throw new Error("Service worker indisponible");
  let abo = await registration.pushManager.getSubscription();
  if (!abo) {
    abo = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlVersOctets(clePublique) as BufferSource,
    });
  }

  const brut = abo.toJSON() as { endpoint?: string; keys?: Record<string, string> };
  await apiFetch("/push/web/abonnement", {
    method: "PUT",
    body: { endpoint: brut.endpoint, keys: brut.keys, expirationTime: null, appareil: decrireAppareil() },
  });

  return { supporte: true, permission: "granted", abonne: true };
}

/** Coupe les notifications système : désabonne le navigateur et nettoie le serveur. */
export async function desabonnerPushWeb(): Promise<EtatPushWeb> {
  if (!pushWebDisponible()) return ETAT_NON_SUPPORTE;
  try {
    const abo = await abonnementCourant();
    if (abo) {
      const endpoint = abo.endpoint;
      await abo.unsubscribe();
      await apiFetch("/push/web/abonnement", {
        method: "DELETE",
        body: { endpoint, keys: { p256dh: "x", auth: "x" } },
      });
    }
  } catch {
    // Désabonnement local : ne doit jamais bloquer l'interface.
  }
  return { supporte: true, permission: Notification.permission as EtatPushWeb["permission"], abonne: false };
}

/**
 * Réenregistre l'abonnement existant (les abonnements peuvent tourner).
 * Aucune popup : uniquement si l'autorisation est déjà accordée.
 */
export async function synchroniserPushWeb(): Promise<void> {
  if (!pushWebDisponible() || Notification.permission !== "granted") return;
  try {
    const abo = await abonnementCourant();
    if (!abo) return;
    const brut = abo.toJSON() as { endpoint?: string; keys?: Record<string, string> };
    await apiFetch("/push/web/abonnement", {
      method: "PUT",
      body: { endpoint: brut.endpoint, keys: brut.keys, expirationTime: null, appareil: decrireAppareil() },
    });
  } catch {
    // silencieux
  }
}
