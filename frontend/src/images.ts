const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;

/**
 * Transforme le champ `image` d'un produit en URL affichable.
 * - URL absolue (photo historique) : renvoyée telle quelle
 * - chemin relatif renvoyé par l'API (`/api/fichiers/<id>`) : préfixé
 * - vide : `null` (l'appelant affiche le visuel par défaut)
 */
export function urlImage(image?: string | null): string | null {
  if (!image) return null;
  if (image.startsWith("http://") || image.startsWith("https://")) return image;
  return `${BASE}${image.startsWith("/") ? "" : "/"}${image}`;
}
