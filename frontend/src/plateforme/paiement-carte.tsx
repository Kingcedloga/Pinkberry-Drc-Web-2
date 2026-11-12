import React from "react";
import WebView from "react-native-webview";

/**
 * Paiement par carte — iOS / Android : la page Flexpaie s'affiche dans l'app
 * (WebView), refermée dès l'arrivée sur l'adresse de retour du backend.
 * Même API que paiement-carte.web.tsx.
 */
export type SessionCarte = {
  /** Affiche la page de paiement. `true` : elle s'affiche dans l'app, via <VuePaiementCarte>. */
  ouvrir: (url: string) => boolean;
  /** Abandon avant l'ouverture (paiement refusé à la création). */
  annuler: () => void;
};

/** À appeler pendant le geste du client. Mobile : rien à préparer. */
export function preparerPaiementCarte(): SessionCarte {
  return { ouvrir: () => true, annuler: () => undefined };
}

export function VuePaiementCarte({ url, retour, onRetour }: { url: string; retour: string; onRetour: () => void }) {
  return (
    <WebView
      source={{ uri: url }}
      javaScriptEnabled
      domStorageEnabled
      startInLoadingState
      // La page de retour (backend) enregistre l'issue avant que la vue se ferme.
      onNavigationStateChange={(e) => {
        if (!e.loading && e.url.startsWith(retour)) onRetour();
      }}
      style={{ flex: 1 }}
    />
  );
}
