import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icone } from "@/src/components/Icone";
import { toastCentre } from "@/src/plateforme/styles";
import { colors, fonts, radius, softShadow, spacing, stylesDynamiques } from "@/src/theme";

type Type = "succes" | "erreur" | "info";
type Notification = { id: number; message: string; type: Type; titre?: string };
type ToastValue = { show: (message: string, type?: Type, titre?: string) => void };

const DUREE = 3500;
const MAX_VISIBLES = 3;

const ToastContext = createContext<ToastValue | null>(null);

let compteur = 0;

function Pastille({ notif, onFini }: { notif: Notification; onFini: (id: number) => void }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(anim, { toValue: 1, useNativeDriver: true, damping: 16, stiffness: 180 }).start();
    const t = setTimeout(() => {
      Animated.timing(anim, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => onFini(notif.id));
    }, DUREE);
    return () => clearTimeout(t);
  }, [anim, notif.id, onFini]);

  const fond = notif.type === "succes" ? colors.success : notif.type === "erreur" ? colors.error : colors.surfaceInverse;
  const icone = notif.type === "erreur" ? "alert-circle" : notif.type === "succes" ? "check-circle" : "info";

  return (
    <Animated.View
      testID="toast-message"
      style={[
        styles.toast,
        {
          backgroundColor: fond,
          opacity: anim,
          transform: [
            { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] }) },
            { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) },
          ],
        },
      ]}
    >
      <Icone name={icone} size={18} color={colors.onBrandPrimary} />
      <View style={styles.bloc}>
        {notif.titre ? <Text style={styles.titre}>{notif.titre}</Text> : null}
        <Text style={styles.texte}>{notif.message}</Text>
      </View>
    </Animated.View>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const insets = useSafeAreaInsets();

  const retirer = useCallback((id: number) => {
    setNotifs((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const show = useCallback((message: string, type: Type = "info", titre?: string) => {
    compteur += 1;
    const notif = { id: compteur, message, type, titre };
    setNotifs((prev) => [...prev, notif].slice(-MAX_VISIBLES));
  }, []);

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <View
        testID="zone-notifications"
        pointerEvents="none"
        style={[styles.zone, { top: insets.top + spacing.sm }]}
      >
        {notifs.map((n) => (
          <Pastille key={n.id} notif={n} onFini={retirer} />
        ))}
      </View>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast doit être utilisé dans ToastProvider");
  return ctx;
}

const styles = stylesDynamiques(() => StyleSheet.create({
  zone: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    alignItems: "center",
    gap: spacing.sm,
    ...toastCentre,
  },
  toast: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    ...softShadow,
  },
  bloc: { flex: 1, gap: 1 },
  titre: { color: colors.onBrandPrimary, fontFamily: fonts.display, fontSize: 14 },
  texte: { color: colors.onBrandPrimary, fontFamily: fonts.text, fontSize: 13, fontWeight: "700" },
}));
