import { Redirect } from "expo-router";
import React from "react";
import { ActivityIndicator, View } from "react-native";

import { useAuth } from "@/src/auth";
import { colors } from "@/src/theme";

export default function Index() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View
        testID="ecran-chargement"
        style={{ flex: 1, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" }}
      >
        <ActivityIndicator color={colors.brandPrimary} size="large" />
      </View>
    );
  }

  if (!user) return <Redirect href="/bienvenue" />;
  if (user.role === "admin") return <Redirect href="/dashboard" />;
  if (user.role === "livreur") return <Redirect href="/courses" />;
  return <Redirect href="/accueil" />;
}
