import { useRouter } from "expo-router";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import React, { useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { obtenirToken } from "@/src/api";
import { Bouton } from "@/src/components/Bouton";
import { Champ } from "@/src/components/Champ";
import { Icone } from "@/src/components/Icone";
import { colors, fonts, radius, softShadow, spacing } from "@/src/theme";
import { useToast } from "@/src/toast";

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

export default function Rapports() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const p = periodes();

  const [debut, setDebut] = useState(p.mois.debut);
  const [fin, setFin] = useState(p.mois.fin);
  const [enCours, setEnCours] = useState<"xlsx" | "pdf" | null>(null);

  const valide = /^\d{4}-\d{2}-\d{2}$/.test(debut) && /^\d{4}-\d{2}-\d{2}$/.test(fin);

  const telecharger = async (format: "xlsx" | "pdf") => {
    if (!valide) {
      toast.show("Dates attendues au format AAAA-MM-JJ", "erreur");
      return;
    }
    setEnCours(format);
    const url = `${BASE}/api/admin/rapport?debut=${debut}&fin=${fin}&format=${format}`;
    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${obtenirToken()}` } });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt.includes("detail") ? JSON.parse(txt).detail : "Rapport indisponible");
      }
      const nom = `pinkberry-rapport-${debut}-${fin}.${format}`;

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
      toast.show("Rapport prêt", "succes");
    } catch (e: any) {
      toast.show(e.message, "erreur");
    } finally {
      setEnCours(null);
    }
  };

  const raccourcis = [
    { cle: "aujourdhui", label: "Aujourd'hui", ...p.aujourdhui },
    { cle: "semaine", label: "Cette semaine", ...p.semaine },
    { cle: "mois", label: "Ce mois", ...p.mois },
  ];

  return (
    <View testID="ecran-rapports" style={styles.ecran}>
      <View style={[styles.entete, { paddingTop: insets.top + spacing.md }]}>
        <Pressable testID="btn-retour-rapports" onPress={() => router.back()} style={styles.iconeBtn}>
          <Icone name="arrow-left" size={20} color={colors.brandPrimary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.titre}>Rapport des commandes</Text>
          <Text style={styles.sousTitre}>Excel ou PDF, archives incluses</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.contenu, { paddingBottom: insets.bottom + spacing.xxxl }]}>
        <View style={styles.carte}>
          <Text style={styles.sectionTitre}>Filtres rapides</Text>
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
          <Text style={styles.sectionTitre}>Période personnalisée</Text>
          <Champ
            label="Du (AAAA-MM-JJ)"
            testID="input-rapport-debut"
            value={debut}
            onChangeText={setDebut}
            placeholder="2026-09-01"
            autoCapitalize="none"
          />
          <Champ
            label="Au (AAAA-MM-JJ)"
            testID="input-rapport-fin"
            value={fin}
            onChangeText={setFin}
            placeholder="2026-09-30"
            autoCapitalize="none"
          />
        </View>

        <View style={styles.carte}>
          <Text style={styles.sectionTitre}>Télécharger le rapport</Text>
          <Text style={styles.aide}>
            Numéro, date, client, adresse, articles, montant, statut et livreur, avec un récapitulatif
            (commandes, chiffre d&apos;affaires, livraisons réussies et annulées).
          </Text>
          <Bouton
            testID="btn-rapport-xlsx"
            label={enCours === "xlsx" ? "Génération..." : "Télécharger en Excel (.xlsx)"}
            icone="download"
            onPress={() => telecharger("xlsx")}
          />
          <Bouton
            testID="btn-rapport-pdf"
            label={enCours === "pdf" ? "Génération..." : "Télécharger en PDF"}
            variant="secondaire"
            icone="download"
            onPress={() => telecharger("pdf")}
          />
          {enCours ? <ActivityIndicator color={colors.brandPrimary} /> : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
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
  titre: { fontFamily: fonts.display, fontSize: 21, color: colors.onSurface },
  sousTitre: { fontFamily: fonts.text, fontSize: 12, color: colors.muted },
  contenu: { paddingHorizontal: spacing.lg, gap: spacing.lg },
  carte: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
    ...softShadow,
  },
  sectionTitre: { fontFamily: fonts.display, fontSize: 16, color: colors.onSurface },
  aide: { fontFamily: fonts.text, fontSize: 12, color: colors.muted },
  raccourcis: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    minHeight: 40,
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActif: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  chipTexte: { fontFamily: fonts.text, fontSize: 13, fontWeight: "700", color: colors.muted },
});
