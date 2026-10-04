import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/src/api";
import { useLibelle } from "@/src/catalogue-i18n";
import { useT, type CleTexte } from "@/src/i18n";
import { useMontant } from "@/src/taux";

/**
 * Promotions gérées par l'admin. Le serveur calcule seul les réductions : le
 * client ne fait qu'afficher ce que renvoient /promotions/apercu et la commande.
 * Montants en FC.
 */
export type TypePromo = "pourcentage" | "montant" | "livraison";
export type CiblePromo = "commande" | "categorie" | "produit" | "premiere_commande";

export type Promotion = {
  id: string;
  nom: string;
  nomEn?: string | null;
  type: TypePromo;
  valeur: number;
  automatique: boolean;
  code?: string | null;
  cible: CiblePromo;
  cibleValeur?: string | null;
  cibleLibelle?: string | null;
  cibleLibelleEn?: string | null;
  montantMin: number;
  dateDebut?: string | null;
  dateFin?: string | null;
  limiteTotale?: number | null;
  limiteParClient?: number | null;
  nombreUtilisations?: number;
  actif: boolean;
  cumulable: boolean;
  /** Annonce (notification + push) aux clients éligibles quand la promotion devient active. */
  notifierClients?: boolean;
  /** Visible dans la bannière client (un code peut rester privé). */
  afficherBanniere?: boolean;
  statut?: "active" | "programmee" | "expiree" | "epuisee" | "desactivee";
};

export type PromoAppliquee = Pick<Promotion, "id" | "nom" | "nomEn" | "type" | "valeur" | "code" | "cible"> & {
  montant: number;
  livraison: number;
};

export type StatutCode =
  | "applique"
  | "moins_avantageux"
  | "invalide"
  | "expiree"
  | "programmee"
  | "epuisee"
  | "deja_utilisee"
  | "montant_min"
  | "premiere_commande"
  | "cible_absente"
  | "sans_effet";

/** Détail du calcul, tel que le serveur l'appliquera à la commande. */
export type Totaux = {
  sousTotal: number;
  fraisLivraison: number;
  reduction?: number;
  reductionLivraison?: number;
  total: number;
  promotions?: PromoAppliquee[];
  code?: { saisi: string; statut: StatutCode; montantMin?: number | null } | null;
};

/** Promotions automatiques en cours, pour la bannière client. */
export function usePromotionsActives() {
  return useQuery({
    queryKey: ["promotions-actives"],
    queryFn: () => apiFetch<Promotion[]>("/promotions/actives"),
    staleTime: 60_000,
  });
}

/** « −20 % sur Boissons dès 30 000 FC », « Livraison offerte »… */
export function useDescriptionPromo() {
  const t = useT();
  const libelle = useLibelle();
  const { fc } = useMontant();
  return (p: Pick<Promotion, "type" | "valeur" | "cible" | "montantMin" | "cibleLibelle" | "cibleLibelleEn">) => {
    const remise =
      p.type === "livraison"
        ? t("promo.livraisonOfferte")
        : p.type === "pourcentage"
          ? t("promo.pourcentage", { valeur: p.valeur })
          : t("promo.montant", { montant: fc(p.valeur) });
    const portee =
      p.cible === "premiere_commande"
        ? t("promo.surPremiereCommande")
        : p.cibleLibelle
          ? t("promo.sur", { cible: libelle(p.cibleLibelle, p.cibleLibelleEn) })
          : "";
    const minimum = p.montantMin > 0 ? t("promo.des", { montant: fc(p.montantMin) }) : "";
    return [remise, portee, minimum].filter(Boolean).join(" ");
  };
}

/** Message affiché sous le champ « Code promo ». */
export function useMessageCode() {
  const t = useT();
  const { fc } = useMontant();
  return (code: NonNullable<Totaux["code"]>) => {
    const cle = `promo.code_${code.statut}` as CleTexte;
    return t(cle, { code: code.saisi, montant: fc(code.montantMin ?? 0) });
  };
}
