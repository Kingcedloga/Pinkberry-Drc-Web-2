/**
 * Web / PWA : barres système (status bar, barre d'adresse) de la couleur de
 * l'en-tête, y compris quand le thème est forcé contre celui de l'appareil.
 */
export function colorerBarresSysteme(scheme: "light" | "dark", couleurs: { entete: string; fond: string }): void {
  if (typeof document === "undefined") return;
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", couleurs.entete));
  document.documentElement.style.colorScheme = scheme;
  document.documentElement.style.backgroundColor = couleurs.fond;
}
