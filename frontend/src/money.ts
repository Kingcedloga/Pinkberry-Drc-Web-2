export const TAUX_FC = 2800;

function groupe(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export function usd(n: number): string {
  return `$${(n ?? 0).toFixed(2)}`;
}

export function fc(n: number): string {
  return `${groupe(Math.round((n ?? 0) * TAUX_FC))} FC`;
}

export function prix(n: number): string {
  return `${usd(n)} · ${fc(n)}`;
}
