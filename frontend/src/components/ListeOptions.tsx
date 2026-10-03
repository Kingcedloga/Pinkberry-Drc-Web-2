import React from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Icone } from "@/src/components/Icone";
import { useT } from "@/src/i18n";
import { colors, fonts, poids, radius, spacing, stylesDynamiques } from "@/src/theme";

export type Option = { nom: string; valeur: string; nomEn?: string };

/**
 * Liste éditable d'options de produit (tailles ou garnitures) : ajout, modification
 * du nom (français et anglais) et du montant, suppression ligne par ligne.
 */
export function ListeOptions({
  titre,
  aide,
  cle,
  options,
  onChange,
  placeholderNom,
}: {
  titre: string;
  aide: string;
  cle: string;
  options: Option[];
  onChange: (o: Option[]) => void;
  placeholderNom: string;
}) {
  const t = useT();
  const modifier = (index: number, champ: keyof Option, valeur: string) =>
    onChange(options.map((o, i) => (i === index ? { ...o, [champ]: valeur } : o)));

  return (
    <View testID={`bloc-${cle}s`} style={styles.bloc}>
      <View style={styles.entete}>
        <Text style={styles.titre}>{titre}</Text>
        <Pressable testID={`btn-ajouter-${cle}`} onPress={() => onChange([...options, { nom: "", valeur: "0" }])} style={styles.ajouter}>
          <Icone name="plus" size={16} color={colors.onBrandPrimary} />
        </Pressable>
      </View>
      <Text style={styles.aide}>{aide}</Text>

      {options.length === 0 ? (
        <Text style={styles.vide}>{t("catalogue.aucuneOption")}</Text>
      ) : (
        options.map((o, i) => (
          <View key={`${cle}-${i}`} style={styles.option}>
            <View style={styles.ligne}>
              <TextInput
                testID={`input-${cle}-nom-${i}`}
                value={o.nom}
                onChangeText={(v) => modifier(i, "nom", v)}
                placeholder={placeholderNom}
                placeholderTextColor={colors.muted}
                style={[styles.saisie, styles.saisieNom]}
              />
              <TextInput
                testID={`input-${cle}-valeur-${i}`}
                value={o.valeur}
                onChangeText={(v) => modifier(i, "valeur", v)}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={colors.muted}
                style={[styles.saisie, styles.saisieMontant]}
              />
              <Pressable
                testID={`btn-supprimer-${cle}-${i}`}
                onPress={() => onChange(options.filter((_, j) => j !== i))}
                style={styles.supprimer}
                hitSlop={8}
              >
                <Icone name="trash-2" size={17} color={colors.error} />
              </Pressable>
            </View>
            <TextInput
              testID={`input-${cle}-nom-en-${i}`}
              value={o.nomEn ?? ""}
              onChangeText={(v) => modifier(i, "nomEn", v)}
              placeholder={t("catalogue.enAnglais")}
              placeholderTextColor={colors.muted}
              style={[styles.saisie, styles.saisieAnglais]}
            />
          </View>
        ))
      )}
    </View>
  );
}

const styles = stylesDynamiques(() => StyleSheet.create({
  bloc: {
    gap: spacing.xs,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  entete: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  titre: { fontFamily: fonts.display, fontSize: 15, fontWeight: poids.fort, color: colors.onSurface },
  ajouter: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brandPrimary,
  },
  aide: { fontFamily: fonts.text, fontSize: 11, color: colors.muted, marginBottom: spacing.xs },
  vide: { fontFamily: fonts.text, fontSize: 12, color: colors.muted },
  option: { gap: spacing.xs },
  ligne: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  saisie: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    minHeight: 44,
    fontFamily: fonts.text,
    fontSize: 14,
    color: colors.onSurface,
  },
  saisieNom: { flex: 1 },
  saisieMontant: { width: 86, textAlign: "right" },
  // Sous le nom français, aligné sur lui (montant + corbeille à droite).
  saisieAnglais: { minHeight: 38, fontSize: 13, marginRight: 86 + 40 + spacing.sm * 2 },
  supprimer: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
}));
