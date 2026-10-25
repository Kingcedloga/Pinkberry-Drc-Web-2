/* global module */
// Une seule suite, jouée sur iOS et Android : l'app réelle montée avec
// expo-router, modules natifs et API simulés (__tests__/setup.js).
// Lancer : npx jest  (une plateforme : npx jest --selectProjects android)
// Le web n'est pas dans Jest : la Testing Library native refuse le DOM de
// react-native-web ; il est vérifié dans un vrai navigateur.
const commun = {
  setupFiles: ["./__tests__/setup.js"],
  testMatch: ["<rootDir>/__tests__/**/*.test.tsx"],
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|react-native-heroicons|lucide-react-native|@tanstack/.*|i18next|react-i18next|standard-navigation|@standard-navigation/.*))",
  ],
};

module.exports = {
  projects: ["ios", "android"].map((plateforme) => {
    // Options réservées à la racine, inutiles par projet.
    const { passWithNoTests, watchPlugins, ...preset } = require(`jest-expo/${plateforme}/jest-preset`);
    return {
      ...preset,
      ...commun,
      setupFiles: [...(preset.setupFiles ?? []), ...commun.setupFiles],
      displayName: plateforme,
    };
  }),
};
