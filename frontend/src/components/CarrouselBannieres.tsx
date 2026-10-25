import React, { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent, type ScrollViewInstance } from "react-native";

import { useBannieres, type Banniere } from "@/src/bannieres";
import { BanniereVisuel } from "@/src/components/BanniereVisuel";
import { useLibelle } from "@/src/catalogue-i18n";
import { useT } from "@/src/i18n";
import { usePanier } from "@/src/panier";
import { RUPTURES } from "@/src/reactif";
import { colors, radius, spacing, stylesDynamiques } from "@/src/theme";
import { useToast } from "@/src/toast";

const DELAI_DEFILEMENT = 5000;

/**
 * Affiches de l'accueil : une bannière, ou un carrousel si plusieurs sont
 * actives (défilement automatique, mis en pause quand le client fait défiler).
 * Au toucher : ouvre le produit, filtre la catégorie, ou applique / met en avant
 * la promotion liée. Rien ne s'affiche sans bannière active.
 */
export function CarrouselBannieres({
  onProduit,
  onCategorie,
}: {
  onProduit: (id: string) => void;
  onCategorie: (nom: string) => void;
}) {
  const t = useT();
  const libelle = useLibelle();
  const toast = useToast();
  const { setCodePromo } = usePanier();
  const q = useBannieres();
  const bannieres = q.data ?? [];
  const [largeur, setLargeur] = useState(0);
  const [index, setIndex] = useState(0);
  const defilement = useRef<ScrollViewInstance>(null);
  const pauseJusqua = useRef(0);

  useEffect(() => {
    if (bannieres.length < 2 || !largeur) return;
    const minuterie = setInterval(() => {
      if (Date.now() < pauseJusqua.current) return;
      setIndex((courant) => {
        const suivant = (courant + 1) % bannieres.length;
        defilement.current?.scrollTo({ x: suivant * largeur, animated: true });
        return suivant;
      });
    }, DELAI_DEFILEMENT);
    return () => clearInterval(minuterie);
  }, [bannieres.length, largeur]);

  if (bannieres.length === 0) return null;
  const compact = largeur > 0 && largeur < RUPTURES.md;

  const surDefilement = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!largeur) return;
    setIndex(Math.max(0, Math.min(bannieres.length - 1, Math.round(e.nativeEvent.contentOffset.x / largeur))));
  };

  const agir = (b: Banniere) => {
    const lien = b.lien;
    if (!lien) return;
    if (lien.type === "produit") onProduit(lien.valeur);
    else if (lien.type === "categorie") onCategorie(lien.valeur);
    else {
      if (lien.code) {
        setCodePromo(lien.code);
        toast.show(t("promo.codeAjouteTexte"), "succes", t("promo.codeAjoute", { code: lien.code }));
      } else if (lien.automatique) {
        toast.show(t("promo.automatique"), "succes", libelle(b.titre, b.titreEn) || undefined);
      }
      // Met en avant ce que la promotion concerne.
      if (lien.cible === "produit" && lien.cibleValeur) onProduit(lien.cibleValeur);
      if (lien.cible === "categorie" && lien.cibleValeur) onCategorie(lien.cibleValeur);
    }
  };

  return (
    <View testID="carrousel-bannieres" onLayout={(e) => setLargeur(e.nativeEvent.layout.width)} style={styles.bloc}>
      <ScrollView
        ref={defilement}
        horizontal
        pagingEnabled
        snapToInterval={largeur || undefined}
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={32}
        onScroll={surDefilement}
        onScrollBeginDrag={() => (pauseJusqua.current = Date.now() + 2 * DELAI_DEFILEMENT)}
        style={styles.defilement}
      >
        {bannieres.map((b) => (
          <Pressable
            key={b.id}
            testID={`banniere-${b.id}`}
            disabled={!b.lien}
            accessibilityRole={b.lien ? "button" : "image"}
            accessibilityLabel={libelle(b.titre, b.titreEn) || t("bannieres.affiche")}
            onPress={() => agir(b)}
            style={({ pressed }) => [{ width: largeur || "100%" }, pressed && { opacity: 0.92 }]}
          >
            <BanniereVisuel banniere={b} compact={compact} />
          </Pressable>
        ))}
      </ScrollView>
      {bannieres.length > 1 ? (
        <View style={styles.points} accessibilityRole="tablist">
          {bannieres.map((b, i) => (
            <Pressable
              key={b.id}
              testID={`point-banniere-${i}`}
              accessibilityRole="tab"
              accessibilityState={{ selected: i === index }}
              accessibilityLabel={t("bannieres.voir", { n: i + 1, total: bannieres.length })}
              onPress={() => {
                pauseJusqua.current = Date.now() + 2 * DELAI_DEFILEMENT;
                setIndex(i);
                defilement.current?.scrollTo({ x: i * largeur, animated: true });
              }}
              style={styles.pointZone}
            >
              <View style={[styles.point, i === index && styles.pointActif]} />
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = stylesDynamiques(() =>
  StyleSheet.create({
    bloc: { gap: spacing.xs },
    defilement: { borderRadius: radius.xl },
    points: { flexDirection: "row", justifyContent: "center" },
    pointZone: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
    point: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
    pointActif: { width: 20, backgroundColor: colors.brandPrimary },
  }),
);
