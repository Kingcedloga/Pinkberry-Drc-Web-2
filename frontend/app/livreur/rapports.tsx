import React from "react";

import { EcranRapport } from "@/src/components/EcranRapport";
import { useTheme } from "@/src/theme-contexte";
import { useLangue } from "@/src/i18n";

export default function RapportsLivreur() {
  useTheme();
  const { t } = useLangue();
  return (
    <EcranRapport
      titre={t("rapport.livreurTitre")}
      sousTitre={t("rapport.livreurSousTitre")}
      aide={t("rapport.livreurAide")}
      chemin="/livreur/rapport"
      prefixeFichier="pinkberry-courses"
    />
  );
}
