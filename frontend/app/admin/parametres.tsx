import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { apiFetch } from "@/src/api";
import { useAuth } from "@/src/auth";
import { Bouton } from "@/src/components/Bouton";
import { Champ } from "@/src/components/Champ";
import { ChoixTheme } from "@/src/components/ChoixTheme";
import { Icone, type NomIcone } from "@/src/components/Icone";
import { LiensLegaux } from "@/src/components/LiensLegaux";
import { ReglagesNotifications } from "@/src/components/ReglagesNotifications";
import { useLangue, type Langue } from "@/src/i18n";
import { LARGEUR_CONTENU } from "@/src/reactif";
import { colors, fonts, radius, softShadow, spacing, stylesDynamiques } from "@/src/theme";
import { useTheme } from "@/src/theme-contexte";
import { useToast } from "@/src/toast";
import { useRetour } from "@/src/retour";

/** Point d'entrée central de l'administration. Ajouter un nouveau réglage =
 *  ajouter une <Section> ou une <Ligne> ci-dessous. */
function Section({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitre}>{titre}</Text>
      <View style={styles.carte}>{children}</View>
    </View>
  );
}

function Ligne({
  icone,
  label,
  valeur,
  onPress,
  testID,
}: {
  icone: NomIcone;
  label: string;
  valeur?: string;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [styles.ligne, pressed && { backgroundColor: colors.brandTertiary }]}
    >
      <Icone name={icone} size={20} color={colors.brandPrimary} />
      <View style={styles.ligneTexte}>
        <Text style={styles.ligneLabel}>{label}</Text>
        {valeur ? <Text style={styles.ligneValeur}>{valeur}</Text> : null}
      </View>
      <Icone name="chevron-down" size={16} color={colors.muted} />
    </Pressable>
  );
}

export default function Parametres() {
  useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const retour = useRetour("/admin");
  const toast = useToast();
  const { user, deconnexion } = useAuth();
  const { langue, t, enregistrerPrefs } = useLangue();
  const estSuper = user?.role === "superadmin";

  const [vue, setVue] = useState<"menu" | "profil" | "motdepasse">("menu");
  const [nom, setNom] = useState(user?.nom ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [telephone, setTelephone] = useState(user?.telephone ?? "");
  const [actuel, setActuel] = useState("");
  const [nouveau, setNouveau] = useState("");
  const [confirme, setConfirme] = useState("");

  const enregistrerProfil = async () => {
    try {
      await apiFetch("/auth/profil", {
        method: "PUT",
        body: { nom, email: email.trim() || undefined, telephone },
      });
      toast.show(t("params.profilOk"), "succes");
      setVue("menu");
    } catch (e: any) {
      toast.show(e.message, "erreur");
    }
  };

  const enregistrerMotDePasse = async () => {
    if (nouveau.length < 6) {
      toast.show(t("params.mdpCourt"), "erreur");
      return;
    }
    if (nouveau !== confirme) {
      toast.show(t("params.mdpDifferent"), "erreur");
      return;
    }
    try {
      await apiFetch("/auth/motdepasse", { method: "PUT", body: { actuel, nouveau } });
      toast.show(t("params.mdpOk"), "succes");
      setActuel("");
      setNouveau("");
      setConfirme("");
      setVue("menu");
    } catch (e: any) {
      toast.show(e.message, "erreur");
    }
  };

  return (
    <View testID="ecran-parametres" style={styles.ecran}>
      <View style={[styles.entete, { paddingTop: spacing.lg }]}>
        <Pressable
          testID="btn-retour-parametres"
          onPress={() => (vue === "menu" ? retour() : setVue("menu"))}
          style={styles.iconeBtn}
        >
          <Icone name="arrow-left" size={20} color={colors.brandPrimary} />
        </Pressable>
        <Text style={styles.titre}>
          {vue === "profil"
            ? t("params.profilTitre")
            : vue === "motdepasse"
              ? t("params.mdpTitre")
              : t("admin.titre")}
        </Text>
      </View>

      <KeyboardAwareScrollView
        bottomOffset={60}
        contentContainerStyle={[styles.contenu, { paddingBottom: insets.bottom + spacing.xxxl }]}
      >
        {vue === "profil" ? (
          <View style={styles.carte}>
            <View style={styles.formulaire}>
              <Champ label={t("params.nom")} testID="input-profil-nom" value={nom} onChangeText={setNom} />
              <Champ
                label={t("params.email")}
                testID="input-profil-email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <Champ
                label={t("params.telephone")}
                testID="input-profil-telephone"
                value={telephone}
                onChangeText={setTelephone}
                keyboardType="phone-pad"
              />
              <Bouton testID="btn-enregistrer-profil" label={t("commun.enregistrer")} onPress={enregistrerProfil} />
            </View>
          </View>
        ) : vue === "motdepasse" ? (
          <View style={styles.carte}>
            <View style={styles.formulaire}>
              <Champ
                label={t("params.mdpActuel")}
                testID="input-mdp-actuel"
                value={actuel}
                onChangeText={setActuel}
                secureTextEntry
                autoCapitalize="none"
              />
              <Champ
                label={t("params.mdpNouveau")}
                testID="input-mdp-nouveau"
                value={nouveau}
                onChangeText={setNouveau}
                secureTextEntry
                autoCapitalize="none"
              />
              <Champ
                label={t("params.mdpConfirme")}
                testID="input-mdp-confirme"
                value={confirme}
                onChangeText={setConfirme}
                secureTextEntry
                autoCapitalize="none"
              />
              <Bouton testID="btn-enregistrer-mdp" label={t("params.mdpValider")} onPress={enregistrerMotDePasse} />
            </View>
          </View>
        ) : (
          <>
            <Section titre={t("params.theme")}>
              <ChoixTheme onChange={() => toast.show(t("params.enregistre"), "succes")} />
            </Section>

            <Section titre={t("params.langue")}>
              <View style={styles.langues}>
                {(["fr", "en"] as Langue[]).map((code) => {
                  const actif = langue === code;
                  return (
                    <Pressable
                      key={code}
                      testID={`btn-langue-admin-${code}`}
                      onPress={async () => {
                        try {
                          await enregistrerPrefs({ langue: code });
                          toast.show(t("params.enregistre"), "succes");
                        } catch (e: any) {
                          toast.show(e.message, "erreur");
                        }
                      }}
                      style={[styles.langue, actif && styles.langueActive]}
                    >
                      <Text style={[styles.langueTexte, actif && styles.langueTexteActif]}>
                        {t(code === "fr" ? "langue.fr" : "langue.en")}
                      </Text>
                      {actif ? <Icone name="check" size={16} color={colors.onBrandPrimary} /> : null}
                    </Pressable>
                  );
                })}
              </View>
            </Section>

            <ReglagesNotifications
              invite={t("admin.notifications")}
              types={[{ cle: "notifCommandes", label: "notifs.typeCommandes", detail: "notifs.typeCommandesDetail" }]}
            />

            <Section titre={t("params.monCompte")}>
              <Ligne
                testID="ligne-profil"
                icone="user"
                label={t("params.profil")}
                valeur={user?.nom}
                onPress={() => setVue("profil")}
              />
              <Ligne
                testID="ligne-motdepasse"
                icone="key"
                label={t("params.motdepasse")}
                onPress={() => setVue("motdepasse")}
              />
            </Section>

            <Section titre={t("admin.commandes")}>
              <Ligne
                testID="ligne-rapports"
                icone="download"
                label={t("admin.rapports")}
                valeur={t("admin.rapportsDetail")}
                onPress={() => router.push("/admin/rapports")}
              />
              <Ligne
                testID="ligne-archives"
                icone="package"
                label={t("admin.archives")}
                valeur={t("admin.archivesDetail")}
                onPress={() => router.push("/admin/archives")}
              />
            </Section>

            <Section titre={t("admin.boutique")}>
              <Ligne
                testID="ligne-bannieres"
                icone="image"
                label={t("admin.bannieres")}
                valeur={t("admin.bannieresDetail")}
                onPress={() => router.push("/admin/bannieres")}
              />
              <Ligne
                testID="ligne-promotions"
                icone="gift"
                label={t("admin.promotions")}
                valeur={t("admin.promotionsDetail")}
                onPress={() => router.push("/admin/promotions")}
              />
              <Ligne
                testID="ligne-taux"
                icone="repeat"
                label={t("admin.taux")}
                onPress={() => router.replace("/admin/catalogue")}
              />
              <Ligne
                testID="ligne-zones"
                icone="map"
                label={t("admin.zones")}
                onPress={() => router.replace("/admin/zones")}
              />
              {estSuper ? (
                <Ligne
                  testID="ligne-personnel"
                  icone="users"
                  label={t("admin.personnel")}
                  valeur={t("admin.personnelDetail")}
                  onPress={() => router.replace("/admin/personnel")}
                />
              ) : null}
            </Section>

            <LiensLegaux />

            <Bouton
              testID="btn-deconnexion-parametres"
              label={t("compte.deconnexion")}
              variant="danger"
              icone="log-out"
              onPress={async () => {
                await deconnexion();
                router.replace("/bienvenue");
              }}
            />
          </>
        )}
      </KeyboardAwareScrollView>
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
  titre: { fontFamily: fonts.display, fontSize: 22, color: colors.onSurface },
  contenu: { ...LARGEUR_CONTENU, paddingHorizontal: spacing.lg, gap: spacing.lg },
  section: { gap: spacing.sm },
  sectionTitre: { fontFamily: fonts.text, fontSize: 12, fontWeight: "700", color: colors.muted, textTransform: "uppercase" },
  carte: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    ...softShadow,
  },
  formulaire: { padding: spacing.lg, gap: spacing.md },
  ligne: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: 60,
    paddingHorizontal: spacing.lg,
  },
  ligneTexte: { flex: 1 },
  ligneLabel: { fontFamily: fonts.text, fontSize: 15, fontWeight: "700", color: colors.onSurface },
  langues: { flexDirection: "row", gap: spacing.sm, padding: spacing.md },
  langue: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    minHeight: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.brandTertiary,
  },
  langueActive: { backgroundColor: colors.brandPrimary },
  langueTexte: { fontFamily: fonts.text, fontSize: 14, fontWeight: "800", color: colors.brandPrimary },
  langueTexteActif: { color: colors.onBrandPrimary },
  ligneValeur: { fontFamily: fonts.text, fontSize: 12, color: colors.muted },
}));
