import { Icone } from "@/src/components/Icone";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { apiFetch } from "@/src/api";
import { useAuth } from "@/src/auth";
import { AttentePaiement } from "@/src/components/AttentePaiement";
import { Bouton } from "@/src/components/Bouton";
import { ChoixPaiement, type Devise, type ModePaiement, type Operateur } from "@/src/components/ChoixPaiement";
import { PhotoProduit } from "@/src/components/PhotoProduit";
import { useT } from "@/src/i18n";
import { usePanier } from "@/src/panier";
import { TitrePage } from "@/src/components/TitrePage";
import { LARGEUR_CONTENU } from "@/src/reactif";
import { colors, fonts, radius, softShadow, spacing, stylesDynamiques } from "@/src/theme";
import { useTheme } from "@/src/theme-contexte";
import { useConfigApp, useMontant } from "@/src/taux";
import { useToast } from "@/src/toast";

export default function Confirmation() {
  useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();
  const t = useT();
  const { usd, fc } = useMontant();
  const { fraisLivraison: FRAIS } = useConfigApp();
  const { articles, adresse, sousTotal, vider } = usePanier();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<ModePaiement>("cash");
  const [operateur, setOperateur] = useState<Operateur>("mpesa");
  const [telephone, setTelephone] = useState(user?.telephone ?? "");
  const [devise, setDevise] = useState<Devise>("USD");
  const [paiement, setPaiement] = useState<{
    depositId: string;
    commandeId: string;
    montant: string;
    devise: string;
  } | null>(null);

  const total = sousTotal + FRAIS;

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
          items: articles.map((a) => ({
            produitId: a.produitId,
            nom: a.nom,
            taille: a.taille,
            garnitures: a.garnitures,
            quantite: a.quantite,
            prixUnitaire: a.prixUnitaire,
            emoji: a.emoji,
            image: a.image,
          })),
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

  return (
    <View testID="ecran-confirmation" style={styles.ecran}>
      <ScrollView contentContainerStyle={styles.contenu}>
        <TitrePage
          titre={t("confirmation.titre")}
          sousTitre="Étape 2 sur 2 · Paiement"
          retour="/commande/adresse"
        />
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
                {a.quantite}× {a.nom}
              </Text>
              <Text style={styles.articlePrix}>{usd(a.prixUnitaire * a.quantite)}</Text>
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
          equivalent={devise === "USD" ? `Montant débité : ${usd(total)}` : `Montant débité : ${fc(total)}`}
        />

        <View style={styles.carte}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>{t("confirmation.sousTotal")}</Text>
            <Text style={styles.totalValeur}>{usd(sousTotal)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>{t("confirmation.frais")}</Text>
            <Text style={styles.totalValeur}>{usd(FRAIS)}</Text>
          </View>
          <View style={styles.separateur} />
          <View style={styles.totalRow}>
            <Text style={styles.grandTotalLabel}>{t("confirmation.total")}</Text>
            <View>
              <Text testID="confirmation-total" style={styles.grandTotalValeur}>
                {usd(total)}
              </Text>
              <Text style={styles.grandTotalFc}>≈ {fc(total)}</Text>
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
            toast.show("Paiement confirmé, merci !", "succes");
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
              toast.show("Vous paierez en espèces à la livraison", "succes");
            } catch (e: any) {
              toast.show(e.message, "erreur");
            }
            setPaiement(null);
            router.replace(`/suivi/${id}`);
          }}
        />
      ) : null}

      <View style={[styles.pied, { paddingBottom: insets.bottom + spacing.lg }]}>
        <Bouton
          testID="btn-passer-commande"
          label={t("confirmation.passer")}
          icone="check"
          loading={loading}
          onPress={passerCommande}
        />
      </View>
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
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 3 },
  totalLabel: { fontFamily: fonts.text, fontSize: 13, color: colors.muted, fontWeight: "700" },
  totalValeur: { fontFamily: fonts.text, fontSize: 14, color: colors.onSurface, fontWeight: "700" },
  separateur: { height: 1, backgroundColor: colors.divider, marginVertical: spacing.sm },
  grandTotalLabel: { fontFamily: fonts.display, fontSize: 17, color: colors.onSurface },
  grandTotalValeur: { fontFamily: fonts.display, fontSize: 24, color: colors.brandPrimary, textAlign: "right" },
  grandTotalFc: { fontFamily: fonts.text, fontSize: 11, color: colors.muted, textAlign: "right" },
  pied: {
    ...LARGEUR_CONTENU,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    ...softShadow,
  },
}));
