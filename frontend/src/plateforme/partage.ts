import { Share } from "react-native";

/** Partage — iOS / Android : feuille de partage du système. Même API que partage.web.ts. */
export async function partagerLien(message: string, url: string): Promise<"partage" | "copie"> {
  await Share.share({ message, url });
  return "partage";
}
