/** Types communs aux deux variantes de chaque adaptateur (natif / web). */

/**
 * Notifications système (push), quelle que soit la plateforme :
 * - non_supporte : impossible ici (simulateur, navigateur sans Push) ;
 * - a_installer : iPhone dans Safari, l'app doit d'abord être ajoutée à l'écran d'accueil ;
 * - a_demander : la demande d'autorisation peut être affichée ;
 * - actives : autorisées et appareil enregistré ;
 * - bloquees : refusées, la demande ne peut plus s'afficher.
 */
export type StatutNotifs = "non_supporte" | "a_installer" | "a_demander" | "actives" | "bloquees";

/** Position GPS reçue. */
export type Fix = { lat: number; lng: number; precision: number | null; at: number };
/** `a_demander` : jamais demandée ; `refusee` : refusée ou retirée ; `indisponible` : pas de GPS. */
export type EtatPermission = "accordee" | "a_demander" | "refusee" | "indisponible";
export type ErreurGps = "refusee" | "indisponible" | "delai";

/** Textes de l'explication du partage écran verrouillé (clés de traduction). */
export type TextesFond = { explication: "livreur.fondExplication" | "livreur.fondExplicationAndroid"; consigne: "livreur.fondConsigne" | null };
