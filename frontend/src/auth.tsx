import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Platform } from "react-native";

import { apiFetch, setAuthToken } from "@/src/api";
import { storage } from "@/src/utils/storage";

const TOKEN_KEY = "pb_token";
const AUTH_EMERGENT = "https://auth.emergentagent.com/?redirect=";

WebBrowser.maybeCompleteAuthSession();

function extraireSessionId(url?: string | null): string | null {
  if (!url) return null;
  const m = url.match(/[?#&]session_id=([^&#]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

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
  const urlCapturee = useRef<string | null>(null);

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
      let sessionId: string | null = null;
      if (Platform.OS === "web") {
        sessionId = extraireSessionId(window.location.href);
      } else {
        sessionId = extraireSessionId(await Linking.getInitialURL());
      }

      if (sessionId) {
        try {
          await echangerSession(sessionId);
          if (Platform.OS === "web") {
            const propre = window.location.href
              .replace(/([?#&])session_id=[^&#]*/g, "$1")
              .replace(/[?#&]$/, "");
            window.history.replaceState(window.history.state, "", propre);
          }
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

  // Deep links « à chaud » (Android renvoie souvent dismiss sans URL)
  useEffect(() => {
    if (Platform.OS === "web") return;
    const sub = Linking.addEventListener("url", ({ url }) => {
      urlCapturee.current = url;
      const id = extraireSessionId(url);
      if (id) echangerSession(id).catch(() => undefined);
    });
    return () => sub.remove();
  }, [echangerSession]);

  const connexionGoogle = useCallback(async () => {
    if (Platform.OS === "web") {
      const redirect = window.location.origin + "/";
      window.location.href = `${AUTH_EMERGENT}${encodeURIComponent(redirect)}`;
      return;
    }
    const redirect = Linking.createURL("");
    urlCapturee.current = null;
    const res = await WebBrowser.openAuthSessionAsync(`${AUTH_EMERGENT}${encodeURIComponent(redirect)}`, redirect);
    const url =
      (res as any)?.url ?? urlCapturee.current ?? (await Linking.getInitialURL());
    const sessionId = extraireSessionId(url);
    if (!sessionId) throw new Error("Connexion Google annulée");
    await echangerSession(sessionId);
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
