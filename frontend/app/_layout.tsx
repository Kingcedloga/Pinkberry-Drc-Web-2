import { QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import * as Notifications from "expo-notifications";
import { StatusBar } from "expo-status-bar";
import { Stack, useRouter } from "expo-router";
import React, { useEffect } from "react";
import { ActivityIndicator, LogBox, Platform, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider } from "@/src/auth";
import { ErrorBoundary } from "@/src/components/error-boundary";
import { GestionPush, ouvrirDepuisNotification } from "@/src/components/GestionPush";
import { SurveillanceCommandes } from "@/src/components/SurveillanceCommandes";
import "@/src/gras";
import { LangueProvider } from "@/src/i18n";
import { PanierProvider } from "@/src/panier";
import { queryClient } from "@/src/query-client";
import { colors } from "@/src/theme";
import { ThemeProvider, useTheme } from "@/src/theme-contexte";
import { TauxProvider } from "@/src/taux";
import { ToastProvider } from "@/src/toast";

// Disable logbox errors etc so that users can see the app
// and agent works as expected.
LogBox.ignoreAllLogs(true);

// Affichage des notifications reçues app ouverte (portée module, natif seulement).
if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

// Canal Android créé avant toute réception de notification.
if (Platform.OS === "android") {
  Notifications.setNotificationChannelAsync("default", {
    name: "Commandes Pinkberry",
    importance: Notifications.AndroidImportance.MAX,
    sound: "default",
  });
}

/** La pile est isolée pour suivre le thème actif (clair / sombre). */
function PileEcrans() {
  const { colors: palette, scheme } = useTheme();
  return (
    <>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <Stack
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: palette.surfaceSecondary } }}
      />
    </>
  );
}

export default function RootLayout() {
  const router = useRouter();
  const [policesPretes, erreurPolices] = useFonts({
    Fredoka: require("@/assets/fonts/Fredoka.ttf"),
    Nunito: require("@/assets/fonts/Nunito.ttf"),
  });

  useEffect(() => {
    if (Platform.OS === "web") return;

    // Tap sur une notification, app ouverte
    const tapSub = Notifications.addNotificationResponseReceivedListener((response) => {
      ouvrirDepuisNotification(response.notification.request.content.data as any, (href) => router.push(href as any));
    });

    // Tap sur une notification, app fermée (démarrage à froid)
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response) return;
      ouvrirDepuisNotification(response.notification.request.content.data as any, (href) => router.push(href as any));
    });

    return () => {
      tapSub.remove();
    };
  }, [router]);

  if (!policesPretes && !erreurPolices) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.brandPrimary} size="large" />
      </View>
    );
  }

  // One app level ErrorBoundary; a render crash shows a reload screen
  // instead of a blank app.
  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <KeyboardProvider>
            <QueryClientProvider client={queryClient}>
              <AuthProvider>
                <LangueProvider>
                  <ThemeProvider>
                  <PanierProvider>
                    <ToastProvider>
                      <TauxProvider>
                        <SurveillanceCommandes />
                        <GestionPush />
                        <PileEcrans />
                      </TauxProvider>
                    </ToastProvider>
                  </PanierProvider>
                  </ThemeProvider>
                </LangueProvider>
              </AuthProvider>
            </QueryClientProvider>
          </KeyboardProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
