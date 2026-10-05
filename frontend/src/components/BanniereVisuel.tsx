import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { RATIO_BANNIERE, type Banniere } from "@/src/bannieres";
import { useLibelle } from "@/src/catalogue-i18n";
import { urlImage } from "@/src/images";
import { colors, fonts, radius, stylesDynamiques } from "@/src/theme";

const ALIGNEMENT = { gauche: "flex-start", centre: "center", droite: "flex-end" } as const;

/**
 * Une affiche au ratio fixe 3:1 : image en « cover » (remplit sans déformer),
 * ou dégradé rose Pinkberry quand il n'y a pas d'image. Un voile en dégradé
 * passe sous le texte pour qu'il reste lisible quelle que soit la photo.
 * `compact` choisit la variante 1200 × 400 (téléphones).
 */
export function BanniereVisuel({
  banniere,
  compact = false,
  apercuLocal,
}: {
  banniere: Pick<
    Banniere,
    "imageUrl" | "imageMobileUrl" | "titre" | "titreEn" | "sousTitre" | "sousTitreEn" | "couleurTexte" | "positionTexte"
  >;
  compact?: boolean;
  /** Admin : image locale affichée avant l'envoi. */
  apercuLocal?: string | null;
}) {
  const libelle = useLibelle();
  const image = apercuLocal ?? urlImage(compact ? banniere.imageMobileUrl || banniere.imageUrl : banniere.imageUrl);
  const titre = libelle(banniere.titre, banniere.titreEn);
  const sousTitre = libelle(banniere.sousTitre, banniere.sousTitreEn);
  const position = banniere.positionTexte ?? "gauche";
  const avecTexte = !!(titre || sousTitre);

  // Voile du côté du texte (gauche → droite, droite → gauche, centre → bas).
  const voile =
    position === "centre"
      ? { start: { x: 0.5, y: 0 }, end: { x: 0.5, y: 1 }, couleurs: ["rgba(0,0,0,0.05)", "rgba(0,0,0,0.55)"] as const }
      : position === "gauche"
        ? { start: { x: 0, y: 0.5 }, end: { x: 1, y: 0.5 }, couleurs: ["rgba(0,0,0,0.6)", "rgba(0,0,0,0)"] as const }
        : { start: { x: 1, y: 0.5 }, end: { x: 0, y: 0.5 }, couleurs: ["rgba(0,0,0,0.6)", "rgba(0,0,0,0)"] as const };

  return (
    <View style={styles.cadre} testID="banniere-visuel">
      {image ? (
        <Image
          source={{ uri: image }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={250}
          accessibilityIgnoresInvertColors
        />
      ) : (
        <LinearGradient
          colors={[colors.brandSecondary, colors.brandPrimary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      )}
      {image && avecTexte ? (
        <LinearGradient colors={voile.couleurs} start={voile.start} end={voile.end} style={StyleSheet.absoluteFill} />
      ) : null}
      {avecTexte ? (
        <View
          style={[
            styles.texte,
            { alignItems: ALIGNEMENT[position], justifyContent: position === "centre" ? "flex-end" : "center" },
          ]}
        >
          {titre ? (
            <Text
              numberOfLines={2}
              style={[
                styles.titre,
                compact && styles.titreCompact,
                { color: banniere.couleurTexte, textAlign: position === "centre" ? "center" : position === "droite" ? "right" : "left" },
              ]}
            >
              {titre}
            </Text>
          ) : null}
          {sousTitre ? (
            <Text
              numberOfLines={2}
              style={[
                styles.sousTitre,
                compact && styles.sousTitreCompact,
                { color: banniere.couleurTexte, textAlign: position === "centre" ? "center" : position === "droite" ? "right" : "left" },
              ]}
            >
              {sousTitre}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = stylesDynamiques(() =>
  StyleSheet.create({
    cadre: {
      width: "100%",
      aspectRatio: RATIO_BANNIERE,
      borderRadius: radius.xl,
      overflow: "hidden",
      backgroundColor: colors.brandPrimary,
    },
    texte: { flex: 1, paddingHorizontal: "6%", paddingVertical: "4%", gap: 4 },
    titre: {
      maxWidth: "70%",
      fontFamily: fonts.display,
      fontSize: 30,
      lineHeight: 34,
      textShadowColor: "rgba(0,0,0,0.25)",
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 4,
    },
    titreCompact: { fontSize: 19, lineHeight: 22 },
    sousTitre: {
      maxWidth: "70%",
      fontFamily: fonts.text,
      fontSize: 15,
      fontWeight: "700",
      textShadowColor: "rgba(0,0,0,0.25)",
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 3,
    },
    sousTitreCompact: { fontSize: 12 },
  }),
);
