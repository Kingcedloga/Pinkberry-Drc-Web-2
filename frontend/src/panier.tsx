import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

export type Garniture = { nom: string; prix: number };

export type ArticlePanier = {
  cle: string;
  produitId: string;
  nom: string;
  taille?: string | null;
  garnitures: Garniture[];
  quantite: number;
  prixUnitaire: number;
  emoji?: string | null;
  image?: string | null;
};

export type Adresse = {
  label: string;
  commune: string;
  avenue: string;
  numero: string;
  repere: string;
  telephone: string;
  lat?: number | null;
  lng?: number | null;
};

type PanierValue = {
  articles: ArticlePanier[];
  adresse: Adresse | null;
  setAdresse: (a: Adresse | null) => void;
  ajouter: (a: Omit<ArticlePanier, "cle">) => void;
  changerQuantite: (cle: string, delta: number) => void;
  retirer: (cle: string) => void;
  vider: () => void;
  nbArticles: number;
  sousTotal: number;
};

const PanierContext = createContext<PanierValue | null>(null);

function cleDe(a: Omit<ArticlePanier, "cle">) {
  return `${a.produitId}|${a.taille ?? ""}|${a.garnitures.map((g) => g.nom).sort().join(",")}`;
}

export function PanierProvider({ children }: { children: React.ReactNode }) {
  const [articles, setArticles] = useState<ArticlePanier[]>([]);
  const [adresse, setAdresse] = useState<Adresse | null>(null);

  const ajouter = useCallback((a: Omit<ArticlePanier, "cle">) => {
    const cle = cleDe(a);
    setArticles((prev) => {
      const i = prev.findIndex((x) => x.cle === cle);
      if (i >= 0) {
        const copie = [...prev];
        copie[i] = { ...copie[i], quantite: copie[i].quantite + a.quantite };
        return copie;
      }
      return [...prev, { ...a, cle }];
    });
  }, []);

  const changerQuantite = useCallback((cle: string, delta: number) => {
    setArticles((prev) =>
      prev
        .map((x) => (x.cle === cle ? { ...x, quantite: x.quantite + delta } : x))
        .filter((x) => x.quantite > 0),
    );
  }, []);

  const retirer = useCallback((cle: string) => {
    setArticles((prev) => prev.filter((x) => x.cle !== cle));
  }, []);

  const vider = useCallback(() => setArticles([]), []);

  const nbArticles = articles.reduce((s, a) => s + a.quantite, 0);
  const sousTotal = articles.reduce((s, a) => s + a.quantite * a.prixUnitaire, 0);

  const value = useMemo(
    () => ({ articles, adresse, setAdresse, ajouter, changerQuantite, retirer, vider, nbArticles, sousTotal }),
    [articles, adresse, ajouter, changerQuantite, retirer, vider, nbArticles, sousTotal],
  );

  return <PanierContext.Provider value={value}>{children}</PanierContext.Provider>;
}

export function usePanier(): PanierValue {
  const ctx = useContext(PanierContext);
  if (!ctx) throw new Error("usePanier doit être utilisé dans PanierProvider");
  return ctx;
}
