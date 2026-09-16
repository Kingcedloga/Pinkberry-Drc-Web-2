import { Stack } from "expo-router";
import React from "react";

import { colors } from "@/src/theme";
import { useTheme } from "@/src/theme-contexte";

export default function LivreurLayout() {
  useTheme();
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surfaceSecondary } }} />;
}
