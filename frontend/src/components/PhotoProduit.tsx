import { Image } from "expo-image";
import React from "react";
import { StyleSheet, View } from "react-native";

import { Icone } from "@/src/components/Icone";
import { urlImage } from "@/src/images";
import { colors, radius as radiusTokens, stylesDynamiques } from "@/src/theme";

/** Photo d'un produit, avec visuel par défaut si aucune image n'est enregistrée. */
export function PhotoProduit({
  image,
  taille = 72,
  rayon = radiusTokens.lg,
  testID,
}: {
  image?: string | null;
  taille?: number;
  rayon?: number;
  testID?: string;
}) {
  const url = urlImage(image);
  const base = { width: taille, height: taille, borderRadius: rayon };

  if (!url) {
    return (
      <View testID={testID ?? "photo-produit-defaut"} style={[styles.defaut, base]}>
        <Icone name="ice-cream" size={Math.round(taille * 0.44)} color={colors.brandPrimary} />
      </View>
    );
  }

  return (
    <Image
      testID={testID ?? "photo-produit"}
      source={{ uri: url }}
      style={[styles.image, base]}
      contentFit="cover"
      transition={200}
    />
  );
}

const styles = stylesDynamiques(() => StyleSheet.create({
  image: { backgroundColor: colors.brandTertiary },
  defaut: { backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
}));
