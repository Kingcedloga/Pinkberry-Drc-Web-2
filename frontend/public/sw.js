// Service worker minimal : rend l'app installable (PWA) et sert la coquille
// applicative hors ligne. Les requêtes /api/* passent toujours par le réseau.
const CACHE = "pinkberry-v1";
const COQUILLE = ["/", "/manifest.json", "/icones/icon-192.png", "/icones/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(COQUILLE))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cles) => Promise.all(cles.filter((c) => c !== CACHE).map((c) => caches.delete(c))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const requete = event.request;
  if (requete.method !== "GET") return;

  const url = new URL(requete.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  // Réseau d'abord, cache en secours (app toujours à jour, tolérante hors ligne).
  event.respondWith(
    fetch(requete)
      .then((reponse) => {
        const copie = reponse.clone();
        caches.open(CACHE).then((cache) => cache.put(requete, copie)).catch(() => undefined);
        return reponse;
      })
      .catch(() => caches.match(requete).then((c) => c ?? caches.match("/"))),
  );
});
