import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { apiFetch } from "@/src/api";
import { useAuth } from "@/src/auth";
import { Bouton } from "@/src/components/Bouton";
import { Champ } from "@/src/components/Champ";
import { Icone, type NomIcone } from "@/src/components/Icone";
import { colors, fonts, radius, softShadow, spacing } from "@/src/theme";
import { useToast } from "@/src/toast";

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
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { user, deconnexion } = useAuth();
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
      toast.show("Profil mis à jour", "succes");
      setVue("menu");
    } catch (e: any) {
      toast.show(e.message, "erreur");
    }
  };

  const enregistrerMotDePasse = async () => {
    if (nouveau.length < 6) {
      toast.show("Mot de passe : 6 caractères minimum", "erreur");
      return;
    }
    if (nouveau !== confirme) {
      toast.show("Les deux mots de passe ne correspondent pas", "erreur");
      return;
    }
    try {
      await apiFetch("/auth/motdepasse", { method: "PUT", body: { actuel, nouveau } });
      toast.show("Mot de passe modifié", "succes");
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
      <View style={[styles.entete, { paddingTop: insets.top + spacing.md }]}>
        <Pressable
          testID="btn-retour-parametres"
          onPress={() => (vue === "menu" ? router.back() : setVue("menu"))}
          style={styles.iconeBtn}
        >
          <Icone name="arrow-left" size={20} color={colors.brandPrimary} />
        </Pressable>
        <Text style={styles.titre}>
          {vue === "profil" ? "Modifier le profil" : vue === "motdepasse" ? "Changer le mot de passe" : "Paramètres"}
        </Text>
      </View>

      <KeyboardAwareScrollView
        bottomOffset={60}
        contentContainerStyle={[styles.contenu, { paddingBottom: insets.bottom + spacing.xxxl }]}
      >
        {vue === "profil" ? (
          <View style={styles.carte}>
            <View style={styles.formulaire}>
              <Champ label="Nom" testID="input-profil-nom" value={nom} onChangeText={setNom} />
              <Champ
                label="Email"
                testID="input-profil-email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <Champ
                label="Téléphone"
                testID="input-profil-telephone"
                value={telephone}
                onChangeText={setTelephone}
                keyboardType="phone-pad"
              />
              <Bouton testID="btn-enregistrer-profil" label="Enregistrer" onPress={enregistrerProfil} />
            </View>
          </View>
        ) : vue === "motdepasse" ? (
          <View style={styles.carte}>
            <View style={styles.formulaire}>
              <Champ
                label="Mot de passe actuel"
                testID="input-mdp-actuel"
                value={actuel}
                onChangeText={setActuel}
                secureTextEntry
                autoCapitalize="none"
              />
              <Champ
                label="Nouveau mot de passe"
                testID="input-mdp-nouveau"
                value={nouveau}
                onChangeText={setNouveau}
                secureTextEntry
                autoCapitalize="none"
              />
              <Champ
                label="Confirmer le nouveau mot de passe"
                testID="input-mdp-confirme"
                value={confirme}
                onChangeText={setConfirme}
                secureTextEntry
                autoCapitalize="none"
              />
              <Bouton testID="btn-enregistrer-mdp" label="Modifier le mot de passe" onPress={enregistrerMotDePasse} />
            </View>
          </View>
        ) : (
          <>
            <Section titre="Mon compte">
              <Ligne
                testID="ligne-profil"
                icone="user"
                label="Modifier le profil"
                valeur={user?.nom}
                onPress={() => setVue("profil")}
              />
              <Ligne
                testID="ligne-motdepasse"
                icone="key"
                label="Changer le mot de passe"
                onPress={() => setVue("motdepasse")}
              />
            </Section>

            <Section titre="Commandes">
              <Ligne
                testID="ligne-archives"
                icone="package"
                label="Archives des commandes"
                valeur="Commandes livrées ou annulées archivées"
                onPress={() => router.push("/admin/archives")}
              />
            </Section>

            <Section titre="Boutique">
              <Ligne
                testID="ligne-taux"
                icone="repeat"
                label="Taux de change et catalogue"
                onPress={() => router.replace("/catalogue")}
              />
              <Ligne
                testID="ligne-zones"
                icone="map"
                label="Zones de livraison"
                onPress={() => router.replace("/zones")}
              />
              {estSuper ? (
                <Ligne
                  testID="ligne-personnel"
                  icone="users"
                  label="Comptes du personnel"
                  valeur="Réservé au super admin"
                  onPress={() => router.replace("/personnel")}
                />
              ) : null}
            </Section>

            <Bouton
              testID="btn-deconnexion-parametres"
              label="Se déconnecter"
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
  titre: { fontFamily: fonts.display, fontSize: 22, color: colors.onSurface },
  contenu: { paddingHorizontal: spacing.lg, gap: spacing.lg },
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
  ligneValeur: { fontFamily: fonts.text, fontSize: 12, color: colors.muted },
});
