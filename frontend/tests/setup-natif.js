/* global jest, require, global */
// Modules natifs simulés pour le rendu iOS sous Jest.
require("react-native-gesture-handler/jestSetup");
jest.mock("@react-native-async-storage/async-storage", () => require("@react-native-async-storage/async-storage/jest/async-storage-mock"));
jest.mock("react-native-keyboard-controller", () => require("react-native-keyboard-controller/jest"));
jest.mock("react-native-webview", () => {
  const { View } = require("react-native");
  return { __esModule: true, default: View, WebView: View };
});
// API : réponses vides mais bien formées (aucun appel réseau réel).
global.fetch = jest.fn(async (url) => {
  const u = String(url);
  let corps = [];
  if (/\/composition/.test(u)) corps = { tailles: [], contenants: [], categories: [], regle: { total: 0 } };
  else if (/\/config/.test(u)) corps = { tauxFC: 2300, fraisLivraison: 2000, demo: false };
  else if (/\/notifications(\?|$)/.test(u)) corps = { notifications: [], nonLues: 0 };
  else if (/\/admin\/(stats|ventes)/.test(u)) corps = { total: 0, enCours: 0, livrees: 0, annulees: 0, revenus: 0, chiffre: 0, nbCommandes: 0, panierMoyen: 0, topProduits: [] };
  else if (/\/(commandes|course)\/[\w-]+$/.test(u)) corps = { id: "c1", numero: "PB-1", statut: "recue", items: [], adresse: {}, total: 0, sousTotal: 0, fraisLivraison: 0, historique: [] };
  else if (/\/auth\/moi$/.test(u)) corps = null;
  return { ok: true, status: 200, text: async () => JSON.stringify(corps), json: async () => corps };
});
jest.mock("expo-notifications", () => {
  const abonnement = () => ({ remove: jest.fn() });
  return {
    setNotificationHandler: jest.fn(),
    setNotificationChannelAsync: jest.fn(async () => null),
    addNotificationResponseReceivedListener: jest.fn(abonnement),
    addNotificationReceivedListener: jest.fn(abonnement),
    addPushTokenListener: jest.fn(abonnement),
    getLastNotificationResponseAsync: jest.fn(async () => null),
    getPermissionsAsync: jest.fn(async () => ({ status: "undetermined", granted: false, canAskAgain: true })),
    requestPermissionsAsync: jest.fn(async () => ({ status: "denied", granted: false, canAskAgain: true })),
    getExpoPushTokenAsync: jest.fn(async () => ({ data: "ExponentPushToken[test]" })),
    getDevicePushTokenAsync: jest.fn(async () => ({ data: "test" })),
    AndroidImportance: { MAX: 5, HIGH: 4, DEFAULT: 3 },
  };
});
// Animations en boucle infinie (mascotte, chargement) : neutralisées, sinon act() n'aboutit jamais.
const RN = require("react-native");
RN.Animated.loop = () => ({ start: () => undefined, stop: () => undefined, reset: () => undefined });
