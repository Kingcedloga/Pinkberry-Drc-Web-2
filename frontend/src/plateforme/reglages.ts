import { Linking } from "react-native";

/**
 * Réglages de l'appareil pour cette app (autorisations refusées).
 * Natif : l'écran Réglages s'ouvre. Web : voir reglages.web.ts.
 */
export const reglagesDisponibles = true;

export function ouvrirReglages(): void {
  Linking.openSettings().catch(() => undefined);
}
