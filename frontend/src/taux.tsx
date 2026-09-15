import { useQuery } from "@tanstack/react-query";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

import { apiFetch } from "@/src/api";
import { TAUX_FC_DEFAUT, setTauxFC } from "@/src/money";

type ConfigApp = { tauxFC: number; fraisLivraison: number };

const TauxContext = createContext<ConfigApp>({ tauxFC: TAUX_FC_DEFAUT, fraisLivraison: 2.5 });

export function TauxProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<ConfigApp>({ tauxFC: TAUX_FC_DEFAUT, fraisLivraison: 2.5 });

  const q = useQuery({
    queryKey: ["config"],
    queryFn: () => apiFetch<ConfigApp>("/config"),
    refetchInterval: 20000,
    refetchOnMount: "always",
    staleTime: 0,
  });

  useEffect(() => {
    if (q.data?.tauxFC) {
      setTauxFC(q.data.tauxFC);
      setConfig(q.data);
    }
  }, [q.data?.tauxFC, q.data?.fraisLivraison]);

  return <TauxContext.Provider value={config}>{children}</TauxContext.Provider>;
}

/** Taux USD → FC courant (abonne le composant à ses changements). */
export function useTaux(): number {
  return useContext(TauxContext).tauxFC;
}

export function useConfigApp(): ConfigApp {
  return useContext(TauxContext);
}

function groupe(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/** Formateurs de montants basés sur le taux défini par l'admin. */
export function useMontant() {
  const taux = useTaux();
  return useMemo(() => {
    const usd = (n: number) => `$${(n ?? 0).toFixed(2)}`;
    const fc = (n: number) => `${groupe(Math.round((n ?? 0) * taux))} FC`;
    return { usd, fc, prix: (n: number) => `${usd(n)} ≈ ${fc(n)}`, taux };
  }, [taux]);
}
