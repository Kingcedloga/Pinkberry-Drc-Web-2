import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { apiFetch, setAuthToken } from "@/src/api";
import {
  nettoyerRetourGoogle,
  ouvrirConnexionGoogle,
  retourGoogleInitial,
  surRetourGoogle,
} from "@/src/plateforme/connexion-google";
import { storage } from "@/src/utils/storage";
import { CLE_JETON } from "@/src/prefs";

const TOKEN_KEY = CLE_JETON;
export type Utilisateur = {
  id: string;
  nom: string;
  telephone: string;
  email?: string | null;
  role: "client" | "livreur" | "admin" | "superadmin";
  verifie: boolean;
  livreurId?: string | null;
  actif?: boolean;
};

type AuthValue = {
  user: Utilisateur | null;
  loading: boolean;
  connexion: (telephone: string, motDePasse: string) => Promise<Utilisateur>;
  inscription: (p: { nom: string; telephone: string; email?: string; motDePasse: string }) => Promise<{ codeDemo?: string; emailEnvoye: boolean }>;
  verifierOtp: (telephone: string, code: string) => Promise<Utilisateur>;
  connexionGoogle: () => Promise<void>;
  enregistrerTelephone: (telephone: string) => Promise<Utilisateur>;
  deconnexion: () => Promise<void>;
  supprimerCompte: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Utilisateur | null>(null);
  const [loading, setLoading] = useState(true);
  const dejaTraites = useRef<Set<string>>(new Set());

  const applique = useCallback(async (token: string, u: Utilisateur) => {
    setAuthToken(token);
    await storage.secureSet(TOKEN_KEY, token);
    setUser(u);
    return u;
  }, []);

  const echangerSession = useCallback(
    async (sessionId: string) => {
      if (dejaTraites.current.has(sessionId)) return;
      dejaTraites.current.add(sessionId);
      const r = await apiFetch<{ token: string; user: Utilisateur }>("/auth/session", {
        method: "POST",
        body: { session_id: sessionId },
      });
      await applique(r.token, r.user);
    },
    [applique],
  );

  useEffect(() => {
    (async () => {
      // 1. Un retour de Google est prioritaire sur la session stockée.
      const sessionId = await retourGoogleInitial();

      if (sessionId) {
        try {
          await echangerSession(sessionId);
          nettoyerRetourGoogle();
          setLoading(false);
          return;
        } catch {
          // on retombe sur la session stockée
        }
      }

      const t = await storage.secureGet<string>(TOKEN_KEY, "");
      if (t) {
        setAuthToken(t);
        try {
          setUser(await apiFetch<Utilisateur>("/auth/moi"));
        } catch {
          setAuthToken(null);
          await storage.secureRemove(TOKEN_KEY);
        }
      }
      setLoading(false);
    })();
  }, [echangerSession]);

  // Retours de Google « à chaud » (lien profond, mobile).
  useEffect(() => surRetourGoogle((id) => void echangerSession(id).catch(() => undefined)), [echangerSession]);

  // Web : la page part vers Google (null) ; mobile : session obtenue, ou erreur si annulée.
  const connexionGoogle = useCallback(async () => {
    const sessionId = await ouvrirConnexionGoogle();
    if (sessionId) await echangerSession(sessionId);
  }, [echangerSession]);

  const enregistrerTelephone = useCallback(async (telephone: string) => {
    const u = await apiFetch<Utilisateur>("/auth/telephone", { method: "PUT", body: { telephone } });
    setUser(u);
    return u;
  }, []);

  const connexion = useCallback(
    async (telephone: string, motDePasse: string) => {
      const r = await apiFetch<{ token: string; user: Utilisateur }>("/auth/connexion", {
        method: "POST",
        body: { telephone, motDePasse },
      });
      return applique(r.token, r.user);
    },
    [applique],
  );

  const inscription = useCallback(async (p: { nom: string; telephone: string; email?: string; motDePasse: string }) => {
    return apiFetch<{ codeDemo?: string; emailEnvoye: boolean }>("/auth/inscription", { method: "POST", body: p });
  }, []);

  const verifierOtp = useCallback(
    async (telephone: string, code: string) => {
      const r = await apiFetch<{ token: string; user: Utilisateur }>("/auth/verifier-otp", {
        method: "POST",
        body: { telephone, code },
      });
      return applique(r.token, r.user);
    },
    [applique],
  );

  const deconnexion = useCallback(async () => {
    setAuthToken(null);
    await storage.secureRemove(TOKEN_KEY);
    setUser(null);
  }, []);

  const supprimerCompte = useCallback(async () => {
    await apiFetch("/auth/moi", { method: "DELETE" });
    setAuthToken(null);
    await storage.secureRemove(TOKEN_KEY);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      connexion,
      inscription,
      verifierOtp,
      connexionGoogle,
      enregistrerTelephone,
      deconnexion,
      supprimerCompte,
    }),
    [user, loading, connexion, inscription, verifierOtp, connexionGoogle, enregistrerTelephone, deconnexion, supprimerCompte],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être utilisé dans AuthProvider");
  return ctx;
}
