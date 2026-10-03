import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Platform, Pressable, Share, StyleSheet, Switch, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { apiFetch } from "@/src/api";
import { useAuth } from "@/src/auth";
import { Bouton } from "@/src/components/Bouton";
import { Champ } from "@/src/components/Champ";
import { ChoixTheme } from "@/src/components/ChoixTheme";
import { Icone, type NomIcone } from "@/src/components/Icone";
import { useLangue, type CleTexte, type Langue } from "@/src/i18n";
import { LARGEUR_CONTENU } from "@/src/reactif";
import { colors, fonts, poids, radius, softShadow, spacing, stylesDynamiques } from "@/src/theme";
import { useTheme } from "@/src/theme-contexte";
import { CarteNotifications } from "@/src/components/CarteNotifications";
import { useToast } from "@/src/toast";

/** Lien partagé aux amis : remplacé par le lien Play Store / App Store dès qu'il existe. */
const LIEN_APP = process.env.EXPO_PUBLIC_APP_STORE_URL || process.env.EXPO_PUBLIC_BACKEND_URL || "";

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

function LigneInterrupteur({
  label,
  detail,
  valeur,
  onChange,
  testID,
}: {
  label: string;
  detail: string;
  valeur: boolean;
  onChange: (v: boolean) => void;
  testID: string;
}) {
  return (
    <View style={styles.ligne}>
      <View style={styles.ligneTexte}>
        <Text style={styles.ligneLabel}>{label}</Text>
        <Text style={styles.ligneValeur}>{detail}</Text>
      </View>
      <Switch
        testID={testID}
        value={valeur}
        onValueChange={onChange}
        trackColor={{ true: colors.brandPrimary, false: colors.border }}
        thumbColor={colors.surface}
      />
    </View>
  );
}

export default function ParametresClient() {
  useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { user, deconnexion } = useAuth();
  const { prefs, langue, t, enregistrerPrefs } = useLangue();

  const [vue, setVue] = useState<"menu" | "profil" | "motdepasse">("menu");
  const [nom, setNom] = useState(user?.nom ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [telephone, setTelephone] = useState(user?.telephone ?? "");
  const [actuel, setActuel] = useState("");
  const [nouveau, setNouveau] = useState("");
  const [confirme, setConfirme] = useState("");

  const majPrefs = async (maj: Parameters<typeof enregistrerPrefs>[0]) => {
    try {
      // Préférences par type : appliquées par le serveur à l'envoi (push et
      // notifications internes). L'activation des push de cet appareil se fait
      // dans la carte « Notifications » ci-dessous.
      await enregistrerPrefs(maj);
      toast.show(t("params.enregistre"), "succes");
    } catch (e: any) {
      toast.show(e.message, "erreur");
    }
  };

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

  const partager = async () => {
    const message = `${t("params.partageMessage")}\n${LIEN_APP}`;
    try {
      if (Platform.OS === "web") {
        const partageWeb = (globalThis.navigator as any)?.share;
        if (partageWeb) await partageWeb.call(globalThis.navigator, { text: message, url: LIEN_APP });
        else {
          await (globalThis.navigator as any)?.clipboard?.writeText?.(message);
          toast.show(langue === "fr" ? "Lien copié" : "Link copied", "succes");
        }
        return;
      }
      await Share.share({ message, url: LIEN_APP });
    } catch (e: any) {
      toast.show(e.message, "erreur");
    }
  };

  const titreEcran: CleTexte =
    vue === "profil" ? "params.profilTitre" : vue === "motdepasse" ? "params.mdpTitre" : "params.titre";

  return (
    <View testID="ecran-parametres-client" style={styles.ecran}>
      <View style={[styles.entete, { paddingTop: spacing.lg }]}>
        <Pressable
          testID="btn-retour-parametres-client"
          onPress={() => (vue === "menu" ? router.back() : setVue("menu"))}
          style={styles.iconeBtn}
        >
          <Icone name="arrow-left" size={20} color={colors.brandPrimary} />
        </Pressable>
        <Text style={styles.titre}>{t(titreEcran)}</Text>
      </View>

      <KeyboardAwareScrollView
        bottomOffset={60}
        contentContainerStyle={[styles.contenu, { paddingBottom: insets.bottom + spacing.xxxl }]}
      >
        {vue === "profil" ? (
          <View style={styles.carte}>
            <View style={styles.formulaire}>
              <Champ label={t("params.nom")} testID="input-client-nom" value={nom} onChangeText={setNom} />
              <Champ
                label={t("params.email")}
                testID="input-client-email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <Champ
                label={t("params.telephone")}
                testID="input-client-telephone"
                value={telephone}
                onChangeText={setTelephone}
                keyboardType="phone-pad"
              />
              <Bouton
                testID="btn-enregistrer-profil-client"
                label={t("commun.enregistrer")}
                onPress={enregistrerProfil}
              />
            </View>
          </View>
        ) : vue === "motdepasse" ? (
          <View style={styles.carte}>
            <View style={styles.formulaire}>
              <Champ
                label={t("params.mdpActuel")}
                testID="input-client-mdp-actuel"
                value={actuel}
                onChangeText={setActuel}
                secureTextEntry
                autoCapitalize="none"
              />
              <Champ
                label={t("params.mdpNouveau")}
                testID="input-client-mdp-nouveau"
                value={nouveau}
                onChangeText={setNouveau}
                secureTextEntry
                autoCapitalize="none"
              />
              <Champ
                label={t("params.mdpConfirme")}
                testID="input-client-mdp-confirme"
                value={confirme}
                onChangeText={setConfirme}
                secureTextEntry
                autoCapitalize="none"
              />
              <Bouton
                testID="btn-enregistrer-mdp-client"
                label={t("params.mdpValider")}
                onPress={enregistrerMotDePasse}
              />
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
                      testID={`btn-langue-${code}`}
                      onPress={() => majPrefs({ langue: code })}
                      style={[styles.langue, actif && styles.langueActive]}
                    >
                      <Text style={[styles.langueTexte, actif && styles.langueTexteActif]}>
                        {code === "fr" ? "Français" : "English"}
                      </Text>
                      {actif ? <Icone name="check" size={16} color={colors.onBrandPrimary} /> : null}
                    </Pressable>
                  );
                })}
              </View>
            </Section>

            <Section titre={t("params.notifications")}>
              <View style={styles.carteNotifs}>
                <CarteNotifications texte={t("compte.notifications")} masquable={false} />
              </View>
              <LigneInterrupteur
                testID="switch-notif-suivi"
                label={t("params.notifSuivi")}
                detail={t("params.notifSuiviDetail")}
                valeur={prefs.notifSuivi}
                onChange={(v) => majPrefs({ notifSuivi: v })}
              />
              <LigneInterrupteur
                testID="switch-notif-promos"
                label={t("params.notifPromos")}
                detail={t("params.notifPromosDetail")}
                valeur={prefs.notifPromos}
                onChange={(v) => majPrefs({ notifPromos: v })}
              />
              <LigneInterrupteur
                testID="switch-notif-nouveautes"
                label={t("params.notifNouveautes")}
                detail={t("params.notifNouveautesDetail")}
                valeur={prefs.notifNouveautes}
                onChange={(v) => majPrefs({ notifNouveautes: v })}
              />
            </Section>

            <Section titre={t("params.monCompte")}>
              <Ligne
                testID="ligne-client-profil"
                icone="user"
                label={t("params.profil")}
                valeur={user?.nom}
                onPress={() => setVue("profil")}
              />
              <Ligne
                testID="ligne-client-motdepasse"
                icone="key"
                label={t("params.motdepasse")}
                onPress={() => setVue("motdepasse")}
              />
            </Section>

            <Section titre={t("params.historique")}>
              <Ligne
                testID="ligne-client-archives"
                icone="package"
                label={t("params.archives")}
                valeur={t("params.archivesDetail")}
                onPress={() => router.push("/archives")}
              />
              <Ligne
                testID="ligne-client-partage"
                icone="share"
                label={t("params.partage")}
                valeur={t("params.partageDetail")}
                onPress={partager}
              />
            </Section>

            <Section titre={t("params.legal")}>
              <Ligne
                testID="ligne-politique-confidentialite"
                icone="info"
                label={t("params.confidentialite")}
                onPress={() => router.push("/legal/confidentialite")}
              />
              <Ligne
                testID="ligne-conditions-utilisation"
                icone="receipt"
                label={t("params.conditions")}
                onPress={() => router.push("/legal/conditions")}
              />
            </Section>

            <Bouton
              testID="btn-deconnexion-client"
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
  carteNotifs: { padding: spacing.md },
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
  titre: { fontFamily: fonts.display, fontSize: 22, fontWeight: poids.fort, color: colors.onSurface },
  contenu: { ...LARGEUR_CONTENU, paddingHorizontal: spacing.lg, gap: spacing.lg },
  section: { gap: spacing.sm },
  sectionTitre: {
    fontFamily: fonts.text,
    fontSize: 12,
    fontWeight: poids.fort,
    color: colors.muted,
    textTransform: "uppercase",
  },
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
    paddingVertical: spacing.sm,
  },
  ligneTexte: { flex: 1 },
  ligneLabel: { fontFamily: fonts.text, fontSize: 15, fontWeight: poids.titre, color: colors.onSurface },
  ligneValeur: { fontFamily: fonts.text, fontSize: 12, fontWeight: poids.corps, color: colors.muted },
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
  langueTexte: { fontFamily: fonts.text, fontSize: 14, fontWeight: poids.fort, color: colors.brandPrimary },
  langueTexteActif: { color: colors.onBrandPrimary },
  aide: { fontFamily: fonts.text, fontSize: 12, fontWeight: poids.corps, color: colors.muted },
}));
