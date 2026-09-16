import { Icone } from "@/src/components/Icone";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { useT, type CleTexte } from "@/src/i18n";
import { colors, fonts, spacing, stylesDynamiques } from "@/src/theme";

export const ETAPES = [
  { cle: "recue", icone: "check" },
  { cle: "en_preparation", icone: "coffee" },
  { cle: "en_route", icone: "navigation" },
  { cle: "livree", icone: "gift" },
];

export function indexEtape(statut: string) {
  if (statut === "recue") return 0;
  if (statut === "en_preparation" || statut === "recuperee") return 1;
  if (statut === "en_route") return 2;
  if (statut === "livree") return 3;
  return -1;
}

export function Etapes({ statut }: { statut: string }) {
  const t = useT();
  const actuel = indexEtape(statut);
  return (
    <View testID="fil-etapes" style={styles.wrap}>
      {ETAPES.map((e, i) => {
        const fait = i <= actuel;
        const encours = i === actuel;
        return (
          <View key={e.cle} style={styles.ligne}>
            <View style={styles.colonne}>
              <View
                testID={`etape-${e.cle}`}
                style={[styles.rond, { backgroundColor: fait ? colors.success : colors.surfaceTertiary }]}
              >
                <Icone
                  name={e.icone as any}
                  size={15}
                  color={fait ? colors.onSuccess : colors.brandPrimary}
                />
              </View>
              {i < ETAPES.length - 1 ? (
                <View style={[styles.trait, { backgroundColor: i < actuel ? colors.success : colors.border }]} />
              ) : null}
            </View>
            <View style={styles.texteBloc}>
              <Text style={[styles.label, { color: fait ? colors.onSurface : colors.muted }]}>
                {t(`etape.${e.cle}` as CleTexte)}
              </Text>
              {encours ? <Text style={styles.encours}>En cours…</Text> : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = stylesDynamiques(() => StyleSheet.create({
  wrap: { gap: 0 },
  ligne: { flexDirection: "row", gap: spacing.md },
  colonne: { alignItems: "center", width: 30 },
  rond: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  trait: { width: 2, flex: 1, minHeight: 22 },
  texteBloc: { flex: 1, paddingBottom: spacing.lg },
  label: { fontFamily: fonts.text, fontSize: 15, fontWeight: "700", marginTop: 5 },
  encours: { fontFamily: fonts.text, fontSize: 12, color: colors.success, fontWeight: "700" },
}));
