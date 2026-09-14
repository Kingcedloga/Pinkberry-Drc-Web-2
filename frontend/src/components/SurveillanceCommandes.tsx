import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { apiFetch } from "@/src/api";
import { useAuth } from "@/src/auth";
import { useToast } from "@/src/toast";

const MESSAGES: Record<string, { titre: string; message: string; type: "succes" | "erreur" | "info" }> = {
  recue: { titre: "Commande reçue", message: "Nous avons bien reçu votre commande.", type: "succes" },
  en_preparation: { titre: "En préparation", message: "Votre commande est en préparation.", type: "info" },
  recuperee: { titre: "Commande récupérée", message: "Le livreur a récupéré votre commande.", type: "info" },
  en_route: { titre: "Livreur en route", message: "Votre livreur arrive, suivez-le sur la carte.", type: "succes" },
  arrive: { titre: "Le livreur est arrivé", message: "Préparez le montant à régler en cash.", type: "succes" },
  livree: { titre: "Commande livrée", message: "Bon appétit ! Merci pour votre commande.", type: "succes" },
  annulee: { titre: "Commande annulée", message: "Votre commande a été annulée.", type: "erreur" },
};

/**
 * Surveille les commandes du client et déclenche une notification pop-up
 * à chaque changement de statut (y compris « le livreur est arrivé »).
 */
export function SurveillanceCommandes() {
  const { user } = useAuth();
  const toast = useToast();
  const connus = useRef<Record<string, string>>({});
  const initialise = useRef(false);

  const q = useQuery({
    queryKey: ["mes-commandes"],
    queryFn: () => apiFetch<any[]>("/commandes/mes"),
    enabled: !!user && user.role === "client",
    refetchInterval: 5000,
  });

  useEffect(() => {
    if (!q.data) return;

    const etats: Record<string, string> = {};
    q.data.forEach((c) => {
      const proche = c.statut === "en_route" && (c.etaMinutes ?? 99) <= 3;
      etats[c.id] = proche ? "arrive" : c.statut;
    });

    if (!initialise.current) {
      connus.current = etats;
      initialise.current = true;
      return;
    }

    Object.entries(etats).forEach(([id, etat]) => {
      const avant = connus.current[id];
      if (avant && avant !== etat) {
        const m = MESSAGES[etat];
        const numero = q.data?.find((c) => c.id === id)?.numero;
        if (m) toast.show(numero ? `${numero} · ${m.message}` : m.message, m.type, m.titre);
      }
    });
    connus.current = etats;
  }, [q.data, toast]);

  useEffect(() => {
    if (!user) {
      connus.current = {};
      initialise.current = false;
    }
  }, [user]);

  return null;
}
