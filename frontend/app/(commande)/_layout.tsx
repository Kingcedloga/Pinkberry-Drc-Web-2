import { Stack } from "expo-router";
import React from "react";

import { Garde } from "@/src/components/Garde";
import { colors } from "@/src/theme";
import { useTheme } from "@/src/theme-contexte";

/** Tunnel de commande (panier → adresse → confirmation) : clients connectés uniquement. */
export default function CommandeLayout() {
  useTheme();
  return (
    <Garde roles={["client"]}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surfaceSecondary } }} />
    </Garde>
  );
}
