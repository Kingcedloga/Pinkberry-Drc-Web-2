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
