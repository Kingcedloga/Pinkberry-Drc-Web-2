import { useQueryClient } from "@tanstack/react-query";
import { useGlobalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef } from "react";

import { useAuth } from "@/src/auth";
import { marquerLues, useNotifications, type NotificationApp } from "@/src/notifications";
import { surNotificationRecue } from "@/src/plateforme/notifications";
import { useToast } from "@/src/toast";

const typeToast = (n: NotificationApp) =>
  /annulee|-ko$/.test(n.tag) ? "erreur" : /livree|-ok$|promo-/.test(n.tag) ? "succes" : "info";

/**
 * Canal interne, quand l'app est ouverte : chaque nouvelle notification du
 * serveur s'affiche en toast (empilé, non bloquant, disparaît seul). Une
 * notification reçue app ouverte (push mobile, ou message du service worker sur
 * le web) déclenche un rafraîchissement immédiat.
 */
export function NotificationsInternes() {
  const { user } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const q = useNotifications();
  const router = useRouter();
  const { notif } = useGlobalSearchParams<{ notif?: string }>();
  // Notifications déjà connues : l'historique présent à l'ouverture ne s'affiche pas.
  const connues = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!user) connues.current = null;
  }, [user]);

  useEffect(() => {
    const liste = q.data?.notifications;
    if (!liste) return;
    if (!connues.current) {
      connues.current = new Set(liste.map((n) => n.id));
      return;
    }
    const nouvelles = liste.filter((n) => !connues.current!.has(n.id)).reverse();
    for (const n of nouvelles) {
      connues.current.add(n.id);
      if (!n.lu) toast.show(n.message, typeToast(n), n.titre);
    }
    // Les écrans concernés se mettent à jour sans attendre leur propre rafraîchissement.
    if (nouvelles.some((n) => n.type === "commande" || n.type === "paiement")) {
      qc.invalidateQueries({ queryKey: ["mes-commandes"] });
      qc.invalidateQueries({ queryKey: ["commande"] });
    }
    if (nouvelles.some((n) => n.type === "admin" || n.type === "course")) {
      qc.invalidateQueries({ queryKey: ["admin-commandes"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
      qc.invalidateQueries({ queryKey: ["livreur-courses"] });
    }
  }, [q.data, toast, qc]);

  // Ouverture depuis un push (lien « …?notif=<id> ») : la notification est marquée
  // lue côté serveur, donc sur tous les appareils, puis le paramètre est retiré.
  useEffect(() => {
    if (!user || typeof notif !== "string" || !notif) return;
    marquerLues([notif])
      .catch(() => undefined)
      .finally(() => qc.invalidateQueries({ queryKey: ["notifications"] }));
    router.setParams({ notif: undefined } as any);
  }, [notif, user, qc, router]);

  // Une notification arrive app ouverte : la liste se rafraîchit aussitôt.
  useEffect(() => surNotificationRecue(() => qc.invalidateQueries({ queryKey: ["notifications"] })), [qc]);

  return null;
}
