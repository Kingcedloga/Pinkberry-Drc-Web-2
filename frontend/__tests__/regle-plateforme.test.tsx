/// <reference types="node" />
/**
 * Règle web / mobile : aucune branche de plateforme dans les écrans ni les
 * composants. Les différences vivent dans src/plateforme/ (voir son README).
 */
import { expect, test } from "@jest/globals";
import fs from "fs";
import path from "path";

const RACINE = path.resolve(__dirname, "..");
const AUTORISES = [path.join("src", "plateforme"), path.join("src", "utils", "storage")];

function fichiers(dossier: string): string[] {
  return fs.readdirSync(dossier, { withFileTypes: true }).flatMap((e) => {
    const chemin = path.join(dossier, e.name);
    if (e.isDirectory()) return fichiers(chemin);
    return /\.(ts|tsx)$/.test(e.name) ? [chemin] : [];
  });
}

test("aucun Platform.OS hors de src/plateforme", () => {
  const fautifs = [...fichiers(path.join(RACINE, "app")), ...fichiers(path.join(RACINE, "src"))]
    .filter((f) => !AUTORISES.some((a) => path.relative(RACINE, f).startsWith(a)))
    .filter((f) => /Platform\.OS\b/.test(fs.readFileSync(f, "utf8").replace(/\/\/.*$/gm, "")))
    .map((f) => path.relative(RACINE, f));
  expect(fautifs).toEqual([]);
});
