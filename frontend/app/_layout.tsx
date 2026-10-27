import { QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { StatusBar } from "expo-status-bar";
import { Stack, useRouter } from "expo-router";
import React, { useEffect } from "react";
import { Platform, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";

import { AuthProvider } from "@/src/auth";
import { EcranDemarrage } from "@/src/components/EcranDemarrage";
import { ErrorBoundary } from "@/src/components/error-boundary";
import { GestionPush, ouvrirDepuisNotification } from "@/src/components/GestionPush";
import { NotificationsInternes } from "@/src/components/NotificationsInternes";
import "@/src/gras";
import { demarrerPlateforme, initialiserPlateforme } from "@/src/plateforme/demarrage";
import { preparerNotifications, surNotificationTouchee } from "@/src/plateforme/notifications";
// Déclare la tâche de partage GPS écran verrouillé (mobile) avant tout rendu.
import "@/src/plateforme/position";
import { LangueProvider } from "@/src/i18n";
import { PanierProvider } from "@/src/panier";
import { queryClient } from "@/src/query-client";
import { ThemeProvider, useTheme } from "@/src/theme-contexte";
import { TauxProvider } from "@/src/taux";
import { ToastProvider } from "@/src/toast";

// Avant tout rendu : journal des erreurs (mobile), LogBox (web), affichage des notifications.
initialiserPlateforme();
preparerNotifications();

/** La pile est isolée pour suivre le thème actif (clair / sombre). */
function PileEcrans() {
  const { colors: palette, scheme } = useTheme();
  // Safe areas latérales (encoche en paysage) appliquées une fois pour toute l'app ;
  // le haut et le bas sont gérés par les en-têtes et barres fixes.
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        flex: 1,
        paddingLeft: insets.left,
        paddingRight: insets.right,
        backgroundColor: palette.surfaceSecondary,
      }}
    >
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <Stack
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: palette.surfaceSecondary } }}
      />
    </View>
  );
}

export default function RootLayout() {
  const router = useRouter();
  const [policesPretes, erreurPolices] = useFonts({
    Fredoka: require("@/assets/fonts/Fredoka.ttf"),
    Nunito: require("@/assets/fonts/Nunito.ttf"),
  });

  useEffect(() => {
    // Web : service worker (PWA, notifications push) et noms des champs de formulaire.
    demarrerPlateforme();
  }, []);

  // Tap sur une notification (app ouverte ou démarrage à froid) : écran ciblé.
  useEffect(
    () => surNotificationTouchee((donnees) => ouvrirDepuisNotification(donnees, (href) => router.push(href as any))),
    [router],
  );

  if (Platform.OS !== "web" && !policesPretes && !erreurPolices) {
    return <EcranDemarrage testID="ecran-demarrage-polices" />;
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
                        <NotificationsInternes />
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
