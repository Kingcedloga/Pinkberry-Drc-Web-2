/** Web : AsyncStorage écrit dans localStorage (JSON), lisible tout de suite. */
export function lireImmediatement(cle: string): unknown {
  try {
    if (typeof localStorage === "undefined") return undefined;
    return JSON.parse(localStorage.getItem(cle) ?? "null") ?? undefined;
  } catch {
    return undefined; // stockage illisible ou bloqué
  }
}
