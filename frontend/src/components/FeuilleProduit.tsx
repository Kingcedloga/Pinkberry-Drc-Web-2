import { Icone } from "@/src/components/Icone";
import React, { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Bouton } from "@/src/components/Bouton";
import { PhotoProduit } from "@/src/components/PhotoProduit";
import { ArticlePanier, Garniture } from "@/src/panier";
import { LARGEUR_FEUILLE } from "@/src/reactif";
import { colors, fonts, radius, softShadow, spacing, stylesDynamiques } from "@/src/theme";
import { useMontant } from "@/src/taux";

export type Produit = {
  id: string;
  nom: string;
  categorie: string;
  prix: number;
  image?: string | null;
  emoji?: string | null;
  description?: string | null;
  disponible: boolean;
  enAvant?: boolean;
  tailles: { nom: string; ecart: number }[];
  garnitures: Garniture[];
};

export function FeuilleProduit({
  produit,
  visible,
  onClose,
  onAjouter,
}: {
  produit: Produit | null;
  visible: boolean;
  onClose: () => void;
  onAjouter: (a: Omit<ArticlePanier, "cle">) => void;
}) {
  const insets = useSafeAreaInsets();
  const { usd, fc } = useMontant();
  const [tailleIndex, setTailleIndex] = useState(0);
  const [garnituresChoisies, setGarnitures] = useState<string[]>([]);
  const [quantite, setQuantite] = useState(1);

  const reset = () => {
    setTailleIndex(0);
    setGarnitures([]);
    setQuantite(1);
  };

  const prixUnitaire = useMemo(() => {
    if (!produit) return 0;
    const ecart = produit.tailles[tailleIndex]?.ecart ?? 0;
    const sup = produit.garnitures
      .filter((g) => garnituresChoisies.includes(g.nom))
      .reduce((s, g) => s + g.prix, 0);
    return produit.prix + ecart + sup;
  }, [produit, tailleIndex, garnituresChoisies]);

  if (!produit) return null;

  const ajouter = () => {
    onAjouter({
      produitId: produit.id,
      nom: produit.nom,
      taille: produit.tailles[tailleIndex]?.nom ?? null,
      garnitures: produit.garnitures.filter((g) => garnituresChoisies.includes(g.nom)),
      quantite,
      prixUnitaire,
      emoji: produit.emoji,
      image: produit.image,
    });
    reset();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.voile}>
        <Pressable style={styles.zoneFermeture} onPress={onClose} testID="fermer-feuille-fond" />
        <View testID="feuille-produit" style={[styles.feuille, { paddingBottom: insets.bottom + spacing.lg }]}>
          <View style={styles.poignee} />
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            <View style={styles.entete}>
              <PhotoProduit image={produit.image} taille={96} rayon={radius.lg} />
              <View style={styles.enteteTexte}>
                <Text testID="feuille-nom-produit" style={styles.nom}>
                  {produit.nom}
                </Text>
                <Text style={styles.desc}>{produit.description ?? produit.categorie}</Text>
                <Text style={styles.prixBase}>
                  {usd(produit.prix)} ≈ {fc(produit.prix)}
                </Text>
              </View>
            </View>

            {produit.tailles.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitre}>Choisir la taille</Text>
                {produit.tailles.map((t, i) => (
                  <Pressable
                    key={t.nom}
                    testID={`taille-${t.nom}`}
                    onPress={() => setTailleIndex(i)}
                    style={[styles.option, i === tailleIndex && styles.optionActive]}
                  >
                    <View style={[styles.radio, i === tailleIndex && styles.radioActif]}>
                      {i === tailleIndex ? <View style={styles.radioPoint} /> : null}
                    </View>
                    <Text style={styles.optionNom}>{t.nom}</Text>
                    <Text style={styles.optionPrix}>
                      {t.ecart > 0 ? `+ ${usd(t.ecart)}` : "Inclus"}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            {produit.garnitures.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitre}>Garnitures</Text>
                {produit.garnitures.map((g) => {
                  const coche = garnituresChoisies.includes(g.nom);
                  return (
                    <Pressable
                      key={g.nom}
                      testID={`garniture-${g.nom}`}
                      onPress={() =>
                        setGarnitures((prev) => (coche ? prev.filter((x) => x !== g.nom) : [...prev, g.nom]))
                      }
                      style={[styles.option, coche && styles.optionActive]}
                    >
                      <View style={[styles.checkbox, coche && styles.checkboxActif]}>
                        {coche ? <Icone name="check" size={14} color={colors.onBrandPrimary} /> : null}
                      </View>
                      <Text style={styles.optionNom}>{g.nom}</Text>
                      <Text style={styles.optionPrix}>+ {usd(g.prix)}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            <View style={styles.section}>
              <Text style={styles.sectionTitre}>Quantité</Text>
              <View style={styles.quantiteRow}>
                <Pressable
                  testID="btn-quantite-moins"
                  onPress={() => setQuantite((q) => Math.max(1, q - 1))}
                  style={styles.qBtn}
                >
                  <Icone name="minus" size={18} color={colors.brandPrimary} />
                </Pressable>
                <Text testID="valeur-quantite" style={styles.qValeur}>
                  {quantite}
                </Text>
                <Pressable testID="btn-quantite-plus" onPress={() => setQuantite((q) => q + 1)} style={styles.qBtn}>
                  <Icone name="plus" size={18} color={colors.brandPrimary} />
                </Pressable>
              </View>
            </View>
          </ScrollView>

          <View style={styles.cta}>
            <Bouton
              testID="btn-ajouter-panier"
              label={`Ajouter au panier · ${usd(prixUnitaire * quantite)}`}
              icone="shopping-bag"
              onPress={ajouter}
            />
            <Text style={styles.ctaFc}>≈ {fc(prixUnitaire * quantite)}</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = stylesDynamiques(() => StyleSheet.create({
  voile: { flex: 1, backgroundColor: "rgba(42,23,33,0.45)", justifyContent: "flex-end" },
  zoneFermeture: { flex: 1 },
  feuille: {
    ...LARGEUR_FEUILLE,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: "88%",
    paddingHorizontal: spacing.xl,
    ...softShadow,
  },
  poignee: {
    width: 44,
    height: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
    alignSelf: "center",
    marginVertical: spacing.md,
  },
  scroll: { gap: spacing.lg, paddingBottom: spacing.lg },
  entete: { flexDirection: "row", gap: spacing.lg },
  image: { width: 96, height: 96, borderRadius: radius.lg, backgroundColor: colors.brandTertiary },
  imageVide: { alignItems: "center", justifyContent: "center" },
  emoji: { fontSize: 40 },
  enteteTexte: { flex: 1, gap: 2 },
  nom: { fontFamily: fonts.display, fontSize: 22, color: colors.onSurface },
  desc: { fontFamily: fonts.text, fontSize: 13, color: colors.muted },
  prixBase: { fontFamily: fonts.display, fontSize: 16, color: colors.brandPrimary, marginTop: spacing.xs },
  section: { gap: spacing.sm },
  sectionTitre: { fontFamily: fonts.display, fontSize: 16, color: colors.onSurface },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  optionActive: { borderColor: colors.brandPrimary, backgroundColor: colors.brandTertiary },
  optionNom: { flex: 1, fontFamily: fonts.text, fontSize: 15, fontWeight: "700", color: colors.onSurface },
  optionPrix: { fontFamily: fonts.text, fontSize: 13, color: colors.muted, fontWeight: "700" },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  radioActif: { borderColor: colors.brandPrimary },
  radioPoint: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.brandPrimary },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxActif: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  quantiteRow: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
  qBtn: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  qValeur: { fontFamily: fonts.display, fontSize: 20, color: colors.onSurface, minWidth: 28, textAlign: "center" },
  cta: { paddingTop: spacing.md, gap: spacing.xs },
  ctaFc: { textAlign: "center", fontFamily: fonts.text, fontSize: 12, color: colors.muted },
}));
