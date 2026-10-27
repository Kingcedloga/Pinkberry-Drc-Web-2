import { usePathname, useRouter } from "expo-router";
import React, { useEffect } from "react";
import { Platform } from "react-native";

import { useAuth } from "@/src/auth";
import { accueilDuRole } from "@/src/nav-web";
import { EcranDemarrage } from "@/src/components/EcranDemarrage";

export type Role = "client" | "livreur" | "admin" | "superadmin";

export const TOUS_ROLES: Role[] = ["client", "livreur", "admin", "superadmin"];

/**
 * Redirection lancée après le rendu (router.replace), jamais avec <Redirect> :
 * ces gardes enveloppent des layouts qui restent montés pendant une navigation
 * interne, et <Redirect> (useFocusEffect, expo-router 58) y annulait la
 * navigation en cours, laissant l'utilisateur bloqué sur la page précédente.
 */
function useRedirection(cible: string | null) {
  const router = useRouter();
  useEffect(() => {
    if (cible) router.replace(cible as any);
  }, [cible, router]);
}

/**
 * Renvoie un écran de blocage (chargement ou redirection) si l'utilisateur n'a pas
 * le droit d'être là, sinon `null`. À appeler APRÈS tous les autres hooks.
 */
export function useBlocage(roles: Role[]): React.ReactElement | null {
  const { user, loading } = useAuth();
  const cible = loading
    ? null
    : !user
      ? "/bienvenue"
      : !roles.includes(user.role as Role)
        ? accueilDuRole(user.role)
        : null;
  useRedirection(cible);
  if (loading || cible) return <EcranDemarrage testID="ecran-garde" />;
  return null;
}

/** Protège une zone de l'app : seuls les rôles listés peuvent voir `children`. */
export function Garde({ roles, children }: { roles: Role[]; children: React.ReactNode }) {
  const blocage = useBlocage(roles);
  return blocage ?? <>{children}</>;
}

/** Inverse de `Garde` : réservé aux visiteurs non connectés (écrans d'authentification). */
export function GardeInvite({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const afficherBienvenuePendantChargement = Platform.OS === "web" && pathname === "/bienvenue";
  // L'accueil choisit la destination (page visitée avant la connexion, saisie du téléphone…).
  const cible = !loading && user ? "/" : null;
  useRedirection(cible);
  if ((loading && !afficherBienvenuePendantChargement) || cible) return <EcranDemarrage testID="ecran-garde" />;
  return <>{children}</>;
}
