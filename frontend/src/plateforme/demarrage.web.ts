import { LogBox } from "react-native";

/** Démarrage — web / PWA. Même API que demarrage.ts. */

/** Pas de panneau LogBox : l'app reste lisible et testable dans le navigateur. */
export function initialiserPlateforme(): void {
  LogBox.ignoreAllLogs(true);
}

/**
 * Enregistre le service worker (PWA installable, notifications web). Les
 * balises du <head> (manifeste, icônes, Open Graph) sont dans public/index.html.
 */
export function demarrerPlateforme(): void {
  if (typeof navigator === "undefined") return;
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }
  nommerChampsFormulaire();
}

/**
 * Chaque champ de formulaire reçoit un `id` unique s'il n'a ni `id` ni `name`
 * (avertissement Chrome « A form field element should have an id or name
 * attribute », et remplissage automatique plus fiable). react-native-web ne
 * transmet pas ces attributs à tous les champs (l'<input> interne d'un Switch
 * notamment) : l'id vient du testID du champ, ou de celui de son conteneur.
 * Un `id`, pas un `name` : React 19 retire `name` d'un <input> à chaque rendu
 * quand il n'est pas dans ses props, alors qu'il ne touche pas à `id`.
 */
function nommerChampsFormulaire(): void {
  if (typeof document === "undefined" || typeof MutationObserver === "undefined") return;
  const utilises = new Map<string, number>();
  const nommer = () => {
    document.querySelectorAll<HTMLInputElement>("input:not([id]):not([name]), textarea:not([id]):not([name]), select:not([id]):not([name])")
      .forEach((champ) => {
        const source =
          champ.getAttribute("data-testid") ||
          champ.closest("[data-testid]")?.getAttribute("data-testid") ||
          champ.getAttribute("aria-label") ||
          "champ";
        const base = `champ-${source.replace(/[^\w-]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase() || "sans-nom"}`;
        let n = utilises.get(base) ?? 0;
        let id = "";
        do {
          n += 1;
          id = n === 1 ? base : `${base}-${n}`;
        } while (document.getElementById(id));
        utilises.set(base, n);
        champ.id = id;
      });
  };
  // Les mutations arrivent déjà regroupées ; poser un `id` ne modifie pas l'arbre
  // (attribut, non observé) : pas de boucle.
  const demarrer = () => {
    nommer();
    new MutationObserver(nommer).observe(document.body, { childList: true, subtree: true });
  };
  if (document.body) demarrer();
  else document.addEventListener("DOMContentLoaded", demarrer, { once: true });
}
