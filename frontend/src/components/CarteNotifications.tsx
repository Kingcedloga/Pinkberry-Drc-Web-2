import React, { useEffect, useState } from "react";
import { Linking, Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { useAuth } from "@/src/auth";
import { Bouton } from "@/src/components/Bouton";
import { Icone } from "@/src/components/Icone";
import { useT } from "@/src/i18n";
import { demanderPush, etatPush, type EtatPush } from "@/src/push";
import {
  abonnerPushWeb,
  desabonnerPushWeb,
  etatPushWeb,
  iosSansInstallation,
  pushWebDisponible,
  type EtatPushWeb,
} from "@/src/push-web";
import { colors, fonts, radius, spacing, stylesDynamiques } from "@/src/theme";
import { useToast } from "@/src/toast";
import { storage } from "@/src/utils/storage";

const CLE_INVITE = "invite-notifications-masquee-jusqua";
const SEPT_JOURS = 7 * 24 * 3600 * 1000;

/**
 * Invite maison « Notifications » : explique le bénéfice AVANT la demande du
 * système / navigateur, qui n'est déclenchée que si l'utilisateur accepte.
 * Gère les états default / granted / denied, l'iPhone non installé (push web
 * réservé aux PWA ajoutées à l'écran d'accueil) et la désactivation (abonnement
 * supprimé côté serveur). `masquable` : bouton « Plus tard » (7 jours).
 */
export function CarteNotifications({ texte, masquable = true }: { texte: string; masquable?: boolean }) {
  const { user } = useAuth();
  const t = useT();
  const toast = useToast();
  const web = Platform.OS === "web";
  const iosAInstaller = web && iosSansInstallation();
  const [etat, setEtat] = useState<EtatPush | null>(null);
  const [etatWeb, setEtatWeb] = useState<EtatPushWeb | null>(null);
  const [aideIOS, setAideIOS] = useState(false);
  const [masquee, setMasquee] = useState(masquable);

  useEffect(() => {
    let monte = true;
    (async () => {
      if (web) {
        const e = await etatPushWeb();
        if (monte) setEtatWeb(e);
      } else {
        const e = await etatPush();
        if (monte) setEtat(e);
      }
      if (masquable) {
        const jusqua = await storage.getItem<number>(CLE_INVITE, 0).catch(() => 0);
        if (monte) setMasquee(Number(jusqua) > Date.now());
      }
    })();
    return () => {
      monte = false;
    };
  }, [web, masquable]);

  if (!user) return null;

  const plusTard = () => {
    setMasquee(true);
    storage.setItem(CLE_INVITE, Date.now() + SEPT_JOURS).catch(() => undefined);
  };

  const carte = (
    actif: boolean,
    titre: string,
    message: string,
    actions: React.ReactNode,
    testID = "carte-notifications",
  ) => (
    <View testID={testID} style={[styles.carte, actif && styles.carteOk]}>
      <View style={styles.ligne}>
        <Icone name={actif ? "check-circle" : "bell"} size={20} color={actif ? colors.success : colors.brandPrimary} />
        <Text style={styles.titre}>{titre}</Text>
      </View>
      <Text style={styles.texte}>{message}</Text>
      {actions}
    </View>
  );

  const boutonPlusTard =
    masquable ? (
      <Pressable testID="btn-notifications-plus-tard" onPress={plusTard} hitSlop={6}>
        <Text style={styles.plusTard}>{t("notifs.plusTard")}</Text>
      </Pressable>
    ) : null;

  // ------------------------------------------------------------------- web
  if (web) {
    // iPhone dans Safari : l'API Push n'existe qu'une fois l'app installée.
    if (iosAInstaller) {
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
          <View style={styles.actions}>
            <Bouton
              testID="btn-activer-notifications"
              label={t("notifs.activer")}
              variant="secondaire"
              onPress={() => setAideIOS(true)}
            />
            {boutonPlusTard}
          </View>
        ),
      );
    }

    if (!pushWebDisponible() || !etatWeb || !etatWeb.supporte) {
      return masquable ? null : carte(false, t("notifs.inviteTitre"), t("notifs.nonSupporte"), null);
    }

    const activer = async () => {
      try {
        const apres = await abonnerPushWeb();
        setEtatWeb(apres);
        if (apres.abonne) toast.show(t("notifs.activees"), "succes");
        else if (apres.permission === "denied") toast.show(t("notifs.refusees"), "info");
      } catch {
        toast.show(t("notifs.impossible"), "erreur");
      }
    };

    const couper = async () => {
      setEtatWeb(await desabonnerPushWeb());
      toast.show(t("notifs.desactivees"), "info");
    };

    if (etatWeb.abonne) {
      // Invite contextuelle : rien à proposer une fois activées (sauf dans les paramètres).
      if (masquable) return null;
      return carte(
        true,
        t("notifs.activeesTitre"),
        t("notifs.activeesTexte"),
        <Bouton testID="btn-couper-notifications" label={t("notifs.desactiver")} variant="secondaire" onPress={couper} />,
      );
    }

    if (etatWeb.permission === "denied") {
      return masquee
        ? null
        : carte(false, t("notifs.bloqueesTitre"), t("notifs.bloqueesTexte"), boutonPlusTard);
    }

    if (masquee) return null;
    return carte(
      false,
      t("notifs.inviteTitre"),
      texte,
      <View style={styles.actions}>
        <Bouton testID="btn-activer-notifications" label={t("notifs.activer")} variant="secondaire" onPress={activer} />
        {boutonPlusTard}
      </View>,
    );
  }

  // ----------------------------------------------------------------- natif
  if (!etat) return null;
  const accorde = etat.statut === "granted";
  if (accorde && masquable) return null;
  if (!accorde && masquee) return null;
  const bloque = !accorde && !etat.peutRedemander;

  const activerNatif = async () => {
    const apres = await demanderPush(user.id);
    setEtat(apres);
    if (apres.statut === "granted") toast.show(t("notifs.activees"), "succes");
    else if (!apres.peutRedemander) toast.show(t("notifs.refuseesNatif"), "info");
  };

  return carte(
    accorde,
    accorde ? t("notifs.activeesTitre") : bloque ? t("notifs.bloqueesTitre") : t("notifs.inviteTitre"),
    accorde ? t("notifs.activeesTexte") : bloque ? t("notifs.bloqueesNatif") : texte,
    accorde ? null : bloque ? (
      <Bouton
        testID="btn-reglages-notifications"
        label={t("notifs.ouvrirReglages")}
        variant="secondaire"
        onPress={() => Linking.openSettings()}
      />
    ) : (
      <View style={styles.actions}>
        <Bouton testID="btn-activer-notifications" label={t("notifs.activer")} variant="secondaire" onPress={activerNatif} />
        {boutonPlusTard}
      </View>
    ),
  );
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
