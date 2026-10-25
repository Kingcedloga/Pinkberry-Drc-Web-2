# Adaptateurs de plateforme

Règle : **aucun `Platform.OS` dans les écrans ni les composants.** Ce qui
diffère entre le web et le mobile vit ici, dans deux fichiers à l'API identique :

- `<capacite>.ts` : iOS et Android (et la source des types pour TypeScript) ;
- `<capacite>.web.ts` : navigateur / PWA. Metro le choisit seul sur le web.

Les écrans appellent la même fonction partout et lisent les **capacités**
exportées (`reglagesDisponibles`, `desactivationDansApp`…) au lieu de tester
la plateforme. Une nouvelle différence = une nouvelle capacité ici, jamais un
`if (Platform.OS …)` dans un écran.

Exceptions admises : ce dossier et `src/utils/storage/`. Les écarts de mise en
page vont dans `styles.ts` / `styles.web.ts` ; un `Platform.select` purement
visuel (une police) reste toléré. Les types communs sont dans `types.ts`.

| Adaptateur | Mobile | Web |
|---|---|---|
| `notifications` | APNs / FCM (expo-notifications) | Push API + service worker |
| `reglages` | ouvre les Réglages de l'app | indisponible (« Réessayer ») |
| `fichiers` | joindre `{uri}` ; partage du fichier | Blob ; téléchargement |
| `position` | expo-location + tâche écran verrouillé | Geolocation + écran allumé |
| `demarrage` | journal des erreurs fatales | LogBox muet, service worker, ids des champs |
| `connexion-google` | navigateur d'auth + lien profond | redirection de la page |
| `partage` | feuille de partage | Web Share, sinon copie |
| `site` | URL du backend | origine de la page |
| `apparence` | — (StatusBar) | `theme-color`, `color-scheme` |
| `lecture-immediate` | rien (stockage asynchrone) | localStorage |
| `VuePage` | WebView | iframe |

Contrôle : la suite Jest (`npx jest`, iOS et Android) contient
`__tests__/regle-plateforme.test.tsx`, qui échoue si un `Platform.OS` apparaît
hors de ce dossier. Le web se vérifie dans un navigateur.
