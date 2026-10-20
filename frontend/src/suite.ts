import { storage } from "@/src/utils/storage";

/**
 * Page à rouvrir après la connexion d'un visiteur (ex. le passage en caisse).
 * Gardée sur l'appareil : survit à la redirection de la connexion Google.
 */
const CLE_SUITE = "pb_suite_connexion";

export function memoriserSuite(chemin: string) {
  return storage.setItem(CLE_SUITE, chemin);
}

/** Lit et efface la page mémorisée (chemin interne uniquement). */
export async function prendreSuite(): Promise<string | null> {
  const suite = await storage.getItem<string>(CLE_SUITE, "");
  if (suite) await storage.removeItem(CLE_SUITE);
  return typeof suite === "string" && suite.startsWith("/") && !suite.startsWith("//") ? suite : null;
}
