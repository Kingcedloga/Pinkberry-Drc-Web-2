import { Platform } from "react-native";

/**
 * Sur iOS 26+, les onglets natifs (liquid glass) sont utilisés : la barre est
 * translucide et le contenu passe DESSOUS. Ailleurs (iOS < 26, Android, web),
 * la barre d'onglets classique occupe sa place dans la mise en page.
 */
export const ONGLETS_NATIFS = Platform.OS === "ios" && parseInt(String(Platform.Version), 10) >= 26;

/** Hauteur réservée par la barre d'onglets native qui recouvre le contenu. */
export function hauteurOngletsNatifs(insetBas: number): number {
  return ONGLETS_NATIFS ? 49 + insetBas : 0;
}
