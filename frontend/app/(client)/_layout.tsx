import { Slot } from "expo-router";
import React from "react";

import { Coquille } from "@/src/components/Coquille";
import { Garde } from "@/src/components/Garde";
import { NAV_CLIENT } from "@/src/nav-web";

/** Espace client : pages web (menu, panier, commande, suivi, compte). */
export default function ClientLayout() {
  return (
    <Garde roles={["client"]}>
      <Coquille liens={NAV_CLIENT} avecPanier>
        <Slot />
      </Coquille>
    </Garde>
  );
}
