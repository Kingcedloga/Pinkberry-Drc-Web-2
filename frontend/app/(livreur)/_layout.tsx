import { Stack } from "expo-router";
import React from "react";

import { colors } from "@/src/theme";

export default function LivreurLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surfaceSecondary } }} />;
}
