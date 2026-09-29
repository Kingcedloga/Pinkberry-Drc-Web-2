type Traducteur = (cle: string, variables?: Record<string, string | number>) => string;

const CLES_CONTENU: Record<string, string> = {
  Tous: "catalogue.valeurs.toutesCategories",
  "Pots de crème": "catalogue.valeurs.potsDeCreme",
  Smoothies: "catalogue.valeurs.smoothies",
  Toppings: "catalogue.valeurs.garnituresCategorie",
  Boissons: "catalogue.valeurs.boissons",
  "Pot Original": "catalogue.valeurs.potOriginal",
  "Pot Fraise": "catalogue.valeurs.potFraise",
  "Pot Mangue": "catalogue.valeurs.potMangue",
  "Pot Chocolat": "catalogue.valeurs.potChocolat",
  "Smoothie Fraise-Banane": "catalogue.valeurs.smoothieFraiseBanane",
  "Smoothie Tropical": "catalogue.valeurs.smoothieTropical",
  "Granola croustillant": "catalogue.valeurs.granolaCroustillant",
  "Fruits frais coupés": "catalogue.valeurs.fruitsFraisCoupes",
  "Eau minérale 50cl": "catalogue.valeurs.eauMinerale",
  "Jus d'ananas": "catalogue.valeurs.jusAnanas",
  "Le classique pinkberry, yogourt glacé nature et acidulé.": "catalogue.valeurs.descriptionPotOriginal",
  "Frozen yogurt à la fraise de saison.": "catalogue.valeurs.descriptionPotFraise",
  "Mangue mûre et yogourt glacé onctueux.": "catalogue.valeurs.descriptionPotMangue",
  "Chocolat noir intense.": "catalogue.valeurs.descriptionPotChocolat",
  "Fraise, banane et yogourt.": "catalogue.valeurs.descriptionSmoothieFraiseBanane",
  "Ananas, mangue, passion.": "catalogue.valeurs.descriptionSmoothieTropical",
  "Portion supplémentaire de granola.": "catalogue.valeurs.descriptionGranola",
  "Assortiment de fruits du jour.": "catalogue.valeurs.descriptionFruits",
  "Bien fraîche.": "catalogue.valeurs.descriptionEau",
  "Pressé du jour.": "catalogue.valeurs.descriptionJus",
  Petit: "catalogue.petit",
  Moyen: "catalogue.moyen",
  Grand: "catalogue.grand",
  "Fruits frais": "catalogue.fruitsFrais",
  Granola: "catalogue.granola",
  "Coulis fraise": "catalogue.coulisFraise",
  "Pépites de chocolat": "catalogue.pepitesChocolat",
  Mochi: "catalogue.mochi",
};

export function traduireContenuCatalogue(valeur: string | null | undefined, t: Traducteur): string {
  if (!valeur) return "";
  const cle = CLES_CONTENU[valeur];
  return cle ? t(cle) : valeur;
}