/// <reference types="jest" />
/* global jest, describe, it, expect, beforeEach, afterEach */
/**
 * Rendu NATIF (iOS) de chaque page après navigation : l'app réelle (dossier
 * app/, layouts, gardes, providers) montée par expo-router. Une page « blanche »
 * (rien d'affiché) ou une erreur de rendu fait échouer le test.
 */
import { act, screen } from "@testing-library/react-native";
import { renderRouter } from "expo-router/testing-library";
import * as SecureStore from "expo-secure-store";

type Role = "client" | "admin" | "livreur" | null;
let roleConnecte: Role = null;

const UTILISATEURS: Record<Exclude<Role, null>, object> = {
  client: { id: "u1", nom: "Client Test", telephone: "0990000001", role: "client", verifie: true, preferences: { langue: "fr", theme: "clair" } },
  admin: { id: "u2", nom: "Admin Test", telephone: "0810000000", role: "admin", verifie: true, preferences: { langue: "fr", theme: "clair" } },
  livreur: { id: "u3", nom: "Livreur Test", telephone: "0820000001", role: "livreur", livreurId: "l1", verifie: true, preferences: { langue: "fr", theme: "clair" } },
};

const fetchDeBase = globalThis.fetch as jest.Mock;
const erreurs: string[] = [];

beforeEach(() => {
  erreurs.length = 0;
  jest.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    erreurs.push(args.map(String).join(" ").slice(0, 400));
  });
  jest.spyOn(SecureStore, "getItemAsync").mockImplementation(async () => (roleConnecte ? JSON.stringify("jeton-test") : null));
  globalThis.fetch = jest.fn(async (url: string, init?: RequestInit) => {
    if (String(url).endsWith("/auth/moi") && roleConnecte) {
      const corps = UTILISATEURS[roleConnecte];
      return { ok: true, status: 200, text: async () => JSON.stringify(corps), json: async () => corps } as any;
    }
    return fetchDeBase(url, init);
  }) as any;
});

afterEach(() => {
  jest.restoreAllMocks();
});

/** Laisse les promesses (session, requêtes, redirections) se résoudre (minuteries simulées). */
async function attendre() {
  for (let i = 0; i < 10; i++) {
    await act(async () => {
      await jest.advanceTimersByTimeAsync(100);
    });
  }
}

async function ouvrir(role: Role, chemin: string) {
  roleConnecte = role;
  jest.useFakeTimers();
  const rendu = await renderRouter("./app", { initialUrl: "/" });
  await attendre();
  await act(async () => {
    const { router } = require("expo-router");
    router.push(chemin);
  });
  await attendre();
  return rendu;
}

const PAGES: [Role, string, string][] = [
  [null, "/bienvenue", "ecran-bienvenue"],
  [null, "/menu", "ecran-menu"],
  [null, "/panier", "ecran-panier"],
  [null, "/connexion", "ecran-connexion"],
  [null, "/legal/confidentialite", "page-legale-confidentialite"],
  [null, "/legal/suppression-compte", "page-suppression-compte"],
  ["client", "/menu", "ecran-menu"],
  ["client", "/commandes", "ecran-commandes"],
  ["client", "/compte", "ecran-compte"],
  ["client", "/parametres", "ecran-parametres-client"],
  ["client", "/suivi/c1", "ecran-suivi"],
  ["admin", "/admin", "ecran-admin-dashboard"],
  ["admin", "/admin/catalogue", "ecran-admin-catalogue"],
  ["admin", "/admin/zones", "ecran-admin-zones"],
  ["admin", "/admin/parametres", "ecran-parametres"],
  ["livreur", "/livreur", "ecran-livreur-courses"],
  ["livreur", "/livreur/parametres", "ecran-parametres-livreur"],
];

// Navigations qui passent par une garde (redirection) : [rôle, demandé, attendu, écran attendu].
const REDIRECTIONS: [Role, string, string, string][] = [
  [null, "/commandes", "/connexion", "ecran-connexion"],
  [null, "/compte", "/connexion", "ecran-connexion"],
  [null, "/commande/adresse", "/connexion", "ecran-connexion"],
  [null, "/admin", "/bienvenue", "ecran-bienvenue"],
  [null, "/livreur", "/bienvenue", "ecran-bienvenue"],
  ["client", "/admin", "/menu", "ecran-menu"],
  ["client", "/livreur", "/menu", "ecran-menu"],
  ["admin", "/commandes", "/admin", "ecran-admin-dashboard"],
];

jest.setTimeout(30000);

describe("navigation native (iOS)", () => {
  it.each(PAGES)("%s → %s s'affiche", async (role, chemin, ecran) => {
    const rendu = await ouvrir(role, chemin);
    // La page demandée est bien rendue (pas d'écran blanc ni d'attente sans fin).
    expect(rendu.getPathname()).toBe(chemin === "/suivi/c1" ? "/suivi/c1" : chemin);
    expect(screen.queryByTestId(ecran)).not.toBeNull();
    const graves = erreurs.filter((e) => !/act\(|not wrapped in act|Warning:/.test(e));
    expect(graves).toEqual([]);
  });
  it.each(REDIRECTIONS)("%s → %s redirige vers %s (jamais d'écran vide)", async (role, chemin, attendu, ecran) => {
    const rendu = await ouvrir(role, chemin);
    expect(rendu.getPathname()).toBe(attendu);
    expect(screen.queryByTestId(ecran)).not.toBeNull();
  });
});
