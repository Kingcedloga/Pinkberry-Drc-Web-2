import { Image } from "expo-image";
import React from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Icone } from "@/src/components/Icone";
import { colors, fonts, poids, radius, spacing, stylesDynamiques } from "@/src/theme";
import { useT, type CleTexte } from "@/src/i18n";

export type ModePaiement = "cash" | "mobile" | "carte";
export type Devise = "USD" | "CDF";
/** Modes en ligne actifs côté serveur (Flexpaie configuré). */
export type ModesEnLigne = { mobile: boolean; carte: boolean };

/** Opérateurs acceptés, à titre indicatif : Flexpaie reconnaît l'opérateur au numéro. */
const OPERATEURS: { nom: string; logo: number }[] = [
  { nom: "M-Pesa (Vodacom)", logo: require("@/assets/images/mpesa.png") },
  { nom: "Airtel Money", logo: require("@/assets/images/airtel.png") },
  { nom: "Orange Money", logo: require("@/assets/images/orange.png") },
];

const MODES: { cle: ModePaiement; icone: string; libelle: CleTexte }[] = [
  { cle: "cash", icone: "receipt", libelle: "paiement.aLaLivraison" },
  { cle: "mobile", icone: "smartphone", libelle: "paiement.mobileMoney" },
  { cle: "carte", icone: "credit-card", libelle: "paiement.carte" },
];

/** Numéro accepté par le serveur : 9 chiffres, précédés de 0 ou 243 au besoin. */
export function numeroMobileValide(tel: string): boolean {
  return /^(00243|243|0)?\d{9}$/.test(tel.replace(/[\s+\-.()]/g, ""));
}

/** Choix du mode de paiement au checkout. Les noms d'opérateurs sont des marques (non traduits). */
export function ChoixPaiement({
  mode,
  setMode,
  modes,
  telephone,
  setTelephone,
  devise,
  setDevise,
  equivalent,
}: {
  mode: ModePaiement;
  setMode: (m: ModePaiement) => void;
  modes: ModesEnLigne;
  telephone: string;
  setTelephone: (t: string) => void;
  devise: Devise;
  setDevise: (d: Devise) => void;
  equivalent: string;
}) {
  const t = useT();
  const proposes = MODES.filter((m) => m.cle === "cash" || modes[m.cle]);

  const choixDevise = (
    <>
      <Text style={styles.label}>{t("paiement.devise")}</Text>
      <View style={styles.puces}>
        {(["CDF", "USD"] as Devise[]).map((d) => (
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
    </>
  );

  return (
    <View testID="bloc-choix-paiement" style={styles.carte}>
      <View style={styles.titreRow}>
        <Icone name="credit-card" size={16} color={colors.brandPrimary} />
        <Text style={styles.titre}>{t("paiement.mode")}</Text>
      </View>

      <View style={styles.modes}>
        {proposes.map((m) => (
          <Pressable
            key={m.cle}
            testID={`mode-paiement-${m.cle}`}
            accessibilityRole="radio"
            accessibilityState={{ selected: mode === m.cle }}
            onPress={() => setMode(m.cle)}
            style={[styles.mode, mode === m.cle && styles.modeActif]}
          >
            <Icone name={m.icone} size={20} color={mode === m.cle ? colors.onBrandPrimary : colors.onSurface} />
            <Text style={[styles.modeTexte, mode === m.cle && styles.modeTexteActif]}>{t(m.libelle)}</Text>
          </Pressable>
        ))}
      </View>

      {mode === "mobile" ? (
        <View style={styles.bloc}>
          <Text style={styles.label}>{t("paiement.operateursAcceptes")}</Text>
          <View style={styles.puces}>
            {OPERATEURS.map((o) => (
              <View key={o.nom} accessibilityLabel={o.nom} style={styles.tuile}>
                <Image source={o.logo} style={styles.logo} contentFit="contain" />
              </View>
            ))}
          </View>

          <Text style={styles.label}>{t("paiement.numero")}</Text>
          <TextInput
            testID="input-telephone-paiement"
            value={telephone}
            onChangeText={setTelephone}
            keyboardType="phone-pad"
            placeholder="0812345678"
            placeholderTextColor={colors.muted}
            style={styles.saisie}
          />
          {choixDevise}
        </View>
      ) : mode === "carte" ? (
        <View style={styles.bloc}>
          <View style={styles.infoCarte}>
            <Icone name="lock" size={16} color={colors.brandPrimary} />
            <Text style={styles.infoCarteTexte}>{t("paiement.carteInfo")}</Text>
          </View>
          {choixDevise}
        </View>
      ) : (
        <Text style={styles.equivalent}>{t("paiement.especes")}</Text>
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
    minHeight: 64,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
  },
  modeActif: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  modeTexte: { fontFamily: fonts.text, fontSize: 13, fontWeight: poids.fort, color: colors.onSurface, textAlign: "center" },
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
    width: 84,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
  },
  logo: { width: 70, height: 38 },
  infoCarte: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSecondary,
  },
  infoCarteTexte: { flex: 1, fontFamily: fonts.text, fontSize: 13, color: colors.onSurface },
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
