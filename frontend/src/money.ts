export const TAUX_FC_DEFAUT = 2800;

let tauxCourant = TAUX_FC_DEFAUT;

/** Met à jour le taux USD → FC utilisé par tous les affichages. */
export function setTauxFC(taux: number) {
  if (taux > 0) tauxCourant = taux;
}

export function getTauxFC(): number {
  return tauxCourant;
}

function groupe(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export function usd(n: number): string {
  return `$${(n ?? 0).toFixed(2)}`;
}

export function fc(n: number): string {
  return `${groupe(Math.round((n ?? 0) * tauxCourant))} FC`;
}

/** « 16 800 FC ≈ $6.00 » */
export function prix(n: number): string {
  return `${fc(n)} ≈ ${usd(n)}`;
}
