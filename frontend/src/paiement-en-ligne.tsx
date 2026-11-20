import { useQueryClient } from "@tanstack/react-query";
import React, { useState } from "react";

import { apiFetch } from "@/src/api";
import { AttentePaiement } from "@/src/components/AttentePaiement";
import { PageCarte } from "@/src/components/PageCarte";
import { useT } from "@/src/i18n";
import { preparerPaiementCarte, type SessionCarte } from "@/src/plateforme/paiement-carte";
import { useToast } from "@/src/toast";

export type EnLigne = "mobile" | "carte";
export type ReponsePaiement = { paiementId: string; montant: string; devise: string; url?: string; retour?: string };

/** Paiement suivi à l'écran ; `id` nul : Flexpaie a refusé la demande (la commande existe). */
export type PaiementEnCours = {
  id: string | null;
  commandeId: string;
  mode: EnLigne;
  montant: string;
  devise: string;
  url?: string;
  retour?: string;
};

/** Canaux renvoyés par Flexpaie : noms de marque, identiques dans toutes les langues. */
export const NOMS_CANAUX: Record<string, string> = {
  mpesa: "M-Pesa",
  airtel: "Airtel Money",
  orange: "Orange Money",
  afrimoney: "Afrimoney",
  visa: "Visa",
  mastercard: "Mastercard",
};

/**
 * Paiement en ligne en cours : fenêtre d'attente, page carte, nouvel essai et repli sur
 * la livraison. Partagé par le checkout et le suivi de commande ; `fenetre` est à rendre
 * dans l'écran.
 */
export function usePaiementEnLigne({
  onPaye,
  onCash,
  reessayerSansReference,
}: {
  onPaye: (commandeId: string) => void;
  onCash: (commandeId: string) => void;
  /** Demande refusée d'emblée (pas de tentative à relancer) : nouvel essai par l'écran. */
  reessayerSansReference?: (p: PaiementEnCours) => void;
}) {
  const t = useT();
  const toast = useToast();
  const qc = useQueryClient();
  const [paiement, setPaiement] = useState<PaiementEnCours | null>(null);
  const [pageCarte, setPageCarte] = useState(false);

  /** Envoie `appel` et suit le paiement. `session` (carte) : préparée pendant le geste du client. */
  const suivre = async (
    commandeId: string,
    mode: EnLigne,
    devise: string,
    appel: () => Promise<ReponsePaiement>,
    session?: SessionCarte,
  ) => {
    try {
      const r = await appel();
      setPaiement({ id: r.paiementId, commandeId, mode, montant: r.montant, devise: r.devise, url: r.url, retour: r.retour });
      if (mode === "carte" && r.url && (session ?? preparerPaiementCarte()).ouvrir(r.url)) setPageCarte(true);
    } catch (e: any) {
      session?.annuler();
      toast.show(e.message, "erreur");
      setPaiement({ id: null, commandeId, mode, montant: "", devise });
    }
  };

  /** Nouvel essai avec le numéro et la devise de la tentative `paiementId`. Dans le geste du client. */
  const relancer = (p: { paiementId: string; commandeId: string; mode: EnLigne; devise: string }) => {
    const session = p.mode === "carte" ? preparerPaiementCarte() : undefined;
    setPaiement(null);
    void suivre(
      p.commandeId,
      p.mode,
      p.devise,
      () => apiFetch<ReponsePaiement>(`/paiements/${p.paiementId}/relancer`, { method: "POST" }),
      session,
    );
  };

  /** Rouvre la page carte d'une tentative en attente. Dans le geste du client. */
  const reouvrir = (p: PaiementEnCours) => {
    setPaiement(p);
    if (p.url && preparerPaiementCarte().ouvrir(p.url)) setPageCarte(true);
  };

  const payerLivraison = async (commandeId: string) => {
    try {
      await apiFetch(`/paiements/${commandeId}/cash`, { method: "POST" });
      toast.show(t("confirmation.cashLivraison"), "succes");
    } catch (e: any) {
      toast.show(e.message, "erreur");
    }
    setPaiement(null);
    qc.invalidateQueries({ queryKey: ["commande", commandeId] });
    qc.invalidateQueries({ queryKey: ["mes-commandes"] });
    onCash(commandeId);
  };

  const fenetre =
    paiement && pageCarte && paiement.url && paiement.retour ? (
      <PageCarte url={paiement.url} retour={paiement.retour} onFermee={() => setPageCarte(false)} />
    ) : paiement ? (
      <AttentePaiement
        paiementId={paiement.id}
        mode={paiement.mode}
        montant={paiement.montant}
        devise={paiement.devise}
        onPaye={() => {
          const id = paiement.commandeId;
          setPaiement(null);
          qc.invalidateQueries({ queryKey: ["commande", id] });
          qc.invalidateQueries({ queryKey: ["mes-commandes"] });
          toast.show(t("confirmation.paiementConfirme"), "succes");
          onPaye(id);
        }}
        onReessayer={() => {
          if (paiement.id) relancer({ ...paiement, paiementId: paiement.id });
          else if (reessayerSansReference) {
            setPaiement(null);
            reessayerSansReference(paiement);
          }
        }}
        onCash={() => void payerLivraison(paiement.commandeId)}
        onReouvrir={paiement.url ? () => reouvrir(paiement) : undefined}
      />
    ) : null;

  return { paiement, suivre, relancer, reouvrir, payerLivraison, fenetre };
}
