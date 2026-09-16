import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { apiFetch } from "@/src/api";
import { useAuth } from "@/src/auth";
import { CLE_LANGUE } from "@/src/prefs";
import { storage } from "@/src/utils/storage";

export type Langue = "fr" | "en";

/**
 * Traductions de l'espace client. Pour traduire un nouvel écran : ajouter les
 * clés ici (fr ET en) puis remplacer les textes par `t("ma.cle")`.
 */
const FR = {
  "langue.nom": "Français",
  "langue.autre": "English",

  "onglet.accueil": "Accueil",
  "onglet.commandes": "Commandes",
  "onglet.compte": "Compte",

  "commun.enregistrer": "Enregistrer",
  "commun.annuler": "Annuler",
  "commun.retour": "Retour",
  "commun.supprimer": "Supprimer",
  "commun.archiver": "Archiver",
  "commun.desarchiver": "Désarchiver",
  "commun.chargement": "Chargement...",

  "compte.parametres": "Paramètres",
  "compte.parametresDetail": "Langue, notifications, profil",
  "compte.mesCommandes": "Mes commandes",
  "compte.deconnexion": "Se déconnecter",
  "compte.supprimerCompte": "Supprimer mon compte",
  "compte.paiement": "Paiement en espèces à la livraison",
  "compte.livraison": "Livraison en 25 à 45 minutes",
  "compte.zones": "Zones de livraison couvertes",

  "params.titre": "Paramètres",
  "params.langue": "Langue",
  "params.notifications": "Notifications",
  "params.notifSuivi": "Suivi de commande",
  "params.notifSuiviDetail": "Préparation, départ du livreur et livraison",
  "params.notifPromos": "Promotions",
  "params.notifPromosDetail": "Offres et réductions Pinkberry",
  "params.notifNouveautes": "Nouveautés du menu",
  "params.notifNouveautesDetail": "Nouveaux parfums et garnitures",
  "params.monCompte": "Mon compte",
  "params.profil": "Modifier le profil",
  "params.motdepasse": "Changer le mot de passe",
  "params.historique": "Historique",
  "params.archives": "Commandes archivées",
  "params.archivesDetail": "Vos commandes terminées mises de côté",
  "params.partage": "Partager l'application",
  "params.partageDetail": "Invitez vos amis à commander",
  "params.enregistre": "Préférences enregistrées",
  "params.profilTitre": "Modifier le profil",
  "params.nom": "Nom",
  "params.email": "Email",
  "params.telephone": "Téléphone",
  "params.profilOk": "Profil mis à jour",
  "params.mdpTitre": "Changer le mot de passe",
  "params.mdpActuel": "Mot de passe actuel",
  "params.mdpNouveau": "Nouveau mot de passe",
  "params.mdpConfirme": "Confirmer le nouveau mot de passe",
  "params.mdpValider": "Modifier le mot de passe",
  "params.mdpOk": "Mot de passe modifié",
  "params.mdpCourt": "Mot de passe : 6 caractères minimum",
  "params.mdpDifferent": "Les deux mots de passe ne correspondent pas",
  "params.partageMessage":
    "Commande ton frozen yogurt Pinkberry à Kinshasa, livré chez toi en 25 à 45 minutes !",

  "commandes.titre": "Mes commandes",
  "commandes.vide": "Aucune commande pour le moment",
  "commandes.voirCarte": "Voir la carte",
  "commandes.archives": "Archives",
  "commandes.archiveOk": "Commande archivée",
  "commandes.archivesTitre": "Commandes archivées",
  "commandes.archivesVide": "Aucune commande archivée",
  "commandes.supprimerTitre": "Supprimer cette commande ?",
  "commandes.supprimerTexte":
    "Elle disparaîtra définitivement de votre historique. La boutique la conserve pour sa comptabilité.",
  "commandes.supprimeOk": "Commande supprimée de votre historique",
  "commandes.desarchiveOk": "Commande remise dans l'historique",

  "statut.recue": "Commande reçue",
  "statut.en_preparation": "En préparation",
  "statut.recuperee": "Récupérée par le livreur",
  "statut.en_route": "Livreur en route",
  "statut.livree": "Livrée",
  "statut.annulee": "Annulée",

  "accueil.rechercher": "Rechercher un pot, un smoothie…",
  "accueil.erreur": "Impossible de charger le catalogue",
  "accueil.recharger": "Recharger",
  "accueil.recommander": "Recommander",
  "accueil.aNouveau": "Commander à nouveau",
  "accueil.recommande": "Recommandé",
  "accueil.recommandeAccroche": "Les coups de cœur Pinkberry",
  "accueil.notreCarte": "Notre carte",
  "accueil.aucunProduit": "Aucun produit dans cette catégorie",
  "accueil.rupture": "En rupture",
  "accueil.voirPanier": "Voir mon panier",
  "accueil.ajoute": "Ajouté au panier",
  "accueil.panierRempli": "Panier rempli avec votre ancienne commande",

  "panier.titre": "Mon panier",
  "panier.vide": "Votre panier est vide",
  "panier.retourCatalogue": "Retour au catalogue",
  "panier.sansOption": "Sans option",
  "panier.sousTotal": "Sous-total ({n} articles)",
  "panier.choisirAdresse": "Choisir l\'adresse de livraison",

  "adresse.titre": "Adresse de livraison",
  "adresse.gpsOk": "Position GPS enregistrée",
  "adresse.gpsUtiliser": "Utiliser ma position actuelle",
  "adresse.gpsBloque": "L\'accès à la position est bloqué. Activez-le dans les réglages ou saisissez l\'adresse à la main.",
  "adresse.gpsRefuse": "Position refusée, saisissez l\'adresse manuellement",
  "adresse.ouvrirReglages": "Ouvrir les réglages",
  "adresse.commune": "Commune",
  "adresse.choisirCommune": "Choisir votre commune",
  "adresse.choisirCommuneTitre": "Choisir la commune",
  "adresse.couverte": "Couverte",
  "adresse.nonCouverte": "Non couverte",
  "adresse.onLivre": "Super, on livre à {commune} !",
  "adresse.onLivrePas": "Désolé, on ne livre pas encore à {commune}.",
  "adresse.zonesCouvertes": "Zones couvertes : {zones}",
  "adresse.avenue": "Avenue / Rue",
  "adresse.numero": "Numéro",
  "adresse.nomAdresse": "Nom de l\'adresse",
  "adresse.maison": "Maison",
  "adresse.bureau": "Bureau",
  "adresse.autre": "Autre",
  "adresse.repere": "Point de repère (important)",
  "adresse.reperePlaceholder": "Ex. près de la pharmacie Kin, en face de l\'école",
  "adresse.telephone": "Téléphone de contact",
  "adresse.continuer": "Continuer",

  "confirmation.titre": "Confirmer la commande",
  "confirmation.livraisonA": "Livraison à {label}",
  "confirmation.repere": "Repère : {repere}",
  "confirmation.contact": "Contact : {telephone}",
  "confirmation.vosArticles": "Vos articles",
  "confirmation.cash": "Paiement à la livraison (cash)",
  "confirmation.sousTotal": "Sous-total",
  "confirmation.frais": "Frais de livraison",
  "confirmation.total": "Total à payer",
  "confirmation.passer": "Passer la commande",
  "confirmation.adresseManquante": "Adresse manquante",
  "confirmation.envoyee": "Commande {numero} envoyée !",

  "suivi.arrive": "Le livreur est arrivé",
  "suivi.montantEspeces": "Montant à régler en espèces",
  "suivi.jaiPaye": "J\'ai payé le livreur",
  "suivi.progression": "Progression",
  "suivi.annulee": "Commande annulée",
  "suivi.votreLivreur": "Votre livreur",
  "suivi.attenteLivreur": "Un livreur vous sera assigné dans quelques instants…",
  "suivi.detail": "Détail",
  "suivi.frais": "Frais de livraison",
  "suivi.total": "Total",
  "suivi.annuler": "Annuler la commande",
  "suivi.annulerTitre": "Annuler la commande ?",
  "suivi.annulerTexte": "Cette action est définitive. Votre panier ne sera pas rétabli.",
  "suivi.ouiAnnuler": "Oui, annuler",
  "suivi.nonGarder": "Non, garder",
  "suivi.merci": "Merci pour votre commande !",

  "etape.recue": "Commande reçue",
  "etape.en_preparation": "En préparation",
  "etape.en_route": "Livreur en route",
  "etape.livree": "Livré",

  "admin.titre": "Paramètres",
  "admin.commandes": "Commandes",
  "admin.boutique": "Boutique",
  "admin.rapports": "Rapport des commandes",
  "admin.rapportsDetail": "Excel ou PDF par période",
  "admin.archives": "Archives des commandes",
  "admin.archivesDetail": "Commandes livrées ou annulées archivées",
  "admin.taux": "Taux de change et catalogue",
  "admin.zones": "Zones de livraison",
  "admin.personnel": "Comptes du personnel",
  "admin.personnelDetail": "Réservé au super admin",
};

const EN: Record<keyof typeof FR, string> = {
  "langue.nom": "English",
  "langue.autre": "Français",

  "onglet.accueil": "Home",
  "onglet.commandes": "Orders",
  "onglet.compte": "Account",

  "commun.enregistrer": "Save",
  "commun.annuler": "Cancel",
  "commun.retour": "Back",
  "commun.supprimer": "Delete",
  "commun.archiver": "Archive",
  "commun.desarchiver": "Unarchive",
  "commun.chargement": "Loading...",

  "compte.parametres": "Settings",
  "compte.parametresDetail": "Language, notifications, profile",
  "compte.mesCommandes": "My orders",
  "compte.deconnexion": "Sign out",
  "compte.supprimerCompte": "Delete my account",
  "compte.paiement": "Cash payment on delivery",
  "compte.livraison": "Delivery in 25 to 45 minutes",
  "compte.zones": "Delivery areas covered",

  "params.titre": "Settings",
  "params.langue": "Language",
  "params.notifications": "Notifications",
  "params.notifSuivi": "Order updates",
  "params.notifSuiviDetail": "Preparation, rider on the way and delivery",
  "params.notifPromos": "Promotions",
  "params.notifPromosDetail": "Pinkberry offers and discounts",
  "params.notifNouveautes": "New on the menu",
  "params.notifNouveautesDetail": "New flavours and toppings",
  "params.monCompte": "My account",
  "params.profil": "Edit profile",
  "params.motdepasse": "Change password",
  "params.historique": "History",
  "params.archives": "Archived orders",
  "params.archivesDetail": "Your completed orders set aside",
  "params.partage": "Share the app",
  "params.partageDetail": "Invite your friends to order",
  "params.enregistre": "Preferences saved",
  "params.profilTitre": "Edit profile",
  "params.nom": "Name",
  "params.email": "Email",
  "params.telephone": "Phone",
  "params.profilOk": "Profile updated",
  "params.mdpTitre": "Change password",
  "params.mdpActuel": "Current password",
  "params.mdpNouveau": "New password",
  "params.mdpConfirme": "Confirm new password",
  "params.mdpValider": "Change password",
  "params.mdpOk": "Password changed",
  "params.mdpCourt": "Password: 6 characters minimum",
  "params.mdpDifferent": "The two passwords do not match",
  "params.partageMessage": "Order your Pinkberry frozen yogurt in Kinshasa, delivered in 25 to 45 minutes!",

  "commandes.titre": "My orders",
  "commandes.vide": "No order yet",
  "commandes.voirCarte": "See the menu",
  "commandes.archives": "Archive",
  "commandes.archiveOk": "Order archived",
  "commandes.archivesTitre": "Archived orders",
  "commandes.archivesVide": "No archived order",
  "commandes.supprimerTitre": "Delete this order?",
  "commandes.supprimerTexte":
    "It will disappear from your history for good. The shop keeps it for its own accounting.",
  "commandes.supprimeOk": "Order removed from your history",
  "commandes.desarchiveOk": "Order moved back to your history",

  "statut.recue": "Order received",
  "statut.en_preparation": "Being prepared",
  "statut.recuperee": "Picked up by the rider",
  "statut.en_route": "Rider on the way",
  "statut.livree": "Delivered",
  "statut.annulee": "Cancelled",

  "accueil.rechercher": "Search a cup, a smoothie…",
  "accueil.erreur": "Could not load the menu",
  "accueil.recharger": "Reload",
  "accueil.recommander": "Order again",
  "accueil.aNouveau": "Order again",
  "accueil.recommande": "Recommended",
  "accueil.recommandeAccroche": "Pinkberry favourites",
  "accueil.notreCarte": "Our menu",
  "accueil.aucunProduit": "No product in this category",
  "accueil.rupture": "Out of stock",
  "accueil.voirPanier": "View my cart",
  "accueil.ajoute": "Added to cart",
  "accueil.panierRempli": "Cart filled with your previous order",

  "panier.titre": "My cart",
  "panier.vide": "Your cart is empty",
  "panier.retourCatalogue": "Back to the menu",
  "panier.sansOption": "No option",
  "panier.sousTotal": "Subtotal ({n} items)",
  "panier.choisirAdresse": "Choose the delivery address",

  "adresse.titre": "Delivery address",
  "adresse.gpsOk": "GPS location saved",
  "adresse.gpsUtiliser": "Use my current location",
  "adresse.gpsBloque": "Location access is blocked. Enable it in the settings or type the address manually.",
  "adresse.gpsRefuse": "Location denied, please type the address manually",
  "adresse.ouvrirReglages": "Open settings",
  "adresse.commune": "District",
  "adresse.choisirCommune": "Choose your district",
  "adresse.choisirCommuneTitre": "Choose the district",
  "adresse.couverte": "Covered",
  "adresse.nonCouverte": "Not covered",
  "adresse.onLivre": "Great, we deliver to {commune}!",
  "adresse.onLivrePas": "Sorry, we do not deliver to {commune} yet.",
  "adresse.zonesCouvertes": "Covered areas: {zones}",
  "adresse.avenue": "Street / Avenue",
  "adresse.numero": "Number",
  "adresse.nomAdresse": "Address name",
  "adresse.maison": "Home",
  "adresse.bureau": "Office",
  "adresse.autre": "Other",
  "adresse.repere": "Landmark (important)",
  "adresse.reperePlaceholder": "E.g. next to Kin pharmacy, facing the school",
  "adresse.telephone": "Contact phone",
  "adresse.continuer": "Continue",

  "confirmation.titre": "Confirm the order",
  "confirmation.livraisonA": "Delivery to {label}",
  "confirmation.repere": "Landmark: {repere}",
  "confirmation.contact": "Contact: {telephone}",
  "confirmation.vosArticles": "Your items",
  "confirmation.cash": "Payment on delivery (cash)",
  "confirmation.sousTotal": "Subtotal",
  "confirmation.frais": "Delivery fee",
  "confirmation.total": "Total to pay",
  "confirmation.passer": "Place the order",
  "confirmation.adresseManquante": "Address missing",
  "confirmation.envoyee": "Order {numero} sent!",

  "suivi.arrive": "The rider has arrived",
  "suivi.montantEspeces": "Amount to pay in cash",
  "suivi.jaiPaye": "I paid the rider",
  "suivi.progression": "Progress",
  "suivi.annulee": "Order cancelled",
  "suivi.votreLivreur": "Your rider",
  "suivi.attenteLivreur": "A rider will be assigned in a few moments…",
  "suivi.detail": "Details",
  "suivi.frais": "Delivery fee",
  "suivi.total": "Total",
  "suivi.annuler": "Cancel the order",
  "suivi.annulerTitre": "Cancel the order?",
  "suivi.annulerTexte": "This cannot be undone. Your cart will not be restored.",
  "suivi.ouiAnnuler": "Yes, cancel",
  "suivi.nonGarder": "No, keep it",
  "suivi.merci": "Thanks for your order!",

  "etape.recue": "Order received",
  "etape.en_preparation": "Being prepared",
  "etape.en_route": "Rider on the way",
  "etape.livree": "Delivered",

  "admin.titre": "Settings",
  "admin.commandes": "Orders",
  "admin.boutique": "Shop",
  "admin.rapports": "Orders report",
  "admin.rapportsDetail": "Excel or PDF by period",
  "admin.archives": "Archived orders",
  "admin.archivesDetail": "Delivered or cancelled orders set aside",
  "admin.taux": "Exchange rate and menu",
  "admin.zones": "Delivery areas",
  "admin.personnel": "Staff accounts",
  "admin.personnelDetail": "Super admin only",
};

export type CleTexte = keyof typeof FR;

const DICTIONNAIRES: Record<Langue, Record<CleTexte, string>> = { fr: FR, en: EN };

export type Preferences = {
  langue: Langue;
  notifSuivi: boolean;
  notifPromos: boolean;
  notifNouveautes: boolean;
};

export const PREFS_DEFAUT: Preferences = {
  langue: "fr",
  notifSuivi: true,
  notifPromos: true,
  notifNouveautes: true,
};

type LangueValue = {
  prefs: Preferences;
  langue: Langue;
  t: (cle: CleTexte, vars?: Record<string, string | number>) => string;
  enregistrerPrefs: (maj: Partial<Preferences>) => Promise<void>;
};

const LangueContext = createContext<LangueValue | null>(null);

export function LangueProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<Preferences>(PREFS_DEFAUT);

  // 1. Reprise immédiate du choix local (avant même la connexion).
  useEffect(() => {
    (async () => {
      const locale = await storage.getItem<string>(CLE_LANGUE, "");
      if (locale === "fr" || locale === "en") setPrefs((p) => ({ ...p, langue: locale }));
    })();
  }, []);

  // 2. Les préférences du compte font foi dès qu'on connaît l'utilisateur.
  useEffect(() => {
    const distantes = (user as any)?.preferences as Preferences | undefined;
    if (distantes) {
      setPrefs({ ...PREFS_DEFAUT, ...distantes });
      storage.setItem(CLE_LANGUE, distantes.langue ?? "fr");
    }
  }, [user]);

  const enregistrerPrefs = useCallback(
    async (maj: Partial<Preferences>) => {
      const suivantes = { ...prefs, ...maj };
      setPrefs(suivantes);
      await storage.setItem(CLE_LANGUE, suivantes.langue);
      if (user) await apiFetch("/auth/preferences", { method: "PUT", body: suivantes });
    },
    [prefs, user],
  );

  const value = useMemo<LangueValue>(
    () => ({
      prefs,
      langue: prefs.langue,
      t: (cle: CleTexte, vars?: Record<string, string | number>) => {
        const brut = DICTIONNAIRES[prefs.langue][cle] ?? DICTIONNAIRES.fr[cle] ?? cle;
        if (!vars) return brut;
        return Object.keys(vars).reduce((texte, k) => texte.split(`{${k}}`).join(String(vars[k])), brut);
      },
      enregistrerPrefs,
    }),
    [prefs, enregistrerPrefs],
  );

  return <LangueContext.Provider value={value}>{children}</LangueContext.Provider>;
}

export function useLangue(): LangueValue {
  const ctx = useContext(LangueContext);
  if (!ctx) throw new Error("useLangue doit être utilisé dans LangueProvider");
  return ctx;
}

/** Raccourci : `const t = useT();` puis `t("params.titre")`. */
export function useT() {
  return useLangue().t;
}
