// Plan de navigation de l'application web (URLs propres, pensées navigateur).

export type LienNav = {
  href: string;
  libelle: string;
  icone: string;
  /** Réservé au super admin. */
  superadmin?: boolean;
};

export const NAV_CLIENT: LienNav[] = [
  { href: "/menu", libelle: "Menu", icone: "home" },
  { href: "/commandes", libelle: "Mes commandes", icone: "shopping-bag" },
  { href: "/compte", libelle: "Compte", icone: "user" },
];

export const NAV_ADMIN: LienNav[] = [
  { href: "/admin", libelle: "Commandes", icone: "grid" },
  { href: "/admin/catalogue", libelle: "Catalogue", icone: "package" },
  { href: "/admin/zones", libelle: "Zones", icone: "map" },
  { href: "/admin/livreurs", libelle: "Livreurs", icone: "users" },
  { href: "/admin/personnel", libelle: "Personnel", icone: "key", superadmin: true },
];

export const NAV_ADMIN_SECONDAIRE: LienNav[] = [
  { href: "/admin/rapports", libelle: "Rapports", icone: "download" },
  { href: "/admin/archives", libelle: "Archives", icone: "archive" },
  { href: "/admin/parametres", libelle: "Paramètres", icone: "settings" },
];

export const NAV_LIVREUR: LienNav[] = [
  { href: "/livreur", libelle: "Mes courses", icone: "scooter" },
  { href: "/livreur/rapports", libelle: "Rapports", icone: "download" },
  { href: "/livreur/archives", libelle: "Archives", icone: "archive" },
  { href: "/livreur/parametres", libelle: "Paramètres", icone: "settings" },
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
