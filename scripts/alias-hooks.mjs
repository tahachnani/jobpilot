import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

/**
 * Résolution des chemins `@/…` pour les tests.
 *
 * Next.js comprend l'alias du `tsconfig.json`, Node non : sans ce crochet, le
 * premier `import { normaliser } from "@/lib/texte"` fait échouer tout le
 * fichier de test. Deux règles seulement, et aucune dépendance à installer.
 *
 * `@/lib/supabase/server` est détourné vers une doublure : les fonctions
 * testées sont arithmétiques, mais certaines vivent dans un module qui importe
 * le client Supabase. On ne veut ni base de données ni clés pour faire tourner
 * des tests.
 */

const racine = process.cwd();
const src = path.join(racine, "src");
const doublure = path.join(racine, "tests", "doublure-supabase.ts");

const EXTENSIONS = [".ts", ".tsx", ".mjs", ".js"];

function versFichier(base) {
  if (existsSync(base) && !existsSync(path.join(base, "index.ts"))) {
    // Un fichier portant déjà son extension.
    if (path.extname(base)) return base;
  }
  for (const e of EXTENSIONS) {
    const essai = base + e;
    if (existsSync(essai)) return essai;
  }
  for (const e of EXTENSIONS) {
    const essai = path.join(base, "index" + e);
    if (existsSync(essai)) return essai;
  }
  return null;
}

export async function resolve(specifier, context, next) {
  if (specifier === "@/lib/supabase/server") {
    return { url: pathToFileURL(doublure).href, shortCircuit: true };
  }

  if (specifier.startsWith("@/")) {
    const trouve = versFichier(path.join(src, specifier.slice(2)));
    if (trouve) {
      return { url: pathToFileURL(trouve).href, shortCircuit: true };
    }
  }

  // Un import relatif sans extension depuis un fichier TypeScript.
  if (specifier.startsWith(".") && !path.extname(specifier)) {
    const depuis = context.parentURL
      ? path.dirname(fileURLToPath(context.parentURL))
      : racine;
    const trouve = versFichier(path.resolve(depuis, specifier));
    if (trouve) {
      return { url: pathToFileURL(trouve).href, shortCircuit: true };
    }
  }

  return next(specifier, context);
}
