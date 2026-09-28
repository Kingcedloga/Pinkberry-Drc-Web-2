import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { Icone } from "@/src/components/Icone";
import { colors, fonts, radius, spacing, stylesDynamiques } from "@/src/theme";

export function SelectionBar({
  selectedCount,
  onClear,
  onDelete,
  deleteLabel,
  allSelected,
  onToggleAll,
  totalCount,
}: {
  selectedCount: number;
  onClear: () => void;
  onDelete: () => void;
  deleteLabel?: string;
  allSelected?: boolean;
  onToggleAll?: () => void;
  totalCount?: number;
}) {
  if (selectedCount === 0) return null;

  return (
    <View style={styles.barre}>
      <Pressable onPress={onClear} style={styles.clearButton}>
        <Text style={styles.clearText}>Annuler</Text>
      </Pressable>

      <Pressable onPress={onToggleAll} style={styles.selectAll}>
        <Text style={styles.selectAllText}>{allSelected ? "Tout désélectionner" : "Tout sélectionner"}</Text>
      </Pressable>

      <View style={styles.compteurWrap}>
        <Text style={styles.compteur}>{selectedCount} sélectionné{selectedCount > 1 ? "s" : ""}</Text>
        {typeof totalCount === "number" ? <Text style={styles.total}>{totalCount} au total</Text> : null}
      </View>

      <Pressable onPress={onDelete} style={styles.deleteButton}>
        <Text style={styles.deleteText}>{deleteLabel ?? "Supprimer"}</Text>
      </Pressable>
    </View>
  );
}

export function BulkDeleteDialog({
  visible,
  count,
  onCancel,
  onConfirm,
  title,
  confirmLabel,
}: {
  visible: boolean;
  count: number;
  onCancel: () => void;
  onConfirm: () => void;
  title?: string;
  confirmLabel?: string;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.voile}>
        <View style={styles.boite}>
          <Icone name="alert-circle" size={30} color={colors.error} />
          <Text style={styles.boiteTitre}>{title ?? `Supprimer ${count} élément${count > 1 ? "s" : ""} ?`}</Text>
          <Text style={styles.boiteTexte}>Action définitive. Cette opération respecte les règles métier déjà appliquées.</Text>
          <Pressable onPress={onConfirm} style={styles.confirmButton}>
            <Text style={styles.confirmText}>{confirmLabel ?? `Supprimer ${count} élément${count > 1 ? "s" : ""}`}</Text>
          </Pressable>
          <Pressable onPress={onCancel} style={styles.cancelButton}>
            <Text style={styles.cancelText}>Annuler</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export function ToggleSelection({
  checked,
  onToggle,
  testID,
}: {
  checked: boolean;
  onToggle: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onToggle}
      style={[styles.checkBox, checked && styles.checkBoxSelected]}
      hitSlop={8}
    >
      {checked ? <Icone name="check" size={14} color={colors.onBrandPrimary} /> : null}
    </Pressable>
  );
}

const styles = stylesDynamiques(() => StyleSheet.create({
  barre: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    ...({ elevation: 6, shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } }),
  },
  clearButton: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  clearText: { fontFamily: fonts.text, fontSize: 13, color: colors.muted, fontWeight: "700" },
  selectAll: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  selectAllText: { fontFamily: fonts.text, fontSize: 12, color: colors.brandPrimary, fontWeight: "700" },
  compteurWrap: { flex: 1 },
  compteur: { fontFamily: fonts.display, fontSize: 15, color: colors.onSurface, fontWeight: "700" },
  total: { fontFamily: fonts.text, fontSize: 10, color: colors.muted },
  deleteButton: {
    backgroundColor: colors.errorSoft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  deleteText: { color: colors.error, fontFamily: fonts.text, fontSize: 13, fontWeight: "800" },
  checkBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  checkBoxSelected: {
    backgroundColor: colors.brandPrimary,
    borderColor: colors.brandPrimary,
  },
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
  confirmButton: {
    width: "100%",
    backgroundColor: colors.errorSoft,
    borderRadius: radius.pill,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmText: { fontFamily: fonts.text, fontSize: 15, fontWeight: "800", color: colors.error },
  cancelButton: { width: "100%", borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, minHeight: 52, alignItems: "center", justifyContent: "center" },
  cancelText: { fontFamily: fonts.text, fontSize: 15, color: colors.onSurface, fontWeight: "700" },
}));
