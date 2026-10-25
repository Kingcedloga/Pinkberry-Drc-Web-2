/**
 * Partage — web : feuille de partage du navigateur (Web Share), sinon le texte
 * est copié dans le presse-papiers (« copie » : l'appelant le signale).
 */
export async function partagerLien(message: string, url: string): Promise<"partage" | "copie"> {
  const nav = globalThis.navigator as any;
  if (nav?.share) {
    await nav.share.call(nav, { text: message, url });
    return "partage";
  }
  await nav?.clipboard?.writeText?.(message);
  return "copie";
}
