#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================
## Itération responsive web (juin 2026)

### Objectif utilisateur
Faire évoluer l'app mobile Pinkberry Drc en **web app responsive** utilisable depuis
n'importe quel navigateur (ordinateur + téléphone), sans perdre aucune fonctionnalité,
en gardant la charte (rose #E6156F, vert #8DC63F, Fredoka/Nunito, coins arrondis),
le mode sombre et l'installation PWA.

### Travaux réalisés
- `src/reactif.ts` : points de rupture (sm 480 / md 768 / lg 1024 / xl 1440), hook `useEcran()`
  et largeurs centrées (`LARGEUR_ETROITE` 520, `LARGEUR_CONTENU` 760, `LARGEUR_GRILLE` 1160,
  `LARGEUR_LARGE` 1280, `LARGEUR_FEUILLE` 640).
- Client : onglets en **barre haute** sur ≥1024 px (bas sur mobile), en-tête et listes centrées,
  **grille produits** 1/2/3/4 colonnes selon la largeur, barre panier bornée à 520 px.
- Admin : **navigation latérale** (sidebar `src/components/BarreLaterale.tsx`) sur ≥1024 px web,
  avec liens Rapports / Archives / Paramètres ; dashboard en **tableau large** (7 colonnes)
  + bloc ventes et KPI en 2 colonnes ; modale détail en boîte de dialogue centrée.
- Livreur : grille de courses 1/2/3 colonnes, en-tête centré.
- Toutes les autres pages (auth, commande, suivi, archives, paramètres, catalogue, zones,
  livreurs, personnel, rapports) : contenu centré avec largeur max ; feuilles/modales ≤ 640 px.
- Cartes Mapbox plus hautes sur grand écran (suivi 420, course 400, choix adresse 360).
- PWA : `public/manifest.json`, `public/sw.js` (réseau d'abord, /api exclu), icônes 180/192/512
  + maskable, métadonnées dans `app/+html.tsx` (manifest, theme-color, apple-touch-icon).

### À tester (frontend)
1. Desktop 1440 : connexion, accueil client (grille 4 colonnes), panier, adresse, confirmation, suivi.
2. Desktop 1440 admin : sidebar (Commandes/Catalogue/Zones/Livreurs + liens bas), tableau commandes,
   ouverture de la modale détail, changement de statut, assignation livreur.
3. Desktop 1440 livreur : grille de courses, ouverture d'une course, carte.
4. Mobile 390 : non-régression complète (onglets bas, cartes une colonne, feuilles en bas d'écran).
5. Tablette 820 : 2 colonnes produits, onglets bas.
6. PWA : /manifest.json et /sw.js répondent 200.

### Identifiants
Voir `/app/memory/test_credentials.md` (client 0990000001/client123, admin 0810000000/admin123,
livreur 0820000001/livreur123).

## Itération 27 — Bascule complète en application web (desktop-first)

### Demande utilisateur
Le produit n'est plus une app mobile : c'est une **application web** pensée navigateur
(desktop d'abord, mobile en adaptation). Abandon du format « écran de téléphone », navigation
web (header + sidebar), URLs propres, pages web classiques, back-end et modèle de données inchangés.

### Restructuration des routes (URLs propres)
- Client (groupe `(client)`, invisible dans l'URL) : `/menu`, `/panier`, `/commande/adresse`,
  `/commande/paiement`, `/commandes`, `/compte`, `/parametres`, `/archives`, `/suivi/{id}`
- Admin (`app/admin/`) : `/admin`, `/admin/catalogue`, `/admin/zones`, `/admin/livreurs`,
  `/admin/personnel`, `/admin/rapports`, `/admin/archives`, `/admin/parametres`
- Livreur (`app/livreur/`) : `/livreur`, `/livreur/course/{id}`, `/livreur/rapports`,
  `/livreur/archives`, `/livreur/parametres`
- Auth inchangée : `/bienvenue`, `/connexion`, `/inscription`, `/otp`, `/telephone`
- Les anciens groupes `(admin)`, `(livreur)`, `(commande)`, `client/`, `suivi/` ont été supprimés.
- Plus aucun navigateur d'onglets : chaque espace utilise `<Slot/>` + navigation par liens
  (`src/components/Coquille.tsx`), donc le bouton retour du navigateur fonctionne.

### Interface
- `Coquille` : header web (logo + liens + bouton panier + déconnexion) sur ≥1024 px pour
  client/livreur ; **sidebar fixe 252 px** pour l'admin ; sur petit écran header compact +
  **barre d'onglets basse** (choix utilisateur).
- `TitrePage` : titres de page web (titre, sous-titre, lien retour, actions).
- `/menu` : hero + recherche, **colonne de filtres catégories** à gauche (desktop) et grille
  produits 1/2/3/4 colonnes ; fiche produit en **modale centrée** (bottom sheet sur mobile).
- `/panier` : 2 colonnes (articles + récapitulatif sticky) sur desktop.
- `/admin` : sidebar + KPI 2 colonnes + **barre de filtres** (recherche texte + 7 filtres de
  statut + compteur) + tableau 7 colonnes ; cartes sur mobile.
- `/livreur` : titre + 3 KPI (en cours, terminées, à encaisser) + grille de courses 1/2/3 colonnes.

### À tester (frontend)
1. URLs : toutes les pages ci-dessus répondent, aucun « Unmatched Route », bouton retour navigateur OK.
2. Client desktop 1440 : /menu (filtres catégories, grille, recherche), modale produit centrée,
   ajout panier, /panier 2 colonnes, /commande/adresse, /commande/paiement, /suivi/{id}, /commandes,
   /compte, /parametres, /archives.
3. Admin desktop 1440 : sidebar (7 liens + déconnexion), filtres statut + recherche, tableau,
   modale détail centrée, assignation livreur, changement de statut, archivage, pages catalogue/
   zones/livreurs/personnel/rapports/archives/parametres.
4. Livreur desktop 1440 : /livreur (KPI + grille), /livreur/course/{id} (carte), rapports, archives, parametres.
5. Mobile 390 : header compact + barre d'onglets basse pour les 3 rôles, navigation complète.
6. Non-régression fonctionnelle : passer une commande de bout en bout (cash), voir la commande
   côté admin, l'assigner, changer le statut, la suivre côté client.

### Itération 27 — compléments après retour du testing agent
- Parcours de commande client validé manuellement de bout en bout (Pot Fraise + taille →
  /panier → /commande/adresse (Gombe) → /commande/paiement (cash) → /suivi/{id}) : OK.
- `/suivi/{id}` passe en **2 colonnes** sur desktop (carte à gauche, progression / livreur /
  détail / annulation à droite).
- `/bienvenue` devient une **vraie page d'accueil web** : header site (logo + Se connecter),
  hero 2 colonnes (accroche, arguments, CTA) et illustration ; carte compacte conservée sur mobile.
- Cartes d'authentification : hauteur bornée à 640 px sur grand écran.

### Reste à tester (itération 28)
1. Non-régression métier complète : commande client → visible admin → assignation livreur →
   changement de statut → visible côté livreur → mise à jour du suivi client.
2. Back office : ajout/modification d'un produit (catalogue), zones, livreurs, rapports, archives.
3. Nouvelle page d'accueil web `/bienvenue` (desktop + mobile) et écrans d'auth.
