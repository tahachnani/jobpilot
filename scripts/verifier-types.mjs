#!/usr/bin/env node
/**
 * Contrôle de types hors ligne, moins aveugle (D117).
 *
 * `npm install` est refusé par le proxy de cet environnement : impossible de
 * faire un vrai `tsc` avec les types de React, Next et Supabase. On tourne donc
 * en `--noResolve`, où tout ce qui est importé devient inconnu — et les erreurs
 * qui en découlent sont du bruit qu'il faut filtrer.
 *
 * Le filtre était trop large. Deux fois le 2 octobre, un build Vercel a échoué
 * sur une erreur que ce contrôle avait vue et jetée :
 *
 *   TS2345  `"message"` n'est pas assignable au paramètre de
 *           `purgerAnciennesVersions` — union figée dans une signature.
 *   TS2304  `Cannot find name 'fiche'` — variable laissée dans l'autre
 *           fonction après une extraction.
 *
 * TS2304 est précisément le code dont on a besoin : il signale un nom
 * introuvable. Le jeter en bloc revenait à renoncer à la seule vérification que
 * `--noResolve` permette encore de faire sérieusement.
 *
 * D'où ce script : TS2304 n'est écarté que si le nom en cause est **importé
 * dans ce fichier**. Un nom local introuvable est une vraie erreur, et il
 * remonte.
 */
import { spawnSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { globSync } from "node:fs";

/** Codes dus uniquement à l'absence de résolution, sans valeur diagnostique. */
const BRUIT = new Set([
  "TS2307", // module introuvable
  "TS2305", // le module n'exporte pas ce membre
  "TS7026", // élément JSX implicitement any
  "TS7006", // paramètre implicitement any
  "TS18046", // 'x' est de type unknown
  "TS2534",
  "TS2591", // 'process' non défini
  "TS2686",
  "TS2339", // propriété inexistante sur unknown
  "TS2694",
  "TS2503", // espace de noms React
  "TS2741", // children manquant
  "TS2322", // types incompatibles via unknown
  "TS2882",
  "TS2345", // argument non assignable — souvent du bruit, mais pas toujours
  "TS7031", // élément de déstructuration implicitement any
  "TS2353", // propriété inconnue sur un type devenu unknown
]);

const fichiers = globSync("src/**/*.{ts,tsx}");
const sortie = spawnSync(
  "npx",
  [
    "tsc", "--ignoreConfig", "--noResolve", "--noEmit",
    "--jsx", "preserve", "--target", "es2022", "--module", "esnext",
    ...fichiers,
  ],
  { encoding: "utf8" }
);

const lignes = (sortie.stdout ?? "").split("\n").filter(Boolean);
const cache = new Map();

/** Le nom est-il importé dans ce fichier ? Alors TS2304 est du bruit. */
function estImporte(fichier, nom) {
  if (!cache.has(fichier)) {
    cache.set(fichier, existsSync(fichier) ? readFileSync(fichier, "utf8") : "");
  }
  const source = cache.get(fichier);
  /**
   * Seule la clause d'import compte, PAS le chemin du module.
   *
   * Première version de ce détecteur : elle cherchait le nom dans l'instruction
   * entière, chemin compris. `import { ficheEnTexte } from "@/lib/entreprise/fiche"`
   * contient donc « fiche » dans son chemin, et une variable `fiche` hors
   * portée passait pour un import. Le détecteur a échoué au test qui l'avait
   * motivé — vérifier qu'un outil attrape le cas qu'on vient de corriger vaut
   * mieux que de le supposer.
   */
  const clauses = [...source.matchAll(/^\s*import\s+([\s\S]*?)\s+from\s+["'][^"']+["']/gm)]
    .map((m) => m[1])
    .join("\n");
  return new RegExp(`\\b${nom}\\b`).test(clauses);
}

const reels = [];
for (const ligne of lignes) {
  const m = ligne.match(/^(.+?)\((\d+),\d+\): error (TS\d+): (.*)$/);
  if (!m) continue;
  const [, fichier, , code, texte] = m;

  if (code === "TS2304") {
    const nom = texte.match(/Cannot find name '([^']+)'/)?.[1];
    // `React`, `process` et consorts viennent des types absents.
    const ambiants = ["React", "process", "JSX", "NodeJS", "Buffer", "console"];
    if (nom && !ambiants.includes(nom) && !estImporte(fichier, nom)) {
      reels.push(ligne);
    }
    continue;
  }

  if (!BRUIT.has(code)) reels.push(ligne);
}

if (reels.length > 0) {
  console.error("Erreurs de types probablement réelles :\n");
  for (const l of reels) console.error("  " + l);
  console.error(
    `\n${reels.length} à examiner. Le contrôle reste partiel : sans node_modules, ` +
      "rien de ce qui traverse deux fichiers n'est vérifiable. Vercel reste le juge."
  );
  process.exit(1);
}

console.log("Aucune erreur locale détectée. Contrôle partiel : Vercel reste le juge.");
