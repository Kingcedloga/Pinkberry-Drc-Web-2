/** Commun aux deux variantes de connexion-google : identifiant de session dans une adresse de retour. */
export function extraireSessionId(url?: string | null): string | null {
  if (!url) return null;
  const m = url.match(/[?#&]session_id=([^&#]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

/** Portail d'authentification Emergent : configurable au déploiement. */
export const AUTH_EMERGENT = process.env.EXPO_PUBLIC_AUTH_PORTAL_URL ?? "";
