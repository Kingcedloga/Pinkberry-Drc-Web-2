import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { StyleSheet, View } from "react-native";

import { VuePage, type VuePageRef } from "@/src/plateforme/VuePage";
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
  const page = useRef<VuePageRef>(null);
  const trace = itineraire ?? [];
  // L'URL est figée : positions et tracé sont poussés à la page ensuite.
  const uri = useMemo(() => urlCarte(client, livreur ?? null, mode, scheme === "dark"), []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    page.current?.envoyer(
      JSON.stringify({
        livreur: livreur ? [livreur.lat, livreur.lng] : null,
        trace: trace.length > 1 ? trace : null,
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [livreur?.lat, livreur?.lng, trace.length]);

  // Mode `choix` : la page remonte la position du repère déplacé.
  const recevoir = useCallback(
    (data: string) => {
      try {
        const d = JSON.parse(data);
        if (d?.type === "position") onPosition?.({ lat: d.lat, lng: d.lng });
      } catch {
        /* message non exploitable */
      }
    },
    [onPosition],
  );

  return (
    <View testID={testID} style={[styles.wrap, { height: hauteur }]}>
      <VuePage ref={page} uri={uri} hauteur={hauteur} fond={colors.surfaceSecondary} onMessage={onPosition ? recevoir : undefined} />
    </View>
  );
}

const styles = stylesDynamiques(() => StyleSheet.create({
  wrap: { borderRadius: radius.xl, overflow: "hidden", backgroundColor: colors.surfaceSecondary },
}));
