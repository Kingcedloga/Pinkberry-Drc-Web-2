import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { apiFetch } from "@/src/api";
import { Bouton } from "@/src/components/Bouton";
import { Icone } from "@/src/components/Icone";
import { useT } from "@/src/i18n";
import { montantDebite } from "@/src/money";
import { NOMS_CANAUX, type EnLigne, type PaiementEnCours } from "@/src/paiement-en-ligne";
import { useMontant } from "@/src/taux";
import { colors, fonts, poids, radius, spacing, stylesDynamiques } from "@/src/theme";

type Etat = {
  paiementId: string;
  commandeId: string;
  mode: EnLigne;
  statut: "attente" | "paye" | "echoue" | "expire";
  montant: string;
  devise: string;
  canal?: string | null;
  url?: string;
  retour?: string;
};

/**
 * État du paiement en ligne d'une commande, sur le suivi : payé, en attente (vérifié
 * auprès de Flexpaie toutes les 4 s) ou échoué, avec nouvel essai et repli sur la livraison.
 * Rien pour une commande payée à la livraison.
 */
export function BandeauPaiement({
  commande,
  onRelancer,
  onReouvrir,
  onPayerLivraison,
}: {
  commande: any;
  onRelancer: (p: { paiementId: string; commandeId: string; mode: EnLigne; devise: string }) => void;
  onReouvrir: (p: PaiementEnCours) => void;
  onPayerLivraison: (commandeId: string) => void;
}) {
  const t = useT();
  const router = useRouter();
  const { fc } = useMontant();
  const p = commande?.paiement;
  const enLigne = (p?.mode === "mobile" || p?.mode === "carte") && !!p?.paiementId;
  const q = useQuery({
    queryKey: ["paiement", p?.paiementId],
    queryFn: () => apiFetch<Etat>(`/paiements/${p.paiementId}`),
    enabled: enLigne,
    refetchInterval: (r) => ((r.state.data?.statut ?? "attente") === "attente" ? 4000 : false),
  });
  if (!enLigne || commande.statut === "annulee") return null;

  // Payée côté commande (callback, rattrapage, admin) : pas besoin d'attendre la requête.
  const statut = commande.paye ? "paye" : q.data?.statut;
  if (!statut) return null;
  const montant = montantDebite(q.data?.montant ?? p.montant, q.data?.devise ?? p.devise, fc);
  const canal = NOMS_CANAUX[String(q.data?.canal ?? p.canal ?? "")];
  const libelleMode = t(p.mode === "carte" ? "paiement.carte" : "paiement.mobileMoney");

  if (statut === "paye") {
    return (
      <View testID="bandeau-paiement-paye" style={[styles.bandeau, styles.paye]}>
        <Icone name="check-circle" size={22} color={colors.success} />
        <View style={styles.texte}>
          <Text style={styles.titre}>{t("suiviPaiement.paye")}</Text>
          <Text style={styles.detail}>{t("suiviPaiement.payeDetail", { moyen: canal ?? libelleMode, montant })}</Text>
          <Pressable
            testID="lien-recu"
            accessibilityRole="link"
            onPress={() => router.push(`/commande/recu/${commande.id}`)}
            style={styles.lien}
          >
            <Icone name="receipt" size={14} color={colors.brandPrimary} />
            <Text style={styles.lienTexte}>{t("suiviPaiement.voirRecu")}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (statut === "attente") {
    return (
      <View testID="bandeau-paiement-attente" accessibilityLiveRegion="polite" style={[styles.bandeau, styles.attente]}>
        <Icone name="clock" size={22} color={colors.warning} />
        <View style={styles.texte}>
          <Text style={styles.titre}>{t("suiviPaiement.attente")}</Text>
          <Text style={styles.detail}>
            {t(p.mode === "carte" ? "suiviPaiement.attenteCarte" : "suiviPaiement.attenteMobile", { montant })}
          </Text>
          {q.data?.url && q.data.retour ? (
            <View style={styles.actions}>
              <Bouton
                testID="btn-suivi-rouvrir-carte"
                label={t("paiement.rouvrirCarte")}
                variant="contour"
                onPress={() =>
                  onReouvrir({
                    id: q.data!.paiementId,
                    commandeId: commande.id,
                    mode: "carte",
                    montant: q.data!.montant,
                    devise: q.data!.devise,
                    url: q.data!.url,
                    retour: q.data!.retour,
                  })
                }
              />
            </View>
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <View testID="bandeau-paiement-echoue" style={[styles.bandeau, styles.echoue]}>
      <Icone name="alert-circle" size={22} color={colors.error} />
      <View style={styles.texte}>
        <Text style={styles.titre}>
          {t(statut === "expire" ? "suiviPaiement.expire" : "suiviPaiement.echoue", { mode: libelleMode })}
        </Text>
        <Text style={styles.detail}>{t("suiviPaiement.echoueDetail")}</Text>
        <View style={styles.actions}>
          <Bouton
            testID="btn-suivi-reessayer-paiement"
            label={t("paiement.reessayer")}
            icone="refresh-cw"
            onPress={() =>
              onRelancer({ paiementId: p.paiementId, commandeId: commande.id, mode: p.mode, devise: p.devise })
            }
          />
          <Bouton
            testID="btn-suivi-payer-livraison"
            label={t("paiement.payerLivraison")}
            variant="contour"
            onPress={() => onPayerLivraison(commande.id)}
          />
        </View>
      </View>
    </View>
  );
}

const styles = stylesDynamiques(() => StyleSheet.create({
  bandeau: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 1,
  },
  paye: { backgroundColor: colors.successSoft, borderColor: colors.success },
  attente: { backgroundColor: colors.surfaceTertiary, borderColor: colors.warning },
  echoue: { backgroundColor: colors.errorSoft, borderColor: colors.error },
  texte: { flex: 1, gap: 4 },
  titre: { fontFamily: fonts.display, fontSize: 16, fontWeight: poids.fort, color: colors.onSurface },
  detail: { fontFamily: fonts.text, fontSize: 13, color: colors.onSurface },
  actions: { gap: spacing.sm, marginTop: spacing.sm },
  lien: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 32, marginTop: 2, alignSelf: "flex-start" },
  lienTexte: { fontFamily: fonts.text, fontSize: 13, fontWeight: poids.fort, color: colors.brandPrimary },
}));
