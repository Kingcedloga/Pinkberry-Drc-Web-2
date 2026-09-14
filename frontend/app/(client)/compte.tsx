import Feather from "@react-native-vector-icons/feather";
import { useRouter } from "expo-router";
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/src/auth";
import { Bouton } from "@/src/components/Bouton";
import { Logo } from "@/src/components/Logo";
import { colors, fonts, radius, softShadow, spacing } from "@/src/theme";

export default function Compte() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, deconnexion } = useAuth();

  return (
    <View testID="ecran-compte" style={styles.ecran}>
      <ScrollView contentContainerStyle={[styles.contenu, { paddingTop: insets.top + spacing.lg }]}>
        <Logo taille={24} />

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

        <View style={styles.carteInfo}>
          <View style={styles.ligneInfo}>
            <Feather name="dollar-sign" size={18} color={colors.brandPrimary} />
            <Text style={styles.infoTexte}>Paiement en espèces à la livraison</Text>
          </View>
          <View style={styles.ligneInfo}>
            <Feather name="map-pin" size={18} color={colors.brandPrimary} />
            <Text style={styles.infoTexte}>Zones : Gombe, Limete, Ngaliema, Lingwala</Text>
          </View>
          <View style={styles.ligneInfo}>
            <Feather name="clock" size={18} color={colors.brandPrimary} />
            <Text style={styles.infoTexte}>Livraison en 25 à 45 minutes</Text>
          </View>
        </View>

        <Bouton
          testID="btn-mes-commandes"
          label="Mes commandes"
          variant="secondaire"
          icone="shopping-bag"
          onPress={() => router.push("/commandes")}
        />
        <Bouton
          testID="btn-deconnexion"
          label="Se déconnecter"
          variant="danger"
          icone="log-out"
          onPress={async () => {
            await deconnexion();
            router.replace("/bienvenue");
          }}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: colors.surfaceSecondary },
  contenu: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: spacing.lg },
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
});
