import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/src/api";
import { useAuth } from "@/src/auth";

/**
 * Notifications internes (centre de notifications). Créées par le serveur à
 * chaque événement métier, dans la langue de l'utilisateur et selon ses
 * préférences ; les mêmes événements partent aussi en push système.
 */
export type NotificationApp = {
  id: string;
  type: "commande" | "paiement" | "promotion" | "admin" | "course";
  titre: string;
  message: string;
  lien: string;
  tag: string;
  lu: boolean;
  createdAt: string;
};

type Reponse = { notifications: NotificationApp[]; nonLues: number };

export function useNotifications() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["notifications"],
    queryFn: () => apiFetch<Reponse>("/notifications"),
    enabled: !!user,
    // Filet de sécurité : un push reçu app ouverte déclenche un rafraîchissement immédiat.
    refetchInterval: 15000,
  });
}

/** Sans `ids`, tout est marqué comme lu. */
export function marquerLues(ids?: string[]) {
  return apiFetch("/notifications/lues", { method: "POST", body: ids ? { ids } : {} });
}
