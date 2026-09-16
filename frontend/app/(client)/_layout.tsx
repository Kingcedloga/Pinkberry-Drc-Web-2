import { Tabs } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import React from "react";
import { Platform } from "react-native";

import { Garde } from "@/src/components/Garde";
import { Icone } from "@/src/components/Icone";
import { useT } from "@/src/i18n";
import { ONGLETS_NATIFS } from "@/src/nav";
import { colors, fonts } from "@/src/theme";
import { useTheme } from "@/src/theme-contexte";

const { Icon, Label } = NativeTabs.Trigger;

function OngletsClient() {
  useTheme();
  const t = useT();

  if (ONGLETS_NATIFS) {
    return (
      <NativeTabs
        tintColor={colors.brandPrimary}
        iconColor={colors.muted}
        labelStyle={{ fontFamily: fonts.text, fontSize: 11, color: colors.muted }}
      >
        <NativeTabs.Trigger name="accueil">
          <Icon sf={{ default: "house", selected: "house.fill" }} />
          <Label>{t("onglet.accueil")}</Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="commandes">
          <Icon sf={{ default: "bag", selected: "bag.fill" }} />
          <Label>{t("onglet.commandes")}</Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="compte">
          <Icon sf={{ default: "person", selected: "person.fill" }} />
          <Label>{t("onglet.compte")}</Label>
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
        options={{ title: t("onglet.accueil"), tabBarIcon: ({ color }) => <Icone name="home" size={22} color={color} /> }}
      />
      <Tabs.Screen
        name="commandes"
        options={{
          title: t("onglet.commandes"),
          tabBarIcon: ({ color }) => <Icone name="shopping-bag" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="compte"
        options={{ title: t("onglet.compte"), tabBarIcon: ({ color }) => <Icone name="user" size={22} color={color} /> }}
      />
    </Tabs>
  );
}

export default function ClientLayout() {
  return (
    <Garde roles={["client"]}>
      <OngletsClient />
    </Garde>
  );
}
