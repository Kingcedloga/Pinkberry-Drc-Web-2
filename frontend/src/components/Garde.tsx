import { Redirect } from "expo-router";
import React from "react";

import { useAuth } from "@/src/auth";
import { accueilDuRole } from "@/src/nav-web";
import { EcranDemarrage } from "@/src/components/EcranDemarrage";

export type Role = "client" | "livreur" | "admin" | "superadmin";

export const TOUS_ROLES: Role[] = ["client", "livreur", "admin", "superadmin"];


/**
 * Renvoie un écran de blocage (chargement ou redirection) si l'utilisateur n'a pas
 * le droit d'être là, sinon `null`. À appeler APRÈS tous les autres hooks.
 */
export function useBlocage(roles: Role[]): React.ReactElement | null {
  const { user, loading } = useAuth();

  if (loading) return <EcranDemarrage testID="ecran-garde" />;
  if (!user) return <Redirect href="/bienvenue" />;
  if (!roles.includes(user.role as Role)) return <Redirect href={accueilDuRole(user.role) as any} />;
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

  if (loading) return <EcranDemarrage testID="ecran-garde" />;
  // L'accueil choisit la destination (page visitée avant la connexion, saisie du téléphone…).
  if (user) return <Redirect href="/" />;
  return <>{children}</>;
}
