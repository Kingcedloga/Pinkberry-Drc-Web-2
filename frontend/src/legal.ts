import type { Langue } from "@/src/i18n";

export type SectionLegale = { titre: string; paragraphes: string[] };
export type DocumentLegal = { titre: string; maj: string; intro: string; sections: SectionLegale[] };

export const MAJ_LEGALE = "22 septembre 2026";
export const EMAIL_LEGAL = "contact@pinkberry.cd";

const CONFIDENTIALITE_FR: DocumentLegal = {
  titre: "Politique de confidentialité",
  maj: `Dernière mise à jour : ${MAJ_LEGALE}`,
  intro:
    "Pinkberry Drc (« nous ») exploite l'application de livraison Pinkberry à Kinshasa. Cette politique explique quelles données personnelles nous collectons, pourquoi, comment nous les utilisons et quels sont vos droits.",
  sections: [
    {
      titre: "1. Données que nous collectons",
      paragraphes: [
        "• Identité et contact : nom complet, numéro de téléphone, adresse email (facultative).",
        "• Livraison : adresse (commune, avenue, numéro), point de repère et position GPS que vous nous transmettez ou ajustez sur la carte.",
        "• Commandes : historique des commandes, articles, tailles et garnitures choisies, montants, statut de livraison et livreur affecté.",
        "• Paiement : mode de paiement choisi (espèces à la livraison ou Mobile Money), opérateur, devise, montant et référence de transaction. Nous conservons uniquement les quatre derniers chiffres du numéro de portefeuille et ne stockons jamais votre code PIN.",
        "• Technique : identifiant d'appareil pour les notifications, langue et thème choisis, journaux techniques nécessaires au bon fonctionnement du service.",
      ],
    },
    {
      titre: "2. Pourquoi nous collectons ces données",
      paragraphes: [
        "• Créer et sécuriser votre compte, vérifier votre numéro par un code à usage unique.",
        "• Préparer, livrer et suivre vos commandes, et permettre au livreur de vous joindre et de vous localiser.",
        "• Encaisser les paiements et produire la comptabilité de l'entreprise.",
        "• Vous informer de l'état de votre commande, des promotions et des nouveautés si vous l'acceptez.",
        "• Améliorer le service (zones couvertes, temps de livraison, catalogue).",
      ],
    },
    {
      titre: "3. Utilisation et conservation",
      paragraphes: [
        "Vos données sont stockées sur des serveurs sécurisés et ne sont accessibles qu'au personnel autorisé de Pinkberry Drc. Les accès sont protégés par mot de passe chiffré et jeton d'authentification.",
        "Durées de conservation : compte et adresses tant que votre compte est actif ; commandes et informations de paiement pendant 10 ans au titre des obligations comptables et fiscales ; journaux techniques 12 mois maximum.",
      ],
    },
    {
      titre: "4. Partage des données",
      paragraphes: [
        "• Livreurs : prénom, nom, téléphone, adresse, point de repère et position GPS, uniquement pour la commande en cours.",
        "• Agrégateur de paiement Mobile Money (PawaPay) et opérateurs M-Pesa, Airtel Money, Orange Money : numéro de portefeuille, montant et référence de commande, pour exécuter la transaction.",
        "• Prestataires techniques : hébergement, envoi d'emails, cartographie et calcul d'itinéraire (fournisseurs de cartes).",
        "• Autorités : uniquement sur demande légale.",
        "Nous ne vendons jamais vos données personnelles.",
      ],
    },
    {
      titre: "5. Vos droits",
      paragraphes: [
        "Vous pouvez à tout moment accéder à vos données, les corriger depuis l'écran Paramètres, demander une copie de vos données ou la suppression de votre compte.",
        "La suppression du compte efface vos données personnelles ; les documents comptables des commandes déjà livrées sont conservés de façon anonymisée pour respecter la loi.",
        `Pour exercer vos droits, écrivez-nous à ${EMAIL_LEGAL}. Nous répondons sous 30 jours.`,
      ],
    },
    {
      titre: "6. Enfants",
      paragraphes: ["Le service est destiné aux personnes de 18 ans et plus, ou aux mineurs avec l'accord d'un parent."],
    },
    {
      titre: "7. Contact",
      paragraphes: [`Pinkberry Drc — Kinshasa, République démocratique du Congo. Email : ${EMAIL_LEGAL}`],
    },
  ],
};

const CONDITIONS_FR: DocumentLegal = {
  titre: "Conditions d'utilisation",
  maj: `Dernière mise à jour : ${MAJ_LEGALE}`,
  intro:
    "En utilisant l'application Pinkberry Drc, vous acceptez les présentes conditions. Merci de les lire attentivement.",
  sections: [
    {
      titre: "1. Le service",
      paragraphes: [
        "Pinkberry Drc propose la commande et la livraison de produits Pinkberry (frozen yogurt, boissons et accompagnements) à Kinshasa, en République démocratique du Congo, via cette application.",
      ],
    },
    {
      titre: "2. Compte et responsabilité",
      paragraphes: [
        "La création d'un compte nécessite un numéro de téléphone valide, vérifié par un code à usage unique. Vous êtes responsable de l'exactitude de vos informations et de la confidentialité de votre mot de passe.",
        "Toute commande passée depuis votre compte est réputée être la vôtre. Signalez-nous immédiatement tout usage non autorisé.",
      ],
    },
    {
      titre: "3. Commandes",
      paragraphes: [
        "Les prix affichés sont en dollars américains (USD) ; l'équivalent en francs congolais (CDF) est calculé au taux du jour défini par Pinkberry Drc. Les frais de livraison sont indiqués avant la validation.",
        "Une commande est confirmée lorsqu'elle apparaît dans votre suivi. La disponibilité des produits, tailles et garnitures peut varier ; nous vous prévenons si un article manque.",
        "Vous devez fournir une adresse exacte avec un point de repère et être joignable au numéro indiqué lors de la livraison.",
      ],
    },
    {
      titre: "4. Paiement",
      paragraphes: [
        "Deux modes sont proposés : espèces à la remise de la commande, ou Mobile Money (M-Pesa Vodacom, Airtel Money, Orange Money) via notre agrégateur de paiement.",
        "Pour un paiement Mobile Money, la commande n'est considérée comme payée qu'après confirmation de l'opérateur. En cas d'échec ou de délai dépassé, vous pouvez réessayer ou choisir le paiement à la livraison.",
      ],
    },
    {
      titre: "5. Annulation et remboursement",
      paragraphes: [
        "Vous pouvez annuler sans frais tant que la commande n'est pas en préparation. Après le départ du livreur, l'annulation n'est plus garantie et les frais de livraison peuvent rester dus.",
        "Un produit non conforme ou manquant est remplacé ou remboursé après signalement dans les 24 heures. Les paiements Mobile Money sont remboursés sur le même portefeuille.",
      ],
    },
    {
      titre: "6. Zones de livraison",
      paragraphes: [
        "Nous livrons uniquement dans les communes de Kinshasa activées dans l'application. Si votre position GPS se situe hors de ces zones, la commande est refusée. La liste des communes couvertes peut évoluer.",
      ],
    },
    {
      titre: "7. Limitation de responsabilité",
      paragraphes: [
        "Nous mettons tout en œuvre pour livrer dans les délais annoncés, mais les temps affichés sont estimatifs et peuvent varier (trafic, météo, force majeure).",
        "Notre responsabilité est limitée au montant de la commande concernée. Nous ne sommes pas responsables des indisponibilités des réseaux mobiles, des opérateurs de paiement ou d'internet.",
      ],
    },
    {
      titre: "8. Modifications et contact",
      paragraphes: [
        "Ces conditions peuvent être mises à jour ; la date en haut de page indique la dernière version. L'usage continu de l'application vaut acceptation.",
        `Questions : ${EMAIL_LEGAL} — Pinkberry Drc, Kinshasa, RDC.`,
      ],
    },
  ],
};

const CONFIDENTIALITE_EN: DocumentLegal = {
  titre: "Privacy Policy",
  maj: `Last updated: ${MAJ_LEGALE}`,
  intro:
    "Pinkberry Drc (\"we\") operates the Pinkberry delivery app in Kinshasa. This policy explains which personal data we collect, why, how we use it and what your rights are.",
  sections: [
    {
      titre: "1. Data we collect",
      paragraphes: [
        "• Identity and contact: full name, phone number, email address (optional).",
        "• Delivery: address (municipality, street, number), landmark and the GPS position you share or adjust on the map.",
        "• Orders: order history, items, sizes and toppings, amounts, delivery status and assigned rider.",
        "• Payment: chosen payment method (cash on delivery or Mobile Money), operator, currency, amount and transaction reference. We only keep the last four digits of the wallet number and never store your PIN.",
        "• Technical: device token for notifications, chosen language and theme, technical logs required to run the service.",
      ],
    },
    {
      titre: "2. Why we collect it",
      paragraphes: [
        "• Create and secure your account and verify your number with a one-time code.",
        "• Prepare, deliver and track your orders, and let the rider reach and locate you.",
        "• Collect payments and keep the company's accounting records.",
        "• Inform you about your order status, promotions and new items if you opt in.",
        "• Improve the service (covered areas, delivery times, catalogue).",
      ],
    },
    {
      titre: "3. Use and retention",
      paragraphes: [
        "Your data is stored on secure servers and is only accessible to authorised Pinkberry Drc staff. Access is protected by hashed passwords and authentication tokens.",
        "Retention: account and addresses while your account is active; orders and payment information for 10 years for accounting and tax obligations; technical logs for up to 12 months.",
      ],
    },
    {
      titre: "4. Data sharing",
      paragraphes: [
        "• Riders: first name, last name, phone, address, landmark and GPS position, for the current order only.",
        "• Mobile Money aggregator (PawaPay) and the M-Pesa, Airtel Money and Orange Money operators: wallet number, amount and order reference, to process the transaction.",
        "• Technical providers: hosting, email delivery, maps and route calculation.",
        "• Authorities: only upon a valid legal request.",
        "We never sell your personal data.",
      ],
    },
    {
      titre: "5. Your rights",
      paragraphes: [
        "You can access your data at any time, correct it from the Settings screen, request a copy of your data or ask for your account to be deleted.",
        "Deleting your account erases your personal data; accounting records for delivered orders are kept in anonymised form as required by law.",
        `To exercise your rights, email ${EMAIL_LEGAL}. We reply within 30 days.`,
      ],
    },
    {
      titre: "6. Children",
      paragraphes: ["The service is intended for people aged 18 and over, or minors with a parent's consent."],
    },
    {
      titre: "7. Contact",
      paragraphes: [`Pinkberry Drc — Kinshasa, Democratic Republic of the Congo. Email: ${EMAIL_LEGAL}`],
    },
  ],
};

const CONDITIONS_EN: DocumentLegal = {
  titre: "Terms of Use",
  maj: `Last updated: ${MAJ_LEGALE}`,
  intro: "By using the Pinkberry Drc app you agree to these terms. Please read them carefully.",
  sections: [
    {
      titre: "1. The service",
      paragraphes: [
        "Pinkberry Drc offers ordering and delivery of Pinkberry products (frozen yogurt, drinks and sides) in Kinshasa, Democratic Republic of the Congo, through this app.",
      ],
    },
    {
      titre: "2. Account and responsibility",
      paragraphes: [
        "Creating an account requires a valid phone number verified with a one-time code. You are responsible for the accuracy of your information and for keeping your password confidential.",
        "Any order placed from your account is deemed to be yours. Report any unauthorised use immediately.",
      ],
    },
    {
      titre: "3. Orders",
      paragraphes: [
        "Prices are shown in US dollars (USD); the Congolese franc (CDF) equivalent uses the daily rate set by Pinkberry Drc. Delivery fees are shown before you confirm.",
        "An order is confirmed once it appears in your tracking screen. Availability of products, sizes and toppings may vary; we will tell you if an item is missing.",
        "You must provide an accurate address with a landmark and be reachable on the phone number given at delivery time.",
      ],
    },
    {
      titre: "4. Payment",
      paragraphes: [
        "Two methods are available: cash when the order is handed over, or Mobile Money (M-Pesa Vodacom, Airtel Money, Orange Money) through our payment aggregator.",
        "For Mobile Money, an order is only considered paid after the operator confirms it. If the payment fails or times out, you can retry or switch to cash on delivery.",
      ],
    },
    {
      titre: "5. Cancellation and refunds",
      paragraphes: [
        "You may cancel free of charge as long as the order is not being prepared. Once the rider has left, cancellation is no longer guaranteed and the delivery fee may remain due.",
        "A missing or non-compliant product is replaced or refunded when reported within 24 hours. Mobile Money payments are refunded to the same wallet.",
      ],
    },
    {
      titre: "6. Delivery areas",
      paragraphes: [
        "We only deliver in the Kinshasa municipalities enabled in the app. If your GPS position falls outside those areas the order is declined. The list of covered municipalities may change.",
      ],
    },
    {
      titre: "7. Limitation of liability",
      paragraphes: [
        "We do our best to deliver within the announced times, but displayed times are estimates and may vary (traffic, weather, force majeure).",
        "Our liability is limited to the amount of the order concerned. We are not liable for outages of mobile networks, payment operators or the internet.",
      ],
    },
    {
      titre: "8. Changes and contact",
      paragraphes: [
        "These terms may be updated; the date at the top shows the latest version. Continued use of the app means you accept them.",
        `Questions: ${EMAIL_LEGAL} — Pinkberry Drc, Kinshasa, DRC.`,
      ],
    },
  ],
};

export function documentLegal(type: "confidentialite" | "conditions", langue: Langue): DocumentLegal {
  if (type === "confidentialite") return langue === "en" ? CONFIDENTIALITE_EN : CONFIDENTIALITE_FR;
  return langue === "en" ? CONDITIONS_EN : CONDITIONS_FR;
}
