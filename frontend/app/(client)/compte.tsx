import { Icone } from "@/src/components/Icone";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { useAuth } from "@/src/auth";
import { Bouton } from "@/src/components/Bouton";
import { CarteNotifications } from "@/src/components/CarteNotifications";
import { TitrePage } from "@/src/components/TitrePage";
import { useT } from "@/src/i18n";
import { LARGEUR_CONTENU } from "@/src/reactif";
import { colors, fonts, radius, softShadow, spacing, stylesDynamiques } from "@/src/theme";
import { useTheme } from "@/src/theme-contexte";
import { useToast } from "@/src/toast";

export default function Compte() {
  useTheme();
  const router = useRouter();
  const toast = useToast();
  const t = useT();
  const { user, deconnexion, supprimerCompte } = useAuth();
  const [confirmation, setConfirmation] = useState<1 | 2 | null>(null);
  const [enCours, setEnCours] = useState(false);

  const supprimer = async () => {
    setEnCours(true);
    try {
      await supprimerCompte();
      setConfirmation(null);
      router.replace("/bienvenue");
      toast.show("Votre compte a été supprimé", "succes");
    } catch (e: any) {
      toast.show(e.message, "erreur");
    } finally {
      setEnCours(false);
    }
  };

  return (
    <View testID="ecran-compte" style={styles.ecran}>
      <ScrollView
        contentContainerStyle={styles.contenu}
      >
        <TitrePage titre="Mon compte" sousTitre={user?.nom ?? undefined} />

        <View style={styles.carte}>
          <View style={styles.avatar}>
            <Text style={styles.initiale}>{(user?.nom ?? "?").charAt(0).toUpperCase()}</Text>
          </View>
          <Text testID="compte-nom" style={styles.nom}>
            {user?.nom}
          </Text>
          <Text style={styles.detail}>{user?.telephone}</Text>
          {user?.email ? <Text style={styles.detail}>{user.email}</Text> : null}
        </View>

        <CarteNotifications texte="Activez-les pour savoir quand votre commande part et quand le livreur arrive, même app fermée." />

        <View style={styles.carteInfo}>
          <View style={styles.ligneInfo}>
            <Icone name="dollar-sign" size={18} color={colors.brandPrimary} />
            <Text style={styles.infoTexte}>{t("compte.paiement")}</Text>
          </View>
          <View style={styles.ligneInfo}>
            <Icone name="map-pin" size={18} color={colors.brandPrimary} />
            <Text style={styles.infoTexte}>{t("compte.zones")}</Text>
          </View>
          <View style={styles.ligneInfo}>
            <Icone name="clock" size={18} color={colors.brandPrimary} />
            <Text style={styles.infoTexte}>{t("compte.livraison")}</Text>
          </View>
        </View>

        <Bouton
          testID="btn-parametres-client"
          label={t("compte.parametres")}
          variant="secondaire"
          icone="settings"
          onPress={() => router.push("/parametres")}
        />
        <Bouton
          testID="btn-mes-commandes"
          label={t("compte.mesCommandes")}
          variant="secondaire"
          icone="shopping-bag"
          onPress={() => router.push("/commandes")}
        />
        <Bouton
          testID="btn-deconnexion"
          label={t("compte.deconnexion")}
          variant="danger"
          icone="log-out"
          onPress={async () => {
            await deconnexion();
            router.replace("/bienvenue");
          }}
        />
        <Pressable testID="btn-supprimer-compte" onPress={() => setConfirmation(1)} style={styles.lienSuppression}>
          <Icone name="trash-2" size={16} color={colors.muted} />
          <Text style={styles.lienTexte}>{t("compte.supprimerCompte")}</Text>
        </Pressable>
      </ScrollView>

      <Modal visible={confirmation !== null} transparent animationType="fade" onRequestClose={() => setConfirmation(null)}>
        <View style={styles.voile}>
          <View style={styles.boite}>
            <Icone name="alert-circle" size={30} color={colors.error} />
            {confirmation === 1 ? (
              <>
                <Text style={styles.boiteTitre}>Supprimer votre compte ?</Text>
                <Text style={styles.boiteTexte}>
                  Votre profil, vos adresses et votre accès seront effacés. Vos commandes passées sont conservées de
                  façon anonyme pour la comptabilité de la boutique.
                </Text>
                <Bouton
                  testID="btn-confirmer-suppression-1"
                  label="Continuer"
                  variant="danger"
                  onPress={() => setConfirmation(2)}
                />
              </>
            ) : (
              <>
                <Text style={styles.boiteTitre}>Confirmation définitive</Text>
                <Text style={styles.boiteTexte}>
                  Cette action est irréversible. Vous devrez créer un nouveau compte pour commander à nouveau.
                </Text>
                <Bouton
                  testID="btn-confirmer-suppression-2"
                  label={enCours ? "Suppression..." : "Supprimer définitivement"}
                  variant="danger"
                  onPress={supprimer}
                />
              </>
            )}
            <Bouton
              testID="btn-annuler-suppression"
              label="Annuler"
              variant="contour"
              onPress={() => setConfirmation(null)}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = stylesDynamiques(() => StyleSheet.create({
  ecran: { flex: 1, backgroundColor: colors.surfaceSecondary },
  contenu: { ...LARGEUR_CONTENU, padding: spacing.xl, gap: spacing.lg },
  carte: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: "center",
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    ...softShadow,
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: radius.pill,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  initiale: { fontFamily: fonts.display, fontSize: 32, color: colors.brandPrimary },
  nom: { fontFamily: fonts.display, fontSize: 22, color: colors.onSurface },
  detail: { fontFamily: fonts.text, fontSize: 13, color: colors.muted },
  carteInfo: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ligneInfo: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  infoTexte: { flex: 1, fontFamily: fonts.text, fontSize: 13, color: colors.onSurface },
  lienSuppression: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    minHeight: 44,
  },
  lienTexte: { fontFamily: fonts.text, fontSize: 13, color: colors.muted, textDecorationLine: "underline" },
  voile: {
    flex: 1,
    backgroundColor: "rgba(42,23,33,0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  boite: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    gap: spacing.md,
    alignItems: "center",
  },
  boiteTitre: { fontFamily: fonts.display, fontSize: 20, color: colors.onSurface, textAlign: "center" },
  boiteTexte: { fontFamily: fonts.text, fontSize: 13, color: colors.muted, textAlign: "center" },
}));
