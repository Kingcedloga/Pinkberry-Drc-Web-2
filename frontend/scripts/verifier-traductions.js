#!/usr/bin/env node
/* global __dirname */
/**
 * Vérifie que les deux langues restent synchrones (à lancer avant chaque livraison) :
 *   npm run i18n:verifier
 * 1. mêmes clés dans fr.json et en.json, aucune valeur vide ;
 * 2. mêmes variables {{…}} dans les deux langues ;
 * 3. chaque clé utilisée dans le code existe (t("…"), i18n.t("…"), y compris les préfixes dynamiques) ;
 * 4. aucun texte d'interface écrit en dur (texte JSX, placeholder, label, title, accessibilityLabel…).
 * Code de sortie 1 au moindre problème.
 */
const fs = require("fs");
const path = require("path");
const ts = require("typescript");

const racine = path.join(__dirname, "..");
const lire = (l) => JSON.parse(fs.readFileSync(path.join(racine, "src/locales", `${l}.json`), "utf8"));
const aplatir = (o, p = "", out = {}) => {
  for (const [k, v] of Object.entries(o)) {
    if (v && typeof v === "object" && !Array.isArray(v)) aplatir(v, `${p}${k}.`, out);
    else out[`${p}${k}`] = v;
  }
  return out;
};
const fr = aplatir(lire("fr"));
const en = aplatir(lire("en"));
const problemes = [];

// 1 et 2. Parité des clés et des variables.
const variables = (v) => JSON.stringify([...new Set(JSON.stringify(v).match(/\{\{\s*\w+/g) ?? [])].sort());
for (const k of Object.keys(fr)) {
  if (!(k in en)) problemes.push(`EN manquante : ${k}`);
  else if (variables(fr[k]) !== variables(en[k])) problemes.push(`variables différentes : ${k}`);
  if (fr[k] === "" || en[k] === "") problemes.push(`valeur vide : ${k}`);
}
for (const k of Object.keys(en)) if (!(k in fr)) problemes.push(`FR manquante : ${k}`);

// 3 et 4. Parcours du code (AST TypeScript).
const prefixes = new Set(Object.keys(fr).flatMap((k) => k.split(".").map((_, i, a) => a.slice(0, i + 1).join("."))));
const ATTRIBUTS_TEXTE = new Set(["placeholder", "label", "title", "sousTitre", "accessibilityLabel", "accessibilityHint", "description", "confirmLabel", "deleteLabel", "texte", "message"]);
const fichiers = [];
const parcourir = (d) => {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) parcourir(p);
    else if (/\.tsx?$/.test(f) && !f.endsWith(".d.ts")) fichiers.push(p);
  }
};
["app", "src"].forEach((d) => parcourir(path.join(racine, d)));

for (const f of fichiers) {
  const src = fs.readFileSync(f, "utf8");
  const sf = ts.createSourceFile(f, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const ou = (n) => `${path.relative(racine, f)}:${sf.getLineAndCharacterOfPosition(n.getStart()).line + 1}`;
  const visiter = (n) => {
    // Clés utilisées
    if (ts.isCallExpression(n) && /^(t|tr|i18n\.t)$/.test(n.expression.getText()) && n.arguments.length) {
      const a = n.arguments[0];
      if (ts.isStringLiteral(a) || ts.isNoSubstitutionTemplateLiteral(a)) {
        if (!(a.text in fr) && !prefixes.has(a.text)) problemes.push(`clé inconnue « ${a.text} » (${ou(a)})`);
      } else if (ts.isTemplateExpression(a)) {
        const prefixe = a.head.text.replace(/\.$/, "");
        if (prefixe && !prefixes.has(prefixe) && !Object.keys(fr).some((k) => k.startsWith(a.head.text))) {
          problemes.push(`préfixe dynamique inconnu « ${a.head.text}… » (${ou(a)})`);
        }
      }
    }
    // Texte JSX écrit en dur
    if (ts.isJsxText(n) && /[A-Za-zÀ-ÿ]{2,}/.test(n.text)) problemes.push(`texte en dur « ${n.text.trim().slice(0, 50)} » (${ou(n)})`);
    // Attributs de texte écrits en dur
    if (ts.isJsxAttribute(n) && ATTRIBUTS_TEXTE.has(n.name.getText()) && n.initializer) {
      const v = n.initializer;
      const lit = ts.isStringLiteral(v) ? v : ts.isJsxExpression(v) && v.expression && ts.isStringLiteral(v.expression) ? v.expression : null;
      if (lit && /[A-Za-zÀ-ÿ]{2,}/.test(lit.text)) problemes.push(`${n.name.getText()} en dur « ${lit.text.slice(0, 50)} » (${ou(n)})`);
    }
    ts.forEachChild(n, visiter);
  };
  visiter(sf);
}

if (problemes.length) {
  console.error(`✗ ${problemes.length} problème(s) de traduction :\n  - ${problemes.join("\n  - ")}`);
  process.exit(1);
}
console.log(`✓ Traductions synchrones : ${Object.keys(fr).length} clés FR/EN, ${fichiers.length} fichiers vérifiés.`);
