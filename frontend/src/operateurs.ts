/**
 * Opérateurs mobile money acceptés et leurs préfixes nationaux (2 chiffres après 0 / 243).
 * Même table que PREFIXES_OPERATEURS dans backend/server.py, qui refuse les autres numéros.
 * Les noms sont des marques (non traduits).
 */
export type CleOperateur = "mpesa" | "airtel" | "orange" | "afrimoney";

export const OPERATEURS_MOBILE: { cle: CleOperateur; nom: string; prefixes: string[]; logo?: number }[] = [
  { cle: "mpesa", nom: "M-Pesa", prefixes: ["81", "82", "83"], logo: require("@/assets/images/mpesa.png") },
  { cle: "airtel", nom: "Airtel Money", prefixes: ["97", "98", "99"], logo: require("@/assets/images/airtel.png") },
  { cle: "orange", nom: "Orange Money", prefixes: ["80", "84", "85", "89"], logo: require("@/assets/images/orange.png") },
  { cle: "afrimoney", nom: "Afrimoney", prefixes: ["90", "91"] },
];

/** Codes USSD pour retrouver une demande de paiement en attente, à renseigner par opérateur. */
export const CODES_USSD: Partial<Record<CleOperateur, string>> = {
  mpesa: "*1122#",
  airtel: "*501#",
  orange: "*411#",
};

/** Numéro national (9 chiffres au plus), sans 0 / 243 / 00243 en tête. */
function national(tel: string): string {
  return tel.replace(/\D/g, "").replace(/^(00243|243|0)/, "");
}

/**
 * Opérateur reconnu au préfixe : `undefined` tant que le préfixe n'est pas saisi,
 * `null` si le préfixe n'appartient à aucun opérateur accepté.
 */
export function operateurDuNumero(tel: string): CleOperateur | null | undefined {
  const n = national(tel);
  if (n.length < 2) return undefined;
  return OPERATEURS_MOBILE.find((o) => o.prefixes.includes(n.slice(0, 2)))?.cle ?? null;
}

/** Numéro accepté par le serveur : 9 chiffres d'un opérateur accepté, précédés de 0 ou 243 au besoin. */
export function numeroMobileValide(tel: string): boolean {
  const nettoye = tel.replace(/[\s+\-.()]/g, "");
  return /^(00243|243|0)?\d{9}$/.test(nettoye) && !!operateurDuNumero(nettoye);
}

export function nomOperateur(cle?: string | null): string | undefined {
  return OPERATEURS_MOBILE.find((o) => o.cle === cle)?.nom;
}
