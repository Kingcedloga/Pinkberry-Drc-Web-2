import { useRouter, type Href } from "expo-router";
import { useCallback } from "react";

/**
 * Bouton retour sûr : revient à l'écran précédent, ou remplace par `repli`
 * quand l'historique est vide (rechargement web, lien direct, notification).
 * `/` redirige vers l'accueil du rôle connecté.
 */
export function useRetour(repli: Href = "/") {
  const router = useRouter();
  return useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace(repli);
  }, [router, repli]);
}
