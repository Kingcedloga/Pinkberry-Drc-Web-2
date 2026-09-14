import Feather from "@react-native-vector-icons/feather";
import { Tabs } from "expo-router";
import { NativeTabs, Icon, Label } from "expo-router/unstable-native-tabs";
import React from "react";
import { Platform } from "react-native";

import { colors, fonts } from "@/src/theme";

const nativeTabs = Platform.OS === "ios" && parseInt(String(Platform.Version), 10) >= 26;

export default function ClientLayout() {
  if (nativeTabs) {
    return (
      <NativeTabs>
        <NativeTabs.Trigger name="accueil">
          <Icon sf="house.fill" />
          <Label>Accueil</Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="commandes">
          <Icon sf="bag.fill" />
          <Label>Commandes</Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="compte">
          <Icon sf="person.fill" />
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
        options={{ title: "Accueil", tabBarIcon: ({ color }) => <Feather name="home" size={22} color={color} /> }}
      />
      <Tabs.Screen
        name="commandes"
        options={{
          title: "Commandes",
          tabBarIcon: ({ color }) => <Feather name="shopping-bag" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="compte"
        options={{ title: "Compte", tabBarIcon: ({ color }) => <Feather name="user" size={22} color={color} /> }}
      />
    </Tabs>
  );
}
