// Plan de navigation de l'application web (URLs propres, pensées navigateur).

import type { CleTexte } from "@/src/i18n";

export type LienNav = {
  href: string;
  libelle: string;
  cle?: CleTexte;
  icone: string;
  /** Réservé au super admin. */
  superadmin?: boolean;
};

export const NAV_CLIENT: LienNav[] = [
  { href: "/menu", libelle: "Menu", cle: "nav.menu", icone: "home" },
  { href: "/commandes", libelle: "Mes commandes", cle: "nav.commandes", icone: "shopping-bag" },
  { href: "/compte", libelle: "Compte", cle: "nav.compte", icone: "user" },
];

export const NAV_ADMIN: LienNav[] = [
  { href: "/admin", libelle: "Commandes", cle: "nav.commandes", icone: "grid" },
  { href: "/admin/catalogue", libelle: "Catalogue", cle: "nav.catalogue", icone: "package" },
  { href: "/admin/zones", libelle: "Zones", cle: "nav.zones", icone: "map" },
  { href: "/admin/livreurs", libelle: "Livreurs", cle: "nav.livreurs", icone: "users" },
  { href: "/admin/personnel", libelle: "Personnel", cle: "nav.personnel", icone: "key", superadmin: true },
];

export const NAV_ADMIN_SECONDAIRE: LienNav[] = [
  { href: "/admin/promotions", libelle: "Promotions", cle: "nav.promotions", icone: "gift" },
  { href: "/admin/rapports", libelle: "Rapports", cle: "nav.rapports", icone: "download" },
  { href: "/admin/archives", libelle: "Archives", cle: "nav.archives", icone: "archive" },
  { href: "/admin/parametres", libelle: "Paramètres", cle: "nav.parametres", icone: "settings" },
];

export const NAV_LIVREUR: LienNav[] = [
  { href: "/livreur", libelle: "Mes courses", cle: "nav.courses", icone: "scooter" },
  { href: "/livreur/rapports", libelle: "Rapports", cle: "nav.rapports", icone: "download" },
  { href: "/livreur/archives", libelle: "Archives", cle: "nav.archives", icone: "archive" },
  { href: "/livreur/parametres", libelle: "Paramètres", cle: "nav.parametres", icone: "settings" },
];

/** Page d'accueil par rôle (redirections). */
export function accueilDuRole(role?: string) {
  if (role === "admin" || role === "superadmin") return "/admin";
  if (role === "livreur") return "/livreur";
  if (role === "client") return "/menu";
  return "/bienvenue";
}

/** Un lien est actif si l'URL courante lui correspond (exactement ou en sous-page). */
export function lienActif(pathname: string, href: string) {
  if (href === "/admin" || href === "/livreur" || href === "/menu") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}
