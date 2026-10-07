import React from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { KeyboardTypeOptions } from "react-native";

import { Icone } from "@/src/components/Icone";
import { colors, fonts, radius, spacing, stylesDynamiques } from "@/src/theme";
import { useT } from "@/src/i18n";

export function Champ({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  secureTextEntry,
  testID,
  multiline,
  autoCapitalize = "sentences",
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  secureTextEntry?: boolean;
  testID?: string;
  multiline?: boolean;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
}) {
  const t = useT();
  const [visible, setVisible] = React.useState(false);
  const masquable = !!secureTextEntry;

  return (
    <View style={styles.bloc}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.champ}>
        <TextInput
          testID={testID}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.muted}
          keyboardType={keyboardType}
          secureTextEntry={masquable && !visible}
          multiline={multiline}
          autoCapitalize={autoCapitalize}
          style={[styles.input, multiline && styles.multi, masquable && styles.avecOeil]}
        />
        {masquable ? (
          <Pressable
            testID={testID ? `${testID}-oeil` : "btn-oeil"}
            accessibilityRole="button"
            accessibilityLabel={t(visible ? "auth.masquerMotDePasse" : "auth.afficherMotDePasse")}
            hitSlop={8}
            onPress={() => setVisible((v) => !v)}
            style={styles.oeil}
          >
            <Icone name={visible ? "eye-off" : "eye"} size={20} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = stylesDynamiques(() => StyleSheet.create({
  bloc: { gap: spacing.xs },
  label: { fontFamily: fonts.text, fontSize: 13, fontWeight: "700", color: colors.muted },
  champ: { position: "relative", justifyContent: "center" },
  input: {
    minHeight: 52,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    fontFamily: fonts.text,
    fontSize: 15,
    color: colors.onSurface,
  },
  avecOeil: { paddingRight: 52 },
  multi: { minHeight: 84, paddingTop: spacing.md, textAlignVertical: "top" },
  oeil: {
    position: "absolute",
    right: 4,
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
}));
