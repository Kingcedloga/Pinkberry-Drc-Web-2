/* global jest */
// Environnement natif simulé : stockage en mémoire et API factice (jamais le vrai backend).

jest.mock("react-native-keyboard-controller", () => require("react-native-keyboard-controller/jest"));
jest.mock("react-native-webview", () => {
  const { View } = require("react-native");
  const WebView = (props) => require("react").createElement(View, props);
  return { __esModule: true, default: WebView, WebView };
});

global.__memoire = new Map();
jest.mock("@/src/utils/storage", () => {
  const lire = (cle, repli) => (global.__memoire.has(cle) ? global.__memoire.get(cle) : repli);
  const ecrire = (cle, v) => (global.__memoire.set(cle, v), true);
  const effacer = (cle) => (global.__memoire.delete(cle), true);
  const storage = {
    getItem: async (c, r) => lire(c, r),
    setItem: async (c, v) => ecrire(c, v),
    removeItem: async (c) => effacer(c),
    secureGet: async (c, r) => lire(c, r),
    secureSet: async (c, v) => ecrire(c, v),
    secureRemove: async (c) => effacer(c),
  };
  return { storage };
});

jest.mock("expo-notifications", () => {
  const abonnement = () => ({ remove: () => undefined });
  return {
    setNotificationHandler: () => undefined,
    setNotificationChannelAsync: async () => null,
    addNotificationResponseReceivedListener: abonnement,
    addNotificationReceivedListener: abonnement,
    addPushTokenListener: abonnement,
    getLastNotificationResponseAsync: async () => null,
    getPermissionsAsync: async () => ({ status: "denied", granted: false, canAskAgain: false }),
    requestPermissionsAsync: async () => ({ status: "denied", granted: false, canAskAgain: false }),
    getDevicePushTokenAsync: async () => ({ data: "jeton-test" }),
    setBadgeCountAsync: async () => true,
    AndroidImportance: { MAX: 5, HIGH: 4, DEFAULT: 3 },
    PermissionStatus: { GRANTED: "granted", DENIED: "denied", UNDETERMINED: "undetermined" },
  };
});

// Configuration réelle de l'app (app.json passé par app.config.js), comme dans un build.
jest.mock("expo-constants", () => {
  const reel = jest.requireActual("expo-constants");
  const base = reel.default ?? reel;
  const expoConfig = require("../app.config.js")({ config: require("../app.json").expo });
  const Constants = Object.assign(Object.create(Object.getPrototypeOf(base)), base, { expoConfig });
  return { __esModule: true, ...reel, default: Constants };
});
