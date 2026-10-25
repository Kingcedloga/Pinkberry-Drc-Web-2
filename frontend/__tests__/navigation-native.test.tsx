/**
 * Navigation sur mobile (iOS) : le vrai routeur expo-router et les vrais écrans
 * de app/, pilotés par des touchers sur les vrais boutons. API simulée.
 */
import { expect, test } from "@jest/globals";
import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import { renderRouter } from "expo-router/testing-library";

import { installerFausseApi } from "./fausse-api";

const CLE_JETON = "pb_token";

async function demarrer(role: "client" | "admin" | "superadmin" | "livreur" | null, stockage: Record<string, string> = {}) {
  (globalThis as any).__memoire.clear();
  if (role) (globalThis as any).__memoire.set(CLE_JETON, `jeton-${role}`);
  for (const [cle, valeur] of Object.entries(stockage)) (globalThis as any).__memoire.set(cle, valeur);
  installerFausseApi(role);
  await renderRouter("./app", { initialUrl: "/" });
}

/** Touche un bouton, puis exige la nouvelle adresse ET l'écran attendu à l'écran. */
async function toucher(bouton: string, chemin: string, ecran?: string) {
  const el = await screen.findByTestId(bouton, {}, { timeout: 8000 });
  await act(async () => {
    fireEvent.press(el);
  });
  await waitFor(() => expect(screen).toHavePathname(chemin), { timeout: 8000 });
  if (ecran) expect(await screen.findByTestId(ecran, {}, { timeout: 8000 })).toBeTruthy();
}

async function attendreAccueil(chemin: string, ecran: string) {
  await waitFor(() => expect(screen).toHavePathname(chemin), { timeout: 15000 });
  expect(await screen.findByTestId(ecran, {}, { timeout: 15000 })).toBeTruthy();
}

test("visiteur : bienvenue, carte, panier, connexion, inscription", async () => {
  await demarrer(null);
  await attendreAccueil("/bienvenue", "ecran-bienvenue");
  await toucher("btn-decouvrir-carte", "/menu", "ecran-menu");
  await toucher("btn-entete-panier", "/panier", "ecran-panier");
  await toucher("btn-se-connecter", "/connexion", "ecran-connexion");
  await toucher("lien-inscription", "/inscription", "ecran-inscription");
});

test("client : onglets, paramètres, archives, suivi", async () => {
  await demarrer("client");
  await attendreAccueil("/menu", "ecran-menu");
  await toucher("onglet-commandes", "/commandes", "ecran-commandes");
  await toucher("commande-PB-1234", "/suivi/cmd-1", "ecran-suivi");
  await toucher("onglet-compte", "/compte", "ecran-compte");
  await toucher("btn-parametres-client", "/parametres", "ecran-parametres-client");
  await toucher("ligne-client-archives", "/archives", "ecran-archives-client");
  await toucher("btn-entete-panier", "/panier", "ecran-panier");
  await toucher("onglet-menu", "/menu", "ecran-menu");
});

test("admin : back office complet", async () => {
  await demarrer("admin");
  await attendreAccueil("/admin", "ecran-admin-dashboard");
  await toucher("onglet-catalogue", "/admin/catalogue", "ecran-admin-catalogue");
  await toucher("onglet-zones", "/admin/zones", "ecran-admin-zones");
  await toucher("onglet-livreurs", "/admin/livreurs", "ecran-admin-livreurs");
  await toucher("onglet-commandes", "/admin", "ecran-admin-dashboard");
  await toucher("btn-admin-parametres", "/admin/parametres", "ecran-parametres");
  await toucher("ligne-rapports", "/admin/rapports", "ecran-rapports");
  await toucher("btn-retour-rapports", "/admin/parametres", "ecran-parametres");
  await toucher("ligne-archives", "/admin/archives", "ecran-archives");
});

test("livreur : courses, détail, rapports, archives, paramètres", async () => {
  await demarrer("livreur");
  await attendreAccueil("/livreur", "ecran-livreur-courses");
  await toucher("course-PB-1234", "/livreur/course/cmd-1", "ecran-course-detail");
  await toucher("onglet-rapports", "/livreur/rapports", "ecran-rapports");
  await toucher("onglet-archives", "/livreur/archives", "ecran-archives-livreur");
  await toucher("onglet-parametres", "/livreur/parametres", "ecran-parametres-livreur");
  await toucher("onglet-courses", "/livreur", "ecran-livreur-courses");
});

test("client : tunnel de commande panier -> adresse", async () => {
  const article = { cle: "a1", produitId: "p-1", nom: "Pot Original", taille: "Petit", garnitures: [], quantite: 1, prixUnitaire: 4.5 };
  await demarrer("client", { pb_panier: JSON.stringify({ articles: [article], codePromo: null }) });
  await attendreAccueil("/menu", "ecran-menu");
  await toucher("btn-entete-panier", "/panier", "ecran-panier");
  await toucher("btn-choisir-adresse", "/commande/adresse", "ecran-adresse");
});

test("visiteur : inscription -> conditions -> retour", async () => {
  await demarrer(null);
  await attendreAccueil("/bienvenue", "ecran-bienvenue");
  await toucher("btn-decouvrir-carte", "/menu", "ecran-menu");
  await toucher("btn-se-connecter", "/connexion", "ecran-connexion");
  await toucher("lien-inscription", "/inscription", "ecran-inscription");
  await toucher("lien-conditions-inscription", "/legal/conditions", "page-legale-conditions");
  await toucher("btn-retour-legal", "/inscription", "ecran-inscription");
});

test("garde toujours active : un visiteur sur une page réservée va à la connexion", async () => {
  (globalThis as any).__memoire.clear();
  installerFausseApi(null);
  await renderRouter("./app", { initialUrl: "/commandes" });
  await attendreAccueil("/connexion", "ecran-connexion");
  expect((globalThis as any).__memoire.get("pb_suite_connexion")).toBe("/commandes");
});

test("super admin : sous-pages du back office", async () => {
  await demarrer("superadmin");
  await attendreAccueil("/admin", "ecran-admin-dashboard");
  await toucher("onglet-catalogue", "/admin/catalogue", "ecran-admin-catalogue");
  await toucher("btn-composition", "/admin/composition", "ecran-admin-composition");
  for (const [ligne, chemin, ecran] of [
    ["ligne-bannieres", "/admin/bannieres", "ecran-admin-bannieres"],
    ["ligne-promotions", "/admin/promotions", "ecran-admin-promotions"],
    ["ligne-personnel", "/admin/personnel", "ecran-personnel"],
  ]) {
    await toucher("onglet-commandes", "/admin", "ecran-admin-dashboard");
    await toucher("btn-admin-parametres", "/admin/parametres", "ecran-parametres");
    await toucher(ligne, chemin, ecran);
  }
});

// Gardes : une adresse interdite mène toujours à un écran rendu (jamais une page vide).
test.each([
  [null, "/compte", "/connexion", "ecran-connexion"],
  [null, "/commande/adresse", "/connexion", "ecran-connexion"],
  [null, "/admin", "/bienvenue", "ecran-bienvenue"],
  [null, "/livreur", "/bienvenue", "ecran-bienvenue"],
  ["client", "/admin", "/menu", "ecran-menu"],
  ["client", "/livreur", "/menu", "ecran-menu"],
  ["admin", "/commandes", "/admin", "ecran-admin-dashboard"],
  ["livreur", "/menu", "/livreur", "ecran-livreur-courses"],
] as const)("garde : %s sur %s → %s", async (role, demande, attendu, ecran) => {
  (globalThis as any).__memoire.clear();
  if (role) (globalThis as any).__memoire.set(CLE_JETON, `jeton-${role}`);
  installerFausseApi(role);
  await renderRouter("./app", { initialUrl: demande });
  await attendreAccueil(attendu, ecran);
});
