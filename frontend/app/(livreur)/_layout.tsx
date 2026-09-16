import { Stack } from "expo-router";
import React from "react";

import { Garde } from "@/src/components/Garde";
import { colors } from "@/src/theme";
import { useTheme } from "@/src/theme-contexte";

export default function LivreurLayout() {
  useTheme();
  return (
    <Garde roles={["livreur"]}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surfaceSecondary } }} />
    </Garde>
  );
}
