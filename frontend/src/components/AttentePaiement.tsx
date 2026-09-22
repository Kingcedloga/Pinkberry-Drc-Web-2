import { useQuery } from "@tanstack/react-query";
import React from "react";
import { ActivityIndicator, Modal, StyleSheet, Text, View } from "react-native";

import { apiFetch } from "@/src/api";
import { Bouton } from "@/src/components/Bouton";
import { Icone } from "@/src/components/Icone";
import { colors, fonts, poids, radius, spacing, stylesDynamiques } from "@/src/theme";

type Etat = { statut: "attente" | "paye" | "echoue" | "expire"; montant: string; devise: string; raisonEchec?: string | null };

/**
 * Attente de l'approbation mobile money : la commande n'est jamais marquée payée
 * ici, on ne fait qu'afficher l'état renvoyé par le serveur (callback PawaPay).
 */
export function AttentePaiement({
  depositId,
  montant,
  devise,
  onPaye,
  onReessayer,
  onCash,
}: {
  depositId: string;
  montant: string;
  devise: string;
  onPaye: () => void;
  onReessayer: () => void;
  onCash: () => void;
}) {
  const q = useQuery({
    queryKey: ["paiement", depositId],
    queryFn: () => apiFetch<Etat>(`/paiements/${depositId}`),
    refetchInterval: (r) => ((r.state.data?.statut ?? "attente") === "attente" ? 4000 : false),
    retry: false,
  });

  const statut = q.data?.statut ?? "attente";

  React.useEffect(() => {
    if (statut === "paye") onPaye();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statut]);

  return (
    <Modal visible transparent animationType="fade">
      <View style={styles.fond}>
        <View testID="bloc-attente-paiement" style={styles.carte}>
          {statut === "attente" ? (
            <>
              <ActivityIndicator color={colors.brandPrimary} size="large" />
              <Text style={styles.titre}>En attente de confirmation…</Text>
              <Text style={styles.detail}>
                Validez la demande de {q.data?.montant ?? montant} {q.data?.devise ?? devise} avec votre code
                PIN sur votre téléphone.
              </Text>
              <Text style={styles.astuce}>
                Pas de demande reçue ? Composez *501# (Vodacom) ou consultez vos approbations en attente.
              </Text>
            </>
          ) : statut === "paye" ? (
            <>
              <Icone name="check-circle" size={40} color={colors.success} />
              <Text style={styles.titre}>Paiement confirmé</Text>
            </>
          ) : (
            <>
              <Icone name="alert-circle" size={40} color={colors.error} />
              <Text style={styles.titre}>
                {statut === "expire" ? "Délai dépassé" : "Paiement échoué"}
              </Text>
              <Text style={styles.detail}>
                {statut === "expire"
                  ? "Nous n'avons pas reçu votre approbation. Réessayez ou payez à la livraison."
                  : q.data?.raisonEchec || "L'opérateur a refusé la transaction."}
              </Text>
              <Bouton testID="btn-reessayer-paiement" label="Réessayer" onPress={onReessayer} />
              <Bouton
                testID="btn-basculer-cash"
                label="Payer à la livraison"
                variant="contour"
                onPress={onCash}
              />
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = stylesDynamiques(() => StyleSheet.create({
  fond: { flex: 1, backgroundColor: "rgba(20,10,16,0.55)", alignItems: "center", justifyContent: "center", padding: spacing.lg },
  carte: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    gap: spacing.md,
    alignItems: "center",
  },
  titre: { fontFamily: fonts.display, fontSize: 18, fontWeight: poids.fort, color: colors.onSurface, textAlign: "center" },
  detail: { fontFamily: fonts.text, fontSize: 13, color: colors.muted, textAlign: "center" },
  astuce: { fontFamily: fonts.text, fontSize: 11, color: colors.muted, textAlign: "center" },
}));
