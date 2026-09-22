import { useRouter } from "expo-router";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Icone } from "@/src/components/Icone";
import { Logo } from "@/src/components/Logo";
import { colors, fonts, radius, spacing, stylesDynamiques } from "@/src/theme";

type LienSecondaire = { libelle: string; icone: string; href: string };

/**
 * Navigation latérale (back office web, ≥ 1024 px). Remplace la barre
 * d'onglets mobile lorsque `tabBarPosition: "left"` est actif.
 */
export function BarreLaterale({
  state,
  descriptors,
  navigation,
  routesMasquees = [],
  sousTitre,
  liens = [],
}: any & { routesMasquees?: string[]; sousTitre?: string; liens?: LienSecondaire[] }) {
  const router = useRouter();
  const routes = state.routes.filter((r: any) => !routesMasquees.includes(r.name));

  return (
    <View testID="barre-laterale" style={styles.barre}>
      <View style={styles.marque}>
        <Logo taille={19} />
        {sousTitre ? <Text style={styles.sousTitre}>{sousTitre}</Text> : null}
      </View>

      <ScrollView contentContainerStyle={styles.liens} showsVerticalScrollIndicator={false}>
        {routes.map((route: any) => {
          const options = descriptors[route.key]?.options ?? {};
          const actif = state.routes[state.index]?.key === route.key;
          const couleur = actif ? colors.onBrandPrimary : colors.onSurface;
          return (
            <Pressable
              key={route.key}
              testID={`lien-lateral-${route.name}`}
              onPress={() => navigation.navigate(route.name)}
              style={({ pressed }) => [
                styles.lien,
                actif && styles.lienActif,
                !actif && pressed && { backgroundColor: colors.brandTertiary },
              ]}
            >
              {options.tabBarIcon ? options.tabBarIcon({ focused: actif, color: couleur, size: 20 }) : null}
              <Text style={[styles.lienTexte, { color: couleur }]}>{options.title ?? route.name}</Text>
            </Pressable>
          );
        })}

        {liens.length > 0 ? <View style={styles.separateur} /> : null}
        {liens.map((l: LienSecondaire) => (
          <Pressable
            key={l.href}
            testID={`lien-lateral-${l.libelle}`}
            onPress={() => router.push(l.href as any)}
            style={({ pressed }) => [styles.lien, pressed && { backgroundColor: colors.brandTertiary }]}
          >
            <Icone name={l.icone} size={20} color={colors.muted} />
            <Text style={[styles.lienTexte, { color: colors.muted }]}>{l.libelle}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = stylesDynamiques(() =>
  StyleSheet.create({
    barre: {
      width: 252,
      backgroundColor: colors.surface,
      borderRightWidth: 1,
      borderRightColor: colors.border,
      paddingVertical: spacing.xl,
    },
    marque: { paddingHorizontal: spacing.lg, gap: 2, marginBottom: spacing.xl },
    sousTitre: { fontFamily: fonts.text, fontSize: 11, color: colors.muted },
    liens: { paddingHorizontal: spacing.md, gap: spacing.xs, paddingBottom: spacing.xl },
    lien: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      minHeight: 48,
      paddingHorizontal: spacing.md,
      borderRadius: radius.md,
    },
    lienActif: { backgroundColor: colors.brandPrimary },
    lienTexte: { fontFamily: fonts.text, fontSize: 14, fontWeight: "700" },
    separateur: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: spacing.md,
      marginHorizontal: spacing.md,
    },
  }),
);
