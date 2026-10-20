import { useQuery } from "@tanstack/react-query";
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Linking, Modal, Platform, StyleSheet, Text, View } from "react-native";

import { apiFetch } from "@/src/api";
import { Bouton } from "@/src/components/Bouton";
import { Icone } from "@/src/components/Icone";
import {
  distanceMetres,
  garderEcranAllume,
  lirePermission,
  positionActuelle,
  suivrePosition,
  surChangementPermission,
  type ErreurGps,
  type EtatPermission,
  type Fix,
} from "@/src/geoloc";
import { useT } from "@/src/i18n";
import { arreterSuiviFond, demarrerSuiviFond, etatPermissionFond } from "@/src/suivi-fond";
import { colors, fonts, radius, softShadow, spacing, stylesDynamiques } from "@/src/theme";
import { storage } from "@/src/utils/storage";

/**
 * Partage de position automatique du livreur. Tant qu'une de ses courses est
 * « en route », l'app suit le GPS (watchPosition) et envoie la position au
 * serveur ; elle s'arrête d'elle-même quand plus aucune course n'est en route
 * (livrée ou annulée). Aucun bouton à presser.
 */
const INTERVALLE_MS = 5000; // envoi au plus toutes les 5 s…
const DEPLACEMENT_M = 25; // …ou dès 25 m parcourus
const FIX_PERIME_MS = 15000; // sans nouvelle position depuis 15 s : on en redemande une
const SIGNAL_PERDU_MS = 30000; // au-delà, le GPS est considéré comme perdu
const CLE_EXPLICATION = "pb_gps_explique";

type Envoi = { lat: number; lng: number; at: number; fixAt: number };

type SuiviLivreur = {
  permission: EtatPermission;
  erreur: ErreurGps | null;
  /** Une course est en route : la position est émise. */
  active: boolean;
  /** Dernière position GPS reçue depuis moins de 30 s. */
  signalOk: boolean;
  /** Avant « en route » : autorisation + position de départ, ou null (message affiché). */
  preparerDepart: () => Promise<Fix | null>;
};

const Contexte = createContext<SuiviLivreur | null>(null);

export function useSuiviLivreur() {
  const c = useContext(Contexte);
  if (!c) throw new Error("useSuiviLivreur doit être utilisé dans SuiviLivreurProvider");
  return c;
}

export function SuiviLivreurProvider({ children }: { children: React.ReactNode }) {
  const [permission, setPermission] = useState<EtatPermission>("a_demander");
  const [erreur, setErreur] = useState<ErreurGps | null>(null);
  const [dernierFixAt, setDernierFixAt] = useState(0);
  const [maintenant, setMaintenant] = useState(0);
  const [explication, setExplication] = useState(false);
  // Natif : partage en arrière-plan (écran verrouillé) et explication préalable à l'autorisation « toujours ».
  const [fondActif, setFondActif] = useState(false);
  const [explicationFond, setExplicationFond] = useState(false);
  const fondPropose = useRef(false);
  const t = useT();
  const fix = useRef<Fix | null>(null);
  const envoi = useRef<Envoi | null>(null);
  const ponctuelEnCours = useRef(false);

  const courses = useQuery({
    queryKey: ["livreur-courses"],
    queryFn: () => apiFetch<{ id: string; statut: string }[]>("/livreur/courses"),
    refetchInterval: 10000,
  });
  const active = (courses.data ?? []).some((c) => c.statut === "en_route");

  const envoyer = useCallback(async (f: Fix) => {
    envoi.current = { lat: f.lat, lng: f.lng, at: Date.now(), fixAt: f.at };
    try {
      await apiFetch("/livreur/position", { method: "POST", body: { lat: f.lat, lng: f.lng } });
    } catch {
      envoi.current = null; // réseau coupé : renvoyé au prochain cycle
    }
  }, []);

  const recevoir = useCallback(
    (f: Fix, emettre: boolean) => {
      fix.current = f;
      setDernierFixAt(f.at);
      setErreur(null);
      setPermission("accordee");
      const e = envoi.current;
      if (emettre && (!e || Date.now() - e.at >= INTERVALLE_MS || distanceMetres(e, f) >= DEPLACEMENT_M)) {
        void envoyer(f);
      }
    },
    [envoyer],
  );

  const echouer = useCallback((e: ErreurGps) => {
    setErreur(e);
    if (e === "refusee") setPermission("refusee");
  }, []);

  // Permission au démarrage : explication une seule fois, à la première connexion.
  useEffect(() => {
    let vivant = true;
    (async () => {
      const etat = await lirePermission();
      if (!vivant) return;
      setPermission(etat);
      if (etat === "a_demander" && !(await storage.getItem<string>(CLE_EXPLICATION, ""))) setExplication(true);
    })();
    let arreter: () => void = () => undefined;
    void surChangementPermission((etat) => {
      setPermission(etat);
      if (etat === "accordee") setErreur(null);
    }).then((f) => (vivant ? (arreter = f) : f()));
    return () => {
      vivant = false;
      arreter();
    };
  }, []);

  // Émission continue tant qu'une course est en route ; arrêt complet sinon.
  useEffect(() => {
    if (!active || permission === "refusee" || permission === "indisponible") return;
    let arreterSuivi: () => void = () => undefined;
    let vivant = true;
    // En arrière-plan natif, c'est la tâche de fond qui envoie : ici on ne fait que suivre l'état du GPS.
    void suivrePosition((f) => recevoir(f, !fondActif), echouer).then((f) => (vivant ? (arreterSuivi = f) : f()));
    const liberer = garderEcranAllume();
    const minuterie = setInterval(() => {
      const f = fix.current;
      const e = envoi.current;
      setMaintenant(Date.now());
      // Position plus récente que le dernier envoi (filtrée par l'intervalle) : on l'envoie.
      if (!fondActif && f && (!e || f.at > e.fixAt) && (!e || Date.now() - e.at >= INTERVALLE_MS)) void envoyer(f);
      // Livreur immobile ou GPS muet : on redemande une position (et on détecte la perte du signal).
      if ((!f || Date.now() - f.at > FIX_PERIME_MS) && !ponctuelEnCours.current) {
        ponctuelEnCours.current = true;
        positionActuelle(10000)
          .then((p) => recevoir({ ...p, at: Date.now() }, !fondActif))
          .catch(echouer)
          .finally(() => (ponctuelEnCours.current = false));
      }
    }, INTERVALLE_MS);
    return () => {
      vivant = false;
      arreterSuivi();
      liberer();
      clearInterval(minuterie);
      fix.current = null;
      envoi.current = null;
    };
  }, [active, permission, recevoir, echouer, envoyer, fondActif]);

  const lancerFond = useCallback(async () => {
    const ok = await demarrerSuiviFond({ titre: t("livreur.fondNotificationTitre"), texte: t("livreur.fondNotificationTexte") });
    setFondActif(ok);
  }, [t]);

  // Natif : partage écran verrouillé pendant la course, arrêt complet sinon.
  useEffect(() => {
    if (Platform.OS === "web") return;
    if (!active || permission !== "accordee") {
      void arreterSuiviFond().then(() => setFondActif(false));
      return;
    }
    void etatPermissionFond().then((etat) => {
      if (etat === "accordee") void lancerFond();
      else if (etat === "a_demander" && !fondPropose.current) {
        fondPropose.current = true;
        setExplicationFond(true);
      }
    });
  }, [active, permission, lancerFond]);

  // Déconnexion : plus aucun partage.
  useEffect(() => () => void arreterSuiviFond(), []);

  // Natif : l'autorisation peut être rendue depuis les réglages ; on la relit.
  useEffect(() => {
    if (Platform.OS === "web" || permission !== "refusee") return;
    const id = setInterval(() => void lirePermission().then(setPermission), 5000);
    return () => clearInterval(id);
  }, [permission]);

  const preparerDepart = useCallback(async () => {
    try {
      const f = await positionActuelle(15000);
      recevoir(f, false); // envoyée avec le passage « en route »
      return f;
    } catch (e) {
      echouer(e as ErreurGps);
      return null;
    }
  }, [recevoir, echouer]);

  const fermerExplication = (autoriser: boolean) => {
    setExplication(false);
    void storage.setItem(CLE_EXPLICATION, "1");
    if (autoriser) void positionActuelle().then((f) => recevoir(f, false)).catch(echouer);
  };

  const signalOk = dernierFixAt > 0 && (maintenant || dernierFixAt) - dernierFixAt < SIGNAL_PERDU_MS;
  const valeur: SuiviLivreur = { permission, erreur, active, signalOk, preparerDepart };

  return (
    <Contexte.Provider value={valeur}>
      <View style={styles.cadre}>
        <BandeauGps />
        <View style={styles.contenu}>{children}</View>
      </View>
      <ExplicationGps visible={explication} onFermer={fermerExplication} />
      <ExplicationGps
        fond
        visible={explicationFond}
        onFermer={(autoriser) => {
          setExplicationFond(false);
          if (autoriser) void lancerFond();
        }}
      />
    </Contexte.Provider>
  );
}

/** Message à afficher pour un GPS refusé ou en panne (null si tout va bien). */
export function useMessageGps() {
  const t = useT();
  const { permission, erreur } = useSuiviLivreur();
  if (permission === "refusee" || erreur === "refusee") {
    return t(Platform.OS === "web" ? "livreur.gpsRefuseWeb" : "livreur.gpsRefuseNatif");
  }
  if (permission === "indisponible" || erreur === "indisponible") return t("livreur.gpsIndisponible");
  if (erreur === "delai") return t("livreur.gpsDelai");
  return null;
}

/** État du partage de position, en tête de toutes les pages du livreur. */
function BandeauGps() {
  const t = useT();
  const { active, permission, signalOk, preparerDepart } = useSuiviLivreur();
  const message = useMessageGps();
  const refusee = permission === "refusee";
  if (!active && !refusee) return null;

  const etat = refusee ? "refuse" : signalOk ? "ok" : message ? "erreur" : "recherche";
  const palette = {
    ok: { fond: colors.successSoft, texte: colors.success, icone: "navigation" },
    recherche: { fond: colors.brandTertiary, texte: colors.brandPrimary, icone: "crosshair" },
    erreur: { fond: colors.errorSoft, texte: colors.error, icone: "alert-triangle" },
    refuse: { fond: colors.errorSoft, texte: colors.error, icone: "alert-triangle" },
  }[etat];
  const texte =
    etat === "ok"
      ? t("livreur.gpsActifAuto")
      : etat === "recherche"
        ? t("livreur.gpsRecherche")
        : etat === "erreur" && active
          ? `${t("livreur.gpsPerdu")} ${message ?? ""}`
          : `${t("livreur.gpsRefuseTitre")} · ${message ?? ""}`;

  return (
    <View
      testID={`bandeau-gps-${etat}`}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[styles.bandeau, { backgroundColor: palette.fond }]}
    >
      <Icone name={palette.icone} size={16} color={palette.texte} />
      <Text style={[styles.bandeauTexte, { color: palette.texte }]}>{texte}</Text>
      {etat === "refuse" || etat === "erreur" ? (
        <Bouton
          testID="btn-gps-reessayer"
          petit
          variant="contour"
          label={Platform.OS === "web" || !refusee ? t("livreur.gpsReessayer") : t("livreur.ouvrirReglages")}
          onPress={() => (Platform.OS !== "web" && refusee ? Linking.openSettings() : void preparerDepart())}
        />
      ) : null}
    </View>
  );
}

/** Explication avant la fenêtre d'autorisation du système, une seule fois. */
function ExplicationGps({
  visible,
  onFermer,
  fond = false,
}: {
  visible: boolean;
  onFermer: (autoriser: boolean) => void;
  /** Explication de l'autorisation « toujours » (obligatoire avant la demande, Google Play). */
  fond?: boolean;
}) {
  const t = useT();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => onFermer(false)}>
      <View style={styles.voile}>
        <View testID={fond ? "modale-gps-fond" : "modale-gps"} style={styles.modale} accessibilityViewIsModal>
          <View style={styles.pastille}>
            <Icone name="map-pin" size={26} color={colors.onBrandPrimary} />
          </View>
          <Text style={styles.titre}>{t(fond ? "livreur.fondExplicationTitre" : "livreur.gpsExplicationTitre")}</Text>
          <Text style={styles.texte}>{t(fond ? "livreur.fondExplication" : "livreur.gpsExplication")}</Text>
          {fond ? <Text style={styles.texte}>{t("livreur.fondConsigne")}</Text> : null}
          <Bouton
            testID={fond ? "btn-gps-fond-autoriser" : "btn-gps-autoriser"}
            label={t(fond ? "livreur.fondAutoriser" : "livreur.gpsAutoriser")}
            icone="map-pin"
            onPress={() => onFermer(true)}
          />
          <Bouton testID="btn-gps-plus-tard" label={t("auth.plusTard")} variant="contour" onPress={() => onFermer(false)} />
        </View>
      </View>
    </Modal>
  );
}

const styles = stylesDynamiques(() =>
  StyleSheet.create({
    cadre: { flex: 1 },
    contenu: { flex: 1 },
    bandeau: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
    },
    bandeauTexte: { flex: 1, minWidth: 180, fontFamily: fonts.text, fontSize: 13, fontWeight: "800" },
    voile: {
      flex: 1,
      backgroundColor: "rgba(20,10,16,0.55)",
      alignItems: "center",
      justifyContent: "center",
      padding: spacing.lg,
    },
    modale: {
      width: "100%",
      maxWidth: 400,
      backgroundColor: colors.surface,
      borderRadius: radius.xl,
      padding: spacing.xl,
      gap: spacing.md,
      alignItems: "stretch",
      ...softShadow,
    },
    pastille: {
      alignSelf: "center",
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.brandPrimary,
      alignItems: "center",
      justifyContent: "center",
    },
    titre: { textAlign: "center", fontFamily: fonts.display, fontSize: 20, color: colors.onSurface },
    texte: { textAlign: "center", fontFamily: fonts.text, fontSize: 14, lineHeight: 21, color: colors.muted },
  }),
);
