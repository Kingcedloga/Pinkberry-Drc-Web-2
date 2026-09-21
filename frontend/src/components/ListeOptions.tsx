import React from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Icone } from "@/src/components/Icone";
import { colors, fonts, poids, radius, spacing, stylesDynamiques } from "@/src/theme";

export type Option = { nom: string; valeur: string };

/**
 * Liste éditable d'options de produit (tailles ou garnitures) : ajout, modification
 * du nom et du montant, suppression ligne par ligne.
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
        <Text style={styles.vide}>Aucune option — le client commandera le produit tel quel.</Text>
      ) : (
        options.map((o, i) => (
          <View key={`${cle}-${i}`} style={styles.ligne}>
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
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brandPrimary,
  },
  aide: { fontFamily: fonts.text, fontSize: 11, color: colors.muted, marginBottom: spacing.xs },
  vide: { fontFamily: fonts.text, fontSize: 12, color: colors.muted },
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
  supprimer: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
}));
