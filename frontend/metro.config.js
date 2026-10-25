// metro.config.js
const { getDefaultConfig } = require("expo/metro-config");
const path = require('path');
const { FileStore } = require('metro-cache');

const config = getDefaultConfig(__dirname);

// Use a stable on-disk store (shared across web/android)
const root = process.env.METRO_CACHE_ROOT || path.join(__dirname, '.metro-cache');
config.cacheStores = [
  new FileStore({ root: path.join(root, 'cache') }),
];


// // Exclude unnecessary directories from file watching
// config.watchFolders = [__dirname];
// config.resolver.blacklistRE = /(.*)\/(__tests__|android|ios|build|dist|.git|node_modules\/.*\/android|node_modules\/.*\/ios|node_modules\/.*\/windows|node_modules\/.*\/macos)(\/.*)?$/;

// // Alternative: use a more aggressive exclusion pattern
// config.resolver.blacklistRE = /node_modules\/.*\/(android|ios|windows|macos|__tests__|\.git|.*\.android\.js|.*\.ios\.js)$/;

// Reduce the number of workers to decrease resource usage
config.maxWorkers = 2;

// Ce fichier s'exécute dans le processus de l'Expo CLI. Le middleware
// /_expo/debugger interroge `${EXPO_PACKAGER_PROXY_URL}/json/list` sans try ;
// derrière le proxy de la preview, cette URL renvoie la page HTML de la web app,
// le .json() échoue et Node 24 tue Metro (exit 7) sur ce rejet non intercepté.
// Avec un gestionnaire, Node ne plante plus : l'erreur est seulement journalisée.
process.on('unhandledRejection', (raison) => {
  console.error('[metro] promesse rejetée non interceptée (Metro continue) :', raison);
});

module.exports = config;
