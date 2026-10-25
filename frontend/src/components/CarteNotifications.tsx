import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useAuth } from "@/src/auth";
import { Bouton } from "@/src/components/Bouton";
import { Icone } from "@/src/components/Icone";
import { useT } from "@/src/i18n";
import {
  activerNotifs,
  desactivationDansApp,
  desactiverNotifs,
  lireStatutNotifs,
  type StatutNotifs,
} from "@/src/plateforme/notifications";
import { ouvrirReglages, reglagesDisponibles } from "@/src/plateforme/reglages";
import { colors, fonts, radius, spacing, stylesDynamiques } from "@/src/theme";
import { useToast } from "@/src/toast";
import { storage } from "@/src/utils/storage";

const CLE_INVITE = "invite-notifications-masquee-jusqua";
const SEPT_JOURS = 7 * 24 * 3600 * 1000;

/**
 * Invite maison « Notifications » : explique le bénéfice AVANT la demande du
 * système / navigateur, qui n'est déclenchée que si l'utilisateur accepte.
 * Une seule logique pour le web et le mobile (src/plateforme/notifications) :
 * à demander / actives / bloquées / non supportées, plus l'iPhone non installé
 * (push web réservé aux PWA ajoutées à l'écran d'accueil).
 * `masquable` : bouton « Plus tard » (7 jours).
 */
export function CarteNotifications({ texte, masquable = true }: { texte: string; masquable?: boolean }) {
  const { user } = useAuth();
  const t = useT();
  const toast = useToast();
  const [statut, setStatut] = useState<StatutNotifs | null>(null);
  const [aideIOS, setAideIOS] = useState(false);
  const [masquee, setMasquee] = useState(masquable);

  useEffect(() => {
    let monte = true;
    (async () => {
      const s = await lireStatutNotifs().catch((): StatutNotifs => "non_supporte");
      if (monte) setStatut(s);
      if (masquable) {
        const jusqua = await storage.getItem<number>(CLE_INVITE, 0).catch(() => 0);
        if (monte) setMasquee(Number(jusqua) > Date.now());
      }
    })();
    return () => {
      monte = false;
    };
  }, [masquable]);

  if (!user || !statut) return null;

  const plusTard = () => {
    setMasquee(true);
    storage.setItem(CLE_INVITE, Date.now() + SEPT_JOURS).catch(() => undefined);
  };

  const activer = async () => {
    try {
      const apres = await activerNotifs(user.id);
      setStatut(apres);
      if (apres === "actives") toast.show(t("notifs.activees"), "succes");
      else if (apres === "bloquees") toast.show(t(reglagesDisponibles ? "notifs.refuseesNatif" : "notifs.refusees"), "info");
    } catch {
      toast.show(t("notifs.impossible"), "erreur");
    }
  };

  const couper = async () => {
    setStatut(await desactiverNotifs());
    toast.show(t("notifs.desactivees"), "info");
  };

  const carte = (actif: boolean, titre: string, message: string, actions: React.ReactNode) => (
    <View testID="carte-notifications" style={[styles.carte, actif && styles.carteOk]}>
      <View style={styles.ligne}>
        <Icone name={actif ? "check-circle" : "bell"} size={20} color={actif ? colors.success : colors.brandPrimary} />
        <Text style={styles.titre}>{titre}</Text>
      </View>
      <Text style={styles.texte}>{message}</Text>
      {actions}
    </View>
  );

  const boutonPlusTard = masquable ? (
    <Pressable testID="btn-notifications-plus-tard" onPress={plusTard} hitSlop={6}>
      <Text style={styles.plusTard}>{t("notifs.plusTard")}</Text>
    </Pressable>
  ) : null;

  const invite = (onActiver: () => void) => (
    <View style={styles.actions}>
      <Bouton testID="btn-activer-notifications" label={t("notifs.activer")} variant="secondaire" onPress={onActiver} />
      {boutonPlusTard}
    </View>
  );

  switch (statut) {
    case "non_supporte":
      return masquable ? null : carte(false, t("notifs.inviteTitre"), t("notifs.nonSupporte"), null);

    case "actives":
      // Invite contextuelle : rien à proposer une fois activées (sauf dans les paramètres).
      if (masquable) return null;
      return carte(
        true,
        t("notifs.activeesTitre"),
        t("notifs.activeesTexte"),
        desactivationDansApp ? (
          <Bouton testID="btn-couper-notifications" label={t("notifs.desactiver")} variant="secondaire" onPress={couper} />
        ) : null,
      );

    case "a_installer":
      // iPhone dans Safari : l'API Push n'existe qu'une fois l'app installée.
      if (masquee) return null;
      return carte(
        false,
        t("notifs.inviteTitre"),
        aideIOS ? t("notifs.iosInstaller") : texte,
        aideIOS ? (
          <Text testID="aide-ios-notifications" style={styles.etapes}>
            {t("notifs.iosEtapes")}
          </Text>
        ) : (
          invite(() => setAideIOS(true))
        ),
      );

    case "bloquees":
      if (masquee) return null;
      return carte(
        false,
        t("notifs.bloqueesTitre"),
        t(reglagesDisponibles ? "notifs.bloqueesNatif" : "notifs.bloqueesTexte"),
        reglagesDisponibles ? (
          <Bouton testID="btn-reglages-notifications" label={t("notifs.ouvrirReglages")} variant="secondaire" onPress={ouvrirReglages} />
        ) : (
          boutonPlusTard
        ),
      );

    case "a_demander":
      if (masquee) return null;
      return carte(false, t("notifs.inviteTitre"), texte, invite(activer));
  }
}

const styles = stylesDynamiques(() =>
  StyleSheet.create({
    carte: {
      backgroundColor: colors.brandTertiary,
      borderRadius: radius.xl,
      padding: spacing.lg,
      gap: spacing.sm,
    },
    carteOk: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
    ligne: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    titre: { flex: 1, fontFamily: fonts.display, fontSize: 16, color: colors.onSurface },
    texte: { fontFamily: fonts.text, fontSize: 13, color: colors.muted },
    etapes: { fontFamily: fonts.text, fontSize: 13, fontWeight: "700", color: colors.onSurface },
    actions: { gap: spacing.sm, alignItems: "stretch" },
    plusTard: { textAlign: "center", fontFamily: fonts.text, fontSize: 13, fontWeight: "700", color: colors.muted },
  }),
);
