import { Tabs } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import React from "react";
import { Platform } from "react-native";

import { Icone } from "@/src/components/Icone";
import { ONGLETS_NATIFS } from "@/src/nav";
import { colors, fonts } from "@/src/theme";

const { Icon, Label } = NativeTabs.Trigger;

export default function ClientLayout() {
  if (ONGLETS_NATIFS) {
    return (
      <NativeTabs
        tintColor={colors.brandPrimary}
        iconColor={colors.muted}
        labelStyle={{ fontFamily: fonts.text, fontSize: 11, color: colors.muted }}
      >
        <NativeTabs.Trigger name="accueil">
          <Icon sf={{ default: "house", selected: "house.fill" }} />
          <Label>Accueil</Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="commandes">
          <Icon sf={{ default: "bag", selected: "bag.fill" }} />
          <Label>Commandes</Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="compte">
          <Icon sf={{ default: "person", selected: "person.fill" }} />
          <Label>Compte</Label>
        </NativeTabs.Trigger>
      </NativeTabs>
    );
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brandPrimary,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontFamily: fonts.text, fontSize: 11, fontWeight: "700" },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          ...(Platform.OS === "web" ? { height: 64 } : {}),
        },
        tabBarItemStyle: { alignSelf: "center" },
        sceneStyle: { backgroundColor: colors.surfaceSecondary },
      }}
    >
      <Tabs.Screen
        name="accueil"
        options={{ title: "Accueil", tabBarIcon: ({ color }) => <Icone name="home" size={22} color={color} /> }}
      />
      <Tabs.Screen
        name="commandes"
        options={{
          title: "Commandes",
          tabBarIcon: ({ color }) => <Icone name="shopping-bag" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="compte"
        options={{ title: "Compte", tabBarIcon: ({ color }) => <Icone name="user" size={22} color={color} /> }}
      />
    </Tabs>
  );
}
