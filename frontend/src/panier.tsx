import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { storage } from "@/src/utils/storage";

/**
 * Panier gardé sur l'appareil : un visiteur ne le perd ni en se connectant
 * (la connexion Google recharge la page) ni en rechargeant. L'adresse n'y est
 * pas enregistrée (donnée personnelle) ; le panier est vidé après la commande.
 */
const CLE_PANIER = "pb_panier";

export type Garniture = {
  nom: string;
  prix: number;
  nomEn?: string | null;
  // Frozen yogurt composé : garniture du catalogue de composition et sa catégorie.
  id?: string;
  categorie?: string | null;
  categorieEn?: string | null;
};

export type ArticlePanier = {
  cle: string;
  produitId: string;
  nom: string;
  nomEn?: string | null;
  taille?: string | null;
  tailleEn?: string | null;
  contenant?: string | null;
  contenantEn?: string | null;
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
  /** Code promo choisi (bannière) : appliqué automatiquement au paiement. */
  codePromo: string | null;
  setCodePromo: (code: string | null) => void;
  nbArticles: number;
  sousTotal: number;
  /** Panier enregistré relu : avant, `articles` vide ne veut pas dire panier vide. */
  pret: boolean;
};

const PanierContext = createContext<PanierValue | null>(null);

function cleDe(a: Omit<ArticlePanier, "cle">) {
  const garnitures = a.garnitures.map((g) => g.id ?? g.nom).sort().join(",");
  return `${a.produitId}|${a.taille ?? ""}|${a.contenant ?? ""}|${garnitures}`;
}

export function PanierProvider({ children }: { children: React.ReactNode }) {
  const [articles, setArticles] = useState<ArticlePanier[]>([]);
  const [adresse, setAdresse] = useState<Adresse | null>(null);
  const [codePromo, setCodePromo] = useState<string | null>(null);
  const restaure = useRef(false);
  const [pret, setPret] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const brut = await storage.getItem<string>(CLE_PANIER, "");
        const sauve = brut ? JSON.parse(brut) : null;
        if (Array.isArray(sauve?.articles)) {
          // Ajouts faits pendant la lecture : conservés en plus du panier enregistré.
          setArticles((courants) => [...sauve.articles.filter((a: ArticlePanier) => !courants.some((c) => c.cle === a.cle)), ...courants]);
        }
        if (typeof sauve?.codePromo === "string") setCodePromo((c) => c ?? sauve.codePromo);
      } catch {
        /* panier illisible : on repart d'un panier vide */
      } finally {
        restaure.current = true;
        setPret(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!restaure.current) return;
    void storage.setItem(CLE_PANIER, articles.length || codePromo ? JSON.stringify({ articles, codePromo }) : "");
  }, [articles, codePromo]);

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

  const vider = useCallback(() => {
    setArticles([]);
    setCodePromo(null);
  }, []);

  const nbArticles = articles.reduce((s, a) => s + a.quantite, 0);
  const sousTotal = articles.reduce((s, a) => s + a.quantite * a.prixUnitaire, 0);

  const value = useMemo(
    () => ({
      articles,
      adresse,
      setAdresse,
      ajouter,
      changerQuantite,
      retirer,
      vider,
      codePromo,
      setCodePromo,
      nbArticles,
      sousTotal,
      pret,
    }),
    [articles, adresse, ajouter, changerQuantite, retirer, vider, codePromo, nbArticles, sousTotal, pret],
  );

  return <PanierContext.Provider value={value}>{children}</PanierContext.Provider>;
}

export function usePanier(): PanierValue {
  const ctx = useContext(PanierContext);
  if (!ctx) throw new Error("usePanier doit être utilisé dans PanierProvider");
  return ctx;
}
