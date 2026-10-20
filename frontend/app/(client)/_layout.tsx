import { Redirect, Slot, usePathname } from "expo-router";
import React, { useEffect } from "react";

import { useAuth } from "@/src/auth";
import { Coquille } from "@/src/components/Coquille";
import { EcranDemarrage } from "@/src/components/EcranDemarrage";
import { accueilDuRole, NAV_CLIENT } from "@/src/nav-web";
import { memoriserSuite } from "@/src/suite";

/** Consultables sans compte : la carte et le panier. Le compte n'est demandé qu'au passage en caisse. */
const PAGES_PUBLIQUES = ["/menu", "/panier"];

/** Espace client : pages web (menu, panier, commande, suivi, compte). */
export default function ClientLayout() {
  const { user, loading } = useAuth();
  const chemin = usePathname();
  const publique = PAGES_PUBLIQUES.includes(chemin);
  const connexionRequise = !loading && !user && !publique;

  // Visiteur sur une page réservée : on retient où il allait pour l'y ramener après connexion.
  useEffect(() => {
    if (connexionRequise) void memoriserSuite(chemin);
  }, [connexionRequise, chemin]);

  if (loading) return <EcranDemarrage testID="ecran-garde" />;
  if (connexionRequise) return <Redirect href="/connexion" />;
  if (user && user.role !== "client") return <Redirect href={accueilDuRole(user.role) as any} />;
  return (
    <Coquille liens={NAV_CLIENT} avecPanier>
      <Slot />
    </Coquille>
  );
}
