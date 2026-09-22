# Pinkberry Drc — PRD

## Problème initial (verbatim, résumé)
Application de livraison à la demande pour la marque de frozen yogurt **Pinkberry** à Kinshasa (RDC).
Le client commande ses pots de crème glacée depuis son téléphone, suit son livreur en temps réel sur une
carte, et paie en **espèces à la livraison**. Tout est **en français**. Trois interfaces partagent un
back-end et une base de données uniques : **client**, **livreur**, **admin (back office)**.

## Choix utilisateur
- OTP envoyé par email + **mode démo** (le code est aussi renvoyé par l'API et affiché à l'écran)
- Admin et livreur **intégrés dans la même app mobile** (routage selon le rôle)
- Prix affichés en **USD et Francs congolais (FC)** — taux 2800
- **Phase 1 + Phase 2** livrées ensemble
- App mobile **Expo / React Native** (testable via Expo Go)
- Logo fourni par l'utilisateur : spirale + feuilles + mot « pinkberry » (recréé en vectoriel rose)

## Architecture
- **Front-end** : Expo SDK 57, expo-router (file-based), React Query, react-native-svg,
  react-native-keyboard-controller, expo-location, react-native-webview + Leaflet/OSM
- **Back-end** : FastAPI, routes préfixées `/api`, JWT (HS256), bcrypt
- **Base** : MongoDB (collections `users`, `adresses`, `produits`, `zones`, `commandes`,
  `livreurs`, `positions_livreurs`, `otps`)
- **Temps réel** : polling React Query (4–6 s) pour statut de commande et position GPS du livreur
- **Email** : intégration Emergent managée (Resend) avec garde-fous ; bascule automatique en mode démo
  si `EMERGENT_EMAIL_KEY` n'est pas provisionnée

### Design system
Rose `#E6156F` / pressé `#B60E56` / pâle `#FCE4EF`, vert citron `#8DC63F`, texte `#2A1721`,
secondaire `#9A8E94`, bordures `#F0E6EB`, fond `#FBF6F9`. Titres/prix en **Fredoka**, texte en
**Nunito** (chargées à distance via expo-font). Cartes r=24px, ombres roses douces, boutons pill.
Tous les tokens vivent dans `/app/frontend/src/theme.ts`.

## Personas
1. **Cliente à Kinshasa** — commande un pot, veut savoir quand le livreur arrive et payer en cash.
2. **Livreur moto** — reçoit ses courses, partage sa position, encaisse le cash.
3. **Gérant Pinkberry (admin)** — voit les commandes arriver, assigne les livreurs, gère la carte,
   les prix, les zones couvertes.

## Exigences cœur (statiques)
- Téléphone = identifiant principal, vérifié par code à 4 chiffres. Email facultatif.
- Contrôle de zone : seules les communes cochées par l'admin sont livrables.
- Paiement **cash uniquement** ; le livreur confirme l'encaissement, ce qui clôt la commande.
- Statuts : `recue → en_preparation → (recuperee) → en_route → livree`, plus `annulee`.
- Annulation possible par le client tant que la commande n'est pas « en route ».

## Implémenté — 14/09/2026 (v1, Phase 1 + Phase 2)
**Client**
- Bienvenue, inscription, vérification OTP (code démo affiché), connexion
- Accueil : recherche, chips de catégories défilables, section « Recommander » (commandes livrées),
  liste des produits, barre de panier flottante
- Feuille produit : tailles (Petit/Moyen/Grand), garnitures cochables, quantité, prix recalculé
- Panier (quantités, retrait, sous-total)
- Formulaire de localisation : GPS (flux de permissions complet + ouverture des réglages),
  sélecteur de commune avec contrôle de zone vert/rouge, avenue, numéro, label, point de repère, contact
- Confirmation : adresse, articles, badge « Paiement à la livraison (cash) », sous-total + frais + total
- Suivi : carte Leaflet/OSM (client + livreur + tracé), pastille ETA, fil d'étapes, carte livreur avec
  appel, annulation avec confirmation, bloc « Le livreur est arrivé » + montant cash + « J'ai payé » +
  notation par étoiles
- Onglet Commandes (historique), onglet Compte (déconnexion)

**Livreur**
- Connexion, liste des courses assignées, détail (carte, client, repère, appel, itinéraire OSM)
- Statuts : Course récupérée → En route → Livré ; partage GPS continu (watchPositionAsync) +
  bouton de simulation de trajet pour la démo ; confirmation d'encaissement du cash

**Admin**
- Tableau de bord temps réel (stats + commandes), détail commande, assignation de livreur,
  changement de statut
- Catalogue CRUD (nom, prix, catégorie, emoji, description, tailles, garnitures, rupture)
- Zones : bascule des communes couvertes
- Livreurs : ajout (crée aussi le compte de connexion), activation/désactivation, dernière position

**Tests** : 22/22 tests backend + parcours frontend complets validés (itération 1).

## Implémenté — ajout du 14/09/2026 (v1.1)
- **Taux de change USD → FC géré par l'admin** : nouvelle collection `parametres` (doc `cle="global"`),
  `GET /api/config` + `PUT /api/admin/config`. L'admin saisit le taux depuis l'onglet **Catalogue**
  (bannière « Taux de change USD → FC » + modal avec aperçu live). Stocké en base, aucun redéploiement.
- Côté client, tous les prix s'affichent `$6.00 ≈ 16 800 FC` avec le taux courant (catalogue, feuille
  produit, panier, confirmation, suivi). L'écran de paiement à la livraison montre le montant cash dans
  les deux devises, idem pour le montant à encaisser côté livreur.
- Technique : `TauxProvider` + hook `useMontant()` (`src/taux.tsx`) — polling `/api/config` toutes les 20 s
  et invalidation immédiate après une modification admin.
- Tests : 30/30 backend (dont 8 nouveaux sur le taux) + parcours admin/client/livreur validés (itération 2).

## Implémenté — ajout du 14/09/2026 (v1.2)
- **Notifications pop-up fiables** : `src/toast.tsx` réécrit en pile (3 max), 3 s, positionnées en haut via
  `useSafeAreaInsets`, `pointerEvents="none"` (ne masque aucun bouton), animation ressort.
  `src/components/SurveillanceCommandes.tsx` (monté dans le layout racine) surveille les commandes du
  client toutes les 5 s et déclenche une notification titrée à chaque changement de statut, y compris
  le pseudo-statut « le livreur est arrivé » (ETA ≤ 3 min). Vérifié en mobile et desktop.
- **Photos de produits (Emergent Object Storage)** : `POST /api/admin/photos` (JPG/PNG/WebP, 5 Mo max)
  → Pillow redimensionne à 900 px et réencode en JPEG q82 → envoi dans le bucket (aucun base64 en base) ;
  `GET /api/fichiers/{id}` sert l'image publiquement avec cache d'une semaine. Le champ produit `image`
  contient `/api/fichiers/<id>`, préfixé côté app par `src/images.ts`.
  Formulaire admin : aperçu immédiat, remplacement, retrait. Composant `PhotoProduit` (avec visuel par
  défaut) utilisé dans le catalogue, la feuille produit, le panier, le récapitulatif et la liste admin.
  L'emoji produit est abandonné.
- **Icônes SVG inline (lucide)** : nouveau registre `src/components/Icone.tsx`, tous les `Feather`
  (police d'icônes) supprimés, couleur toujours explicite. Plus aucun emoji comme icône d'interface
  (états vides, pins de carte Leaflet, tags livreur inclus).
- **Correctif iOS/Safari** : les icônes invisibles venaient de la police d'icônes non chargée par
  WebKit ; le passage aux SVG inline avec `stroke` explicite corrige le problème.
- **Connexion Google (Emergent Auth)** : `POST /api/auth/session` échange le `session_id` contre le JWT
  maison, crée le compte client depuis le nom/email Google ou réutilise le compte existant.
  Boutons « Continuer avec Google » sur connexion et inscription. Les comptes Google n'ont pas de
  téléphone (index unique partiel) : l'écran `/telephone` le demande une seule fois, avec « Plus tard ».
  `PUT /api/auth/telephone` valide l'unicité du numéro.
- Tests : 43/43 backend + parcours icônes / notifications / upload / Google validés (itération 3).

## Implémenté — ajout du 14/09/2026 (v1.3)
- **Notifications push (Emergent managed / SuprSend)** :
  - Backend : `POST /api/register-push` + helper `send_push()` (relais `X-Push-Key`), appels enveloppés
    dans try/except pour ne jamais bloquer une commande. Évènements couverts : chaque changement de
    statut → client (`/suivi/{id}`), nouvelle commande → tous les admins (`/dashboard`), assignation
    d'une course → livreur concerné (`/course/{id}`).
  - Frontend : handler et canal Android à portée module dans `app/_layout.tsx`, gestion du tap
    (app ouverte et démarrage à froid), enregistrement du token natif (`getDevicePushTokenAsync`) à la
    connexion et à chaque retour au premier plan, relance hebdomadaire vers les réglages si l'utilisateur
    a refusé (`src/components/GestionPush.tsx`).
  - `app.json` : plugin `expo-notifications`, `android.googleServicesFile`, permission POST_NOTIFICATIONS.
  - **Ne fonctionne qu'après déploiement + build natif** (jamais dans Expo Go ni sur le web).
    `google-services.json` doit être fourni par l'utilisateur ; `EMERGENT_PUSH_KEY` est injectée
    automatiquement au déploiement (ne jamais l'éditer).
- **Ventes du jour (admin)** : `GET /api/admin/ventes` calcule, sur le fuseau de Kinshasa (UTC+1) et
  uniquement sur les commandes **livrées**, le chiffre du jour, le nombre de commandes, le panier moyen
  et le top 5 des produits. Carte dédiée en tête du tableau de bord (USD + FC, classement des produits).
- Tests : 49/49 backend + audit de conformité push + rendu mobile/desktop validés (itération 4).

## Implémenté — ajout du 14/09/2026 (v1.4)
- **Heroicons partout** : `src/components/Icone.tsx` s'appuie désormais sur `react-native-heroicons`
  (outline, tracés arrondis ; variante solid pour l'étoile pleine). Aucun import de `lucide-react-native`
  ni de `@react-native-vector-icons/feather` ne subsiste, et aucun emoji ne sert d'icône d'interface.
- **Correctif du bug « icônes du menu invisibles sur iOS »** : cause racine identifiée —
  `expo-router/unstable-native-tabs` n'exporte pas `Icon` ni `Label` au niveau racine, mes imports
  valaient donc `undefined` et la barre d'onglets iOS 26 s'affichait sans icône, avec le nom de route
  brut en minuscules et la teinte bleue système. Correctif : `NativeTabs.Trigger.Icon` /
  `NativeTabs.Trigger.Label`, SF Symbols `{default, selected}`, `tintColor` rose #E6156F, `iconColor`
  et `labelStyle`. Double garde-fou anti-icône invisible côté web/WebKit : couleur passée
  explicitement dans `stroke` (jamais `currentColor`) et enveloppe `View` de taille fixe.
- **Chevauchement corrigé** : `src/nav.ts` (`ONGLETS_NATIFS`, `hauteurOngletsNatifs`) décale la barre de
  panier flottante et le bas des listes (client + admin) quand la barre d'onglets native translucide
  d'iOS 26 recouvre le contenu.
- Tests : 57/57 backend + vérification runtime (0 SVG de taille nulle, 0 `currentColor`) en mobile et
  desktop, client et admin (itération 5).

## Implémenté — ajout du 15/09/2026 (v1.5)
- **Rôle Super Admin et hiérarchie RBAC** : `superadmin > admin > livreur > client`, appliquée côté
  serveur (`NIVEAUX` / `require_admin` par niveau / `require_superadmin` dans `backend/server.py`).
  Le superadmin conserve tous les droits admin ; l'admin perd la création et la suppression de comptes.
- **Section « Personnel » réservée au superadmin** (`app/(admin)/personnel.tsx`, 5e onglet masqué pour
  les autres rôles) : liste des comptes admin + livreur, création d'un Admin (nom, email, téléphone,
  mot de passe initial) ou d'un Livreur (nom, téléphone, véhicule, plaque, mot de passe),
  activation/désactivation et suppression.
- **Nouvelles routes** : `GET /api/superadmin/comptes`, `POST /api/superadmin/admins`,
  `PATCH /api/superadmin/comptes/{id}/actif`, `DELETE /api/superadmin/comptes/{id}`.
  `POST` et `DELETE /api/admin/livreurs` sont désormais réservés au superadmin (le `PUT` reste admin).
- **Champ `actif`** : un compte désactivé est bloqué à la connexion (téléphone, OTP et Google) et sur
  toute requête authentifiée, même avec un jeton déjà émis. Garde-fous : impossible de supprimer son
  propre compte, ni de cibler un client ou un autre superadmin.
- **Seed idempotent du superadmin** (`0800000000` / `super123`) via `$setOnInsert`, plus migration
  `actif: true` pour les comptes existants.
- **Bascule œil sur tous les mots de passe** : `src/components/Champ.tsx` affiche une icône Heroicon
  œil / œil barré à l'intérieur du champ, alignée à droite, masqué par défaut, sans changement de
  hauteur (inscription, connexion, création Admin/Livreur).
- Tests : 73/73 backend (dont 16 nouveaux tests RBAC) + parcours frontend superadmin, admin, livreur
  et client validés (itération 6).

## Implémenté — ajout du 15/09/2026 (v1.6)
- **Super admin unique** : le compte du propriétaire (`SUPERADMIN_EMAIL` = `mecedloga@gmail.com`,
  +243992113682) est promu superadmin au démarrage ; tout autre superadmin est rétrogradé en admin et
  l'ancien compte de démo `0800000000` a été supprimé. Connexion via Google uniquement (pas de mot de
  passe applicatif).
- **Suppression de compte client** (exigence Apple) : `DELETE /api/auth/moi` réservé aux clients, avec
  double confirmation dans l'écran Compte. Le profil, les adresses, les OTP et les sessions sont
  effacés ; les commandes sont **conservées anonymisées** (`userId: "anonyme"`,
  `clientNom: "Client supprime"`, téléphones vidés, `anonymisee: true`) pour la comptabilité.
- **Gestion des catégories par l'admin** : nouvelle collection `categories` (initialisée depuis les
  produits existants), `GET /api/categories` devenu dynamique, plus
  `GET|POST /api/admin/categories` et `DELETE /api/admin/categories/{id}`. La suppression d'une
  catégorie supprime aussi ses produits et renvoie `produitsSupprimes`. UI : bouton « Catégories »
  dans le catalogue admin (ajout, compteur de produits, suppression avec confirmation) ; les chips
  du catalogue client et du formulaire produit sont désormais alimentées par l'API.
- Tests : 90/90 backend (17 nouveaux) + parcours frontend admin et client validés (itération 7).

## Implémenté — ajout du 15/09/2026 (v1.7)
- **Finalisation des notifications push** : plus aucune popup système au démarrage. Nouvelle carte
  « Notifications » (`src/components/CarteNotifications.tsx`) qui explique le bénéfice AVANT la
  demande d'autorisation, gère les états accordé / refusé / bloqué (bouton « Ouvrir les réglages »
  via `Linking.openSettings()`), montée dans l'écran Compte client, le dashboard admin et l'écran
  Courses du livreur. `src/push.ts` expose `etatPush`, `enregistrerToken` et `demanderPush` ;
  `GestionPush` ne rafraîchit plus que le token, silencieusement, à chaque retour au premier plan.
- Tests : 90/90 backend + non-régression web des 3 écrans concernés (itération 8). Rappel : la
  réception réelle en arrière-plan n'est vérifiable qu'après Publish + build natif, avec la clé
  `EMERGENT_PUSH_KEY` injectée au déploiement et le `google-services.json` Android fourni par
  le propriétaire (package `com.emergent.commanderose.bbj4fa`).
- **Android push prêt** : `frontend/google-services.json` (projet Firebase `pinkberry-drc`) fourni par
  le propriétaire et redéclaré via `expo.android.googleServicesFile`. iOS passe par le push managé
  Emergent (jetons natifs), aucun fichier Firebase iOS nécessaire.
- **Durcissement déploiement** (health check) : seed non destructif (plus de `delete_one` au
  démarrage), comptes de démo pilotés par `SEED_DEMO_ACCOUNTS` + mots de passe en variables
  d'environnement (aucun mot de passe en clair dans le code), polices Fredoka et Nunito
  désormais embarquées dans `assets/fonts` au lieu d'être téléchargées au lancement.

## Implémenté — ajout du 15/09/2026 (v1.8)
- **Page « Paramètres » de l'administration** (`app/(admin)/parametres.tsx`, hors barre d'onglets,
  accessible par l'engrenage en haut du tableau de bord) : point d'entrée central structuré en
  sections — Mon compte (Modifier le profil, Changer le mot de passe avec bascule œil), Commandes
  (Archives), Boutique (taux de change / catalogue, zones, comptes du personnel pour le super admin)
  et Se déconnecter. Ajouter un réglage = ajouter une `<Section>` ou une `<Ligne>`.
- **Nouvelles routes compte** : `PUT /api/auth/profil` (nom, email, téléphone avec contrôle
  d'unicité ; rôle et `actif` non modifiables) et `PUT /api/auth/motdepasse` (vérifie l'ancien mot de
  passe, minimum 6 caractères, permet à un compte Google sans mot de passe d'en définir un).
- **Archivage puis suppression des commandes** : `POST /api/admin/commandes/{id}/archiver`
  (livrées ou annulées uniquement), `POST .../desarchiver`, `GET /api/admin/commandes/archives`,
  `DELETE /api/admin/commandes/{id}` (refusé tant que la commande n'est pas archivée).
  `GET /api/admin/commandes` exclut désormais les archivées, mais `/admin/stats` et `/admin/ventes`
  continuent de les compter. UI : bouton « Archiver » sur les commandes livrées/annulées du tableau
  de bord, écran Archives (`app/(admin)/archives.tsx`) avec Restaurer et Supprimer + confirmation.
- Tests : 115/115 backend (25 nouveaux) + parcours frontend admin validés (itération 9).

## Correctif — 15/09/2026 (v1.8.1)
- **Bug « bouton Paramètres non cliquable » sur téléphone** : les écrans Paramètres et Archives
  étaient des onglets masqués du groupe `(admin)`. Sur iOS 26 (onglets natifs `NativeTabs`), un
  `router.push` vers un onglet masqué ne navigue pas → bouton apparemment mort, alors que le web
  fonctionnait. Corrigé en sortant les deux écrans du groupe d'onglets : ils sont désormais des
  routes de pile de premier niveau `app/admin/parametres.tsx` (`/admin/parametres`) et
  `app/admin/archives.tsx` (`/admin/archives`), sans aucune déclaration d'onglet masqué.
  Les raccourcis vers les onglets (catalogue, zones, personnel) utilisent `router.replace`.
- **Leçon pour les tests** : un écran hors barre d'onglets doit être validé par lecture de code en
  plus du web, car `NativeTabs` n'est pas rendu dans l'aperçu web.
- Tests : 115/115 backend + navigation admin revérifiée (itération 10).

## Implémenté — ajout du 15/09/2026 (v1.9)
- **Rapport des commandes par période** : `GET /api/admin/rapport?debut&fin&format=xlsx|pdf`
  (openpyxl + reportlab, commandes archivées incluses) — colonnes numéro, date, client,
  adresse/commune, articles, total USD, statut, livreur, plus un récapitulatif (nombre de commandes,
  chiffre d'affaires des livrées, livraisons réussies, commandes annulées). Écran
  `app/admin/rapports.tsx` (`/admin/rapports`, accessible depuis Paramètres) avec filtres rapides
  aujourd'hui / cette semaine / ce mois, période personnalisée et téléchargement Excel ou PDF
  (partage natif via `expo-file-system` + `expo-sharing`, téléchargement direct sur le web).
- **Zones entièrement gérées par l'admin** : `POST /api/admin/zones` (nom + activation, refus des
  doublons insensibles à la casse) et `DELETE /api/admin/zones/{id}`. Écran Zones refondu avec ajout,
  bascule d'activation et suppression confirmée ; retirer une zone la rend immédiatement
  indisponible côté client (sélecteur d'adresse et contrôle serveur à la commande).
- **Archivage automatique** : champ `termineeAt` posé à chaque passage en livrée/annulée et helper
  `archiver_anciennes()` (appelé par `GET /api/admin/commandes`) qui archive les commandes livrées
  depuis plus de `ARCHIVAGE_AUTO_JOURS` jours (10 par défaut), marquées `archivageAuto`.
  Les annulées restent archivables manuellement.
- Tests : 136/136 backend (21 nouveaux) + parcours frontend admin validés (itération 11).

## Correctifs — 15/09/2026 (v1.9.1)
- **Taux de change durable** : `lire_config()` lit toujours le document `{cle:"global"}` de la
  collection `parametres` (les variables d'env `TAUX_FC`/`FRAIS_LIVRAISON` ne servent qu'à la
  création initiale) ; `GET /api/config` répond avec `Cache-Control: no-store` ;
  `PUT /api/admin/config` fait un `update_one` (`$set` + `$setOnInsert`, upsert) et renvoie la config
  relue en base ; le seed de démarrage reste en `$setOnInsert` (jamais d'écrasement).
  Côté client, `enregistrerTaux` affiche la valeur renvoyée par le serveur puis refetch `["config"]`,
  et `TauxProvider` utilise `staleTime: 0` + `refetchOnMount: "always"`.
  Cause racine complémentaire : d'anciens tests (`test_final_taux_is_2800`, `test_config`,
  `test_non_regression_config`) remettaient le taux à 2800 à chaque exécution — ils restaurent
  désormais la valeur initiale. **Ne jamais remettre 2800 en dur dans un test.**
- **Page de bienvenue** : revenue à la photo `livreur-pinkberry.png` (choix utilisateur du 15/09/2026,
  la scène emoji `HeroLivreur` a été supprimée).
- Tests : 152 tests backend (itération 12) + parcours admin/bienvenue validés.

## Préparation au déploiement — 16/09/2026
- `frontend/.env` : valeur `METRO_CACHE_ROOT` mise entre guillemets (env malformée = bloqueur de build).
- `frontend/app.json` : entrée de plugin `@react-native-vector-icons/feather` retirée (paquet non utilisé,
  toutes les icônes viennent de `react-native-heroicons`). `npx expo config --type introspect` sort en 0.
- `backend/server.py` : suppression des requêtes N+1 — `enrichir()` accepte des maps pré-chargées et
  `enrichir_lot()` charge livreurs + positions en 2 requêtes (utilisé par `/commandes/mes`,
  `/admin/commandes`, `/admin/commandes/archives`, `/livreur/courses`) ; `/admin/categories` compte les
  produits via une agrégation ; `/admin/livreurs` charge les positions en une seule requête `$in`.
- Tests : `test_iteration12` ne redémarre plus le backend (cela provoquait des 502 sur les tests en
  parallèle) — il rejoue l'opération de seed directement en base. `test_commande_refus_zone_non_couverte`
  désactive lui-même la zone testée puis restaure son état.
- Reste en avertissement (non bloquant) : push iOS non configuré (il manque `GoogleService-Info.plist`
  et `expo.ios.googleServicesFile`) ; l'Android est configuré via `google-services.json`.

## Espace client — 16/09/2026 (v2.0)
- **Paramètres client** (`app/client/parametres.tsx`, route `/client/parametres`, accessible depuis
  l'onglet Compte) : choix de langue FR/EN, 3 interrupteurs de notifications (suivi de commande,
  promotions, nouveautés du menu), modification du profil, changement de mot de passe (icône œil via
  `Champ`), accès aux archives et partage de l'application (`Share` natif / `navigator.share` sur web).
- **Préférences serveur** : `PUT /api/auth/preferences` (langue + 3 notifs) stockées sur le document
  utilisateur et renvoyées par `public_user`/`GET /auth/moi`. `notifier_client()` respecte
  `notifSuivi` et n'envoie plus de push si le client l'a coupé.
  Le lien de partage utilise `EXPO_PUBLIC_APP_STORE_URL` si défini (à remplir dès que les liens
  Play Store / App Store existent), sinon le lien web de l'app.
- **Internationalisation** : `src/i18n.tsx` (dictionnaires FR/EN + `LangueProvider` + `useT()` avec
  interpolation `{var}`). Langue persistée localement (`pb_langue`) ET sur le compte. Écrans traduits :
  Paramètres, Compte, Commandes, Archives, onglets, Accueil, Panier, Adresse, Confirmation, Suivi, Étapes.
- **Archiver puis supprimer côté client** : `clientArchivee` / `clientMasquee` sur la commande.
  `POST /api/commandes/{id}/archiver`, `POST /api/commandes/{id}/desarchiver`,
  `DELETE /api/commandes/{id}/masquer` (uniquement si archivée) et `GET /api/commandes/mes/archives`.
  `GET /api/commandes/mes` exclut les archivées et masquées. La suppression ne touche QUE la vue
  client : la commande reste dans `/admin/commandes` et dans les rapports.
- **Typographie plus affirmée** : `src/gras.ts` patche `Text.render` pour un poids 600 par défaut
  (les styles explicites 700/800 restent prioritaires) et `theme.poids` expose `corps/titre/fort`.

## Produit mis en avant — 16/09/2026 (v2.1)
- **Admin** : champ `enAvant` sur `ProduitIn` (POST/PUT `/api/admin/produits`), interrupteur
  `switch-en-avant` « Mettre en avant / Recommander » dans la fiche produit du catalogue et badge
  « ⭐ Recommandé » sur la carte du produit. Le seed normalise les anciens produits (`enAvant: false`).
- **Client** : `src/components/BanniereRecommandes.tsx` — bannière dégradé rose
  (`brandPrimary → brandSecondary`, `expo-linear-gradient`), badge « ⭐ Recommandé », accroche
  « Les coups de cœur Pinkberry », affichée en tête de l'accueil avant « Commander à nouveau » et
  « Notre carte ». Un seul produit = grande carte, plusieurs = carrousel horizontal
  (`carrousel-recommandes`). Masquée pendant une recherche. Textes traduits FR/EN.
- Tests : 173/173 backend (itération 15) + parcours admin et client validés.

## Livreur : archives + rapport, langue admin — 16/09/2026 (v2.2)
- **Choix de la langue côté admin** : section Langue dans `app/admin/parametres.tsx`
  (`btn-langue-admin-fr` / `btn-langue-admin-en`) ; écran Paramètres admin traduit via les clés
  `admin.*` de `src/i18n.tsx`. Suppression de la clé `params.langueDetail` (texte d'aide retiré).
- **Livreur — archiver puis supprimer** : champs `livreurArchivee` / `livreurMasquee` sur la commande.
  `POST /api/livreur/courses/{id}/archiver` (course terminée uniquement),
  `POST /api/livreur/courses/{id}/desarchiver`, `DELETE /api/livreur/courses/{id}/masquer`
  (uniquement si archivée) et `GET /api/livreur/courses/archives`. `GET /api/livreur/courses` exclut
  archivées et masquées. Rien n'est supprimé en base : la commande reste côté admin et dans les rapports.
  Écrans : bouton Archiver sur les courses terminées + en-tête avec accès Archives et Rapports
  (`app/livreur/archives.tsx`).
- **Livreur — rapport par période** : `GET /api/livreur/rapport?debut&fin&format=xlsx|pdf` (colonnes
  `COLONNES_RAPPORT_LIVREUR` : n° commande, date, adresse/commune, cash encaissé, statut ; récapitulatif
  courses effectuées / livraisons réussies / annulées / total cash). Écran `app/livreur/rapports.tsx`.
  `construire_xlsx` et `construire_pdf` acceptent désormais des colonnes et un récapitulatif
  paramétrables ; l'écran de téléchargement est partagé (`src/components/EcranRapport.tsx`) entre
  admin et livreur.
- Tests : 190 tests backend (17 nouveaux, itération 16) + parcours livreur, admin et client validés.
  Note : `test_iteration9`/`test_iteration11` peuvent échouer en exécution parallèle (données
  partagées) mais passent en isolation.

## Mode sombre — 16/09/2026 (v2.3)
- **Préférence `theme`** (`clair` / `sombre` / `systeme`) ajoutée à `PreferencesIn` et `PREFS_DEFAUT`
  côté backend (`PUT /api/auth/preferences`), persistée sur le compte et en local (`pb_theme`).
- **Palette sombre** dans `src/theme.ts` (`dark` : fond `#1A1016`, cartes `#241820`, bordures
  `#3A2B34`, textes clairs ; rose `#E6156F` et vert `#8DC63F` conservés comme accents).
  `colors` est désormais un Proxy qui résout la couleur à la lecture, et
  `stylesDynamiques(() => StyleSheet.create({...}))` recalcule (et met en cache) la feuille pour
  chaque thème — équivalent des variables CSS + `data-theme` en React Native.
  Les 47 fichiers d'écrans/composants ont été convertis par `scripts/theme-dynamique.py` ; chaque
  écran appelle `useTheme()` (contexte `src/theme-contexte.tsx`) pour se redessiner au changement.
- **Réglage Thème** : composant `src/components/ChoixTheme.tsx` (`btn-theme-clair` /
  `btn-theme-sombre` / `btn-theme-systeme`) dans les Paramètres client, admin et le nouvel écran
  `app/livreur/parametres.tsx` (accessible via l'icône engrenage de l'app livreur).
  `StatusBar` et `Appearance` suivent le thème actif.
- **Expo Go Android** (« new update available, downloading ») : diagnostic — le manifeste et le bundle
  Android sont servis correctement (200, ~12 Mo en ~11 s). Causes côté appareil : version d'Expo Go
  antérieure au SDK 57, cache Expo Go, ou réseau lent pendant le téléchargement du bundle de dev.
- Tests : 190/190 backend.

## Page Bienvenue v3 + spinner logo — 16/09/2026 (v2.4)
- Nouvelle image `assets/images/livreur-pinkberry-v2.webp` (livreur 3D sur scooter rose, fond
  transparent) à la place de `livreur-pinkberry.png`.
- **Refonte `app/(auth)/bienvenue.tsx`** inspirée de la référence fournie : carte à coins arrondis,
  en-tête centré (spirale `Swirl` + « pinkberry » + trait fin + sous-titre « LIVRAISON »), zone
  illustration en aplat rose pâle (`brandTertiary`) avec motif de lignes SVG en coin haut droit,
  illustration imposante animée (flottement `Animated.loop`), vague SVG (couleur `surface`) entre
  l'illustration et le bas, slogan puis CTA « Créer un compte » (rose plein) et « J'ai déjà un compte ».
  Compatible clair/sombre (via `stylesDynamiques`) et responsive 360 → 1280 px.
- **Spinner logo** : `src/components/Chargement.tsx` (spirale du logo en rotation) remplace
  `ActivityIndicator` dans 16 écrans (accueil, commandes, archives client/admin/livreur, dashboard,
  catalogue, zones, livreurs, personnel, suivi, course, rapports, index, chargement des polices).
  `ActivityIndicator` ne subsiste que dans les boutons.
- Tests : 200/200 backend, refonte validée en clair et sombre, persistance du thème après
  déconnexion confirmée (itérations 18 et 19).

## Écran de démarrage + Connexion/Inscription stylés — 16/09/2026 (v2.5)
- `src/components/DecorAuth.tsx` (partagé) : `MotifCoin`, `Vague`, `EnteteMarque` (spirale +
  « pinkberry » + trait + « LIVRAISON », option `anime` pour faire tourner la spirale) et
  `CarteAuth` (carte blanche arrondie plein écran des écrans d'authentification).
- `src/components/EcranDemarrage.tsx` : écran de démarrage reprenant la mise en page Bienvenue
  (logo qui tourne, illustration flottante sur aplat rose, vague, slogan + « Chargement… »).  Branché dans `app/index.tsx` (testID `ecran-chargement`) et dans `app/_layout.tsx` pendant le
  chargement des polices (testID `ecran-demarrage-polices`) — n'utilise pas les safe-area insets
  car rendu avant `SafeAreaProvider`.
- `app/(auth)/connexion.tsx` et `app/(auth)/inscription.tsx` réécrits dans `CarteAuth` :
  en-tête de marque centré, titres centrés, bouton retour rond en position absolue, formulaires
  inchangés (KeyboardAwareScrollView conservé). `bienvenue.tsx` réutilise désormais `DecorAuth`.
- Tests : itération 20 — splash, connexion, inscription, responsive 360→1280 et mode sombre
  validés ; 200/200 backend.
- Ajustement : illustration `image-livreur` agrandie sur Bienvenue (largeur = 1,45 × largeur de la
  carte, hauteur plafonnée à 54 % de la hauteur d'écran) pour un rendu imposant au centre tout en
  gardant les deux boutons visibles sans scroll dès 360 × 640.
- Marque écrite « Pinkberry » (P majuscule) dans `EnteteMarque`.

## Gardes de routes par rôle + bannière recommandée — 16/09/2026 (v2.6)
- **Bannière recommandée** (`src/components/BanniereRecommandes.tsx`) : la racine n'est plus un
  `LinearGradient` mais une `View` à fond plein `brandPrimary` avec le dégradé en calque absolu →
  la bannière reste visible même si le dégradé natif ne rend pas (cas signalé sur Expo Go).
- **Protection des routes** : `src/components/Garde.tsx` expose `Garde`, `GardeInvite`,
  `useBlocage`, `accueilDuRole`, `TOUS_ROLES`. Un accès interdit redirige vers l'accueil du rôle,
  un visiteur non connecté vers `/bienvenue`, un connecté sur les écrans d'auth vers son accueil.
  - `(auth)` → visiteurs uniquement ; `(client)` + `client/*` + `suivi/*` + `(commande)/*` → client ;
    `(livreur)` + `livreur/*` → livreur ; `(admin)` + `admin/*` → admin/superadmin ;
    `/personnel` → superadmin (redirection `/dashboard` sinon) ; `/telephone` → tout connecté.
  - `panier.tsx`, `adresse.tsx`, `confirmation.tsx` déplacés dans `app/(commande)/`
    (URLs `/panier`, `/adresse`, `/confirmation` inchangées) pour bénéficier d'un layout gardé.
- Côté serveur les permissions existaient déjà (`require_admin`, `require_superadmin`,
  `require_livreur`) — couvertes par `backend/tests/test_iteration21.py`.
- Tests : itération 21 — 228/228 backend, 22/22 URLs bloquées hors connexion, matrices
  client/livreur/admin conformes, bannière validée en clair et sombre.

## Cartographie Leaflet + TomTom — 17/09/2026 (v2.7)
- Choix utilisateur : Google Maps écarté (payant) → **Leaflet + TomTom** (offre gratuite).
  Clé dans `backend/.env` (`TOMTOM_API_KEY`), jamais exposée au client.
- Backend (`server.py`, section « cartographie ») :
  - `GET /api/carte/tuiles/{z}/{x}/{y}.png` : relais des tuiles TomTom (public, bornes validées,
    cache 24 h) — c'est cette URL que Leaflet consomme.
  - `GET /api/carte/recherche?q=` (jeton requis) : autocomplétion d'adresses Kinshasa
    (`countrySet=CD`, biais lat/lng Kinshasa) → `{id, libelle, detail, commune, avenue, lat, lng}`.
  - `POST /api/carte/itineraire` (jeton requis) : itinéraire routier réel (travelMode moto, trafic
    live) → `{points, distanceMetres, etaSecondes, heureArrivee}`.
- Frontend :
  - `src/components/Carte.tsx` : tuiles TomTom, tracé de route continu quand l'itinéraire est
    disponible (sinon trait pointillé), et **carte visible aussi sur le web** (iframe Leaflet au
    lieu de l'ancien encadré de coordonnées).
  - `src/itineraire.ts` : hook `useItineraire` + formats `dureeLisible` / `distanceLisible`.
  - `/suivi/[id]` : pastille ETA réelle (« 2 min · 689 m ») pendant `en_route`.
  - `/course/[id]` (livreur) : bloc « Arrivée estimée dans … ».
  - `/adresse` : champ de recherche avec suggestions TomTom (debounce 350 ms) qui remplit
    avenue + commune + coordonnées GPS.
- Tests : itération 22 — 248/248 backend (dont `test_iteration22.py`), aucune fuite de clé,
  autocomplétion et carte web validées ; ETA `en_route` vérifiée manuellement.

## Préparation production — 21/09/2026 (v2.8)
- Health check déploiement : aucun blocage (compilation OK, backend 0.0.0.0:8001, `/health`,
  permissions et `google-services.json` Android présents). Avertissements non bloquants : URLs
  Emergent internes codées en dur (normal, playbooks) et push iOS non configuré (nécessite un
  `GoogleService-Info.plist`).
- **Mode démonstration** : `/api/config` renvoie désormais `demo` (= `SEED_DEMO_ACCOUNTS`).
  L'écran Connexion n'affiche le bloc « Comptes de démonstration » que si `demo` est vrai.
  En production, mettre `SEED_DEMO_ACCOUNTS=false` dans le panneau de déploiement : les comptes
  de démo ne sont pas créés et le bloc disparaît automatiquement (vérifié dans les deux états).
- Taux de change et zones : la prod démarre sur les valeurs par défaut, à reconfigurer depuis
  l'admin après déploiement (choix utilisateur).

## OTP email réel, carte Leaflet servie par le backend, options produit — 21/09/2026 (v2.9)
- **OTP par email** : nouvelle `EMERGENT_EMAIL_KEY` (l'ancienne renvoyait 401) → l'intégration
  répond 202. `codeDemo` n'est plus renvoyé que si `SEED_DEMO_ACCOUNTS=true` ou si l'envoi a
  échoué ; l'écran `/otp` affiche alors `bloc-email-echoue` invitant à renvoyer le code.
- **Carte Leaflet** : nouvelle page HTML servie par le backend
  `GET /api/carte/vue?clat&clng&dlat&dlng&fond&accent&livreurCouleur`. `Carte.tsx` la charge par
  URL (WebView `source={{uri}}` sur mobile, iframe sur web) au lieu d'injecter du HTML — ce qui
  corrige l'affichage natif (scripts distants bloqués sur Android avec du HTML injecté). Les
  positions et le tracé sont poussés par `postMessage` / `injectJavaScript` : le repère du livreur
  bouge sans recharger la page.
- **Traçage validé de bout en bout** : 3 positions livreur successives → repère qui se déplace,
  `pastille-eta` client et `bloc-eta-livreur` mis à jour (TomTom, ex. « 2 min · 623 m »).
- **Tailles et garnitures éditables par l'admin** : `src/components/ListeOptions.tsx`
  (ajout/renommage/montant/suppression ligne par ligne) remplace les anciens interrupteurs
  on/off dans le formulaire produit. Convention : `Taille.ecart` = supplément, `Garniture.prix`
  = prix, saisis dans `Option.valeur` (texte) puis convertis en nombre à l'enregistrement.
  Listes vides acceptées (produit commandé tel quel).
- Tests : itération 23 — 262/262 backend (dont `test_iteration23.py`), traçage live, CRUD options
  et OTP email validés. Limite connue : l'intégration email partage un quota (429 en rafale).
- 21/09 (suite) : suppression définitive des blocs de démonstration dans l'UI — plus de
  « Comptes de démonstration » sur `/connexion` ni de « Code de démonstration » sur `/otp`
  (quel que soit `SEED_DEMO_ACCOUNTS`). Le backend continue de renvoyer `codeDemo` en mode démo
  pour les tests automatisés, mais l'app ne l'affiche plus ; en cas d'échec d'envoi l'écran OTP
  affiche `bloc-email-echoue`.

## Écran OTP en carte + migration Mapbox — 21/09/2026 (v3.0)
- `/otp` utilise `CarteAuth` + `EnteteMarque` comme Connexion / Inscription (bouton retour rond).
- **Cartographie migrée de Leaflet + TomTom vers Mapbox GL JS** (choix utilisateur) :
  - `GET /api/carte/vue` sert une page **Mapbox GL JS** (styles `light-v11` / `dark-v11`),
    repère client rose `#E6156F`, repère livreur vert `#8DC63F`, tracé rose ; `mode=choix`
    ajoute un **repère déplaçable** qui remonte la position (`postMessage` / `ReactNativeWebView`).
    L'endpoint `/api/carte/tuiles` (tuiles TomTom) a été supprimé.
  - `POST /api/carte/itineraire` : **Mapbox Directions** (`driving-traffic`) → tracé réel + ETA.
  - `GET /api/carte/zone?lat&lng` : géocodage inverse Mapbox → commune + couverture.
  - `POST /api/commandes` refuse une adresse dont les **coordonnées GPS** tombent hors des
    communes couvertes, même si la commune saisie est couverte (`commune_des_coords`).
  - **La recherche d'adresse reste TomTom** : Mapbox ne renvoie aucune avenue de Kinshasa
    (« avenue de la Justice » → 0 résultat, « Boulevard du 30 Juin » → résultats en France).
  - `/adresse` : debounce 300 ms, carte `carte-choix-adresse` avec repère déplaçable, commune
    détectée par GPS prioritaire, alerte `alerte-zone-gps` hors zone, champ point de repère conservé.
- `MAPBOX_TOKEN` dans `backend/.env` ; le token public `pk.*` apparaît volontairement dans la page
  carte servie (usage client normal de Mapbox GL JS).
- Tests : itération 24 — `test_iteration24.py` 21/21, suite 274/275 (échec restant :
  `test_livreur_flow_position_and_encaisser`, fragilité d'ordonnancement pré-existante).

## Paiement Mobile Money (PawaPay) — 22/09/2026 (v3.1)
- Agrégateur **PawaPay** (sandbox), providers RDC : `VODACOM_MPESA_COD` (CDF sans décimales),
  `AIRTEL_COD`, `ORANGE_COD`. Clés uniquement dans `backend/.env` :
  `PAWAPAY_BASE_URL`, `PAWAPAY_TOKEN`, `PAWAPAY_CALLBACK_URL`, `PAWAPAY_SIGNED_CALLBACKS`.
  Passage en production = remplacer base URL + token (aucun changement de code).
- Backend (`server.py`, section « paiements mobile money ») :
  - `GET /api/paiements/operateurs` — opérateurs et devises disponibles.
  - `POST /api/paiements/mobile-money` — crée le dépôt (montant en chaîne, `depositId` UUID
    réservé avant l'appel), normalise le MSISDN en 243XXXXXXXXX, convertit en CDF au taux admin,
    respecte les décimales par opérateur, et laisse la commande **non payée** (`statut: attente`).
  - `GET /api/paiements/{depositId}` — statut `attente` / `paye` / `echoue` / `expire`
    (10 min sans état final), avec interrogation PawaPay de secours.
  - `POST /api/paiements/pawapay/callback` — **signature RFC 9421 (ECDSA P-256) + content-digest
    vérifiés** (clés publiques chargées au démarrage) ; transition atomique idempotente qui seule
    marque la commande payée.
  - `POST /api/paiements/{commandeId}/cash` — repli « payer à la livraison » après échec.
  - `POST /api/commandes` accepte `modePaiement` (`cash` par défaut) ; le champ `paiement` de la
    commande est désormais un objet `{mode, operateur, devise, montant, telephone masqué,
    depositId, statut}` et `paye` est un booléen.
  - Rapports admin : colonnes « Paiement » et « Statut paiement ».
- Frontend : `src/components/ChoixPaiement.tsx` (cash / mobile money, opérateur, numéro, devise
  USD ou CDF avec équivalent affiché) et `src/components/AttentePaiement.tsx` (modale
  « En attente de confirmation… », puis Paiement confirmé, ou Échec/Délai dépassé avec
  « Réessayer » et « Payer à la livraison »). `/dashboard` admin affiche le mode et le statut de
  paiement par commande (`paiement-<numero>`) et dans la feuille de détail.
- Tests : itération 25 — `test_iteration25.py` 19/19 (dont les 3 scénarios de callback non signé
  refusés sans modifier la commande), parcours checkout mobile money validé de bout en bout en
  sandbox (attente → payé → suivi). Textes des écrans de paiement en français uniquement.
- 22/09 : les opérateurs sont représentés par leurs **logos officiels** (tuiles blanches avec
  contour rose et coche quand sélectionné) — `assets/images/mpesa.png`, `airtel.png`,
  `orange.png` (SVG Wikimedia Commons convertis en PNG), plus d'étiquettes texte.

## Backlog priorisé
### P0
- Aucun (MVP fonctionnel de bout en bout)
### P1
- Notifications de changement de statut (nécessite un build natif)
- Adresses enregistrées réutilisables (choisir « Maison » sans resaisir)
- Recherche d'adresse / pose du pin sur la carte
- Email de confirmation de commande (dès que la clé email est provisionnée)
### P2
- Codes promo et programme de fidélité
- Créneaux de livraison programmée
- Statistiques admin par produit / par jour
- Migration des styles `shadow*` vers `boxShadow` (warnings web uniquement)

## Prochaines tâches
1. Adresses enregistrées + sélection rapide au checkout
2. Pin déplaçable sur la carte pour affiner la position de livraison
3. Tableau de bord admin : chiffre d'affaires par jour et produits les plus vendus

## Web app responsive + PWA (juin 2026)
Le produit n'est plus une app « format téléphone » : c'est une **web app responsive** utilisable
depuis n'importe quel navigateur (ordinateur et mobile), tout en restant une app Expo native.

### Points de rupture (`src/reactif.ts`)
`sm 480` · `md 768` · `lg 1024` · `xl 1440`. Hook `useEcran()` → `{ largeur, mobile, tablette,
bureau, large, colonnes }`. Largeurs centrées réutilisables : `LARGEUR_ETROITE` 520 (auth),
`LARGEUR_CONTENU` 760 (formulaires, listes, suivi), `LARGEUR_GRILLE` 1160 (catalogue client),
`LARGEUR_LARGE` 1280 (back office), `LARGEUR_FEUILLE` 640 (modales / bottom sheets).

### Client
- Onglets en **barre haute** à partir de 1024 px (web), en bas sur mobile/tablette.
- En-tête (logo, recherche, catégories) et listes centrés, largeur max.
- **Grille produits** : 1 colonne (<768), 2 (768-1023), 3 (1024-1439), 4 (≥1440) ; la dernière
  rangée est complétée par des cellules invisibles pour conserver la largeur des cartes.
- Barre panier flottante bornée à 520 px et centrée ; pied de page panier/adresse/confirmation
  borné à 760 px.
- Cartes auth (bienvenue, connexion, inscription, OTP) : boîte centrée 520 × max 760 px sur
  grand écran au lieu d'occuper toute la hauteur.

### Back office admin
- **Navigation latérale** 252 px (`src/components/BarreLaterale.tsx`) à partir de 1024 px web :
  marque Pinkberry + Commandes / Catalogue / Zones / Livreurs / Personnel (super admin),
  puis Rapports / Archives / Paramètres. Onglets bas conservés sur mobile.
- Dashboard : bloc « Ventes du jour » et KPI en 2 colonnes, puis **tableau large 7 colonnes**
  (Commande, Client, Adresse, Livreur, Paiement, Statut, Total) ; cartes empilées sur mobile.
- Modale de détail : boîte de dialogue centrée (≤ 680 px) sur desktop, bottom sheet sur mobile.

### Livreur
Grille de courses 1/2/3 colonnes, en-tête centré, cartes de suivi Mapbox agrandies sur desktop
(suivi 420 px, course 400 px, choix d'adresse 360 px).

### PWA
`public/manifest.json` (nom Pinkberry Drc, `display: standalone`, `theme_color #E6156F`,
icônes 192/512 + maskable), `public/sw.js` (réseau d'abord, cache de secours, `/api/*` exclu),
métadonnées et enregistrement du service worker dans `app/+html.tsx` (+ apple-touch-icon,
`apple-mobile-web-app-*`). L'app reste installable sur l'écran d'accueil mobile et desktop.

### Validation
Itération 26 (testing agent, frontend) : 7/7 scénarios PASS — desktop 1440 client/admin/livreur,
mobile 390 non-régression, tablette 820, mode sombre, manifest + service worker en 200.

## Bascule en application web desktop-first (juin 2026, itérations 27-28)
Le produit **n'est plus une application mobile** : c'est une **application web** conçue pour le
navigateur (desktop d'abord, mobile en adaptation). Le back-end, le modèle de données et toutes
les fonctionnalités métier sont inchangés ; seule la couche interface a changé.

### URLs (routage web, `expo-router` + `<Slot/>`)
- Visiteur : `/bienvenue` (page d'accueil du site), `/connexion`, `/inscription`, `/otp`, `/telephone`
- Client : `/menu`, `/panier`, `/commande/adresse`, `/commande/paiement`, `/commandes`,
  `/suivi/{id}`, `/compte`, `/parametres`, `/archives`
- Admin : `/admin`, `/admin/catalogue`, `/admin/zones`, `/admin/livreurs`, `/admin/personnel`,
  `/admin/rapports`, `/admin/archives`, `/admin/parametres`
- Livreur : `/livreur`, `/livreur/course/{id}`, `/livreur/rapports`, `/livreur/archives`,
  `/livreur/parametres`
Les anciens groupes `(admin)`, `(livreur)`, `(commande)`, `client/`, `suivi/` et les navigateurs
d'onglets Expo ont été supprimés : la navigation se fait par **liens** (`router.push`), donc le
**bouton retour du navigateur** fonctionne et chaque page est partageable par URL.

### Coquille d'interface (`src/components/Coquille.tsx`, `src/nav-web.ts`)
- ≥ 1024 px : **header web** (logo, liens de pages, bouton panier avec total + badge, déconnexion)
  pour le client et le livreur ; **sidebar fixe 252 px** pour le back office (5 sections + Rapports /
  Archives / Paramètres + déconnexion).
- < 1024 px : header compact + **barre d'onglets basse** (choix explicite de l'utilisateur).
- `src/components/TitrePage.tsx` : titre de page, sous-titre, lien retour, actions à droite.

### Pages clés
- `/bienvenue` : hero web 2 colonnes (accroche, arguments, CTA) + illustration ; carte compacte sur mobile.
- `/menu` : hero + recherche, **colonne de filtres catégories**, grille produits 1/2/3/4 colonnes,
  fiche produit en **modale centrée** (bottom sheet sur mobile).
- `/panier` : 2 colonnes (articles + récapitulatif sticky).
- `/commande/adresse` → `/commande/paiement` : tunnel en 2 étapes annoncées (« Étape 1/2 »).
- `/suivi/{id}` : 2 colonnes (carte Mapbox à gauche ; progression, livreur, détail, annulation à droite).
- `/admin` : KPI + ventes du jour sur 2 colonnes, **barre de filtres** (recherche texte + 7 filtres de
  statut + compteur), **tableau 7 colonnes**, modale de détail centrée (assignation, statuts, archivage).
- `/livreur` : 3 KPI (courses en cours, terminées, montant à encaisser) + grille de courses.

### Validation
Itération 27 : routage et interface validés (25+ URLs, 0 « Unmatched Route », retour navigateur OK).
Itération 28 : parcours métier complet validé (commande PB-1980 : client → admin → assignation
Jonas Mbala → statuts → livreur → suivi client), CRUD back office, page d'accueil web, mobile 390.

### Compléments desktop-first (itération 29)
- **Authentification** : sur ≥1024 px, `/connexion`, `/inscription`, `/otp`, `/telephone` s'affichent
  en **page web deux panneaux pleine fenêtre** (panneau rose de marque à gauche avec accroche,
  arguments et illustration ; formulaire 460 px à droite). Carte compacte conservée sur mobile.
- **Tunnel de commande en 2 colonnes** : `/commande/adresse` (formulaire | carte + encart + CTA) et
  `/commande/paiement` (adresse, articles, mode de paiement | totaux + CTA). Barre d'action collante
  conservée sur mobile.
- **Back office** : `/admin/catalogue` en **tableau 5 colonnes** avec recherche produit, compteur et
  boutons libellés ; `/admin/zones`, `/admin/livreurs`, `/admin/personnel` en **grilles 2-3 colonnes**
  avec en-têtes `TitrePage` (utilitaire `completerGrille` dans `src/reactif.ts`).
- **Livreur** : `/livreur/course/{id}` en 2 colonnes (carte Mapbox + ETA + client + montant à gauche ;
  mise à jour du statut, partage GPS et actions à droite).

## Notifications push web (système) — itération 30
Notifications **système** via l'API Push + Service Worker + clés VAPID : reçues même si l'onglet
ou l'application est fermé. À ne pas confondre avec les toasts internes (`src/toast.tsx`), qui ne
s'affichent que l'app ouverte.

### Backend
- Clés VAPID dans `backend/.env` (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`),
  envoi via `pywebpush`.
- Collection `push_web` : un document par navigateur `{userId, endpoint unique, keys, dates}`.
- `GET /api/push/web/cle-publique`, `PUT` / `DELETE /api/push/web/abonnement` (authentifiés,
  cloisonnés par `userId`), `GET /api/push/web/etat`.
- `envoyer_webpush()` : envoi non bloquant, suppression automatique des abonnements expirés (404/410).
- Événements déclencheurs : **client** chaque statut de commande (reçue, en préparation, récupérée,
  en route, livrée, annulée) + **paiement Mobile Money confirmé/échoué** ; **admin** nouvelle
  commande ; **livreur** nouvelle course assignée. Chaque notification porte un titre, un court
  message, l'icône Pinkberry et une URL de destination (`/suivi/{id}`, `/admin`,
  `/livreur/course/{id}`) ouverte par le service worker au clic.

### Frontend
- `src/push-web.ts` (abonnement / désabonnement / synchronisation), handlers `push` et
  `notificationclick` dans `public/sw.js`, enregistrement du service worker à l'exécution
  (`src/web-pwa.ts`, appelé depuis `app/_layout.tsx`).
- Invite maison `CarteNotifications` (« Reçois les infos de ta commande en temps réel ») affichée
  sur `/compte`, `/suivi/{id}`, `/admin` et `/livreur` : la popup du navigateur n'est demandée
  qu'après acceptation de l'invite. Message explicite si le navigateur bloque les notifications.
- Le réglage « suivi de commande » de `/parametres` abonne ou **désabonne** réellement le navigateur.

### Validation
12/12 tests backend (`/app/backend/tests/test_iteration30.py`) : endpoints, validation, idempotence,
cloisonnement, nettoyage des abonnements expirés, déclenchement sur les événements métier sans
régression. L'abonnement réel du navigateur doit être testé dans Chrome/Edge (le Chromium
d'automatisation refuse la permission notifications). Sur iPhone, le push web exige que le site
soit ajouté à l'écran d'accueil (PWA).
