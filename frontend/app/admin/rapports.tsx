import React from "react";

import { EcranRapport } from "@/src/components/EcranRapport";
import { useTheme } from "@/src/theme-contexte";
import { useLangue } from "@/src/i18n";

export default function Rapports() {
  useTheme();
  const { t } = useLangue();
  return (
    <EcranRapport
      titre={t("rapport.adminTitre")}
      sousTitre={t("rapport.adminSousTitre")}
      aide={t("rapport.adminAide")}
      chemin="/admin/rapport"
      prefixeFichier="pinkberry-rapport"
    />
  );
}
