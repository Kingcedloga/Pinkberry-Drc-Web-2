import { Icone } from "@/src/components/Icone";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { apiFetch } from "@/src/api";
import { useAuth } from "@/src/auth";
import { AttentePaiement } from "@/src/components/AttentePaiement";
import { Bouton } from "@/src/components/Bouton";
import { ChoixPaiement, type Devise, type ModePaiement, type Operateur } from "@/src/components/ChoixPaiement";
import { PhotoProduit } from "@/src/components/PhotoProduit";
import { RecapTotaux } from "@/src/components/RecapTotaux";
import { useLibelle } from "@/src/catalogue-i18n";
import { useT } from "@/src/i18n";
import { usePanier } from "@/src/panier";
import { useMessageCode, type Totaux } from "@/src/promotions";
import { TitrePage } from "@/src/components/TitrePage";
import { LARGEUR_CONTENU, useEcran } from "@/src/reactif";
import { colors, fonts, radius, softShadow, spacing, stylesDynamiques } from "@/src/theme";
import { useTheme } from "@/src/theme-contexte";
import { useConfigApp, useMontant } from "@/src/taux";
import { useToast } from "@/src/toast";

export default function Confirmation() {
  useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { bureau } = useEcran();
  const toast = useToast();
  const qc = useQueryClient();
  const t = useT();
  const libelle = useLibelle();
  const { usd, fc, prix } = useMontant();
  const { fraisLivraison: FRAIS } = useConfigApp();
  const { articles, adresse, sousTotal, vider } = usePanier();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<ModePaiement>("cash");
  const [operateur, setOperateur] = useState<Operateur>("mpesa");
  const [telephone, setTelephone] = useState(user?.telephone ?? "");
  const [devise, setDevise] = useState<Devise>("CDF");
  const [paiement, setPaiement] = useState<{
    depositId: string;
    commandeId: string;
    montant: string;
    devise: string;
  } | null>(null);

  // Code saisi par le client, puis code soumis au serveur (bouton « Appliquer »).
  const [codeSaisi, setCodeSaisi] = useState("");
  const [codeApplique, setCodeApplique] = useState<string | null>(null);
  const messageCode = useMessageCode();

  const itemsCommande = articles.map((a) => ({
    produitId: a.produitId,
    nom: a.nom,
    taille: a.taille,
    contenant: a.contenant,
    garnitures: a.garnitures,
    quantite: a.quantite,
    prixUnitaire: a.prixUnitaire,
    emoji: a.emoji,
    image: a.image,
  }));

  // Réductions calculées par le serveur, avec les mêmes règles que la commande :
  // promotions automatiques + code éventuel. Rien n'est calculé côté client.
  const apercuQ = useQuery({
    queryKey: ["apercu-promos", articles.map((a) => `${a.cle}×${a.quantite}`).join("|"), codeApplique],
    queryFn: () =>
      apiFetch<Totaux>("/promotions/apercu", { method: "POST", body: { items: itemsCommande, codePromo: codeApplique } }),
    enabled: articles.length > 0,
  });
  const totaux: Totaux = apercuQ.data ?? { sousTotal, fraisLivraison: FRAIS, total: sousTotal + FRAIS };
  const total = totaux.total;
  const resultatCode = apercuQ.data?.code ?? null;
  const codeAccepte = !!resultatCode && ["applique", "moins_avantageux"].includes(resultatCode.statut);
  const appliquerCode = () => setCodeApplique(codeSaisi.trim().toUpperCase() || null);
  const retirerCode = () => {
    setCodeApplique(null);
    setCodeSaisi("");
  };

  const lancerPaiement = async (commandeId: string) => {
    const r = await apiFetch<{ depositId: string; montant: string; devise: string }>("/paiements/mobile-money", {
      method: "POST",
      body: { commandeId, operateur, telephone, devise },
    });
    setPaiement({ depositId: r.depositId, commandeId, montant: r.montant, devise: r.devise });
  };

  const passerCommande = async () => {
    if (!adresse) {
      toast.show(t("confirmation.adresseManquante"), "erreur");
      return;
    }
    setLoading(true);
    try {
      const cmd = await apiFetch<any>("/commandes", {
        method: "POST",
        body: {
          adresse,
          modePaiement: mode,
          items: itemsCommande,
          // Un code refusé n'est pas transmis : la commande garde les promotions automatiques.
          codePromo: codeAccepte ? codeApplique : null,
        },
      });
      vider();
      qc.invalidateQueries({ queryKey: ["mes-commandes"] });
      toast.show(t("confirmation.envoyee", { numero: cmd.numero }), "succes");
      if (mode === "mobile") {
        await lancerPaiement(cmd.id);
        return;
      }
      router.replace(`/suivi/${cmd.id}`);
    } catch (e: any) {
      toast.show(e.message, "erreur");
    } finally {
      setLoading(false);
    }
  };

  const cta = (
    <Bouton
      testID="btn-passer-commande"
      label={t("confirmation.passer")}
      icone="check"
      loading={loading}
      onPress={passerCommande}
    />
  );

  return (
    <View testID="ecran-confirmation" style={styles.ecran}>
      <ScrollView contentContainerStyle={[styles.contenu, bureau && styles.contenuBureau]}>
        <TitrePage titre={t("confirmation.titre")} sousTitre={t("confirmation.etape")} retour="/commande/adresse" />

        <View style={bureau ? styles.colonnes : styles.pile}>
          <View style={bureau ? styles.colGauche : styles.pile}>
        <View style={styles.carte}>
          <View style={styles.carteTitreRow}>
            <Icone name="map-pin" size={16} color={colors.brandPrimary} />
            <Text style={styles.carteTitre}>{t("confirmation.livraisonA", { label: adresse?.label ?? "" })}</Text>
          </View>
          <Text style={styles.ligne}>
            {adresse?.avenue} n° {adresse?.numero}, {adresse?.commune}
          </Text>
          <Text style={styles.repere}>{t("confirmation.repere", { repere: adresse?.repere ?? "" })}</Text>
          <Text style={styles.ligne}>{t("confirmation.contact", { telephone: adresse?.telephone ?? "" })}</Text>
        </View>

        <View style={styles.carte}>
          <View style={styles.carteTitreRow}>
            <Icone name="shopping-bag" size={16} color={colors.brandPrimary} />
            <Text style={styles.carteTitre}>{t("confirmation.vosArticles")}</Text>
          </View>
          {articles.map((a) => (
            <View key={a.cle} style={styles.articleRow}>
              <PhotoProduit image={a.image} taille={36} rayon={12} />
              <Text style={styles.articleNom}>
                {a.quantite}× {libelle(a.nom, a.nomEn)}
              </Text>
              <Text style={styles.articlePrix}>{prix(a.prixUnitaire * a.quantite)}</Text>
            </View>
          ))}
        </View>

        <ChoixPaiement
          mode={mode}
          setMode={setMode}
          operateur={operateur}
          setOperateur={setOperateur}
          telephone={telephone}
          setTelephone={setTelephone}
          devise={devise}
          setDevise={setDevise}
          equivalent={t("confirmation.montantDebite", { montant: devise === "USD" ? usd(total) : fc(total) })}
        />
          </View>

          <View style={bureau ? styles.colDroite : styles.pile}>
        <View style={styles.carte}>
          <View style={styles.codeBloc}>
            <Text style={styles.codeTitre}>{t("promo.codePromo")}</Text>
            <View style={styles.codeLigne}>
              <TextInput
                testID="input-code-promo"
                value={codeSaisi}
                onChangeText={(v) => setCodeSaisi(v.toUpperCase())}
                onSubmitEditing={appliquerCode}
                autoCapitalize="characters"
                autoCorrect={false}
                placeholder={t("promo.codePlaceholder")}
                placeholderTextColor={colors.muted}
                style={styles.codeChamp}
              />
              {codeApplique ? (
                <Pressable testID="btn-retirer-code" onPress={retirerCode} style={styles.codeBouton}>
                  <Text style={styles.codeBoutonTexte}>{t("promo.retirer")}</Text>
                </Pressable>
              ) : (
                <Pressable
                  testID="btn-appliquer-code"
                  onPress={appliquerCode}
                  disabled={!codeSaisi.trim()}
                  style={[styles.codeBouton, styles.codeBoutonPrimaire, !codeSaisi.trim() && { opacity: 0.5 }]}
                >
                  <Text style={[styles.codeBoutonTexte, { color: colors.onBrandPrimary }]}>{t("promo.appliquer")}</Text>
                </Pressable>
              )}
            </View>
            {codeApplique && apercuQ.isFetching ? <Text style={styles.codeInfo}>{t("promo.verification")}</Text> : null}
            {codeApplique && !apercuQ.isFetching && resultatCode ? (
              <Text
                testID="message-code-promo"
                accessibilityLiveRegion="polite"
                style={[
                  styles.codeInfo,
                  resultatCode.statut === "applique"
                    ? styles.codeSucces
                    : resultatCode.statut === "moins_avantageux"
                      ? null
                      : styles.codeErreur,
                ]}
              >
                {messageCode(resultatCode)}
              </Text>
            ) : null}
          </View>
          <View style={styles.separateur} />
          <RecapTotaux totaux={totaux} testID="confirmation" />
          {bureau ? <View style={styles.ctaBureau}>{cta}</View> : null}
        </View>
          </View>
        </View>
      </ScrollView>

      {paiement ? (
        <AttentePaiement
          depositId={paiement.depositId}
          montant={paiement.montant}
          devise={paiement.devise}
          onPaye={() => {
            qc.invalidateQueries({ queryKey: ["mes-commandes"] });
            const id = paiement.commandeId;
            setPaiement(null);
            toast.show(t("confirmation.paiementConfirme"), "succes");
            router.replace(`/suivi/${id}`);
          }}
          onReessayer={async () => {
            const id = paiement.commandeId;
            setPaiement(null);
            try {
              await lancerPaiement(id);
            } catch (e: any) {
              toast.show(e.message, "erreur");
            }
          }}
          onCash={async () => {
            const id = paiement.commandeId;
            try {
              await apiFetch(`/paiements/${id}/cash`, { method: "POST" });
              toast.show(t("confirmation.cashLivraison"), "succes");
            } catch (e: any) {
              toast.show(e.message, "erreur");
            }
            setPaiement(null);
            router.replace(`/suivi/${id}`);
          }}
        />
      ) : null}

      {!bureau ? (
        <View style={[styles.pied, { paddingBottom: insets.bottom + spacing.lg }]}>{cta}</View>
      ) : null}
    </View>
  );
}

const styles = stylesDynamiques(() => StyleSheet.create({
  ecran: { flex: 1, backgroundColor: colors.surfaceSecondary },
  entete: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
    ...softShadow,
  },
  iconeBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  titre: { fontFamily: fonts.display, fontSize: 19, color: colors.onSurface },
  contenu: { ...LARGEUR_CONTENU, padding: spacing.lg, gap: spacing.md },
  contenuBureau: { maxWidth: 1160, padding: spacing.xl },
  pile: { gap: spacing.md },
  colonnes: { flexDirection: "row", alignItems: "flex-start", gap: spacing.xl },
  colGauche: { flex: 1.15, gap: spacing.md, minWidth: 0 },
  colDroite: { flex: 1, gap: spacing.md, minWidth: 0 },
  ctaBureau: { marginTop: spacing.md },
  codeBloc: { gap: spacing.xs },
  codeTitre: { fontFamily: fonts.text, fontSize: 13, fontWeight: "800", color: colors.onSurface },
  codeLigne: { flexDirection: "row", gap: spacing.sm },
  codeChamp: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    fontFamily: fonts.text,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 1,
    color: colors.onSurface,
  },
  codeBouton: {
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brandTertiary,
  },
  codeBoutonPrimaire: { backgroundColor: colors.brandPrimary },
  codeBoutonTexte: { fontFamily: fonts.text, fontSize: 13, fontWeight: "800", color: colors.brandPrimary },
  codeInfo: { fontFamily: fonts.text, fontSize: 12, fontWeight: "700", color: colors.muted },
  codeSucces: { color: colors.success },
  codeErreur: { color: colors.error },
  carte: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    ...softShadow,
  },
  carteTitreRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.xs },
  carteTitre: { fontFamily: fonts.display, fontSize: 16, color: colors.onSurface },
  ligne: { fontFamily: fonts.text, fontSize: 13, color: colors.onSurface },
  repere: { fontFamily: fonts.text, fontSize: 13, color: colors.brandPrimary, fontWeight: "700" },
  articleRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: 4 },
  articleNom: { flex: 1, fontFamily: fonts.text, fontSize: 13, color: colors.onSurface },
  articlePrix: { fontFamily: fonts.display, fontSize: 14, color: colors.onSurface },
  separateur: { height: 1, backgroundColor: colors.divider, marginVertical: spacing.sm },
  pied: {
    ...LARGEUR_CONTENU,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    ...softShadow,
  },
}));
