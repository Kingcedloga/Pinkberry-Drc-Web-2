import React, { useEffect, useMemo, useRef } from "react";
import { Platform, StyleSheet, View } from "react-native";
import WebView from "react-native-webview";

import { colors, radius, stylesDynamiques } from "@/src/theme";

export type Point = { lat: number; lng: number };

const TUILES = `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/carte/tuiles/{z}/{x}/{y}.png`;

/** Page Leaflet autonome : tuiles TomTom relayées par le backend (clé côté serveur). */
function html(clientP: Point, livreurP: Point | null, trace: [number, number][]) {
  const driver = livreurP ? `[${livreurP.lat},${livreurP.lng}]` : "null";
  return `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>html,body,#map{margin:0;padding:0;height:100%;width:100%;background:${colors.surfaceSecondary}}
.pin{position:relative;border-radius:50% 50% 50% 0;transform:rotate(-45deg);width:26px;height:26px;border:3px solid #fff;box-shadow:0 4px 12px rgba(42,23,33,.35)}
.pin-c{background:${colors.brandPrimary}}.pin-d{background:${colors.success}}
.leaflet-control-attribution{font-size:9px}</style>
</head><body><div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
var client=[${clientP.lat},${clientP.lng}];var driver=${driver};var trace=${JSON.stringify(trace)};
var map=L.map('map',{zoomControl:false}).setView(client,14);
L.tileLayer('${TUILES}',{maxZoom:20,attribution:'&copy; TomTom'}).addTo(map);
var iconC=L.divIcon({html:'<div class="pin pin-c"></div>',className:'',iconSize:[26,26],iconAnchor:[13,26]});
var iconD=L.divIcon({html:'<div class="pin pin-d"></div>',className:'',iconSize:[26,26],iconAnchor:[13,26]});
L.marker(client,{icon:iconC}).addTo(map);
var dm=null,route=null,lien=null;
function cadrer(pts){map.fitBounds(L.latLngBounds(pts).pad(0.25));}
function majLivreur(lat,lng){
  var p=[lat,lng];
  if(!dm){dm=L.marker(p,{icon:iconD}).addTo(map);}else{dm.setLatLng(p);}
  if(!route){
    if(lien){lien.setLatLngs([p,client]);}
    else{lien=L.polyline([p,client],{color:'${colors.brandPrimary}',weight:4,opacity:.7,dashArray:'8,10'}).addTo(map);}
    cadrer([p,client]);
  }
}
function majTrace(pts){
  if(!pts||pts.length<2)return;
  if(lien){map.removeLayer(lien);lien=null;}
  if(route){route.setLatLngs(pts);}
  else{route=L.polyline(pts,{color:'${colors.brandPrimary}',weight:5,opacity:.9}).addTo(map);}
  cadrer(pts);
}
window.majLivreur=majLivreur;window.majTrace=majTrace;
if(driver){majLivreur(driver[0],driver[1]);}
if(trace.length>1){majTrace(trace);}
</script></body></html>`;
}

export function Carte({
  client: clientP,
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
  const ref = useRef<any>(null);
  const trace = itineraire ?? [];
  const initial = useRef(html(clientP, livreur ?? null, trace));
  const pageWeb = useMemo(
    () => html(clientP, livreur ?? null, trace),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clientP.lat, clientP.lng, livreur?.lat, livreur?.lng, trace.length],
  );

  useEffect(() => {
    if (Platform.OS === "web" || !ref.current?.injectJavaScript) return;
    if (livreur) ref.current.injectJavaScript(`window.majLivreur(${livreur.lat},${livreur.lng}); true;`);
    if (trace.length > 1) ref.current.injectJavaScript(`window.majTrace(${JSON.stringify(trace)}); true;`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [livreur?.lat, livreur?.lng, trace.length]);

  if (Platform.OS === "web") {
    return (
      <View testID={testID} style={[styles.wrap, { height: hauteur }]}>
        {React.createElement("iframe" as any, {
          title: "carte",
          srcDoc: pageWeb,
          style: { width: "100%", height: hauteur, border: 0 },
        })}
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

const styles = stylesDynamiques(() => StyleSheet.create({
  wrap: { borderRadius: radius.xl, overflow: "hidden", backgroundColor: colors.surfaceSecondary },
}));
