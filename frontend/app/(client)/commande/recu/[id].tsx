import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { apiFetch, obtenirToken } from "@/src/api";
import { Bouton } from "@/src/components/Bouton";
import { Chargement } from "@/src/components/Chargement";
import { Icone } from "@/src/components/Icone";
import { TitrePage } from "@/src/components/TitrePage";
import { useLangue } from "@/src/i18n";
import { remettreFichier } from "@/src/plateforme/fichiers";
import { LARGEUR_CONTENU } from "@/src/reactif";
import { useMontant } from "@/src/taux";
import { colors, fonts, poids, radius, softShadow, spacing, stylesDynamiques } from "@/src/theme";
import { useTheme } from "@/src/theme-contexte";
import { useToast } from "@/src/toast";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;

type Recu = {
  numero: string;
  client: string | null;
  payeLe: string;
  articles: { nom: string; quantite: number; total: number }[];
  sousTotal: number;
  fraisLivraison: number;
  reduction: number;
  total: number;
  paiement: {
    mode: "cash" | "mobile" | "carte";
    moyen: string;
    montant: string;
    montantClient: string | null;
    reference: string | null;
    orderNumber: string | null;
    referenceOperateur: string | null;
  };
};

/** Reçu d'une commande payée (lien depuis le suivi et l'email de reçu), téléchargeable en PDF. */
export default function RecuCommande() {
  useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { t, langue } = useLangue();
  const { fc } = useMontant();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [telechargement, setTelechargement] = useState(false);

  const q = useQuery({ queryKey: ["recu", id, langue], queryFn: () => apiFetch<Recu>(`/commandes/${id}/recu`) });
  const r = q.data;

  const telecharger = async () => {
    setTelechargement(true);
    try {
      const res = await fetch(`${BASE}/api/commandes/${id}/recu?format=pdf`, {
        headers: { Authorization: `Bearer ${obtenirToken()}`, "Accept-Language": langue },
      });
      if (!res.ok) throw new Error(t("recu.indisponible"));
      await remettreFichier(res, `recu-${r?.numero ?? id}.pdf`);
    } catch (e: any) {
      toast.show(e.message, "erreur");
    } finally {
      setTelechargement(false);
    }
  };

  const ligne = (libelle: string, valeur: string | null | undefined, testID?: string) =>
    valeur ? (
      <View style={styles.ligne}>
        <Text style={styles.libelle}>{libelle}</Text>
        <Text testID={testID} selectable style={styles.valeur}>
          {valeur}
        </Text>
      </View>
    ) : null;

  return (
    <View testID="ecran-recu" style={styles.ecran}>
      <ScrollView contentContainerStyle={[styles.contenu, { paddingBottom: insets.bottom + spacing.xxl }]}>
        <TitrePage titre={t("recu.titre")} sousTitre={r?.numero} retour={`/suivi/${id}`} />
        {q.isLoading ? (
          <Chargement taille={48} />
        ) : !r ? (
          <Text style={styles.erreur}>{(q.error as Error | null)?.message ?? t("recu.indisponible")}</Text>
        ) : (
          <>
            <View style={styles.carte}>
              <View style={styles.entete}>
                <Icone name="check-circle" size={22} color={colors.success} />
                <Text style={styles.payee}>{t("recu.payee", { date: new Date(r.payeLe).toLocaleString(langue === "en" ? "en-GB" : "fr-FR", { dateStyle: "short", timeStyle: "short" }) })}</Text>
              </View>
              {r.articles.map((a, i) => (
                <View key={i} style={styles.ligne}>
                  <Text style={styles.article}>
                    {a.quantite}× {a.nom}
                  </Text>
                  <Text style={styles.valeur}>{fc(a.total)}</Text>
                </View>
              ))}
              <View style={styles.separateur} />
              {ligne(t("recu.sousTotal"), fc(r.sousTotal))}
              {ligne(t("recu.livraison"), fc(r.fraisLivraison))}
              {r.reduction ? ligne(t("recu.reduction"), `- ${fc(r.reduction)}`) : null}
              <View style={styles.ligne}>
                <Text style={styles.total}>{t("recu.total")}</Text>
                <Text testID="recu-total" style={styles.total}>{fc(r.total)}</Text>
              </View>
            </View>

            <View style={styles.carte}>
              <Text style={styles.titreBloc}>{t("recu.paiement")}</Text>
              {ligne(t("recu.moyen"), r.paiement.moyen, "recu-moyen")}
              {ligne(t("recu.debite"), r.paiement.montant)}
              {ligne(t("recu.frais"), r.paiement.montantClient)}
              {ligne(t("recu.reference"), r.paiement.reference, "recu-reference")}
              {ligne(t("recu.flexpaie"), r.paiement.orderNumber)}
              {ligne(t("recu.operateur"), r.paiement.referenceOperateur)}
            </View>

            <Bouton
              testID="btn-telecharger-recu"
              label={t("recu.telecharger")}
              icone="download"
              variant="contour"
              loading={telechargement}
              onPress={telecharger}
            />
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = stylesDynamiques(() => StyleSheet.create({
  ecran: { flex: 1, backgroundColor: colors.surfaceSecondary },
  contenu: { ...LARGEUR_CONTENU, maxWidth: 640, padding: spacing.lg, gap: spacing.md },
  carte: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    ...softShadow,
  },
  entete: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.xs },
  payee: { flex: 1, fontFamily: fonts.display, fontSize: 15, fontWeight: poids.fort, color: colors.onSurface },
  titreBloc: { fontFamily: fonts.display, fontSize: 16, fontWeight: poids.fort, color: colors.onSurface },
  ligne: { flexDirection: "row", justifyContent: "space-between", gap: spacing.md },
  libelle: { fontFamily: fonts.text, fontSize: 13, color: colors.muted },
  article: { flex: 1, fontFamily: fonts.text, fontSize: 13, color: colors.onSurface },
  valeur: { flexShrink: 1, textAlign: "right", fontFamily: fonts.text, fontSize: 13, fontWeight: poids.fort, color: colors.onSurface },
  total: { fontFamily: fonts.display, fontSize: 16, fontWeight: poids.fort, color: colors.brandPrimary },
  separateur: { height: 1, backgroundColor: colors.divider, marginVertical: spacing.xs },
  erreur: { fontFamily: fonts.text, fontSize: 14, color: colors.error, textAlign: "center" },
}));
