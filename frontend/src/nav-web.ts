// Plan de navigation de l'application web (URLs propres, pensées navigateur).

import type { CleTexte } from "@/src/i18n";

export type LienNav = {
  href: string;
  /** Identifiant stable (testID), jamais affiché : le libellé vient de `cle`. */
  id: string;
  cle: CleTexte;
  icone: string;
  /** Réservé au super admin. */
  superadmin?: boolean;
};

export const NAV_CLIENT: LienNav[] = [
  { href: "/menu", id: "menu", cle: "nav.menu", icone: "home" },
  { href: "/commandes", id: "commandes", cle: "nav.commandes", icone: "shopping-bag" },
  { href: "/compte", id: "compte", cle: "nav.compte", icone: "user" },
];

export const NAV_ADMIN: LienNav[] = [
  { href: "/admin", id: "commandes", cle: "nav.commandes", icone: "grid" },
  { href: "/admin/catalogue", id: "catalogue", cle: "nav.catalogue", icone: "package" },
  { href: "/admin/zones", id: "zones", cle: "nav.zones", icone: "map" },
  { href: "/admin/livreurs", id: "livreurs", cle: "nav.livreurs", icone: "users" },
  { href: "/admin/personnel", id: "personnel", cle: "nav.personnel", icone: "key", superadmin: true },
];

export const NAV_ADMIN_SECONDAIRE: LienNav[] = [
  { href: "/admin/promotions", id: "promotions", cle: "nav.promotions", icone: "gift" },
  { href: "/admin/bannieres", id: "bannieres", cle: "nav.bannieres", icone: "image" },
  { href: "/admin/rapports", id: "rapports", cle: "nav.rapports", icone: "download" },
  { href: "/admin/archives", id: "archives", cle: "nav.archives", icone: "archive" },
  { href: "/admin/parametres", id: "parametres", cle: "nav.parametres", icone: "settings" },
];

export const NAV_LIVREUR: LienNav[] = [
  { href: "/livreur", id: "courses", cle: "nav.courses", icone: "scooter" },
  { href: "/livreur/rapports", id: "rapports", cle: "nav.rapports", icone: "download" },
  { href: "/livreur/archives", id: "archives", cle: "nav.archives", icone: "archive" },
  { href: "/livreur/parametres", id: "parametres", cle: "nav.parametres", icone: "settings" },
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
