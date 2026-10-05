import { Image } from "expo-image";
import React, { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View, type GestureResponderEvent } from "react-native";

import { FORMAT_RECOMMANDE, RATIO_BANNIERE } from "@/src/bannieres";
import { Bouton } from "@/src/components/Bouton";
import { Icone } from "@/src/components/Icone";
import { useT } from "@/src/i18n";
import { colors, fonts, radius, spacing, stylesDynamiques } from "@/src/theme";

export type Cadre = { x: number; y: number; w: number; h: number };

const ZOOM_MAX = 6;

/**
 * Recadrage au ratio exact de la bannière (3:1). L'image couvre toujours tout le
 * cadre : on la déplace (glisser) et on zoome (+ / −), sans bord vide possible.
 * Le cadre retenu est exprimé en pixels de l'image source ; le serveur l'applique.
 */
export function RecadrageBanniere({
  uri,
  largeurImage,
  hauteurImage,
  onValider,
  onAnnuler,
  envoi = false,
}: {
  uri: string;
  largeurImage: number;
  hauteurImage: number;
  onValider: (cadre: Cadre) => void;
  onAnnuler: () => void;
  envoi?: boolean;
}) {
  const t = useT();
  const [cadreLargeur, setCadreLargeur] = useState(0);
  const cadreHauteur = cadreLargeur / RATIO_BANNIERE;
  // Échelle minimale : l'image couvre le cadre (« cover »).
  const echelleMin = cadreLargeur ? Math.max(cadreLargeur / largeurImage, cadreHauteur / hauteurImage) : 1;
  const [vue, setVue] = useState<{ s: number; tx: number; ty: number } | null>(null);
  // Point de départ du glisser (pointeur et position de l'image).
  const depart = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);

  const borner = (s: number, tx: number, ty: number) => ({
    s,
    tx: Math.min(0, Math.max(cadreLargeur - largeurImage * s, tx)),
    ty: Math.min(0, Math.max(cadreHauteur - hauteurImage * s, ty)),
  });

  const centrer = (s = echelleMin) =>
    setVue(borner(s, (cadreLargeur - largeurImage * s) / 2, (cadreHauteur - hauteurImage * s) / 2));

  const zoomer = (facteur: number) =>
    setVue((v) => {
      if (!v) return v;
      const s = Math.min(echelleMin * ZOOM_MAX, Math.max(echelleMin, v.s * facteur));
      // Zoom autour du centre du cadre.
      const cx = (cadreLargeur / 2 - v.tx) / v.s;
      const cy = (cadreHauteur / 2 - v.ty) / v.s;
      return borner(s, cadreLargeur / 2 - cx * s, cadreHauteur / 2 - cy * s);
    });

  // Glisser (doigt ou souris) pour déplacer l'image dans le cadre.
  const commencer = (e: GestureResponderEvent) => {
    depart.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY, tx: vue?.tx ?? 0, ty: vue?.ty ?? 0 };
  };
  const deplacer = (e: GestureResponderEvent) => {
    const d = depart.current;
    if (!d) return;
    const dx = e.nativeEvent.pageX - d.x;
    const dy = e.nativeEvent.pageY - d.y;
    setVue((v) => (v ? borner(v.s, d.tx + dx, d.ty + dy) : v));
  };

  const cadre: Cadre | null = vue
    ? { x: -vue.tx / vue.s, y: -vue.ty / vue.s, w: cadreLargeur / vue.s, h: cadreHauteur / vue.s }
    : null;
  const tropPetite = !!cadre && cadre.w < FORMAT_RECOMMANDE.largeur;

  return (
    <View style={styles.bloc} testID="recadrage-banniere">
      <Text style={styles.aide}>{t("bannieres.recadrageAide")}</Text>
      <View
        style={styles.cadre}
        onLayout={(e) => {
          const l = e.nativeEvent.layout.width;
          if (Math.abs(l - cadreLargeur) < 1) return;
          setCadreLargeur(l);
          const s = Math.max(l / largeurImage, l / RATIO_BANNIERE / hauteurImage);
          setVue({ s, tx: (l - largeurImage * s) / 2, ty: (l / RATIO_BANNIERE - hauteurImage * s) / 2 });
        }}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={commencer}
        onResponderMove={deplacer}
        onResponderRelease={() => (depart.current = null)}
        onResponderTerminate={() => (depart.current = null)}
      >
        {vue ? (
          <Image
            source={{ uri }}
            style={{ position: "absolute", left: vue.tx, top: vue.ty, width: largeurImage * vue.s, height: hauteurImage * vue.s }}
            contentFit="fill"
          />
        ) : null}
        {/* Repères des tiers, pour placer le sujet et le texte. */}
        <View pointerEvents="none" style={[styles.ligneV, { left: "33.33%" }]} />
        <View pointerEvents="none" style={[styles.ligneV, { left: "66.66%" }]} />
        <View pointerEvents="none" style={[styles.ligneH, { top: "50%" }]} />
      </View>

      <View style={styles.outils}>
        <Pressable testID="btn-zoom-moins" accessibilityLabel={t("bannieres.zoomMoins")} onPress={() => zoomer(1 / 1.2)} style={styles.outil}>
          <Icone name="minus" size={18} color={colors.brandPrimary} />
        </Pressable>
        <Pressable testID="btn-zoom-plus" accessibilityLabel={t("bannieres.zoomPlus")} onPress={() => zoomer(1.2)} style={styles.outil}>
          <Icone name="plus" size={18} color={colors.brandPrimary} />
        </Pressable>
        <Pressable testID="btn-recentrer" onPress={() => centrer()} style={[styles.outil, styles.outilLarge]}>
          <Text style={styles.outilTexte}>{t("bannieres.recentrer")}</Text>
        </Pressable>
        {cadre ? (
          <Text testID="taille-retenue" style={[styles.info, tropPetite && styles.alerte]}>
            {t("bannieres.zoneRetenue", { largeur: Math.round(cadre.w), hauteur: Math.round(cadre.h) })}
          </Text>
        ) : null}
      </View>
      {tropPetite ? <Text style={[styles.aide, styles.alerte]}>{t("bannieres.tropPetite")}</Text> : null}

      <Bouton
        testID="btn-valider-recadrage"
        label={t("bannieres.validerRecadrage")}
        icone="check"
        loading={envoi}
        disabled={!cadre}
        onPress={() => cadre && onValider(cadre)}
      />
      <Bouton testID="btn-annuler-recadrage" label={t("commun.annuler")} variant="contour" onPress={onAnnuler} />
    </View>
  );
}

const styles = stylesDynamiques(() =>
  StyleSheet.create({
    bloc: { gap: spacing.md },
    aide: { fontFamily: fonts.text, fontSize: 12, color: colors.muted },
    alerte: { color: colors.error, fontWeight: "700" },
    cadre: {
      width: "100%",
      aspectRatio: RATIO_BANNIERE,
      borderRadius: radius.xl,
      overflow: "hidden",
      backgroundColor: colors.surfaceSecondary,
      borderWidth: 2,
      borderColor: colors.brandPrimary,
      cursor: "grab",
    } as any,
    ligneV: { position: "absolute", top: 0, bottom: 0, width: 1, backgroundColor: "rgba(255,255,255,0.55)" },
    ligneH: { position: "absolute", left: 0, right: 0, height: 1, backgroundColor: "rgba(255,255,255,0.55)" },
    outils: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.sm },
    outil: {
      width: 44,
      height: 44,
      borderRadius: radius.pill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.brandTertiary,
    },
    outilLarge: { width: "auto", paddingHorizontal: spacing.lg },
    outilTexte: { fontFamily: fonts.text, fontSize: 13, fontWeight: "800", color: colors.brandPrimary },
    info: { flexShrink: 1, fontFamily: fonts.text, fontSize: 12, fontWeight: "700", color: colors.muted },
  }),
);
