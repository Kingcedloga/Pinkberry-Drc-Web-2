/**
 * Impression des tickets de caisse — iOS / Android : indisponible. Le poste caisse
 * (terminal ZKTeco sous Windows) utilise l'admin web. Même API que impression.web.ts.
 */
export const impressionDisponible = false;

export async function imprimerHtml(_html: string): Promise<void> {
  throw new Error("Impression indisponible sur mobile");
}
