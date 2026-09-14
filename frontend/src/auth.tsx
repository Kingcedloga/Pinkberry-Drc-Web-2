import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { apiFetch, setAuthToken } from "@/src/api";
import { storage } from "@/src/utils/storage";

const TOKEN_KEY = "pb_token";

export type Utilisateur = {
  id: string;
  nom: string;
  telephone: string;
  email?: string | null;
  role: "client" | "livreur" | "admin";
  verifie: boolean;
  livreurId?: string | null;
};

type AuthValue = {
  user: Utilisateur | null;
  loading: boolean;
  connexion: (telephone: string, motDePasse: string) => Promise<Utilisateur>;
  inscription: (p: { nom: string; telephone: string; email?: string; motDePasse: string }) => Promise<{ codeDemo: string; emailEnvoye: boolean }>;
  verifierOtp: (telephone: string, code: string) => Promise<Utilisateur>;
  deconnexion: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Utilisateur | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
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
  }, []);

  const applique = useCallback(async (token: string, u: Utilisateur) => {
    setAuthToken(token);
    await storage.secureSet(TOKEN_KEY, token);
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
    return apiFetch<{ codeDemo: string; emailEnvoye: boolean }>("/auth/inscription", { method: "POST", body: p });
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

  const value = useMemo(
    () => ({ user, loading, connexion, inscription, verifierOtp, deconnexion }),
    [user, loading, connexion, inscription, verifierOtp, deconnexion],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être utilisé dans AuthProvider");
  return ctx;
}
