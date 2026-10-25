/* global jest */
// API factice : répond aux routes appelées par l'app, sans jamais joindre le vrai backend.

const prefs = { langue: "fr", theme: "clair", notifSuivi: true, notifPromos: true, notifNouveautes: true };

export const UTILISATEURS = {
  client: { id: "u-client", nom: "Cliente Test", telephone: "0990000001", email: "c@test.cd", role: "client", verifie: true, actif: true, preferences: prefs },
  admin: { id: "u-admin", nom: "Admin Test", telephone: "0810000000", email: "a@test.cd", role: "admin", verifie: true, actif: true, preferences: prefs },
  superadmin: { id: "u-super", nom: "Super Test", telephone: "0810000009", email: "s@test.cd", role: "superadmin", verifie: true, actif: true, preferences: prefs },
  livreur: { id: "u-livreur", nom: "Livreur Test", telephone: "0820000001", role: "livreur", livreurId: "lv-1", verifie: true, actif: true, preferences: prefs },
};

const produit = {
  id: "p-1", nom: "Pot Original", categorie: "Pots de crème", prix: 4.5, emoji: "🍦", image: null,
  description: "Classique", disponible: true, enAvant: true,
  tailles: [{ nom: "Petit", ecart: 0 }], garnitures: [{ nom: "Granola", prix: 0.75 }],
};

const commande = {
  id: "cmd-1", numero: "PB-1234", userId: "u-client", clientNom: "Cliente Test", clientTelephone: "0990000001",
  adresse: { label: "Maison", commune: "Gombe", avenue: "Av. Test", numero: "1", repere: "Près du marché", telephone: "0990000001", lat: -4.32, lng: 15.31 },
  items: [{ produitId: "p-1", nom: "Pot Original", taille: "Petit", garnitures: [], quantite: 1, prixUnitaire: 4.5, emoji: "🍦" }],
  sousTotal: 4.5, fraisLivraison: 2.5, total: 7, statut: "en_route", livreurId: "lv-1",
  livreur: { id: "lv-1", nom: "Livreur Test", telephone: "0820000001", vehicule: "Moto", plaque: "KIN 1", note: 5 },
  positionLivreur: { livreurId: "lv-1", lat: -4.31, lng: 15.3, updatedAt: new Date().toISOString() },
  paiement: { mode: "cash", statut: "a_la_livraison" }, paye: false, cashEncaisse: false,
  createdAt: new Date().toISOString(), historique: [{ statut: "recue", at: new Date().toISOString() }],
};

function reponse(chemin, role) {
  const p = chemin.split("?")[0];
  if (p === "/auth/moi") return role ? UTILISATEURS[role] : { __statut: 401, detail: "Non authentifie" };
  if (p === "/config") return { tauxFC: 2800, fraisLivraison: 2.5, demo: false };
  if (p === "/produits") return [produit];
  if (p === "/categories")
    return chemin.includes("details=true") ? [{ nom: "Pots de crème", sousCategories: [] }] : ["Tous", "Pots de crème"];
  if (p === "/zones") return [{ id: "z-1", commune: "Gombe", active: true }];
  if (p === "/composition") return { tailles: [], contenants: [], categories: [], regle: { total: 0 } };
  if (p === "/notifications") return { notifications: [], nonLues: 0 };
  if (p === "/promotions/actives" || p === "/bannieres") return [];
  if (p === "/commandes/mes" || p === "/commandes/mes/archives") return [commande];
  if (/^\/commandes\/[^/]+$/.test(p)) return commande;
  if (p === "/livreur/courses" || p === "/livreur/courses/archives") return [commande];
  if (p === "/admin/commandes" || p === "/admin/commandes/archives") return [commande];
  if (p === "/admin/stats") return { total: 1, enCours: 1, livrees: 0, annulees: 0, revenus: 0 };
  if (p === "/admin/ventes") return { date: "2026-10-25", chiffre: 0, nbCommandes: 0, panierMoyen: 0, topProduits: [] };
  if (p === "/paiements/operateurs") return { operateurs: [], devises: ["CDF", "USD"], actif: false };
  if (p === "/push/web/etat") return { abonnements: 0 };
  if (p === "/carte/itineraire") return { points: [], distanceMetres: 0, etaSecondes: 0, heureArrivee: null };
  return [];
}

/** Installe la fausse API pour un rôle (null = visiteur). Renvoie la liste des appels. */
export function installerFausseApi(role) {
  const appels = [];
  global.fetch = jest.fn(async (url, opts = {}) => {
    const chemin = String(url).replace(/^.*?\/api/, "");
    appels.push(`${opts.method || "GET"} ${chemin}`);
    const corps = reponse(chemin, role);
    const statut = corps && corps.__statut ? corps.__statut : 200;
    const texte = JSON.stringify(corps);
    return {
      ok: statut < 400,
      status: statut,
      headers: { get: () => "application/json" },
      text: async () => texte,
      json: async () => JSON.parse(texte),
    };
  });
  return appels;
}
