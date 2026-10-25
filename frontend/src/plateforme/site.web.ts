/** Adresse publique du site : celle de la page ouverte. */
export function adresseSite(): string {
  if (typeof window !== "undefined") return window.location.origin;
  return (process.env.EXPO_PUBLIC_BACKEND_URL ?? "").replace(/\/$/, "");
}
