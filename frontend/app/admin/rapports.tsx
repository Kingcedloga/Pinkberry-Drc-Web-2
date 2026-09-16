import React from "react";

import { EcranRapport } from "@/src/components/EcranRapport";
import { useTheme } from "@/src/theme-contexte";

export default function Rapports() {
  useTheme();
  return (
    <EcranRapport
      titre="Rapport des commandes"
      sousTitre="Excel ou PDF, archives incluses"
      aide="Numéro, date, client, adresse, articles, montant, statut et livreur, avec un récapitulatif (commandes, chiffre d'affaires, livraisons réussies et annulées)."
      chemin="/admin/rapport"
      prefixeFichier="pinkberry-rapport"
    />
  );
}
