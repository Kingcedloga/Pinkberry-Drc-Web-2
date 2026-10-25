import * as WebBrowser from "expo-web-browser";

import { AUTH_EMERGENT, extraireSessionId } from "@/src/plateforme/session-google";

/**
 * Connexion Google — web : la page part vers le portail puis revient sur « / »
 * avec `session_id` dans l'adresse. Même API que connexion-google.ts.
 */
WebBrowser.maybeCompleteAuthSession();

/** Session Google présente dans l'adresse de la page (retour du portail). */
export async function retourGoogleInitial(): Promise<string | null> {
  return typeof window !== "undefined" ? extraireSessionId(window.location.href) : null;
}

/** Retire `session_id` de l'adresse affichée, une fois la session échangée. */
export function nettoyerRetourGoogle(): void {
  const propre = window.location.href.replace(/([?#&])session_id=[^&#]*/g, "$1").replace(/[?#&]$/, "");
  window.history.replaceState(window.history.state, "", propre);
}

/** Web : le retour recharge la page, lu par retourGoogleInitial. */
export function surRetourGoogle(_cb: (sessionId: string) => void): () => void {
  return () => undefined;
}

/** Part vers Google (la page est quittée) : aucune session à renvoyer ici. */
export async function ouvrirConnexionGoogle(): Promise<string | null> {
  window.location.href = `${AUTH_EMERGENT}${encodeURIComponent(window.location.origin + "/")}`;
  return null;
}
