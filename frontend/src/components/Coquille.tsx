import { useRouter, usePathname } from "expo-router";
import React from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/src/auth";
import { Icone } from "@/src/components/Icone";
import { Logo } from "@/src/components/Logo";
import { LienNav, lienActif } from "@/src/nav-web";
import { usePanier } from "@/src/panier";
import { useEcran } from "@/src/reactif";
import { useMontant } from "@/src/taux";
import { colors, fonts, radius, spacing, stylesDynamiques } from "@/src/theme";
import { useTheme } from "@/src/theme-contexte";

/** Bouton panier du header (client uniquement). */
function BoutonPanier() {
  const router = useRouter();
  const { nbArticles, sousTotal } = usePanier();
  const { usd } = useMontant();

  return (
    <Pressable
      testID="btn-entete-panier"
      onPress={() => router.push("/panier")}
      style={({ pressed }) => [styles.panierBtn, pressed && { opacity: 0.85 }]}
    >
      <Icone name="shopping-cart" size={18} color={colors.onBrandPrimary} />
      <Text style={styles.panierTexte}>{nbArticles > 0 ? usd(sousTotal) : "Panier"}</Text>
      {nbArticles > 0 ? (
        <View style={styles.panierBadge}>
          <Text style={styles.panierBadgeTexte}>{nbArticles}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function BoutonDeconnexion({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const { deconnexion } = useAuth();

  const sortir = async () => {
    await deconnexion();
    router.replace("/bienvenue");
  };

  if (compact) {
    return (
      <Pressable testID="btn-deconnexion" onPress={sortir} style={styles.iconeBtn}>
        <Icone name="log-out" size={20} color={colors.muted} />
      </Pressable>
    );
  }
  return (
    <Pressable
      testID="btn-deconnexion"
      onPress={sortir}
      style={({ pressed }) => [styles.lienLateral, pressed && { backgroundColor: colors.brandTertiary }]}
    >
      <Icone name="log-out" size={20} color={colors.muted} />
      <Text style={[styles.lienLateralTexte, { color: colors.muted }]}>Déconnexion</Text>
    </Pressable>
  );
}

/** Barre de navigation haute : logo, liens de pages, panier, compte. */
function EnteteWeb({
  liens,
  avecPanier,
  accueil,
}: {
  liens: LienNav[];
  avecPanier: boolean;
  accueil: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  return (
    <View testID="entete-web" style={[styles.entete, { paddingTop: insets.top }]}>
      <View style={styles.enteteInterieur}>
        <Pressable testID="btn-marque" onPress={() => router.push(accueil as any)} style={styles.marqueBtn}>
          <Logo taille={22} />
        </Pressable>

        <View style={styles.liens}>
          {liens.map((l) => {
            const actif = lienActif(pathname, l.href);
            return (
              <Pressable
                key={l.href}
                testID={`lien-${l.libelle}`}
                onPress={() => router.push(l.href as any)}
                style={({ pressed }) => [
                  styles.lien,
                  actif && styles.lienActif,
                  !actif && pressed && { backgroundColor: colors.surfaceSecondary },
                ]}
              >
                <Text style={[styles.lienTexte, actif && { color: colors.brandPrimary }]}>{l.libelle}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.enteteActions}>
          {avecPanier ? <BoutonPanier /> : null}
          <BoutonDeconnexion compact />
        </View>
      </View>
    </View>
  );
}

/** Header compact (petit écran) : marque + panier. */
function EnteteCompacte({ avecPanier, accueil }: { avecPanier: boolean; accueil: string }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View testID="entete-compacte" style={[styles.enteteCompacte, { paddingTop: insets.top + spacing.sm }]}>
      <Pressable testID="btn-marque" onPress={() => router.push(accueil as any)}>
        <Logo taille={19} />
      </Pressable>
      <View style={styles.enteteActions}>
        {avecPanier ? <BoutonPanier /> : null}
        <BoutonDeconnexion compact />
      </View>
    </View>
  );
}

/** Barre d'onglets basse, conservée sur téléphone. */
function BarreOnglets({ liens }: { liens: LienNav[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  return (
    <View testID="barre-onglets" style={[styles.onglets, { paddingBottom: insets.bottom }]}>
      {liens.map((l) => {
        const actif = lienActif(pathname, l.href);
        const couleur = actif ? colors.brandPrimary : colors.muted;
        return (
          <Pressable
            key={l.href}
            testID={`onglet-${l.libelle}`}
            onPress={() => router.push(l.href as any)}
            style={styles.onglet}
          >
            <Icone name={l.icone} size={22} color={couleur} />
            <Text style={[styles.ongletTexte, { color: couleur }]} numberOfLines={1}>
              {l.libelle}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Navigation latérale fixe du back office (grand écran). */
function BarreLaterale({
  liens,
  liensSecondaires,
  sousTitre,
  accueil,
}: {
  liens: LienNav[];
  liensSecondaires: LienNav[];
  sousTitre?: string;
  accueil: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const rendre = (l: LienNav, secondaire = false) => {
    const actif = lienActif(pathname, l.href);
    const couleur = actif ? colors.onBrandPrimary : secondaire ? colors.muted : colors.onSurface;
    return (
      <Pressable
        key={l.href}
        testID={`lien-lateral-${l.libelle}`}
        onPress={() => router.push(l.href as any)}
        style={({ pressed }) => [
          styles.lienLateral,
          actif && styles.lienLateralActif,
          !actif && pressed && { backgroundColor: colors.brandTertiary },
        ]}
      >
        <Icone name={l.icone} size={20} color={couleur} />
        <Text style={[styles.lienLateralTexte, { color: couleur }]}>{l.libelle}</Text>
      </Pressable>
    );
  };

  return (
    <View testID="barre-laterale" style={styles.laterale}>
      <Pressable testID="btn-marque" onPress={() => router.push(accueil as any)} style={styles.marque}>
        <Logo taille={19} />
        {sousTitre ? <Text style={styles.marqueSous}>{sousTitre}</Text> : null}
      </Pressable>

      <ScrollView contentContainerStyle={styles.lateraleLiens} showsVerticalScrollIndicator={false}>
        {liens.map((l) => rendre(l))}
        {liensSecondaires.length > 0 ? <View style={styles.separateur} /> : null}
        {liensSecondaires.map((l) => rendre(l, true))}
        <View style={styles.separateur} />
        <BoutonDeconnexion />
      </ScrollView>
    </View>
  );
}

/**
 * Coquille de l'application web : navigation haute (ou latérale pour le back
 * office) sur grand écran, header compact + onglets bas sur téléphone.
 */
export function Coquille({
  liens,
  liensSecondaires = [],
  lateral = false,
  sousTitre,
  avecPanier = false,
  children,
}: {
  liens: LienNav[];
  liensSecondaires?: LienNav[];
  lateral?: boolean;
  sousTitre?: string;
  avecPanier?: boolean;
  children: React.ReactNode;
}) {
  useTheme();
  const { bureau } = useEcran();
  const accueil = liens[0]?.href ?? "/";

  if (bureau && lateral) {
    return (
      <View style={styles.rangee}>
        <BarreLaterale liens={liens} liensSecondaires={liensSecondaires} sousTitre={sousTitre} accueil={accueil} />
        <View style={styles.contenu}>{children}</View>
      </View>
    );
  }

  if (bureau) {
    return (
      <View style={styles.colonne}>
        <EnteteWeb liens={[...liens, ...liensSecondaires]} avecPanier={avecPanier} accueil={accueil} />
        <View style={styles.contenu}>{children}</View>
      </View>
    );
  }

  return (
    <View style={styles.colonne}>
      <EnteteCompacte avecPanier={avecPanier} accueil={accueil} />
      <View style={styles.contenu}>{children}</View>
      <BarreOnglets liens={liens} />
    </View>
  );
}

const styles = stylesDynamiques(() =>
  StyleSheet.create({
    rangee: { flex: 1, flexDirection: "row", backgroundColor: colors.surfaceSecondary },
    colonne: { flex: 1, backgroundColor: colors.surfaceSecondary },
    contenu: { flex: 1, minWidth: 0 },

    entete: {
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      ...(Platform.OS === "web" ? { position: "sticky" as any, top: 0, zIndex: 20 } : {}),
    },
    enteteInterieur: {
      width: "100%",
      maxWidth: 1360,
      alignSelf: "center",
      height: 72,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xl,
      paddingHorizontal: spacing.xl,
    },
    marqueBtn: { paddingVertical: spacing.sm },
    liens: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.xs },
    lien: {
      minHeight: 44,
      paddingHorizontal: spacing.lg,
      borderRadius: radius.pill,
      justifyContent: "center",
    },
    lienActif: { backgroundColor: colors.brandTertiary },
    lienTexte: { fontFamily: fonts.text, fontSize: 14, fontWeight: "700", color: colors.onSurface },
    enteteActions: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    iconeBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },

    enteteCompacte: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.sm,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },

    panierBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      minHeight: 44,
      paddingHorizontal: spacing.lg,
      borderRadius: radius.pill,
      backgroundColor: colors.brandPrimary,
    },
    panierTexte: { fontFamily: fonts.text, fontSize: 14, fontWeight: "800", color: colors.onBrandPrimary },
    panierBadge: {
      minWidth: 22,
      height: 22,
      borderRadius: radius.pill,
      backgroundColor: colors.onBrandPrimary,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 5,
    },
    panierBadgeTexte: { fontFamily: fonts.display, fontSize: 12, color: colors.brandPrimary },

    onglets: {
      flexDirection: "row",
      backgroundColor: colors.surface,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    onglet: { flex: 1, minHeight: 56, alignItems: "center", justifyContent: "center", gap: 2, paddingTop: spacing.xs },
    ongletTexte: { fontFamily: fonts.text, fontSize: 11, fontWeight: "700" },

    laterale: {
      width: 252,
      backgroundColor: colors.surface,
      borderRightWidth: 1,
      borderRightColor: colors.border,
      paddingVertical: spacing.xl,
    },
    marque: { paddingHorizontal: spacing.lg, gap: 2, marginBottom: spacing.xl },
    marqueSous: { fontFamily: fonts.text, fontSize: 11, color: colors.muted },
    lateraleLiens: { paddingHorizontal: spacing.md, gap: spacing.xs, paddingBottom: spacing.xl },
    lienLateral: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      minHeight: 48,
      paddingHorizontal: spacing.md,
      borderRadius: radius.md,
    },
    lienLateralActif: { backgroundColor: colors.brandPrimary },
    lienLateralTexte: { fontFamily: fonts.text, fontSize: 14, fontWeight: "700" },
    separateur: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: spacing.md,
      marginHorizontal: spacing.md,
    },
  }),
);
