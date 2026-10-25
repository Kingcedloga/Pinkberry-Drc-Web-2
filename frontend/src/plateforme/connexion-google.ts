import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import i18n from "i18next";

import { AUTH_EMERGENT, extraireSessionId } from "@/src/plateforme/session-google";

/**
 * Connexion Google — iOS / Android : navigateur d'authentification, retour par
 * lien profond (schéma de l'app). Même API que connexion-google.web.ts.
 */

// Android renvoie souvent « dismiss » sans URL : le lien reçu à chaud sert de secours.
let urlCapturee: string | null = null;

/** Session Google apportée par le lancement de l'app (démarrage à froid). */
export async function retourGoogleInitial(): Promise<string | null> {
  return extraireSessionId(await Linking.getInitialURL());
}

/** Mobile : rien à retirer de l'adresse. */
export function nettoyerRetourGoogle(): void {}

/** Retours « à chaud » (lien profond reçu app ouverte). Renvoie la fonction d'arrêt. */
export function surRetourGoogle(cb: (sessionId: string) => void): () => void {
  const abo = Linking.addEventListener("url", ({ url }) => {
    urlCapturee = url;
    const id = extraireSessionId(url);
    if (id) cb(id);
  });
  return () => abo.remove();
}

/** Ouvre Google ; renvoie la session obtenue (erreur si l'utilisateur annule). */
export async function ouvrirConnexionGoogle(): Promise<string | null> {
  const redirect = Linking.createURL("");
  urlCapturee = null;
  const res = await WebBrowser.openAuthSessionAsync(`${AUTH_EMERGENT}${encodeURIComponent(redirect)}`, redirect);
  const url = (res as any)?.url ?? urlCapturee ?? (await Linking.getInitialURL());
  const sessionId = extraireSessionId(url);
  if (!sessionId) throw new Error(i18n.t("auth.googleAnnulee"));
  return sessionId;
}
