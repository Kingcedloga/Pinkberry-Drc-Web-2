import i18n from "i18next";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;

/** Langue de l'interface : le serveur rédige ses messages d'erreur dans cette langue. */
const langue = () => (i18n.language === "en" ? "en" : "fr");

/** Réseau coupé : `fetch` lève une erreur technique (« Failed to fetch »), on la remplace. */
async function envoyer(url: string, init: RequestInit) {
  try {
    return await fetch(url, init);
  } catch {
    throw new Error(i18n.t("erreurs.reseau"));
  }
}

/** Message du serveur (déjà dans la langue demandée), sinon message générique traduit. */
function erreurDe(res: Response, data: any) {
  if (typeof data?.detail === "string") return new Error(data.detail);
  if (res.status === 422) return new Error(i18n.t("erreurs.donneesInvalides"));
  if (res.status >= 500) return new Error(i18n.t("erreurs.serveur"));
  return new Error(i18n.t("erreurs.statut", { statut: res.status }));
}

let authToken: string | null = null;

export function obtenirToken() {
  return authToken;
}

export function setAuthToken(t: string | null) {
  authToken = t;
}

type Opts = {
  method?: string;
  body?: any;
  /** Jeton à utiliser pour cette seule requête (sans toucher à la session de l'appareil). */
  jeton?: string;
};

export async function apiFetch<T = any>(path: string, opts: Opts = {}): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json", "Accept-Language": langue() };
  const jeton = opts.jeton ?? authToken;
  if (jeton) headers.Authorization = `Bearer ${jeton}`;
  const res = await envoyer(`${BASE}/api${path}`, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) throw erreurDe(res, data);
  return data as T;
}

export async function apiUpload<T = any>(path: string, form: FormData): Promise<T> {
  const headers: Record<string, string> = { "Accept-Language": langue() };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  const res = await envoyer(`${BASE}/api${path}`, { method: "POST", headers, body: form });
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) throw erreurDe(res, data);
  return data as T;
}
