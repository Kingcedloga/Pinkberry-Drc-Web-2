/**
 * Saisie de dates dans le back office : « AAAA-MM-JJ HH:MM » à l'heure locale de
 * l'admin, stockées en ISO (UTC) par le serveur.
 */
const deux = (n: number) => String(n).padStart(2, "0");

/** ISO (UTC) → « AAAA-MM-JJ HH:MM » à l'heure locale. */
export const versLocal = (iso?: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())} ${deux(d.getHours())}:${deux(d.getMinutes())}`;
};

/** « AAAA-MM-JJ [HH:MM] » local → ISO ; `null` si vide, `undefined` si invalide. */
export const versIso = (v: string): string | null | undefined => {
  if (!v.trim()) return null;
  const m = v.trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?$/);
  if (!m) return undefined;
  const d = new Date(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0));
  return isNaN(d.getTime()) ? undefined : d.toISOString();
};
