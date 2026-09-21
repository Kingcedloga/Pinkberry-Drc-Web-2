import React, { useEffect, useMemo, useRef } from "react";
import { Platform, StyleSheet, View } from "react-native";
import WebView from "react-native-webview";

import { colors, radius, stylesDynamiques } from "@/src/theme";

export type Point = { lat: number; lng: number };

/** Page Leaflet servie par le backend : une vraie URL rend l'affichage fiable sur Android. */
function urlCarte(client: Point, livreur: Point | null) {
  const p = new URLSearchParams({
    clat: String(client.lat),
    clng: String(client.lng),
    fond: colors.surfaceSecondary,
    accent: colors.brandPrimary,
    livreurCouleur: colors.success,
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
  testID = "carte-suivi",
}: {
  client: Point;
  livreur?: Point | null;
  itineraire?: [number, number][] | null;
  hauteur?: number;
  testID?: string;
}) {
  const vue = useRef<any>(null);
  const cadre = useRef<any>(null);
  const trace = itineraire ?? [];
  // L'URL ne change pas au fil du suivi : les positions sont poussées à la page.
  const uri = useMemo(() => urlCarte(client, livreur ?? null), []); // eslint-disable-line react-hooks/exhaustive-deps

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

  if (Platform.OS === "web") {
    return (
      <View testID={testID} style={[styles.wrap, { height: hauteur }]}>
        {React.createElement("iframe" as any, {
          ref: cadre,
          title: "carte",
          src: uri,
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
        style={{ flex: 1, backgroundColor: colors.surfaceSecondary }}
        scrollEnabled={false}
      />
    </View>
  );
}

const styles = stylesDynamiques(() => StyleSheet.create({
  wrap: { borderRadius: radius.xl, overflow: "hidden", backgroundColor: colors.surfaceSecondary },
}));
