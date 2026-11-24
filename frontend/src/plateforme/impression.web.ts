/**
 * Impression des tickets de caisse — web : page imprimée depuis une iframe cachée,
 * sur l'imprimante par défaut. Avec Chrome lancé en `--kiosk-printing`, sans boîte
 * de dialogue. Même API que impression.ts.
 */
export const impressionDisponible = true;

/** Délai maximal d'une impression : certains navigateurs n'émettent pas `afterprint`. */
const DELAI_MAX = 15000;

export function imprimerHtml(html: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const cadre = document.createElement("iframe");
    cadre.setAttribute("aria-hidden", "true");
    cadre.style.cssText = "position:fixed;width:0;height:0;border:0;visibility:hidden";
    let fini = false;
    const terminer = () => {
      if (fini) return;
      fini = true;
      setTimeout(() => cadre.remove(), 500);
      resolve();
    };
    cadre.onload = () => {
      const fenetre = cadre.contentWindow;
      if (!fenetre) {
        cadre.remove();
        reject(new Error("Impression impossible"));
        return;
      }
      fenetre.addEventListener("afterprint", terminer);
      setTimeout(terminer, DELAI_MAX);
      fenetre.focus();
      fenetre.print();
    };
    cadre.srcdoc = html;
    document.body.appendChild(cadre);
  });
}
