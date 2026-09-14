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
