/* global require, module */
// expo-task-manager déclare toujours le mode d'arrière-plan « fetch » (Background App
// Refresh), que l'app n'utilise pas : seul « location » sert, au partage GPS du livreur.
// Apple peut refuser un mode déclaré mais inutilisé (règle 2.5.4) : on le retire.
const { withInfoPlist } = require("expo/config-plugins");

module.exports = function sansFondFetch(config) {
  return withInfoPlist(config, (c) => {
    const modes = c.modResults.UIBackgroundModes;
    if (Array.isArray(modes)) c.modResults.UIBackgroundModes = modes.filter((m) => m !== "fetch");
    return c;
  });
};
