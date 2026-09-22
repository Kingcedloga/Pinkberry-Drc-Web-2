import React, { useCallback, useEffect, useState } from "react";
import { Linking, Platform, StyleSheet, Text, View } from "react-native";

import { useAuth } from "@/src/auth";
import { Bouton } from "@/src/components/Bouton";
import { Icone } from "@/src/components/Icone";
import { demanderPush, etatPush, type EtatPush } from "@/src/push";
import {
  abonnerPushWeb,
  desabonnerPushWeb,
  etatPushWeb,
  pushWebDisponible,
  type EtatPushWeb,
} from "@/src/push-web";
import { colors, fonts, radius, spacing, stylesDynamiques } from "@/src/theme";
import { useToast } from "@/src/toast";

/**
 * Invite maison « Notifications » : explique le bénéfice AVANT la popup du
 * système / navigateur, puis demande l'autorisation sur un geste utilisateur.
 * Web = API Push + service worker (notifications reçues app fermée).
 * Natif = expo-notifications.
 */
export function CarteNotifications({ texte }: { texte: string }) {
  const { user } = useAuth();
  const toast = useToast();
  const web = Platform.OS === "web";
  const [etat, setEtat] = useState<EtatPush | null>(null);
  const [etatWeb, setEtatWeb] = useState<EtatPushWeb | null>(null);

  const lire = useCallback(async () => {
    if (web) setEtatWeb(await etatPushWeb());
    else setEtat(await etatPush());
  }, [web]);

  useEffect(() => {
    lire();
  }, [lire]);

  if (!user) return null;

  // ------------------------------------------------------------------- web
  if (web) {
    if (!pushWebDisponible() || !etatWeb || !etatWeb.supporte) return null;

    const activer = async () => {
      try {
        const apres = await abonnerPushWeb();
        setEtatWeb(apres);
        if (apres.abonne) toast.show("Notifications activées", "succes");
        else if (apres.permission === "denied")
          toast.show("Autorisez les notifications dans votre navigateur", "info");
      } catch {
        toast.show("Impossible d'activer les notifications", "erreur");
      }
    };

    const couper = async () => {
      setEtatWeb(await desabonnerPushWeb());
      toast.show("Notifications désactivées", "info");
    };

    if (etatWeb.abonne) {
      return (
        <View testID="carte-notifications" style={[styles.carte, styles.carteOk]}>
          <View style={styles.ligne}>
            <Icone name="check-circle" size={20} color={colors.success} />
            <Text style={styles.titre}>Notifications activées</Text>
          </View>
          <Text style={styles.texte}>
            Vous serez prévenu même si l&apos;onglet ou l&apos;application est fermé.
          </Text>
          <Bouton
            testID="btn-couper-notifications"
            label="Désactiver"
            variant="secondaire"
            onPress={couper}
          />
        </View>
      );
    }

    return (
      <View testID="carte-notifications" style={styles.carte}>
        <View style={styles.ligne}>
          <Icone name="alert-circle" size={20} color={colors.brandPrimary} />
          <Text style={styles.titre}>Notifications désactivées</Text>
        </View>
        <Text style={styles.texte}>{texte}</Text>
        {etatWeb.permission === "denied" ? (
          <Text style={styles.texte}>
            Votre navigateur bloque les notifications : ouvrez le cadenas dans la barre
            d&apos;adresse et autorisez les notifications pour ce site.
          </Text>
        ) : (
          <Bouton
            testID="btn-activer-notifications"
            label="Activer les notifications"
            variant="secondaire"
            onPress={activer}
          />
        )}
      </View>
    );
  }

  // ----------------------------------------------------------------- natif
  if (!etat) return null;

  const activerNatif = async () => {
    const apres = await demanderPush(user.id);
    setEtat(apres);
    if (apres.statut === "granted") toast.show("Notifications activées", "succes");
    else if (!apres.peutRedemander) toast.show("Autorisez les notifications dans les réglages", "info");
  };

  const accorde = etat.statut === "granted";
  const bloque = etat.statut !== "granted" && !etat.peutRedemander;

  return (
    <View testID="carte-notifications" style={[styles.carte, accorde && styles.carteOk]}>
      <View style={styles.ligne}>
        <Icone
          name={accorde ? "check-circle" : "alert-circle"}
          size={20}
          color={accorde ? colors.success : colors.brandPrimary}
        />
        <Text style={styles.titre}>{accorde ? "Notifications activées" : "Notifications désactivées"}</Text>
      </View>
      <Text style={styles.texte}>
        {accorde ? "Vous serez prévenu même si l'app est fermée." : texte}
      </Text>
      {accorde ? null : bloque ? (
        <Bouton
          testID="btn-reglages-notifications"
          label="Ouvrir les réglages"
          variant="secondaire"
          onPress={() => Linking.openSettings()}
        />
      ) : (
        <Bouton
          testID="btn-activer-notifications"
          label="Activer les notifications"
          variant="secondaire"
          onPress={activerNatif}
        />
      )}
    </View>
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
  }),
);
