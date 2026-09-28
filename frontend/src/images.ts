const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;

/**
 * Transforme le champ `image` d'un produit en URL affichable.
 * - URL absolue (photo historique) : renvoyée en HTTPS (le http:// est refusé
 *   par iOS/Android en build de production)
 * - chemin relatif renvoyé par l'API (`/api/fichiers/<id>`) : préfixé
 * - vide : `null` (l'appelant affiche le visuel par défaut)
 */
export function urlImage(image?: string | null): string | null {
  if (!image) return null;
  if (image.startsWith("https://")) return image;
  if (image.startsWith("http://")) return `https://${image.slice("http://".length)}`;
  return `${BASE}${image.startsWith("/") ? "" : "/"}${image}`;
}
