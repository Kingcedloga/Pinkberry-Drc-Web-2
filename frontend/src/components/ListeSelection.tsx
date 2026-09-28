import React, { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { Icone } from "@/src/components/Icone";
import { colors, fonts, radius, spacing, stylesDynamiques } from "@/src/theme";

export function SelectionBar({
  selectedCount,
  onClear,
  onDelete,
  deleteLabel,
  bottomOffset,
}: {
  selectedCount: number;
  onClear: () => void;
  onDelete: () => void;
  deleteLabel?: string;
  bottomOffset?: number;
}) {
  if (selectedCount === 0) return null;

  return (
    <View style={[styles.barre, { bottom: bottomOffset ?? spacing.lg }]}>
      <Pressable onPress={onClear} style={styles.clearButton}>
        <Text style={styles.clearText}>Annuler</Text>
      </Pressable>

      <View style={styles.compteurWrap}>
        <Text style={styles.compteur}>{selectedCount} sélectionné{selectedCount > 1 ? "s" : ""}</Text>
      </View>

      <Pressable onPress={onDelete} style={styles.deleteButton}>
        <Text style={styles.deleteText}>{deleteLabel ?? "Supprimer"}</Text>
      </Pressable>
    </View>
  );
}

export function SelectionHeader({
  checked,
  onToggle,
  count,
}: {
  checked: boolean;
  onToggle: () => void;
  count: number;
}) {
  return (
    <View style={styles.selectionHeader}>
      <ToggleSelection checked={checked} onToggle={onToggle} />
      <Pressable onPress={onToggle} accessibilityRole="button">
        <Text style={styles.selectAllText}>Tout sélectionner ({count})</Text>
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
  description,
}: {
  visible: boolean;
  count: number;
  onCancel: () => void;
  onConfirm: () => void;
  title?: string;
  confirmLabel?: string;
  description?: string;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.voile}>
        <View style={styles.boite}>
          <Icone name="alert-circle" size={30} color={colors.error} />
          <Text style={styles.boiteTitre}>{title ?? `Supprimer ${count} élément${count > 1 ? "s" : ""} ?`}</Text>
          <Text style={styles.boiteTexte}>{description ?? "Action définitive. Cette opération respecte les règles métier déjà appliquées."}</Text>
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
      onPress={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      style={[styles.checkBox, checked && styles.checkBoxSelected]}
      hitSlop={8}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={checked ? "Désélectionner" : "Sélectionner"}
    >
      {checked ? <Icone name="check" size={14} color={colors.onBrandPrimary} /> : null}
    </Pressable>
  );
}

export function useListeSelection(ids: string[]) {
  const [selection, setSelection] = useState<Set<string>>(() => new Set());
  const selectedIds = ids.filter((id) => selection.has(id));
  const allSelected = ids.length > 0 && selectedIds.length === ids.length;

  const toggle = (id: string) => {
    setSelection((courante) => {
      const suivante = new Set(courante);
      if (suivante.has(id)) suivante.delete(id);
      else suivante.add(id);
      return suivante;
    });
  };

  const toggleAll = () => {
    setSelection((courante) => {
      if (ids.length > 0 && ids.every((id) => courante.has(id))) return new Set();
      return new Set(ids);
    });
  };

  const clear = () => setSelection(new Set());

  return { selectedIds, allSelected, toggle, toggleAll, clear };
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
  selectionHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm, minHeight: 40, alignSelf: "flex-start" },
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
