import React from "react";

import { EcranRapport } from "@/src/components/EcranRapport";

export default function RapportsLivreur() {
  return (
    <EcranRapport
      titre="Mes courses"
      sousTitre="Rapport Excel ou PDF par période"
      aide="Numéro de commande, date, adresse, cash encaissé et statut, avec un récapitulatif (courses effectuées, livraisons réussies, annulations et total du cash encaissé)."
      chemin="/livreur/rapport"
      prefixeFichier="pinkberry-courses"
    />
  );
}
