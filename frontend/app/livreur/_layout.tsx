import { Slot } from "expo-router";
import React from "react";

import { Coquille } from "@/src/components/Coquille";
import { Garde } from "@/src/components/Garde";
import { NAV_LIVREUR } from "@/src/nav-web";
import { SuiviLivreurProvider } from "@/src/suivi-livreur";

/**
 * Espace livreur : tableau de bord web des courses. Le partage de position est
 * automatique sur toutes les pages dès qu'une course est en route.
 */
export default function LivreurLayout() {
  return (
    <Garde roles={["livreur"]}>
      <Coquille liens={NAV_LIVREUR}>
        <SuiviLivreurProvider>
          <Slot />
        </SuiviLivreurProvider>
      </Coquille>
    </Garde>
  );
}
