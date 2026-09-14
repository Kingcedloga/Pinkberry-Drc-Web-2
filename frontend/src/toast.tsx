import Feather from "@react-native-vector-icons/feather";
import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, fonts, radius, softShadow, spacing } from "@/src/theme";

type Type = "succes" | "erreur" | "info";
type ToastValue = { show: (message: string, type?: Type) => void };

const ToastContext = createContext<ToastValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<{ message: string; type: Type } | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();

  const show = useCallback(
    (message: string, type: Type = "info") => {
      setToast({ message, type });
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
      setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => setToast(null));
      }, 2600);
    },
    [opacity],
  );

  const value = useMemo(() => ({ show }), [show]);

  const fond =
    toast?.type === "succes" ? colors.success : toast?.type === "erreur" ? colors.error : colors.surfaceInverse;

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? (
        <Animated.View
          testID="toast-message"
          pointerEvents="none"
          style={[styles.wrap, { top: insets.top + spacing.sm, opacity }]}
        >
          <View style={[styles.toast, { backgroundColor: fond }]}>
            <Feather
              name={toast.type === "erreur" ? "alert-circle" : toast.type === "succes" ? "check-circle" : "info"}
              size={18}
              color={colors.onBrandPrimary}
            />
            <Text style={styles.texte}>{toast.message}</Text>
          </View>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast doit être utilisé dans ToastProvider");
  return ctx;
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: spacing.lg, right: spacing.lg, alignItems: "center" },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    maxWidth: "100%",
    ...softShadow,
  },
  texte: { color: colors.onBrandPrimary, fontFamily: fonts.text, fontSize: 14, flexShrink: 1 },
});
