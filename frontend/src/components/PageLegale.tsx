import { useRouter } from "expo-router";
import React from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CONTACT_LEGAL, CONFIDENTIALITE, CONDITIONS, MAJ_LEGALE } from "@/src/legal";
import { Icone } from "@/src/components/Icone";
import { useLangue } from "@/src/i18n";
import { LARGEUR_CONTENU } from "@/src/reactif";
import { colors, fonts, poids, radius, spacing, stylesDynamiques } from "@/src/theme";
import { useTheme } from "@/src/theme-contexte";

type DocumentLegal = "confidentialite" | "conditions";

export function PageLegale({ document }: { document: DocumentLegal }) {
  useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { langue } = useLangue();
  const page = document === "confidentialite" ? CONFIDENTIALITE[langue] : CONDITIONS[langue];

  return (
    <View testID={`page-legale-${document}`} style={styles.ecran}>
      <View style={[styles.entete, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="btn-retour-legal" onPress={() => router.back()} style={styles.retour}>
          <Icone name="arrow-left" size={20} color={colors.brandPrimary} />
        </Pressable>
        <Text style={styles.marque}>Pinkberry</Text>
      </View>
      <ScrollView contentContainerStyle={[styles.contenu, { paddingBottom: insets.bottom + spacing.xxxl }]}>
        <Text style={styles.titre}>{page.titre}</Text>
        <Text style={styles.sousTitre}>{page.sousTitre}</Text>
        <Text style={styles.date}>{page.majLabel} : {MAJ_LEGALE[langue]}</Text>
        {page.sections.map((section) => (
          <View key={section.titre} style={styles.section}>
            <Text style={styles.sectionTitre}>{section.titre}</Text>
            {section.paragraphes.map((paragraphe) => (
              <Text key={paragraphe} style={styles.paragraphe}>{paragraphe}</Text>
            ))}
          </View>
        ))}
        <Pressable onPress={() => Linking.openURL(`mailto:${CONTACT_LEGAL}`)} style={styles.contact}>
          <Icone name="mail" size={18} color={colors.brandPrimary} />
          <Text style={styles.contactTexte}>{CONTACT_LEGAL}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = stylesDynamiques(() => StyleSheet.create({
  ecran: { flex: 1, backgroundColor: colors.surfaceSecondary },
  entete: { ...LARGEUR_CONTENU, width: "100%", flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.md },
  retour: { width: 44, height: 44, borderRadius: radius.pill, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  marque: { fontFamily: fonts.display, fontSize: 22, fontWeight: poids.fort, color: colors.brandPrimary },
  contenu: { ...LARGEUR_CONTENU, paddingHorizontal: spacing.lg, gap: spacing.lg },
  titre: { fontFamily: fonts.display, fontSize: 30, lineHeight: 36, fontWeight: poids.fort, color: colors.onSurface },
  sousTitre: { fontFamily: fonts.text, fontSize: 14, lineHeight: 21, fontWeight: poids.titre, color: colors.muted },
  date: { fontFamily: fonts.text, fontSize: 13, lineHeight: 20, fontWeight: poids.corps, color: colors.muted },
  section: { gap: spacing.sm },
  sectionTitre: { fontFamily: fonts.display, fontSize: 21, lineHeight: 27, fontWeight: poids.titre, color: colors.brandPrimary },
  paragraphe: { fontFamily: fonts.text, fontSize: 15, lineHeight: 24, fontWeight: poids.corps, color: colors.onSurface },
  contact: { flexDirection: "row", alignItems: "center", gap: spacing.sm, alignSelf: "flex-start", paddingVertical: spacing.sm },
  contactTexte: { fontFamily: fonts.text, fontSize: 15, fontWeight: poids.fort, color: colors.brandPrimary },
}));
