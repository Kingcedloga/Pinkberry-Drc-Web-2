import { useQuery } from "@tanstack/react-query";
import i18n from "i18next";

import { apiFetch } from "@/src/api";
import { type Point } from "@/src/components/Carte";

export type Itineraire = {
  points: [number, number][];
  distanceMetres: number | null;
  etaSecondes: number | null;
  heureArrivee: string | null;
};

/** Itinéraire routier réel (TomTom) entre le livreur et le client, avec durée estimée. */
export function useItineraire(livreur: Point | null | undefined, client: Point, actif: boolean) {
  return useQuery({
    queryKey: ["itineraire", livreur?.lat, livreur?.lng, client.lat, client.lng],
    enabled: actif && !!livreur,
    staleTime: 30_000,
    retry: false,
    queryFn: () =>
      apiFetch<Itineraire>("/carte/itineraire", {
        method: "POST",
        body: { origine: [livreur!.lat, livreur!.lng], destination: [client.lat, client.lng] },
      }),
  });
}

/** « 12 min » / « 1 h 05 » à partir d'une durée en secondes. */
export function dureeLisible(secondes?: number | null) {
  if (!secondes && secondes !== 0) return null;
  const minutes = Math.max(1, Math.round(secondes / 60));
  if (minutes < 60) return i18n.t("unites.minutes", { n: minutes });
  return i18n.t("unites.heures", { h: Math.floor(minutes / 60), m: String(minutes % 60).padStart(2, "0") });
}

/** « 3,2 km » ou « 850 m ». */
export function distanceLisible(metres?: number | null) {
  if (!metres && metres !== 0) return null;
  if (metres < 1000) return i18n.t("unites.metres", { n: Math.round(metres) });
  return i18n.t("unites.kilometres", { n: (metres / 1000).toFixed(1).replace(".", i18n.t("unites.decimale")) });
}
