// @ts-nocheck
import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

// Domaine public : fourni par l'environnement de deploiement. A defaut, les URLs
// restent relatives et sont completees a l'execution depuis l'origine courante.
const SITE_URL = process.env.EXPO_PUBLIC_SITE_URL ?? "";

/**
 * Coquille HTML de la web app Pinkberry (responsive + installable en PWA).
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="fr" translate="no" style={{ height: "100%" }}>
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover, shrink-to-fit=no"
        />
        <title>Pinkberry Drc</title>
        <link rel="canonical" href={`${SITE_URL}/`} />
        <meta
          name="description"
          content="Commandez vos yogourts glacés Pinkberry à Kinshasa : catalogue, paiement à la livraison et suivi de livraison en direct."
        />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Pinkberry Drc" />
        <meta property="og:locale" content="fr_FR" />
        <meta property="og:title" content="Pinkberry Drc" />
        <meta
          property="og:description"
          content="Commandez vos yogourts glacés Pinkberry à Kinshasa, avec paiement à la livraison et suivi en direct."
        />
        <meta property="og:url" content={`${SITE_URL}/`} />
        <meta property="og:image" content={`${SITE_URL}/PINK%20LOGOS.png`} />
        <meta property="og:image:alt" content="Pinkberry Drc" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Pinkberry Drc" />
        <meta
          name="twitter:description"
          content="Commandez vos yogourts glacés Pinkberry à Kinshasa, avec paiement à la livraison."
        />
        <meta name="twitter:image" content={`${SITE_URL}/PINK%20LOGOS.png`} />

        {/* PWA : installable sur mobile et ordinateur */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#E6156F" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Pinkberry" />
        <link rel="apple-touch-icon" href="/PINK%20LOGO%20icon%20.png" />
        <link rel="icon" type="image/png" href="/PINK%20LOGO%20icon%20.png" />

        {/*
          Disable body scrolling on web to make ScrollView components work correctly.
        */}
        <ScrollViewStyleReset />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              body > div:first-child { position: fixed !important; top: 0; left: 0; right: 0; bottom: 0; }
              [role="tablist"] [role="tab"] * { overflow: visible !important; }
              [role="heading"], [role="heading"] * { overflow: visible !important; }
              html { -webkit-text-size-adjust: 100%; }
              body { overflow-x: hidden; -webkit-font-smoothing: antialiased; }
            `,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Complete les URLs relatives (canonical / Open Graph) avec l'origine reelle.
              (function () {
                var origine = window.location.origin;
                var absolu = function (v) { return v && v.charAt(0) === '/' ? origine + v : v; };
                var canon = document.querySelector('link[rel="canonical"]');
                if (canon) canon.setAttribute('href', absolu(canon.getAttribute('href')));
                document.querySelectorAll('meta[property^="og:"], meta[name^="twitter:"]').forEach(function (m) {
                  m.setAttribute('content', absolu(m.getAttribute('content')));
                });
              })();

              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function () {
                  navigator.serviceWorker.register('/sw.js').catch(function () {});
                });
              }
            `,
          }}
        />
      </head>
      <body
        style={{
          margin: 0,
          height: "100%",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {children}
      </body>
    </html>
  );
}
