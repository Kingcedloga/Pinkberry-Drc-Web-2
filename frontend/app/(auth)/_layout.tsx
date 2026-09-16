import { Stack } from "expo-router";
import React from "react";

import { GardeInvite } from "@/src/components/Garde";
import { colors } from "@/src/theme";
import { useTheme } from "@/src/theme-contexte";

export default function AuthLayout() {
  useTheme();
  return (
    <GardeInvite>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surfaceSecondary } }} />
    </GardeInvite>
  );
}
