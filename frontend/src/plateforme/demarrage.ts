/**
 * Démarrage — iOS / Android. Même API que demarrage.web.ts.
 *
 * LogBox reste ACTIF sur mobile : `ignoreAllLogs` y masquait aussi l'écran rouge
 * des erreurs fatales, qui laissaient alors une page blanche sans explication.
 * Toute exception non interceptée est aussi écrite dans la console, donc visible
 * dans le terminal Expo / Metro (« iOS ERROR » / « Android ERROR »).
 */
export function initialiserPlateforme(): void {
  const ErrorUtils = (globalThis as any).ErrorUtils;
  const precedent = ErrorUtils?.getGlobalHandler?.();
  ErrorUtils?.setGlobalHandler?.((erreur: any, fatale?: boolean) => {
    console.error(`[ERREUR ${fatale ? "FATALE" : "JS"}] ${erreur?.message ?? erreur}\n${erreur?.stack ?? ""}`);
    precedent?.(erreur, fatale);
  });
}

/** Après le premier rendu. Mobile : rien à faire. */
export function demarrerPlateforme(): void {}
