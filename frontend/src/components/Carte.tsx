import React, { useEffect, useMemo, useRef } from "react";
import { Platform, StyleSheet, View } from "react-native";
import WebView from "react-native-webview";

import { colors, radius, stylesDynamiques } from "@/src/theme";
import { useTheme } from "@/src/theme-contexte";

export type Point = { lat: number; lng: number };

/** Page Mapbox GL JS servie par le backend : une vraie URL rend l'affichage fiable sur Android. */
function urlCarte(client: Point, livreur: Point | null, mode: string, sombre: boolean) {
  const p = new URLSearchParams({
    clat: String(client.lat),
    clng: String(client.lng),
    fond: colors.surfaceSecondary,
    accent: colors.brandPrimary,
    livreurCouleur: colors.success,
    mode,
    sombre: sombre ? "1" : "0",
  });
  if (livreur) {
    p.set("dlat", String(livreur.lat));
    p.set("dlng", String(livreur.lng));
  }
  return `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/carte/vue?${p.toString()}`;
}

export function Carte({
  client,
  livreur,
  itineraire,
  hauteur = 260,
  mode = "suivi",
  onPosition,
  testID = "carte-suivi",
}: {
  client: Point;
  livreur?: Point | null;
  itineraire?: [number, number][] | null;
  hauteur?: number;
  /** `choix` affiche un repère déplaçable et remonte la position choisie. */
  mode?: "suivi" | "choix";
  onPosition?: (p: Point) => void;
  testID?: string;
}) {
  const { scheme } = useTheme();
  const vue = useRef<any>(null);
  const cadre = useRef<any>(null);
  const trace = itineraire ?? [];
  // L'URL est figée : positions et tracé sont poussés à la page ensuite.
  const uri = useMemo(() => urlCarte(client, livreur ?? null, mode, scheme === "dark"), []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const message = JSON.stringify({
      livreur: livreur ? [livreur.lat, livreur.lng] : null,
      trace: trace.length > 1 ? trace : null,
    });
    if (Platform.OS === "web") {
      cadre.current?.contentWindow?.postMessage(message, "*");
    } else {
      vue.current?.injectJavaScript?.(`window.postMessage(${JSON.stringify(message)},'*'); true;`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [livreur?.lat, livreur?.lng, trace.length]);

  useEffect(() => {
    if (Platform.OS !== "web" || !onPosition) return;
    const ecouteur = (e: any) => {
      try {
        const d = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
        if (d?.type === "position") onPosition({ lat: d.lat, lng: d.lng });
      } catch {
        /* message tiers ignoré */
      }
    };
    window.addEventListener("message", ecouteur);
    return () => window.removeEventListener("message", ecouteur);
  }, [onPosition]);

  if (Platform.OS === "web") {
    return (
      <View testID={testID} style={[styles.wrap, { height: hauteur }]}>
        {React.createElement("iframe" as any, {
          ref: cadre,
          title: "carte",
          src: uri,
          allow: "geolocation",
          style: { width: "100%", height: hauteur, border: 0 },
        })}
      </View>
    );
  }

  return (
    <View testID={testID} style={[styles.wrap, { height: hauteur }]}>
      <WebView
        ref={vue}
        source={{ uri }}
        originWhitelist={["*"]}
        javaScriptEnabled
        domStorageEnabled
        mixedContentMode="always"
        geolocationEnabled
        onMessage={(e) => {
          if (!onPosition) return;
          try {
            const d = JSON.parse(e.nativeEvent.data);
            if (d?.type === "position") onPosition({ lat: d.lat, lng: d.lng });
          } catch {
            /* message non exploitable */
          }
        }}
        style={{ flex: 1, backgroundColor: colors.surfaceSecondary }}
        scrollEnabled={false}
      />
    </View>
  );
}

const styles = stylesDynamiques(() => StyleSheet.create({
  wrap: { borderRadius: radius.xl, overflow: "hidden", backgroundColor: colors.surfaceSecondary },
}));
