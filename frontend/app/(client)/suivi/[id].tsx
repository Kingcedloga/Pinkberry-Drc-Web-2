import { Chargement } from "@/src/components/Chargement";
import { Icone } from "@/src/components/Icone";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { apiFetch } from "@/src/api";
import { Bouton } from "@/src/components/Bouton";
import { Carte } from "@/src/components/Carte";
import { CarteNotifications } from "@/src/components/CarteNotifications";
import { Etapes } from "@/src/components/Etapes";
import { useT } from "@/src/i18n";
import { distanceLisible, dureeLisible, useItineraire } from "@/src/itineraire";
import { Etoiles } from "@/src/components/Etoiles";
import { TitrePage } from "@/src/components/TitrePage";
import { LARGEUR_CONTENU, useEcran } from "@/src/reactif";
import { colors, fonts, radius, softShadow, spacing, stylesDynamiques } from "@/src/theme";
import { useTheme } from "@/src/theme-contexte";
import { useMontant } from "@/src/taux";
import { useToast } from "@/src/toast";

export default function SuiviCommande() {
  useTheme();
  const insets = useSafeAreaInsets();
  const { bureau } = useEcran();
  const router = useRouter();
  const toast = useToast();
  const t = useT();
  const qc = useQueryClient();
  const { usd, fc } = useMontant();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [confirmAnnuler, setConfirmAnnuler] = useState(false);
  const [notationOuverte, setNotationOuverte] = useState(false);
  const [note, setNote] = useState(5);

  const q = useQuery({
    queryKey: ["commande", id],
    queryFn: () => apiFetch<any>(`/commandes/${id}`),
    refetchInterval: 4000,
  });

  const cmd = q.data;
  const positionClient = { lat: cmd?.adresse?.lat ?? -4.325, lng: cmd?.adresse?.lng ?? 15.322 };
  const positionLivreur = cmd?.positionLivreur
    ? { lat: cmd.positionLivreur.lat, lng: cmd.positionLivreur.lng }
    : null;
  const itineraire = useItineraire(positionLivreur, positionClient, cmd?.statut === "en_route");

  if (q.isLoading || !cmd) {
    return (
      <View style={[styles.ecran, styles.centre]}>
        <Chargement taille={52} />
      </View>
    );
  }

  const annulable = !["en_route", "livree", "annulee"].includes(cmd.statut);
  const arrive = cmd.statut === "livree" || (cmd.statut === "en_route" && (cmd.etaMinutes ?? 99) <= 3);
  const peutPayer = (cmd.statut === "en_route" || cmd.statut === "livree") && !cmd.clientAPaye;

  const annuler = async () => {
    try {
      await apiFetch(`/commandes/${id}/annuler`, { method: "POST" });
      setConfirmAnnuler(false);
      qc.invalidateQueries({ queryKey: ["commande", id] });
      qc.invalidateQueries({ queryKey: ["mes-commandes"] });
      toast.show(t("suivi.annulee"), "succes");
    } catch (e: any) {
      toast.show(e.message, "erreur");
    }
  };

  const confirmerPaiement = async () => {
    try {
      await apiFetch(`/commandes/${id}/paiement`, { method: "POST", body: { note } });
      qc.invalidateQueries({ queryKey: ["commande", id] });
      qc.invalidateQueries({ queryKey: ["mes-commandes"] });
      setNotationOuverte(false);
      toast.show(t("suivi.merci"), "succes");
      router.replace("/menu");
    } catch (e: any) {
      toast.show(e.message, "erreur");
    }
  };

  return (
    <View testID="ecran-suivi" style={styles.ecran}>
      <ScrollView
        contentContainerStyle={[
          styles.contenu,
          bureau && styles.contenuBureau,
          { paddingBottom: insets.bottom + spacing.xxl },
        ]}
      >
        <TitrePage
          titre={`Suivi ${cmd.numero}`}
          sousTitre={`${usd(cmd.total)} ≈ ${fc(cmd.total)}`}
          retour="/commandes"
        />

        <View style={bureau ? styles.colonnes : styles.pile}>
          <View style={bureau ? styles.colGauche : styles.pile}>
        <View style={styles.carteWrap}>
          <Carte
            client={positionClient}
            livreur={positionLivreur}
            itineraire={itineraire.data?.points ?? null}
            hauteur={bureau ? 420 : 260}
          />
          {cmd.statut === "en_route" ? (
            <View testID="pastille-eta" style={styles.eta}>
              <Icone name="clock" size={14} color={colors.onSuccess} />
              <Text style={styles.etaTexte}>
                {dureeLisible(itineraire.data?.etaSecondes) ?? `${cmd.etaMinutes ?? "—"} min`}
                {distanceLisible(itineraire.data?.distanceMetres)
                  ? ` · ${distanceLisible(itineraire.data?.distanceMetres)}`
                  : ""}
              </Text>
            </View>
          ) : null}
        </View>

        {arrive && peutPayer ? (
          <View testID="bloc-livraison" style={styles.blocLivraison}>
            <Text style={styles.livraisonTitre}>{t("suivi.arrive")}</Text>
            <Text style={styles.livraisonLabel}>{t("suivi.montantEspeces")}</Text>
            <Text testID="montant-cash" style={styles.montant}>
              {usd(cmd.total)}
            </Text>
            <Text testID="montant-cash-fc" style={styles.montantFc}>
              ≈ {fc(cmd.total)}
            </Text>
            <Bouton
              testID="btn-jai-paye"
              label={t("suivi.jaiPaye")}
              variant="succes"
              icone="check-circle"
              onPress={() => setNotationOuverte(true)}
            />
          </View>
        ) : null}
          </View>

          <View style={bureau ? styles.colDroite : styles.pile}>
        <CarteNotifications texte="Reçois les infos de ta commande en temps réel, même quand l'application est fermée." />

        <View style={styles.carte}>
          <Text style={styles.carteTitre}>{t("suivi.progression")}</Text>
          {cmd.statut === "annulee" ? (
            <View style={styles.annulee}>
              <Icone name="x-circle" size={18} color={colors.error} />
              <Text style={styles.annuleeTexte}>{t("suivi.annulee")}</Text>
            </View>
          ) : (
            <Etapes statut={cmd.statut} />
          )}
        </View>

        {cmd.livreur ? (
          <View testID="carte-livreur" style={styles.carte}>
            <Text style={styles.carteTitre}>Votre livreur</Text>
            <View style={styles.livreurRow}>
              <View style={styles.livreurAvatar}>
                <Text style={styles.livreurInitiale}>{cmd.livreur.nom.charAt(0)}</Text>
              </View>
              <View style={styles.livreurTexte}>
                <Text style={styles.livreurNom}>{cmd.livreur.nom}</Text>
                <Text style={styles.livreurDetail}>
                  {cmd.livreur.vehicule} · {cmd.livreur.plaque}
                </Text>
                <View style={styles.noteRow}>
                  <Icone name="star" size={12} color={colors.brandPrimary} />
                  <Text style={styles.noteTexte}>{cmd.livreur.note}</Text>
                </View>
              </View>
              <Pressable
                testID="btn-appeler-livreur"
                onPress={() => Linking.openURL(`tel:${cmd.livreur.telephone}`)}
                style={styles.appelBtn}
              >
                <Icone name="phone" size={20} color={colors.onSuccess} />
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.carte}>
            <Text style={styles.carteTitre}>Votre livreur</Text>
            <Text style={styles.attente}>{t("suivi.attenteLivreur")}</Text>
          </View>
        )}

        <View style={styles.carte}>
          <Text style={styles.carteTitre}>{t("suivi.detail")}</Text>
          {cmd.items.map((i: any, idx: number) => (
            <View key={idx} style={styles.itemRow}>
              <Text style={styles.itemNom}>
                {i.quantite}× {i.nom}
                {i.taille ? ` (${i.taille})` : ""}
              </Text>
              <Text style={styles.itemPrix}>{usd(i.prixUnitaire * i.quantite)}</Text>
            </View>
          ))}
          <View style={styles.separateur} />
          <View style={styles.itemRow}>
            <Text style={styles.itemNom}>{t("suivi.frais")}</Text>
            <Text style={styles.itemPrix}>{usd(cmd.fraisLivraison)}</Text>
          </View>
          <View style={styles.itemRow}>
            <Text style={styles.totalLabel}>{t("suivi.total")}</Text>
            <Text style={styles.totalValeur}>{usd(cmd.total)}</Text>
          </View>
          <Text style={styles.adresseTexte}>
            {cmd.adresse?.avenue} n° {cmd.adresse?.numero}, {cmd.adresse?.commune} — {cmd.adresse?.repere}
          </Text>
        </View>

        {annulable ? (
          <Bouton
            testID="btn-annuler-commande"
            label={t("suivi.annuler")}
            variant="danger"
            icone="x"
            onPress={() => setConfirmAnnuler(true)}
          />
        ) : null}
          </View>
        </View>
      </ScrollView>

      <Modal visible={confirmAnnuler} transparent animationType="fade" onRequestClose={() => setConfirmAnnuler(false)}>
        <View style={styles.voile}>
          <View testID="modal-annulation" style={styles.dialogue}>
            <Text style={styles.dialogueTitre}>{t("suivi.annulerTitre")}</Text>
            <Text style={styles.dialogueTexte}>{t("suivi.annulerTexte")}</Text>
            <Bouton testID="btn-confirmer-annulation" label={t("suivi.ouiAnnuler")} variant="danger" onPress={annuler} />
            <Bouton
              testID="btn-garder-commande"
              label={t("suivi.nonGarder")}
              variant="contour"
              onPress={() => setConfirmAnnuler(false)}
            />
          </View>
        </View>
      </Modal>

      <Modal visible={notationOuverte} transparent animationType="fade" onRequestClose={() => setNotationOuverte(false)}>
        <View style={styles.voile}>
          <View testID="modal-notation" style={styles.dialogue}>
            <Text style={styles.dialogueTitre}>Merci ! Notez votre livraison</Text>
            <Etoiles valeur={note} onChange={setNote} />
            <Bouton testID="btn-valider-note" label="Valider" onPress={confirmerPaiement} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = stylesDynamiques(() => StyleSheet.create({
  ecran: { flex: 1, backgroundColor: colors.surfaceSecondary },
  centre: { alignItems: "center", justifyContent: "center" },
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
  titre: { fontFamily: fonts.display, fontSize: 19, color: colors.onSurface, textAlign: "center" },
  sousTitre: { fontFamily: fonts.text, fontSize: 11, color: colors.muted, textAlign: "center" },
  contenu: { ...LARGEUR_CONTENU, padding: spacing.lg, gap: spacing.md },
  contenuBureau: { maxWidth: 1160, padding: spacing.xl },
  pile: { gap: spacing.md },
  colonnes: { flexDirection: "row", alignItems: "flex-start", gap: spacing.xl },
  colGauche: { flex: 1.25, gap: spacing.md, minWidth: 0 },
  colDroite: { flex: 1, gap: spacing.md, minWidth: 0 },
  carteWrap: { position: "relative" },
  eta: {
    position: "absolute",
    top: spacing.md,
    right: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.success,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  etaTexte: { fontFamily: fonts.text, fontSize: 12, fontWeight: "800", color: colors.onSuccess },
  blocLivraison: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    alignItems: "center",
    gap: spacing.xs,
    borderWidth: 2,
    borderColor: colors.success,
    ...softShadow,
  },
  livraisonTitre: { fontFamily: fonts.display, fontSize: 20, color: colors.onSurface },
  livraisonLabel: { fontFamily: fonts.text, fontSize: 12, color: colors.muted },
  montant: { fontFamily: fonts.display, fontSize: 40, color: colors.brandPrimary },
  montantFc: { fontFamily: fonts.text, fontSize: 13, color: colors.muted, marginBottom: spacing.md },
  carte: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    ...softShadow,
  },
  carteTitre: { fontFamily: fonts.display, fontSize: 17, color: colors.onSurface },
  annulee: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  annuleeTexte: { fontFamily: fonts.text, fontSize: 14, fontWeight: "800", color: colors.error },
  livreurRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  livreurAvatar: {
    width: 52,
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  livreurInitiale: { fontFamily: fonts.display, fontSize: 22, color: colors.brandPrimary },
  livreurTexte: { flex: 1, gap: 1 },
  livreurNom: { fontFamily: fonts.display, fontSize: 16, color: colors.onSurface },
  livreurDetail: { fontFamily: fonts.text, fontSize: 12, color: colors.muted },
  noteRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  noteTexte: { fontFamily: fonts.text, fontSize: 12, fontWeight: "800", color: colors.onSurface },
  appelBtn: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.success,
    alignItems: "center",
    justifyContent: "center",
  },
  attente: { fontFamily: fonts.text, fontSize: 13, color: colors.muted },
  itemRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 2 },
  itemNom: { flex: 1, fontFamily: fonts.text, fontSize: 13, color: colors.onSurface },
  itemPrix: { fontFamily: fonts.text, fontSize: 13, fontWeight: "700", color: colors.onSurface },
  separateur: { height: 1, backgroundColor: colors.divider, marginVertical: spacing.xs },
  totalLabel: { fontFamily: fonts.display, fontSize: 16, color: colors.onSurface },
  totalValeur: { fontFamily: fonts.display, fontSize: 18, color: colors.brandPrimary },
  adresseTexte: { fontFamily: fonts.text, fontSize: 12, color: colors.muted, marginTop: spacing.xs },
  voile: {
    flex: 1,
    backgroundColor: "rgba(42,23,33,0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  dialogue: {
    width: "100%",
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    gap: spacing.md,
  },
  dialogueTitre: { fontFamily: fonts.display, fontSize: 20, color: colors.onSurface, textAlign: "center" },
  dialogueTexte: { fontFamily: fonts.text, fontSize: 13, color: colors.muted, textAlign: "center" },
}));
