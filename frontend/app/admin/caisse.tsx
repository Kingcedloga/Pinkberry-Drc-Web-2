import { Redirect } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { apiFetch } from "@/src/api";
import { Bouton } from "@/src/components/Bouton";
import { Icone } from "@/src/components/Icone";
import { TitrePage } from "@/src/components/TitrePage";
import { useDroits } from "@/src/droits";
import { useLangue } from "@/src/i18n";
import { imprimerHtml, impressionDisponible } from "@/src/plateforme/impression";
import { CLE_CAISSE_ACTIVE, CLE_CAISSE_LARGEUR } from "@/src/prefs";
import { LARGEUR_CONTENU } from "@/src/reactif";
import { colors, fonts, radius, softShadow, spacing, stylesDynamiques } from "@/src/theme";
import { useTheme } from "@/src/theme-contexte";
import { useToast } from "@/src/toast";
import { storage } from "@/src/utils/storage";

type Ticket = { commandeId: string; numero: string; impressions: number; html: string };
type Imprime = { numero: string; at: Date; impressions: number };

/** Attente entre deux vérifications de la file, et après une erreur réseau. */
const ATTENTE_MS = 5000;
const ATTENTE_ERREUR_MS = 15000;

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Poste caisse : cet écran reste ouvert sur le terminal ZKTeco (Windows, Chrome
 * en --kiosk-printing) et imprime chaque vente acceptée dès qu'elle arrive.
 * Le réglage est mémorisé sur le poste : il reprend seul après un redémarrage.
 */
export default function Caisse() {
  useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { t, langue } = useLangue();
  const { peutCaisse } = useDroits();

  const [actif, setActif] = useState(false);
  const [largeur, setLargeur] = useState<58 | 80>(80);
  const [derniereVerif, setDerniereVerif] = useState<Date | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [historique, setHistorique] = useState<Imprime[]>([]);
  // Lue par la boucle d'impression, qui ne redémarre pas quand la largeur change.
  const largeurRef = useRef(largeur);
  useEffect(() => {
    largeurRef.current = largeur;
  }, [largeur]);

  useEffect(() => {
    storage.getItem(CLE_CAISSE_ACTIVE, false).then((v) => setActif(!!v));
    storage.getItem<number>(CLE_CAISSE_LARGEUR, 80).then((v) => setLargeur(v === 58 ? 58 : 80));
  }, []);

  // Boucle du poste : vide la file, puis vérifie toutes les quelques secondes.
  useEffect(() => {
    if (!actif || !impressionDisponible || !peutCaisse) return;
    let arrete = false;
    (async () => {
      while (!arrete) {
        try {
          const { ticket } = await apiFetch<{ ticket: Ticket | null }>(
            `/caisse/tickets/suivant?largeur=${largeurRef.current}`,
            { method: "POST" },
          );
          setDerniereVerif(new Date());
          setErreur(null);
          if (!ticket) {
            await pause(ATTENTE_MS);
            continue;
          }
          await imprimerHtml(ticket.html);
          setHistorique((h) => [{ numero: ticket.numero, at: new Date(), impressions: ticket.impressions }, ...h].slice(0, 30));
        } catch (e: any) {
          setErreur(e.message);
          await pause(ATTENTE_ERREUR_MS);
        }
      }
    })();
    return () => {
      arrete = true;
    };
  }, [actif, peutCaisse]);

  if (!peutCaisse) return <Redirect href="/admin" />;

  const basculer = (v: boolean) => {
    setActif(v);
    storage.setItem(CLE_CAISSE_ACTIVE, v);
  };
  const choisirLargeur = (l: 58 | 80) => {
    setLargeur(l);
    storage.setItem(CLE_CAISSE_LARGEUR, l);
  };

  const ticketTest = async () => {
    try {
      await imprimerHtml(
        `<!doctype html><html><head><meta charset="utf-8"><style>@page{size:${largeur}mm auto;margin:0}` +
          `body{width:${largeur - 6}mm;margin:0 3mm;font:12px 'Courier New',monospace;text-align:center}</style></head>` +
          `<body><b>PINKBERRY</b><br>${t("caisse.ticketTestContenu")}<br>${largeur} mm<br>${new Date().toLocaleString()}</body></html>`,
      );
    } catch (e: any) {
      toast.show(e.message, "erreur");
    }
  };

  const heure = (d: Date) => d.toLocaleTimeString(langue === "en" ? "en-GB" : "fr-FR");

  return (
    <ScrollView
      testID="ecran-caisse"
      style={styles.ecran}
      contentContainerStyle={[styles.contenu, { paddingBottom: insets.bottom + spacing.xxxl }]}
    >
      <TitrePage titre={t("caisse.titre")} sousTitre={t("caisse.sousTitre")} />

      {!impressionDisponible ? (
        <View style={styles.carte}>
          <View style={styles.ligne}>
            <Icone name="info" size={20} color={colors.muted} />
            <Text style={styles.texte}>{t("caisse.webSeulement")}</Text>
          </View>
        </View>
      ) : (
        <>
          <View style={styles.carte}>
            <View style={styles.ligne}>
              <Icone name="printer" size={22} color={colors.brandPrimary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>{t("caisse.impressionAuto")}</Text>
                <Text testID="caisse-etat" style={[styles.etat, erreur ? { color: colors.error } : null]}>
                  {!actif
                    ? t("caisse.inactif")
                    : erreur
                      ? t("caisse.erreur", { message: erreur })
                      : derniereVerif
                        ? t("caisse.enAttente", { heure: heure(derniereVerif) })
                        : t("caisse.demarrage")}
                </Text>
              </View>
              <Switch
                testID="switch-caisse"
                value={actif}
                onValueChange={basculer}
                trackColor={{ true: colors.success, false: colors.border }}
              />
            </View>
            <View style={styles.separateur} />
            <View style={styles.ligne}>
              <Text style={[styles.label, { flex: 1 }]}>{t("caisse.largeur")}</Text>
              {([58, 80] as const).map((l) => (
                <Pressable
                  key={l}
                  testID={`largeur-${l}`}
                  onPress={() => choisirLargeur(l)}
                  style={[styles.option, largeur === l && styles.optionActive]}
                >
                  <Text style={[styles.optionTexte, largeur === l && styles.optionTexteActive]}>{l} mm</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.actions}>
              <Bouton testID="btn-ticket-test" label={t("caisse.ticketTest")} icone="printer" variant="contour" petit onPress={ticketTest} />
            </View>
          </View>

          <View style={styles.carte}>
            <Text style={styles.titreCarte}>{t("caisse.imprimes")}</Text>
            {historique.length === 0 ? (
              <Text style={styles.texte}>{t("caisse.aucunImprime")}</Text>
            ) : (
              historique.map((h, i) => (
                <View key={`${h.numero}-${i}`} style={styles.imprime}>
                  <Text style={styles.label}>{h.numero}</Text>
                  <Text style={styles.texte}>
                    {heure(h.at)}
                    {h.impressions > 1 ? ` · ${t("caisse.duplicata")}` : ""}
                  </Text>
                </View>
              ))
            )}
          </View>

          <View style={styles.carte}>
            <Text style={styles.titreCarte}>{t("caisse.installation")}</Text>
            <Text style={styles.texte}>{t("caisse.installationDetail")}</Text>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = stylesDynamiques(() =>
  StyleSheet.create({
    ecran: { flex: 1, backgroundColor: colors.surfaceSecondary },
    contenu: { ...LARGEUR_CONTENU, paddingHorizontal: spacing.lg, paddingTop: spacing.xl, gap: spacing.lg },
    carte: {
      backgroundColor: colors.surface,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
      gap: spacing.sm,
      ...softShadow,
    },
    ligne: { flexDirection: "row", alignItems: "center", gap: spacing.md, minHeight: 44 },
    separateur: { height: 1, backgroundColor: colors.border },
    label: { fontFamily: fonts.text, fontSize: 15, fontWeight: "700", color: colors.onSurface },
    etat: { fontFamily: fonts.text, fontSize: 12, color: colors.muted, marginTop: 2 },
    texte: { flex: 1, fontFamily: fonts.text, fontSize: 13, lineHeight: 19, color: colors.muted },
    titreCarte: { fontFamily: fonts.display, fontSize: 17, color: colors.onSurface },
    actions: { flexDirection: "row", marginTop: spacing.xs },
    option: {
      minHeight: 36,
      paddingHorizontal: spacing.md,
      justifyContent: "center",
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.border,
    },
    optionActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
    optionTexte: { fontFamily: fonts.text, fontSize: 13, fontWeight: "700", color: colors.muted },
    optionTexteActive: { color: colors.onBrandPrimary },
    imprime: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
  }),
);
