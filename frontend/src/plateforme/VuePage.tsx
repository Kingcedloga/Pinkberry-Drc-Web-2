import React, { useImperativeHandle, useRef } from "react";
import WebView from "react-native-webview";

/**
 * Page web intégrée (carte Mapbox servie par le backend) — iOS / Android : WebView.
 * Même API que VuePage.web.tsx : `envoyer` pousse un message à la page,
 * `onMessage` reçoit les siens (texte JSON).
 */
export type VuePageRef = { envoyer: (message: string) => void };

export function VuePage({
  uri,
  hauteur,
  fond,
  onMessage,
  ref,
}: {
  uri: string;
  hauteur: number;
  fond: string;
  onMessage?: (data: string) => void;
  ref?: React.Ref<VuePageRef>;
}) {
  const vue = useRef<any>(null);
  useImperativeHandle(
    ref,
    () => ({ envoyer: (m) => vue.current?.injectJavaScript?.(`window.postMessage(${JSON.stringify(m)},'*'); true;`) }),
    [],
  );
  return (
    <WebView
      ref={vue}
      source={{ uri }}
      originWhitelist={["*"]}
      javaScriptEnabled
      domStorageEnabled
      mixedContentMode="always"
      geolocationEnabled
      onMessage={(e) => onMessage?.(e.nativeEvent.data)}
      style={{ flex: 1, height: hauteur, backgroundColor: fond }}
      scrollEnabled={false}
    />
  );
}
