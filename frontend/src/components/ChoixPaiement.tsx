import { Image } from "expo-image";
import React from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Icone } from "@/src/components/Icone";
import { colors, fonts, poids, radius, spacing, stylesDynamiques } from "@/src/theme";

export type ModePaiement = "cash" | "mobile";
export type Operateur = "mpesa" | "airtel" | "orange";
export type Devise = "USD" | "CDF";

const OPERATEURS: { cle: Operateur; nom: string; logo: number }[] = [
  { cle: "mpesa", nom: "M-Pesa (Vodacom)", logo: require("@/assets/images/mpesa.png") },
  { cle: "airtel", nom: "Airtel Money", logo: require("@/assets/images/airtel.png") },
  { cle: "orange", nom: "Orange Money", logo: require("@/assets/images/orange.png") },
];

/** Choix du mode de paiement au checkout. */
export function ChoixPaiement({
  mode,
  setMode,
  operateur,
  setOperateur,
  telephone,
  setTelephone,
  devise,
  setDevise,
  equivalent,
}: {
  mode: ModePaiement;
  setMode: (m: ModePaiement) => void;
  operateur: Operateur;
  setOperateur: (o: Operateur) => void;
  telephone: string;
  setTelephone: (t: string) => void;
  devise: Devise;
  setDevise: (d: Devise) => void;
  equivalent: string;
}) {
  return (
    <View testID="bloc-choix-paiement" style={styles.carte}>
      <View style={styles.titreRow}>
        <Icone name="credit-card" size={16} color={colors.brandPrimary} />
        <Text style={styles.titre}>Mode de paiement</Text>
      </View>

      <View style={styles.modes}>
        <Pressable
          testID="mode-paiement-cash"
          onPress={() => setMode("cash")}
          style={[styles.mode, mode === "cash" && styles.modeActif]}
        >
          <Icone name="dollar-sign" size={18} color={mode === "cash" ? colors.onBrandPrimary : colors.onSurface} />
          <Text style={[styles.modeTexte, mode === "cash" && styles.modeTexteActif]}>À la livraison</Text>
        </Pressable>
        <Pressable
          testID="mode-paiement-mobile"
          onPress={() => setMode("mobile")}
          style={[styles.mode, mode === "mobile" && styles.modeActif]}
        >
          <Icone name="smartphone" size={18} color={mode === "mobile" ? colors.onBrandPrimary : colors.onSurface} />
          <Text style={[styles.modeTexte, mode === "mobile" && styles.modeTexteActif]}>Mobile Money</Text>
        </Pressable>
      </View>

      {mode === "mobile" ? (
        <View style={styles.bloc}>
          <Text style={styles.label}>Opérateur</Text>
          <View style={styles.puces}>
            {OPERATEURS.map((o) => (
              <Pressable
                key={o.cle}
                testID={`operateur-${o.cle}`}
                accessibilityLabel={o.nom}
                onPress={() => setOperateur(o.cle)}
                style={[styles.tuile, operateur === o.cle && styles.tuileActive]}
              >
                <Image source={o.logo} style={styles.logo} contentFit="contain" />
                {operateur === o.cle ? (
                  <View style={styles.coche}>
                    <Icone name="check" size={11} color={colors.onBrandPrimary} />
                  </View>
                ) : null}
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Numéro à débiter</Text>
          <TextInput
            testID="input-telephone-paiement"
            value={telephone}
            onChangeText={setTelephone}
            keyboardType="phone-pad"
            placeholder="0812345678"
            placeholderTextColor={colors.muted}
            style={styles.saisie}
          />

          <Text style={styles.label}>Devise à débiter</Text>
          <View style={styles.puces}>
            {(["USD", "CDF"] as Devise[]).map((d) => (
              <Pressable
                key={d}
                testID={`devise-${d}`}
                onPress={() => setDevise(d)}
                style={[styles.puce, devise === d && styles.puceActive]}
              >
                <Text style={[styles.puceTexte, devise === d && styles.puceTexteActive]}>{d}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.equivalent}>{equivalent}</Text>
        </View>
      ) : (
        <Text style={styles.equivalent}>Vous réglerez en espèces au livreur à la remise de la commande.</Text>
      )}
    </View>
  );
}

const styles = stylesDynamiques(() => StyleSheet.create({
  carte: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, gap: spacing.md },
  titreRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  titre: { fontFamily: fonts.display, fontSize: 16, fontWeight: poids.fort, color: colors.onSurface },
  modes: { flexDirection: "row", gap: spacing.sm },
  mode: {
    flex: 1,
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
  },
  modeActif: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  modeTexte: { fontFamily: fonts.text, fontSize: 13, fontWeight: poids.fort, color: colors.onSurface },
  modeTexteActif: { color: colors.onBrandPrimary },
  bloc: { gap: spacing.xs },
  label: { fontFamily: fonts.text, fontSize: 12, fontWeight: poids.fort, color: colors.muted, marginTop: spacing.xs },
  puces: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
  puce: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
  },
  puceActive: { backgroundColor: colors.brandTertiary, borderColor: colors.brandPrimary },
  tuile: {
    width: 100,
    height: 64,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
  },
  tuileActive: { borderColor: colors.brandPrimary },
  logo: { width: 84, height: 46 },
  coche: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brandPrimary,
  },
  puceTexte: { fontFamily: fonts.text, fontSize: 13, fontWeight: poids.fort, color: colors.onSurface },
  puceTexteActive: { color: colors.brandPrimary },
  saisie: {
    minHeight: 48,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    fontFamily: fonts.text,
    fontSize: 15,
    color: colors.onSurface,
  },
  equivalent: { fontFamily: fonts.text, fontSize: 12, color: colors.muted },
}));
