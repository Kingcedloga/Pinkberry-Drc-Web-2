import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import React, { useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { obtenirToken } from "@/src/api";
import { Chargement } from "@/src/components/Chargement";
import { Bouton } from "@/src/components/Bouton";
import { Champ } from "@/src/components/Champ";
import { Icone } from "@/src/components/Icone";
import { useLangue } from "@/src/i18n";
import { LARGEUR_CONTENU } from "@/src/reactif";
import { colors, fonts, poids, radius, softShadow, spacing, stylesDynamiques } from "@/src/theme";
import { useToast } from "@/src/toast";
import { useRetour } from "@/src/retour";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;

const jour = (d: Date) => d.toISOString().slice(0, 10);

function periodes() {
  const aujourdhui = new Date();
  const debutSemaine = new Date(aujourdhui);
  debutSemaine.setDate(aujourdhui.getDate() - ((aujourdhui.getDay() + 6) % 7));
  const debutMois = new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), 1);
  return {
    aujourdhui: { debut: jour(aujourdhui), fin: jour(aujourdhui) },
    semaine: { debut: jour(debutSemaine), fin: jour(aujourdhui) },
    mois: { debut: jour(debutMois), fin: jour(aujourdhui) },
  };
}

/**
 * Écran de téléchargement de rapport par période (Excel / PDF), partagé par
 * l'admin (toutes les commandes) et le livreur (ses courses et son cash).
 */
export function EcranRapport({
  titre,
  sousTitre,
  aide,
  chemin,
  prefixeFichier,
}: {
  titre: string;
  sousTitre: string;
  aide: string;
  chemin: string;
  prefixeFichier: string;
}) {
  const insets = useSafeAreaInsets();
  const retour = useRetour();
  const toast = useToast();
  const { t, langue } = useLangue();
  const p = periodes();

  const [debut, setDebut] = useState(p.mois.debut);
  const [fin, setFin] = useState(p.mois.fin);
  const [enCours, setEnCours] = useState<"xlsx" | "pdf" | null>(null);

  const valide = /^\d{4}-\d{2}-\d{2}$/.test(debut) && /^\d{4}-\d{2}-\d{2}$/.test(fin);

  const telecharger = async (format: "xlsx" | "pdf") => {
    if (!valide) {
      toast.show(t("rapport.datesInvalides"), "erreur");
      return;
    }
    setEnCours(format);
    const url = `${BASE}/api${chemin}?debut=${debut}&fin=${fin}&format=${format}`;
    try {
      // Le rapport (colonnes, statuts, récapitulatif) est généré dans la langue de l'interface.
      const res = await fetch(url, { headers: { Authorization: `Bearer ${obtenirToken()}`, "Accept-Language": langue } });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt.includes("detail") ? JSON.parse(txt).detail : t("rapport.indisponible"));
      }
      const nom = `${prefixeFichier}-${debut}-${fin}.${format}`;

      if (Platform.OS === "web") {
        const blob = await res.blob();
        const lien = document.createElement("a");
        lien.href = URL.createObjectURL(blob);
        lien.download = nom;
        lien.click();
        URL.revokeObjectURL(lien.href);
      } else {
        const octets = new Uint8Array(await res.arrayBuffer());
        const fichier = new File(Paths.cache, nom);
        if (fichier.exists) fichier.delete();
        fichier.create();
        fichier.write(octets);
        if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(fichier.uri);
      }
      toast.show(t("rapport.pret"), "succes");
    } catch (e: any) {
      toast.show(e.message, "erreur");
    } finally {
      setEnCours(null);
    }
  };

  const raccourcis = [
    { cle: "aujourdhui", label: t("rapport.aujourdhui"), ...p.aujourdhui },
    { cle: "semaine", label: t("rapport.semaine"), ...p.semaine },
    { cle: "mois", label: t("rapport.mois"), ...p.mois },
  ];

  return (
    <View testID="ecran-rapports" style={styles.ecran}>
      <View style={[styles.entete, { paddingTop: insets.top + spacing.md }]}>
        <Pressable testID="btn-retour-rapports" onPress={retour} style={styles.iconeBtn}>
          <Icone name="arrow-left" size={20} color={colors.brandPrimary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.titre}>{titre}</Text>
          <Text style={styles.sousTitre}>{sousTitre}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.contenu, { paddingBottom: insets.bottom + spacing.xxxl }]}>
        <View style={styles.carte}>
          <Text style={styles.sectionTitre}>{t("rapport.filtresRapides")}</Text>
          <View style={styles.raccourcis}>
            {raccourcis.map((r) => {
              const actif = debut === r.debut && fin === r.fin;
              return (
                <Pressable
                  key={r.cle}
                  testID={`periode-${r.cle}`}
                  onPress={() => {
                    setDebut(r.debut);
                    setFin(r.fin);
                  }}
                  style={[styles.chip, actif && styles.chipActif]}
                >
                  <Text style={[styles.chipTexte, actif && { color: colors.onBrandPrimary }]}>{r.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.carte}>
          <Text style={styles.sectionTitre}>{t("rapport.periodePerso")}</Text>
          <Champ
            label={t("rapport.du")}
            testID="input-rapport-debut"
            value={debut}
            onChangeText={setDebut}
            placeholder="2026-09-01"
            autoCapitalize="none"
          />
          <Champ
            label={t("rapport.au")}
            testID="input-rapport-fin"
            value={fin}
            onChangeText={setFin}
            placeholder="2026-09-30"
            autoCapitalize="none"
          />
        </View>

        <View style={styles.carte}>
          <Text style={styles.sectionTitre}>{t("rapport.telecharger")}</Text>
          <Text style={styles.aide}>{aide}</Text>
          <Bouton
            testID="btn-rapport-xlsx"
            label={enCours === "xlsx" ? t("rapport.generation") : t("rapport.excel")}
            icone="download"
            onPress={() => telecharger("xlsx")}
          />
          <Bouton
            testID="btn-rapport-pdf"
            label={enCours === "pdf" ? t("rapport.generation") : t("rapport.pdf")}
            variant="secondaire"
            icone="download"
            onPress={() => telecharger("pdf")}
          />
          {enCours ? <Chargement taille={30} /> : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = stylesDynamiques(() => StyleSheet.create({
  ecran: { flex: 1, backgroundColor: colors.surfaceSecondary },
  entete: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  iconeBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  titre: { fontFamily: fonts.display, fontSize: 21, fontWeight: poids.fort, color: colors.onSurface },
  sousTitre: { fontFamily: fonts.text, fontSize: 12, fontWeight: poids.corps, color: colors.muted },
  contenu: { ...LARGEUR_CONTENU, paddingHorizontal: spacing.lg, gap: spacing.lg },
  carte: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
    ...softShadow,
  },
  sectionTitre: { fontFamily: fonts.display, fontSize: 16, fontWeight: poids.fort, color: colors.onSurface },
  aide: { fontFamily: fonts.text, fontSize: 12, fontWeight: poids.corps, color: colors.muted },
  raccourcis: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActif: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  chipTexte: { fontFamily: fonts.text, fontSize: 13, fontWeight: poids.titre, color: colors.muted },
}));
