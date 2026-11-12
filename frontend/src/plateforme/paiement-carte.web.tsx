import type { SessionCarte } from "@/src/plateforme/paiement-carte";

/**
 * Paiement par carte — web : la page Flexpaie s'ouvre dans un nouvel onglet, réservé
 * pendant le geste du client (ouvert après une requête, il serait bloqué). L'onglet
 * se referme de lui-même au retour. Même API que paiement-carte.tsx.
 */
export type { SessionCarte };

export function preparerPaiementCarte(): SessionCarte {
  const onglet = window.open("about:blank", "_blank");
  // La page de paiement n'a pas accès à celle de l'app.
  if (onglet) onglet.opener = null;
  return {
    ouvrir: (url) => {
      if (onglet && !onglet.closed) onglet.location.href = url;
      // Onglet bloqué : la page part vers Flexpaie ; le retour propose un lien vers la commande.
      else window.location.assign(url);
      return false;
    },
    annuler: () => onglet?.close(),
  };
}

/** Web : la page de paiement est dans son propre onglet. */
export function VuePaiementCarte(_: { url: string; retour: string; onRetour: () => void }) {
  return null;
}
