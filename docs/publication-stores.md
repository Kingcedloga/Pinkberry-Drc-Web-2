# Publication sur l'App Store et Google Play — Pinkberry Drc

Réponses à recopier dans App Store Connect et la Google Play Console, notes pour
les équipes de revue, et justification du GPS en arrière-plan. À relire si
l'app change (nouvelle donnée collectée, nouveau prestataire…).

---

## 1. Comptes de revue (Apple « Sign-in information », Google « App access »)

Les trois comptes sont créés au démarrage du serveur **si la variable
d'environnement `STORE_REVIEW_PASSWORD` est définie** (8 caractères minimum) dans
le déploiement de production. Aucun mode démo n'est activé : pas de code OTP
exposé, pas de bouton de démonstration.

| Rôle | Téléphone (identifiant) | Mot de passe |
|---|---|---|
| Client | `0890000101` | valeur de `STORE_REVIEW_PASSWORD` |
| Livreur | `0890000102` | idem |
| Admin (configuration en lecture seule) | `0890000103` | idem |

- Les comptes sont déjà vérifiés : aucune saisie de code.
- Changer la variable change le mot de passe au redémarrage suivant.
- Supprimer la variable n'efface pas les comptes : les désactiver depuis
  Personnel (super admin) après la revue si besoin.

## 2. Notes pour la revue (à coller tel quel)

**English (App Review / Play review)**

> Pinkberry Drc is a frozen-yogurt ordering and delivery app for Kinshasa (DRC).
> One app serves three roles: customers, delivery riders and shop staff.
>
> - The menu can be browsed without an account; an account is only required to
>   place an order.
> - Customer: sign in with 0890000101 / [password]. Add any item, choose the
>   "Gombe" district at checkout and pay "On delivery" (cash). Physical goods
>   only: no in-app purchase applies.
> - Staff: sign in with 0890000103 / [password] to see the order and assign it
>   to the rider "Revue Store Livreur".
> - Rider: sign in with 0890000102 / [password], open the assigned delivery and
>   tap "I'm on my way". Location is then shared automatically with the
>   customer, including in the background, until the order is delivered; it
>   stops automatically afterwards. Location ("Always") is requested only from
>   riders, after an in-app explanation.
> - Account deletion: Account → Delete my account, or on the web at
>   https://[domain]/legal/suppression-compte.

**Français (si demandé)**

> Pinkberry Drc est une app de commande et de livraison de frozen yogurt à
> Kinshasa. Une seule app sert trois rôles : clients, livreurs et personnel.
> La carte se consulte sans compte ; le compte n'est demandé que pour commander.
> Client 0890000101, admin 0890000103, livreur 0890000102 (mot de passe fourni).
> Commande : commune « Gombe », paiement « À la livraison ». Le livreur passe
> « en route » : sa position est partagée automatiquement, y compris en
> arrière-plan, jusqu'à la livraison, puis s'arrête.

## 3. Apple — Confidentialité de l'app (« App Privacy »)

- **Suivi (tracking)** : **Non**. Aucune publicité, aucun SDK de suivi, aucune
  donnée vendue ou partagée avec des courtiers.
- Toutes les données ci-dessous sont **liées à l'identité** de l'utilisateur et
  servent à la **fonctionnalité de l'app** (et au support client).

| Catégorie Apple | Donnée | Qui | Finalité |
|---|---|---|---|
| Coordonnées | Nom | tous | Fonctionnalité de l'app |
| Coordonnées | Adresse e-mail | clients (inscription, Google) | Fonctionnalité, support |
| Coordonnées | Numéro de téléphone | tous | Fonctionnalité (livraison, connexion) |
| Coordonnées | Adresse physique | clients (adresse de livraison) | Fonctionnalité |
| Localisation | Localisation précise | clients (si « ma position »), livreurs (pendant les courses) | Fonctionnalité |
| Achats | Historique d'achats | clients | Fonctionnalité |
| Contenu utilisateur | Photos | admins (images du catalogue) | Fonctionnalité |
| Contenu utilisateur | Autre (note de livraison, point de repère) | clients | Fonctionnalité |
| Identifiants | Identifiant d'utilisateur | tous | Fonctionnalité |
| Identifiants | Identifiant d'appareil (jeton de notifications) | tous | Fonctionnalité (notifications) |

Non collecté : données de santé, données financières bancaires (le numéro Mobile
Money est saisi pour le paiement et transmis à PawaPay, déclaré ci-dessus via le
téléphone), contacts, historique de navigation, diagnostics, données d'usage.

## 4. Google Play — Sécurité des données (« Data safety »)

- **Collecte ou partage de données** : Oui.
- **Chiffrement en transit** : Oui (HTTPS partout).
- **Suppression des données** : Oui — dans l'app (Compte → Supprimer mon compte)
  et via l'URL **https://[domaine]/legal/suppression-compte** (champ « Delete
  account URL »).
- **Partage** : Non au sens de Google (les prestataires techniques — hébergement
  Emergent, Mapbox, TomTom, PawaPay, Google — agissent pour notre compte).

| Type Google | Collecté | Facultatif ? | Finalités |
|---|---|---|---|
| Position approximative et précise | Oui | Facultatif pour les clients, requis pour les livreurs | Fonctionnalités de l'app |
| Nom | Oui | Requis | Fonctionnalités, gestion du compte |
| Adresse e-mail | Oui | Requis (inscription) | Gestion du compte, communications |
| Numéro de téléphone | Oui | Requis | Fonctionnalités, gestion du compte |
| Adresse | Oui | Requis pour commander | Fonctionnalités |
| Historique des achats | Oui | Requis | Fonctionnalités |
| Autres infos financières (numéro Mobile Money) | Oui | Facultatif | Fonctionnalités (paiement) |
| Photos | Oui | Facultatif (admins) | Fonctionnalités |
| Identifiants d'appareil ou autres (jeton de notifications) | Oui | Facultatif | Fonctionnalités (notifications) |

Non collecté : santé, messages, contacts, agenda, fichiers, audio, vidéo,
activité dans les apps, navigation web, infos et performances de l'app.

## 5. GPS en arrière-plan (livreurs)

**Google Play — déclaration « Accès à la position en arrière-plan »**

- *Fonctionnalité* : « Suivi de livraison en direct. Pendant une course « en
  route », la position du livreur est envoyée toutes les 5 secondes (ou tous
  les 25 m) pour que le client suive sa livraison sur la carte, y compris quand
  l'écran du livreur est verrouillé. Le partage s'arrête automatiquement à la
  livraison ou à l'annulation. »
- *Pourquoi en arrière-plan* : « Le livreur conduit avec l'écran verrouillé ; sans
  accès en arrière-plan, le client perdrait le suivi pendant le trajet. »
- *Information visible dans l'app* : avant la demande d'autorisation, l'écran
  « Partage pendant la livraison » explique que la position est collectée même
  lorsque l'app est fermée ou non utilisée, pourquoi, et quand cela s'arrête.
  Une notification permanente « Livraison en cours » s'affiche pendant le partage.
- *Vidéo* (30 s, lien YouTube non répertorié) : connexion livreur → course →
  « Je suis en route » → écran d'explication → « Toujours autoriser » →
  verrouillage de l'écran → la position avance côté client → « Marquer comme
  livrée » → la notification disparaît.

**Apple** : le texte de l'autorisation « Toujours » (FR/EN) est dans
`frontend/assets/langues/` ; la note de revue ci-dessus explique le cas d'usage.

## 6. Réglages déjà en place dans le code

- **Navigation sans compte** : la carte et le panier sont accessibles aux
  visiteurs ; la connexion est demandée au passage en caisse, puis l'app revient
  à la caisse avec le panier.
- **Textes d'autorisation iOS** traduits FR/EN (position, position « toujours »,
  photos) ; appareil photo et micro non demandés (non utilisés).
- **Modes d'arrière-plan iOS** : uniquement `location`.
- **iPad** : désactivé (`supportsTablet: false`) — l'app s'ouvre sur iPad en mode
  iPhone ; aucune capture iPad à fournir. À réactiver après validation du rendu
  iPad si souhaité.
- **Chiffrement** : `ITSAppUsesNonExemptEncryption = false`.
- **Numéros de build** : iOS `buildNumber` 1, Android `versionCode` 1 (à
  incrémenter à chaque envoi si la publication ne le fait pas).
