/* global module */
// Tests du rendu NATIF (préréglage iOS de jest-expo) : l'app réelle montée avec
// expo-router, modules natifs simulés. Lancer : npx jest
module.exports = {
  preset: "jest-expo/ios",
  setupFiles: ["./tests/setup-natif.js"],
  testMatch: ["<rootDir>/tests/**/*.test.tsx"],
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|react-native-heroicons|lucide-react-native|@tanstack/.*|i18next|react-i18next|standard-navigation|@standard-navigation/.*))",
  ],
};
