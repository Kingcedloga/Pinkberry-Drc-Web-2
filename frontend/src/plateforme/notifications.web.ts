import i18n from "i18next";

import { apiFetch } from "@/src/api";
import type { StatutNotifs } from "@/src/plateforme/types";

/**
 * Notifications système — web / PWA (API Push + service worker + VAPID).
 * Elles arrivent même onglet fermé (à ne pas confondre avec les toasts
 * internes, src/toast.tsx). Même API que notifications.ts.
 */
export type { StatutNotifs };

/** Le web se désabonne depuis l'app (aucun réglage système accessible). */
export const desactivationDansApp = true;

function pushDisponible(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

/** iPhone / iPad (y compris iPadOS qui se présente comme un Mac tactile). */
function estIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

/** Lancée depuis l'écran d'accueil (PWA installée). */
function estInstallee(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(display-mode: standalone)").matches || (navigator as any).standalone === true;
}

/** « Chrome · Android » : aide l'utilisateur à reconnaître ses appareils abonnés. */
function decrireAppareil(): string {
  const ua = navigator.userAgent;
  const navigateur = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : i18n.t("notifs.navigateur");
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

async function envoyerAbonnement(abo: PushSubscription): Promise<void> {
  const brut = abo.toJSON() as { endpoint?: string; keys?: Record<string, string> };
  await apiFetch("/push/web/abonnement", {
    method: "PUT",
    body: { endpoint: brut.endpoint, keys: brut.keys, expirationTime: null, appareil: decrireAppareil() },
  });
}

function statutSansAbonnement(): StatutNotifs {
  return Notification.permission === "denied" ? "bloquees" : "a_demander";
}

export async function lireStatutNotifs(): Promise<StatutNotifs> {
  // iPhone dans Safari : l'API Push n'existe qu'une fois l'app installée (iOS ≥ 16.4).
  if (estIOS() && !estInstallee()) return "a_installer";
  if (!pushDisponible()) return "non_supporte";
  try {
    return (await abonnementCourant()) ? "actives" : statutSansAbonnement();
  } catch {
    return "non_supporte";
  }
}

/**
 * Demande l'autorisation du navigateur puis enregistre l'abonnement côté serveur.
 * À appeler UNIQUEMENT depuis un geste utilisateur (après l'explication de l'app).
 * Lève une erreur si l'abonnement échoue.
 */
export async function activerNotifs(_userId: string): Promise<StatutNotifs> {
  if (!pushDisponible()) return lireStatutNotifs();
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission === "denied" ? "bloquees" : "a_demander";

  const { clePublique, actif } = await apiFetch<{ clePublique: string; actif: boolean }>("/push/web/cle-publique");
  if (!actif || !clePublique) return "a_demander";

  const registration = await serviceWorkerPret(12000);
  if (!registration) throw new Error(i18n.t("notifs.swIndisponible"));
  const abo =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlVersOctets(clePublique) as BufferSource,
    }));
  await envoyerAbonnement(abo);
  return "actives";
}

/** Coupe les notifications : désabonne le navigateur et nettoie le serveur. */
export async function desactiverNotifs(): Promise<StatutNotifs> {
  if (!pushDisponible()) return "non_supporte";
  try {
    const abo = await abonnementCourant();
    if (abo) {
      const endpoint = abo.endpoint;
      await abo.unsubscribe();
      await apiFetch("/push/web/abonnement", { method: "DELETE", body: { endpoint, keys: { p256dh: "x", auth: "x" } } });
    }
  } catch {
    // Désabonnement local : ne doit jamais bloquer l'interface.
  }
  return statutSansAbonnement();
}

/** Réenregistre l'abonnement existant (il peut tourner). Jamais de popup. */
export async function synchroniserNotifs(_userId: string): Promise<void> {
  if (!pushDisponible() || Notification.permission !== "granted") return;
  try {
    const abo = await abonnementCourant();
    if (abo) await envoyerAbonnement(abo);
  } catch {
    // silencieux
  }
}

/** Web : le service worker gère l'affichage (public/sw.js), rien à préparer. */
export function preparerNotifications(): void {}

/** Le service worker prévient la page ouverte au lieu d'afficher une notification système. */
export function surNotificationRecue(cb: () => void): () => void {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return () => undefined;
  const ecouter = (e: MessageEvent) => {
    if (e.data?.type === "notification") cb();
  };
  navigator.serviceWorker.addEventListener("message", ecouter);
  return () => navigator.serviceWorker.removeEventListener("message", ecouter);
}

/** Web : le service worker ouvre lui-même l'adresse de la notification touchée. */
export function surNotificationTouchee(_cb: (donnees: Record<string, any> | undefined) => void): () => void {
  return () => undefined;
}
