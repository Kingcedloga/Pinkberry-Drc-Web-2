// Service worker minimal : rend l'app installable (PWA) et sert la coquille
// applicative hors ligne. Les requêtes /api/* passent toujours par le réseau.
const CACHE = "pinkberry-v3";
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

// ---------------------------------------------------------------- Web Push
// Notifications systeme : affichees meme si l'onglet ou l'app est ferme.
self.addEventListener("push", (event) => {
  let donnees = {};
  try {
    donnees = event.data ? event.data.json() : {};
  } catch {
    donnees = {};
  }

  const titre = donnees.title || "Pinkberry";
  const options = {
    body: donnees.body || "",
    icon: donnees.icon || "/icones/icon-192.png",
    badge: donnees.badge || "/icones/badge-96.png",
    data: { url: donnees.url || "/" },
    tag: donnees.tag || "pinkberry",
    renotify: true,
  };

  event.waitUntil(self.registration.showNotification(titre, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const cible = new URL(event.notification.data?.url || "/", self.location.origin).href;

  event.waitUntil(
    (async () => {
      const fenetres = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const ouverte = fenetres.find((c) => new URL(c.url).origin === self.location.origin);
      if (ouverte) {
        await ouverte.focus();
        return ouverte.navigate(cible);
      }
      return self.clients.openWindow(cible);
    })(),
  );
});
