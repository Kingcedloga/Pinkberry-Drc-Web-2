import { useRouter } from "expo-router";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icone } from "@/src/components/Icone";
import { useLangue } from "@/src/i18n";
import { documentLegal } from "@/src/legal";
import { colors, fonts, poids, radius, spacing, stylesDynamiques } from "@/src/theme";
import { useTheme } from "@/src/theme-contexte";

/** Page légale (confidentialité / conditions) : lisible, clair et sombre, FR ou EN. */
export function PageLegale({ type }: { type: "confidentialite" | "conditions" }) {
  useTheme();
  const { langue } = useLangue();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const doc = documentLegal(type, langue);

  return (
    <View testID={`ecran-${type}`} style={styles.ecran}>
      <View style={[styles.entete, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="btn-retour-legal" onPress={() => router.back()} style={styles.retour} hitSlop={10}>
          <Icone name="arrow-left" size={20} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.enteteTitre} numberOfLines={1}>
          {doc.titre}
        </Text>
      </View>

      <ScrollView contentContainerStyle={[styles.contenu, { paddingBottom: insets.bottom + spacing.xxl }]}>
        <View style={styles.carte}>
          <Text style={styles.maj}>{doc.maj}</Text>
          <Text style={styles.intro}>{doc.intro}</Text>
        </View>

        {doc.sections.map((s) => (
          <View key={s.titre} style={styles.carte}>
            <Text style={styles.titreSection}>{s.titre}</Text>
            {s.paragraphes.map((p, i) => (
              <Text key={i} style={styles.paragraphe}>
                {p}
              </Text>
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = stylesDynamiques(() => StyleSheet.create({
  ecran: { flex: 1, backgroundColor: colors.surfaceSecondary },
  entete: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
  },
  retour: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceSecondary,
  },
  enteteTitre: { flex: 1, fontFamily: fonts.display, fontSize: 18, fontWeight: poids.fort, color: colors.onSurface },
  contenu: { padding: spacing.md, gap: spacing.md },
  carte: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, gap: spacing.sm },
  maj: { fontFamily: fonts.text, fontSize: 12, fontWeight: poids.fort, color: colors.brandPrimary },
  intro: { fontFamily: fonts.text, fontSize: 14, lineHeight: 21, color: colors.onSurface },
  titreSection: { fontFamily: fonts.display, fontSize: 16, fontWeight: poids.fort, color: colors.onSurface },
  paragraphe: { fontFamily: fonts.text, fontSize: 14, lineHeight: 22, color: colors.onSurface },
}));
