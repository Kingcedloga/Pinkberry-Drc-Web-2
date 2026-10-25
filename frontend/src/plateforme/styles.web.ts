import type { ViewStyle } from "react-native";

/** Web : l'en-tête reste collé en haut de la page qui défile ; toast centré et borné. */
export const enteteCollant: ViewStyle = { position: "sticky" as any, top: 0, zIndex: 20 };
export const toastCentre: ViewStyle = { maxWidth: 420, marginHorizontal: "auto" as any };
