import Feather from "@react-native-vector-icons/feather";
import { Tabs } from "expo-router";
import { Icon, Label, NativeTabs } from "expo-router/unstable-native-tabs";
import React from "react";
import { Platform } from "react-native";

import { colors, fonts } from "@/src/theme";

const nativeTabs = Platform.OS === "ios" && parseInt(String(Platform.Version), 10) >= 26;

export default function AdminLayout() {
  if (nativeTabs) {
    return (
      <NativeTabs>
        <NativeTabs.Trigger name="dashboard">
          <Icon sf="square.grid.2x2.fill" />
          <Label>Commandes</Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="catalogue">
          <Icon sf="cube.box.fill" />
          <Label>Catalogue</Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="zones">
          <Icon sf="map.fill" />
          <Label>Zones</Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="livreurs">
          <Icon sf="person.2.fill" />
          <Label>Livreurs</Label>
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
        name="dashboard"
        options={{ title: "Commandes", tabBarIcon: ({ color }) => <Feather name="grid" size={22} color={color} /> }}
      />
      <Tabs.Screen
        name="catalogue"
        options={{ title: "Catalogue", tabBarIcon: ({ color }) => <Feather name="package" size={22} color={color} /> }}
      />
      <Tabs.Screen
        name="zones"
        options={{ title: "Zones", tabBarIcon: ({ color }) => <Feather name="map" size={22} color={color} /> }}
      />
      <Tabs.Screen
        name="livreurs"
        options={{ title: "Livreurs", tabBarIcon: ({ color }) => <Feather name="users" size={22} color={color} /> }}
      />
    </Tabs>
  );
}
