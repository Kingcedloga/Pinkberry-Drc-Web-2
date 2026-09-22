import { Slot } from "expo-router";
import React from "react";

import { useAuth } from "@/src/auth";
import { Coquille } from "@/src/components/Coquille";
import { Garde } from "@/src/components/Garde";
import { NAV_ADMIN, NAV_ADMIN_SECONDAIRE } from "@/src/nav-web";

/** Back office : navigation latérale fixe sur grand écran. */
function CoquilleAdmin() {
  const { user } = useAuth();
  const estSuper = user?.role === "superadmin";
  const liens = NAV_ADMIN.filter((l) => !l.superadmin || estSuper);

  return (
    <Coquille liens={liens} liensSecondaires={NAV_ADMIN_SECONDAIRE} lateral sousTitre="Back office">
      <Slot />
    </Coquille>
  );
}

export default function AdminLayout() {
  return (
    <Garde roles={["admin", "superadmin"]}>
      <CoquilleAdmin />
    </Garde>
  );
}
