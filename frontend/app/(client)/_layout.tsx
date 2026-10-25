import { Slot, usePathname, useRouter, useSegments } from "expo-router";
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
  const router = useRouter();
  const chemin = usePathname();
  // Sur mobile, la pile native garde cet espace monté sous l'écran suivant
  // (ex. /panier -> /connexion) et usePathname() y renvoie l'adresse de cet
  // écran : la garde n'agit que si la page affichée appartient à l'espace client.
  const actif = useSegments()[0] === "(client)";
  const publique = PAGES_PUBLIQUES.includes(chemin);
  const connexionRequise = actif && !loading && !user && !publique;
  const autreRole = actif && !loading && !!user && user.role !== "client";

  // Redirections lancées après le rendu, pas avec <Redirect> : ce layout reste monté
  // pendant une navigation interne (ex. /panier -> /commande/adresse) et <Redirect>
  // (useFocusEffect) y annulait la navigation, ramenant sur la page précédente.
  useEffect(() => {
    if (connexionRequise) {
      // Visiteur sur une page réservée : on retient où il allait pour l'y ramener après connexion.
      void memoriserSuite(chemin).then(() => router.replace("/connexion"));
    } else if (autreRole && user) {
      router.replace(accueilDuRole(user.role) as any);
    }
  }, [connexionRequise, autreRole, chemin, router, user]);

  if (loading || connexionRequise || autreRole) return <EcranDemarrage testID="ecran-garde" />;
  return (
    <Coquille liens={NAV_CLIENT} avecPanier>
      <Slot />
    </Coquille>
  );
}
