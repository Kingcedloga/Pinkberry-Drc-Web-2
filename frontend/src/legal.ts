import type { Langue } from "@/src/i18n";

/** Contenu des pages légales (FR / EN), utilisé par `src/components/PageLegale.tsx`. */

export type SectionLegale = { titre: string; paragraphes: string[] };
export type DocLegal = {
  titre: string;
  sousTitre: string;
  majLabel: string;
  sections: SectionLegale[];
};

/** Date de dernière mise à jour des documents. */
export const MAJ_LEGALE = { fr: "20 juin 2026", en: "June 20, 2026" };
export const CONTACT_LEGAL = "contact@pinkberrydrc.cd";

const CONFIDENTIALITE_FR: DocLegal = {
  titre: "Politique de confidentialité",
  sousTitre: "Pinkberry Drc — livraison de frozen yogurt à Kinshasa",
  majLabel: "Dernière mise à jour",
  sections: [
    {
      titre: "1. Qui sommes-nous",
      paragraphes: [
        "Pinkberry Drc exploite une application de commande et de livraison de produits Pinkberry à Kinshasa, République démocratique du Congo. Cette politique explique quelles données personnelles nous collectons, pourquoi, comment nous les utilisons et quels sont vos droits.",
        `Pour toute question relative à vos données : ${CONTACT_LEGAL}.`,
      ],
    },
    {
      titre: "2. Données que nous collectons",
      paragraphes: [
        "• Identité et contact : nom complet, numéro de téléphone, adresse email.",
        "• Adresse de livraison : commune, avenue, numéro et point de repère que vous saisissez.",
        "• Position GPS : uniquement lorsque vous choisissez de localiser votre adresse ou de suivre une livraison en cours. Pour les livreurs, la position est partagée pendant la course active.",
        "• Historique de commandes : produits, tailles, garnitures, montants, dates et statuts.",
        "• Moyen de paiement : mode choisi (espèces à la livraison ou Mobile Money) et, pour le Mobile Money, le numéro utilisé et la référence de transaction. Nous ne stockons jamais de code PIN ni de numéro de carte bancaire.",
        "• Données techniques : type d'appareil et de navigateur, langue, préférences d'affichage et abonnement aux notifications.",
      ],
    },
    {
      titre: "3. Pourquoi nous collectons ces données",
      paragraphes: [
        "• Créer et sécuriser votre compte, et vérifier votre numéro ou votre email par code à usage unique.",
        "• Préparer, facturer et livrer vos commandes à la bonne adresse.",
        "• Vous tenir informé de l'avancement de votre commande (notifications, suivi cartographique).",
        "• Traiter les paiements Mobile Money et confirmer leur aboutissement.",
        "• Assurer le service client, la lutte contre la fraude et l'amélioration du service (statistiques agrégées).",
      ],
    },
    {
      titre: "4. Comment vos données sont utilisées et conservées",
      paragraphes: [
        "Vos données sont stockées dans une base de données hébergée chez un prestataire d'infrastructure, avec accès restreint aux personnes habilitées. Les échanges entre l'application et nos serveurs sont chiffrés (HTTPS). Les mots de passe sont conservés sous forme de empreintes chiffrées (bcrypt) et ne sont jamais lisibles.",
        "Nous n'utilisons pas vos données à des fins publicitaires et nous ne les vendons pas.",
      ],
    },
    {
      titre: "5. Avec qui nous partageons vos données",
      paragraphes: [
        "• Livreurs : votre prénom, votre numéro de téléphone, votre adresse et votre point de repère, uniquement pour la commande qui leur est assignée et pendant la durée de la livraison.",
        "• Agrégateur de paiement Mobile Money (PawaPay pour M-Pesa, Airtel Money et Orange Money) : montant, numéro de téléphone payeur et référence de commande, afin d'initier et de confirmer le paiement.",
        "• Prestataires techniques : hébergement de la base de données, envoi des emails de vérification, fonds de carte et calcul d'itinéraire (Mapbox, TomTom pour la recherche d'adresse).",
        "• Autorités compétentes : uniquement si la loi congolaise l'exige.",
      ],
    },
    {
      titre: "6. Durée de conservation",
      paragraphes: [
        "• Compte et coordonnées : tant que votre compte est actif.",
        "• Commandes et justificatifs de paiement : jusqu'à 5 ans, pour des raisons comptables et de traçabilité.",
        "• Position GPS d'une livraison : supprimée à la clôture de la commande.",
        "• Après suppression de votre compte, vos données personnelles sont effacées ou anonymisées sous 30 jours, sauf obligation légale de conservation.",
      ],
    },
    {
      titre: "7. Vos droits",
      paragraphes: [
        "Vous pouvez à tout moment : consulter et corriger vos informations depuis Paramètres → Mon compte ; supprimer votre compte depuis l'écran Compte (« Supprimer mon compte ») ; activer ou désactiver les notifications depuis Paramètres ; demander une copie de vos données ou vous opposer à un traitement en écrivant à " + CONTACT_LEGAL + ".",
        "Nous répondons à toute demande dans un délai de 30 jours.",
      ],
    },
    {
      titre: "8. Sécurité et mineurs",
      paragraphes: [
        "L'accès à votre compte est protégé par mot de passe et vérification par code. Gardez vos identifiants confidentiels. Le service n'est pas destiné aux personnes de moins de 13 ans.",
      ],
    },
    {
      titre: "9. Modifications",
      paragraphes: [
        "Cette politique peut évoluer. La date de dernière mise à jour figure en haut de cette page ; en cas de changement important, nous vous en informerons dans l'application.",
      ],
    },
    {
      titre: "10. Contact",
      paragraphes: [`Pinkberry Drc — Kinshasa, République démocratique du Congo — ${CONTACT_LEGAL}`],
    },
  ],
};

const CONDITIONS_FR: DocLegal = {
  titre: "Conditions d'utilisation",
  sousTitre: "Pinkberry Drc — livraison de frozen yogurt à Kinshasa",
  majLabel: "Dernière mise à jour",
  sections: [
    {
      titre: "1. Objet du service",
      paragraphes: [
        "Pinkberry Drc est une application de commande en ligne et de livraison de produits Pinkberry (pots de frozen yogurt, smoothies, boissons et garnitures) dans certaines communes de Kinshasa. En utilisant l'application, vous acceptez les présentes conditions.",
      ],
    },
    {
      titre: "2. Création et responsabilité du compte",
      paragraphes: [
        "La commande nécessite un compte créé avec un nom, un numéro de téléphone valide, une adresse email et un mot de passe. Un code de vérification vous est envoyé par email.",
        "Vous êtes responsable de l'exactitude de vos informations et de la confidentialité de votre mot de passe. Toute commande passée depuis votre compte est réputée être la vôtre. Prévenez-nous immédiatement en cas d'utilisation non autorisée.",
        "Nous pouvons suspendre un compte en cas de fraude, d'abus, de commandes fictives répétées ou de comportement irrespectueux envers nos livreurs.",
      ],
    },
    {
      titre: "3. Règles de commande",
      paragraphes: [
        "Les produits sont proposés dans la limite des stocks disponibles ; un produit indisponible est signalé dans le catalogue. Les prix sont affichés en dollars américains, avec l'équivalent indicatif en francs congolais calculé au taux paramétré par la boutique.",
        "Des frais de livraison s'ajoutent au sous-total et sont affichés avant la validation. Une adresse complète avec point de repère est obligatoire : une adresse imprécise peut entraîner un retard ou l'annulation de la livraison.",
        "Les délais de livraison annoncés (25 à 45 minutes en moyenne) sont indicatifs et dépendent du trafic et des conditions météorologiques.",
      ],
    },
    {
      titre: "4. Paiement",
      paragraphes: [
        "Deux modes de paiement sont proposés : en espèces à la livraison, ou par Mobile Money (M-Pesa, Airtel Money, Orange Money) via notre agrégateur de paiement.",
        "Pour le Mobile Money, la commande est confirmée lorsque l'opérateur valide la transaction ; si le paiement échoue ou expire, la commande reste en attente et vous pouvez réessayer ou choisir le paiement à la livraison.",
        "Pour le paiement en espèces, le montant exact doit être remis au livreur à la réception.",
      ],
    },
    {
      titre: "5. Annulation et remboursement",
      paragraphes: [
        "Vous pouvez annuler sans frais tant que la commande n'est pas passée en préparation, depuis l'écran de suivi. Après le début de la préparation, l'annulation n'est plus garantie car les produits sont périssables.",
        "En cas de commande non livrée, de produit manquant ou visiblement non conforme, contactez-nous dans les 24 heures : après vérification, nous procédons au remplacement ou au remboursement du montant concerné, par le même moyen de paiement.",
      ],
    },
    {
      titre: "6. Zones de livraison",
      paragraphes: [
        "Nous livrons uniquement dans les communes couvertes et affichées lors du choix de l'adresse (notamment Gombe, Limete, Ngaliema et Lingwala). Une adresse située hors zone est refusée au moment de la commande. La liste des communes couvertes peut évoluer sans préavis.",
      ],
    },
    {
      titre: "7. Limitation de responsabilité",
      paragraphes: [
        "Nous nous engageons à fournir un service fiable, mais nous ne pouvons être tenus responsables des retards ou impossibilités de livraison dus à des causes extérieures : embouteillages, intempéries, coupures de réseau ou d'électricité, panne de l'opérateur Mobile Money, manifestations ou cas de force majeure.",
        "Notre responsabilité est en tout état de cause limitée au montant de la commande concernée. L'application est fournie « en l'état » ; nous ne garantissons pas une disponibilité sans interruption.",
      ],
    },
    {
      titre: "8. Propriété intellectuelle",
      paragraphes: [
        "La marque Pinkberry, les logos, les photographies et les contenus de l'application sont protégés. Toute reproduction ou utilisation commerciale sans autorisation écrite est interdite.",
      ],
    },
    {
      titre: "9. Droit applicable et modifications",
      paragraphes: [
        "Les présentes conditions sont régies par le droit de la République démocratique du Congo. Nous pouvons les modifier ; la date de dernière mise à jour figure en haut de cette page et l'utilisation continue du service vaut acceptation de la version en vigueur.",
      ],
    },
    {
      titre: "10. Contact",
      paragraphes: [`Pinkberry Drc — Kinshasa, République démocratique du Congo — ${CONTACT_LEGAL}`],
    },
  ],
};

const CONFIDENTIALITE_EN: DocLegal = {
  titre: "Privacy Policy",
  sousTitre: "Pinkberry Drc — frozen yogurt delivery in Kinshasa",
  majLabel: "Last updated",
  sections: [
    {
      titre: "1. Who we are",
      paragraphes: [
        "Pinkberry Drc operates an app for ordering and delivering Pinkberry products in Kinshasa, Democratic Republic of the Congo. This policy explains what personal data we collect, why, how we use it and what your rights are.",
        `For any question about your data: ${CONTACT_LEGAL}.`,
      ],
    },
    {
      titre: "2. Data we collect",
      paragraphes: [
        "• Identity and contact: full name, phone number, email address.",
        "• Delivery address: commune, avenue, number and the landmark you provide.",
        "• GPS location: only when you choose to locate your address or follow an ongoing delivery. For riders, location is shared during the active delivery.",
        "• Order history: products, sizes, toppings, amounts, dates and statuses.",
        "• Payment method: the option chosen (cash on delivery or Mobile Money) and, for Mobile Money, the paying phone number and transaction reference. We never store PIN codes or bank card numbers.",
        "• Technical data: device and browser type, language, display preferences and notification subscription.",
      ],
    },
    {
      titre: "3. Why we collect this data",
      paragraphes: [
        "• Create and secure your account and verify your phone or email with a one-time code.",
        "• Prepare, invoice and deliver your orders to the right address.",
        "• Keep you informed about your order (notifications, live map tracking).",
        "• Process Mobile Money payments and confirm their outcome.",
        "• Provide customer support, prevent fraud and improve the service (aggregated statistics).",
      ],
    },
    {
      titre: "4. How your data is used and stored",
      paragraphes: [
        "Your data is stored in a database hosted by an infrastructure provider, with access restricted to authorised staff. Traffic between the app and our servers is encrypted (HTTPS). Passwords are stored as cryptographic hashes (bcrypt) and are never readable.",
        "We do not use your data for advertising and we never sell it.",
      ],
    },
    {
      titre: "5. Who we share it with",
      paragraphes: [
        "• Riders: your first name, phone number, address and landmark, only for the order assigned to them and for the duration of the delivery.",
        "• Mobile Money payment aggregator (PawaPay for M-Pesa, Airtel Money and Orange Money): amount, payer phone number and order reference, to initiate and confirm payment.",
        "• Technical providers: database hosting, verification emails, map tiles and routing (Mapbox, TomTom for address search).",
        "• Competent authorities: only where Congolese law requires it.",
      ],
    },
    {
      titre: "6. Retention period",
      paragraphes: [
        "• Account and contact details: while your account is active.",
        "• Orders and payment records: up to 5 years, for accounting and traceability.",
        "• Delivery GPS location: deleted when the order is closed.",
        "• After you delete your account, your personal data is erased or anonymised within 30 days, unless the law requires otherwise.",
      ],
    },
    {
      titre: "7. Your rights",
      paragraphes: [
        "At any time you can: view and correct your information in Settings → My account; delete your account from the Account screen (“Delete my account”); enable or disable notifications in Settings; request a copy of your data or object to processing by writing to " + CONTACT_LEGAL + ".",
        "We answer any request within 30 days.",
      ],
    },
    {
      titre: "8. Security and minors",
      paragraphes: [
        "Your account is protected by a password and code verification. Keep your credentials confidential. The service is not intended for people under 13.",
      ],
    },
    {
      titre: "9. Changes",
      paragraphes: [
        "This policy may change. The last update date is shown at the top of this page; for significant changes we will inform you in the app.",
      ],
    },
    {
      titre: "10. Contact",
      paragraphes: [`Pinkberry Drc — Kinshasa, Democratic Republic of the Congo — ${CONTACT_LEGAL}`],
    },
  ],
};

const CONDITIONS_EN: DocLegal = {
  titre: "Terms of Use",
  sousTitre: "Pinkberry Drc — frozen yogurt delivery in Kinshasa",
  majLabel: "Last updated",
  sections: [
    {
      titre: "1. The service",
      paragraphes: [
        "Pinkberry Drc is an app for ordering and delivering Pinkberry products (frozen yogurt cups, smoothies, drinks and toppings) in selected communes of Kinshasa. By using the app you accept these terms.",
      ],
    },
    {
      titre: "2. Account creation and responsibility",
      paragraphes: [
        "Ordering requires an account created with a name, a valid phone number, an email address and a password. A verification code is sent to you by email.",
        "You are responsible for the accuracy of your information and for keeping your password confidential. Any order placed from your account is deemed to be yours. Tell us immediately about any unauthorised use.",
        "We may suspend an account in case of fraud, abuse, repeated fake orders or disrespectful behaviour towards our riders.",
      ],
    },
    {
      titre: "3. Ordering rules",
      paragraphes: [
        "Products are offered while stocks last; unavailable products are flagged in the catalogue. Prices are shown in US dollars with an indicative Congolese franc equivalent based on the rate set by the shop.",
        "Delivery fees are added to the subtotal and displayed before you confirm. A complete address with a landmark is mandatory: an imprecise address may cause a delay or a cancelled delivery.",
        "Announced delivery times (25 to 45 minutes on average) are indicative and depend on traffic and weather.",
      ],
    },
    {
      titre: "4. Payment",
      paragraphes: [
        "Two payment options are available: cash on delivery, or Mobile Money (M-Pesa, Airtel Money, Orange Money) through our payment aggregator.",
        "For Mobile Money, the order is confirmed once the operator validates the transaction; if payment fails or expires the order stays pending and you can retry or switch to cash on delivery.",
        "For cash payments, the exact amount must be handed to the rider on delivery.",
      ],
    },
    {
      titre: "5. Cancellation and refunds",
      paragraphes: [
        "You can cancel free of charge from the tracking screen as long as the order has not moved to preparation. Once preparation has started, cancellation is no longer guaranteed because the products are perishable.",
        "If an order is not delivered, an item is missing or clearly non-compliant, contact us within 24 hours: after verification we will replace the item or refund the amount concerned using the same payment method.",
      ],
    },
    {
      titre: "6. Delivery areas",
      paragraphes: [
        "We only deliver in the covered communes shown when you choose your address (notably Gombe, Limete, Ngaliema and Lingwala). Addresses outside the covered area are rejected at checkout. The list of communes may change without notice.",
      ],
    },
    {
      titre: "7. Limitation of liability",
      paragraphes: [
        "We strive to provide a reliable service but cannot be held liable for delays or failures caused by external events: traffic jams, bad weather, network or power outages, Mobile Money operator failures, demonstrations or force majeure.",
        "In any event our liability is limited to the amount of the order concerned. The app is provided “as is”; we do not guarantee uninterrupted availability.",
      ],
    },
    {
      titre: "8. Intellectual property",
      paragraphes: [
        "The Pinkberry brand, logos, photographs and app content are protected. Any reproduction or commercial use without written permission is prohibited.",
      ],
    },
    {
      titre: "9. Governing law and changes",
      paragraphes: [
        "These terms are governed by the law of the Democratic Republic of the Congo. We may amend them; the last update date is shown at the top of this page and continued use of the service constitutes acceptance of the version in force.",
      ],
    },
    {
      titre: "10. Contact",
      paragraphes: [`Pinkberry Drc — Kinshasa, Democratic Republic of the Congo — ${CONTACT_LEGAL}`],
    },
  ],
};

export const CONFIDENTIALITE: Record<Langue, DocLegal> = { fr: CONFIDENTIALITE_FR, en: CONFIDENTIALITE_EN };
export const CONDITIONS: Record<Langue, DocLegal> = { fr: CONDITIONS_FR, en: CONDITIONS_EN };
