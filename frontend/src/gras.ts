import { Text } from "react-native";

/**
 * Rend toute l'interface plus affirmée : poids 600 par défaut sur chaque <Text>.
 * Les styles explicites (700/800 des titres) restent prioritaires car placés
 * après dans le tableau de styles.
 */
const TexteRN = Text as any;

if (!TexteRN.__grasPinkberry) {
  const rendu = TexteRN.render;
  if (typeof rendu === "function") {
    TexteRN.render = function (props: any, ref: any) {
      return rendu.call(this, { ...props, style: [{ fontWeight: "600" }, props.style] }, ref);
    };
    TexteRN.__grasPinkberry = true;
  }
}
