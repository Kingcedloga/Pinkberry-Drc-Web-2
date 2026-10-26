// Reprend app.json tel quel et y ajoute l'empreinte du build (commit + date),
// lue dans l'app (Paramètres) pour vérifier qu'un APK et un AAB viennent du même code.
const { execSync } = require("child_process");

function commit() {
  if (process.env.EAS_BUILD_GIT_COMMIT_HASH) return process.env.EAS_BUILD_GIT_COMMIT_HASH.slice(0, 7);
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "inconnu";
  }
}

module.exports = ({ config }) => ({
  ...config,
  extra: {
    ...config.extra,
    build: {
      commit: commit(),
      date: new Date().toISOString().slice(0, 16).replace("T", " "),
      profil: process.env.EAS_BUILD_PROFILE || "local",
    },
  },
});
