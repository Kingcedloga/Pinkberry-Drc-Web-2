import { Tabs } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import React from "react";
import { Platform } from "react-native";

import { BarreLaterale } from "@/src/components/BarreLaterale";
import { Garde } from "@/src/components/Garde";
import { Icone } from "@/src/components/Icone";
import { useAuth } from "@/src/auth";
import { ONGLETS_NATIFS } from "@/src/nav";
import { useEcran } from "@/src/reactif";
import { colors, fonts } from "@/src/theme";
import { useTheme } from "@/src/theme-contexte";

const { Icon, Label } = NativeTabs.Trigger;

const LIENS_BUREAU = [
  { libelle: "Rapports", icone: "download", href: "/admin/rapports" },
  { libelle: "Archives", icone: "archive", href: "/admin/archives" },
  { libelle: "Paramètres", icone: "settings", href: "/admin/parametres" },
];

function OngletsAdmin() {
  useTheme();
  const { user } = useAuth();
  const { bureau } = useEcran();
  const estSuper = user?.role === "superadmin";
  const lateral = bureau && Platform.OS === "web";

  if (ONGLETS_NATIFS) {
    return (
      <NativeTabs
        tintColor={colors.brandPrimary}
        iconColor={colors.muted}
        labelStyle={{ fontFamily: fonts.text, fontSize: 11, color: colors.muted }}
      >
        <NativeTabs.Trigger name="dashboard">
          <Icon sf={{ default: "square.grid.2x2", selected: "square.grid.2x2.fill" }} />
          <Label>Commandes</Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="catalogue">
          <Icon sf={{ default: "cube.box", selected: "cube.box.fill" }} />
          <Label>Catalogue</Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="zones">
          <Icon sf={{ default: "map", selected: "map.fill" }} />
          <Label>Zones</Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="livreurs">
          <Icon sf={{ default: "person.2", selected: "person.2.fill" }} />
          <Label>Livreurs</Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="personnel" hidden={!estSuper}>
          <Icon sf={{ default: "person.badge.key", selected: "person.badge.key.fill" }} />
          <Label>Personnel</Label>
        </NativeTabs.Trigger>
      </NativeTabs>
    );
  }

  return (
    <Tabs
      tabBar={
        lateral
          ? (props: any) => (
              <BarreLaterale
                {...props}
                sousTitre="Back office administrateur"
                routesMasquees={estSuper ? [] : ["personnel"]}
                liens={LIENS_BUREAU}
              />
            )
          : undefined
      }
      screenOptions={{
        headerShown: false,
        tabBarPosition: lateral ? "left" : "bottom",
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
        options={{ title: "Commandes", tabBarIcon: ({ color }) => <Icone name="grid" size={22} color={color} /> }}
      />
      <Tabs.Screen
        name="catalogue"
        options={{ title: "Catalogue", tabBarIcon: ({ color }) => <Icone name="package" size={22} color={color} /> }}
      />
      <Tabs.Screen
        name="zones"
        options={{ title: "Zones", tabBarIcon: ({ color }) => <Icone name="map" size={22} color={color} /> }}
      />
      <Tabs.Screen
        name="livreurs"
        options={{ title: "Livreurs", tabBarIcon: ({ color }) => <Icone name="users" size={22} color={color} /> }}
      />
      <Tabs.Screen
        name="personnel"
        options={{
          title: "Personnel",
          href: estSuper ? undefined : null,
          tabBarIcon: ({ color }) => <Icone name="key" size={22} color={color} />,
        }}
      />
    </Tabs>
  );
}

export default function AdminLayout() {
  return (
    <Garde roles={["admin", "superadmin"]}>
      <OngletsAdmin />
    </Garde>
  );
}
