import { Slot } from "expo-router";
import React from "react";

import { Coquille } from "@/src/components/Coquille";
import { Garde } from "@/src/components/Garde";
import { NAV_LIVREUR } from "@/src/nav-web";

/** Espace livreur : tableau de bord web des courses. */
export default function LivreurLayout() {
  return (
    <Garde roles={["livreur"]}>
      <Coquille liens={NAV_LIVREUR}>
        <Slot />
      </Coquille>
    </Garde>
  );
}
