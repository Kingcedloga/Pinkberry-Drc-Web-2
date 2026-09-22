import { Platform } from "react-native";

/**
 * Prépare la couche web : manifeste PWA, couleur de thème et enregistrement du
 * service worker. Nécessaire à l'exécution car le gabarit `app/+html.tsx` n'est
 * appliqué qu'au build statique, pas par le serveur de développement.
 */
export function initialiserWeb(): void {
  if (Platform.OS !== "web" || typeof document === "undefined") return;

  const balise = (selecteur: string, creer: () => HTMLElement) => {
    if (!document.querySelector(selecteur)) document.head.appendChild(creer());
  };

  balise('link[rel="manifest"]', () => {
    const l = document.createElement("link");
    l.rel = "manifest";
    l.href = "/manifest.json";
    return l;
  });

  balise('meta[name="theme-color"]', () => {
    const m = document.createElement("meta");
    m.name = "theme-color";
    m.content = "#E6156F";
    return m;
  });

  balise('link[rel="apple-touch-icon"]', () => {
    const l = document.createElement("link");
    l.rel = "apple-touch-icon";
    l.setAttribute("sizes", "180x180");
    l.href = "/icones/icon-180.png";
    return l;
  });

  balise('meta[name="apple-mobile-web-app-capable"]', () => {
    const m = document.createElement("meta");
    m.name = "apple-mobile-web-app-capable";
    m.content = "yes";
    return m;
  });

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }
}
