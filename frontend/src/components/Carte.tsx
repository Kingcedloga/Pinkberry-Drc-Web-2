import { Icone } from "@/src/components/Icone";
import React, { useEffect, useRef } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import WebView from "react-native-webview";

import { colors, fonts, radius, spacing } from "@/src/theme";

export type Point = { lat: number; lng: number };

function html(clientP: Point, livreurP: Point | null) {
  const driver = livreurP ? `[${livreurP.lat},${livreurP.lng}]` : "null";
  return `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>html,body,#map{margin:0;padding:0;height:100%;width:100%;background:${colors.surfaceSecondary}}
.pin{position:relative;border-radius:50% 50% 50% 0;transform:rotate(-45deg);width:26px;height:26px;border:3px solid #fff;box-shadow:0 4px 12px rgba(42,23,33,.35)}
.pin-c{background:${colors.brandPrimary}}.pin-d{background:${colors.success}}</style>
</head><body><div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
var client=[${clientP.lat},${clientP.lng}];var driver=${driver};
var map=L.map('map',{zoomControl:false,attributionControl:false}).setView(client,14);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);
var iconC=L.divIcon({html:'<div class="pin pin-c"></div>',className:'',iconSize:[26,26],iconAnchor:[13,26]});
var iconD=L.divIcon({html:'<div class="pin pin-d"></div>',className:'',iconSize:[26,26],iconAnchor:[13,26]});
L.marker(client,{icon:iconC}).addTo(map);
var dm=null,line=null;
function majLivreur(lat,lng){
  var p=[lat,lng];
  if(!dm){dm=L.marker(p,{icon:iconD}).addTo(map);}else{dm.setLatLng(p);}
  if(!line){line=L.polyline([p,client],{color:'${colors.brandPrimary}',weight:4,opacity:.7,dashArray:'8,10'}).addTo(map);}
  else{line.setLatLngs([p,client]);}
  map.fitBounds(L.latLngBounds([p,client]).pad(0.45));
}
window.majLivreur=majLivreur;
if(driver){majLivreur(driver[0],driver[1]);}
</script></body></html>`;
}

export function Carte({
  client: clientP,
  livreur,
  hauteur = 260,
  testID = "carte-suivi",
}: {
  client: Point;
  livreur?: Point | null;
  hauteur?: number;
  testID?: string;
}) {
  const ref = useRef<any>(null);
  const initial = useRef(html(clientP, livreur ?? null));

  useEffect(() => {
    if (livreur && ref.current?.injectJavaScript) {
      ref.current.injectJavaScript(`window.majLivreur(${livreur.lat},${livreur.lng}); true;`);
    }
  }, [livreur?.lat, livreur?.lng]);

  if (Platform.OS === "web") {
    return (
      <View testID={testID} style={[styles.fallback, { height: hauteur }]}>
        <Icone name="map" size={34} color={colors.brandPrimary} />
        <Text style={styles.fallbackTitre}>Carte en direct</Text>
        <Text style={styles.fallbackTexte}>
          Client : {clientP.lat.toFixed(4)}, {clientP.lng.toFixed(4)}
        </Text>
        <Text style={styles.fallbackTexte}>
          {livreur ? `Livreur : ${livreur.lat.toFixed(4)}, ${livreur.lng.toFixed(4)}` : "Livreur pas encore en route"}
        </Text>
        <Text style={styles.fallbackNote}>La carte OpenStreetMap s&apos;affiche dans l&apos;app mobile.</Text>
      </View>
    );
  }

  return (
    <View testID={testID} style={[styles.wrap, { height: hauteur }]}>
      <WebView
        ref={ref}
        originWhitelist={["*"]}
        source={{ html: initial.current }}
        style={{ flex: 1, backgroundColor: colors.surfaceSecondary }}
        scrollEnabled={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: radius.xl, overflow: "hidden", backgroundColor: colors.surfaceSecondary },
  fallback: {
    borderRadius: radius.xl,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    padding: spacing.lg,
  },
  fallbackTitre: { fontFamily: fonts.display, fontSize: 18, color: colors.onSurface },
  fallbackTexte: { fontFamily: fonts.text, fontSize: 13, color: colors.onSurface },
  fallbackNote: { fontFamily: fonts.text, fontSize: 11, color: colors.muted, marginTop: spacing.xs },
});
