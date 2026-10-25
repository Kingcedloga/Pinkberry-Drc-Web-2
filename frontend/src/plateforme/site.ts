/** Adresse publique du site, pour les liens cités dans les textes (ex. suppression de compte). */
export function adresseSite(): string {
  return (process.env.EXPO_PUBLIC_BACKEND_URL ?? "").replace(/\/$/, "");
}
