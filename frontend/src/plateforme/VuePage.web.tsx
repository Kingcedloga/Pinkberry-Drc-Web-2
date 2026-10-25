import React, { useEffect, useImperativeHandle, useRef } from "react";

import type { VuePageRef } from "@/src/plateforme/VuePage";

/** Page web intégrée — web : <iframe>. Même API que VuePage.tsx. */
export type { VuePageRef };

export function VuePage({
  uri,
  hauteur,
  onMessage,
  ref,
}: {
  uri: string;
  hauteur: number;
  fond: string;
  onMessage?: (data: string) => void;
  ref?: React.Ref<VuePageRef>;
}) {
  const cadre = useRef<HTMLIFrameElement>(null);
  useImperativeHandle(ref, () => ({ envoyer: (m) => cadre.current?.contentWindow?.postMessage(m, "*") }), []);

  useEffect(() => {
    if (!onMessage) return;
    const ecouteur = (e: MessageEvent) => {
      // Seulement les messages de cette page (plusieurs cartes, extensions…).
      if (e.source !== cadre.current?.contentWindow) return;
      onMessage(typeof e.data === "string" ? e.data : JSON.stringify(e.data));
    };
    window.addEventListener("message", ecouteur);
    return () => window.removeEventListener("message", ecouteur);
  }, [onMessage]);

  return React.createElement("iframe", {
    ref: cadre,
    title: "carte",
    src: uri,
    allow: "geolocation",
    style: { width: "100%", height: hauteur, border: 0 },
  });
}
