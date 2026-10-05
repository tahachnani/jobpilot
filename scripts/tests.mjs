import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

/**
 * Lance les tests, et décide s'ils ont le droit de bloquer.
 *
 * Ils bloquent en local : un contrôle de reformulation cassé ou un barème
 * déréglé doit sauter aux yeux avant le `git push`, pas après. Ils ne
 * bloquent pas sur Vercel : un test que j'aurais mal écrit ne doit jamais
 * empêcher un déploiement un dimanche soir.
 *
 * Aucune dépendance : Node exécute directement le TypeScript depuis la 22.6,
 * et les chemins `@/…` passent par un crochet de résolution maison.
 */

const VERSION_MINIMALE = [22, 6];

function versionSuffisante() {
  const [maj, min] = process.versions.node.split(".").map(Number);
  return maj > VERSION_MINIMALE[0] || (maj === VERSION_MINIMALE[0] && min >= VERSION_MINIMALE[1]);
}

function typesADepouiller() {
  const [maj, min] = process.versions.node.split(".").map(Number);
  // Depuis la 22.18 le dépouillement des types est actif sans drapeau.
  return maj === 22 && min < 18 ? ["--experimental-strip-types"] : [];
}

if (process.env.VERCEL) {
  console.log("Tests ignorés : construction Vercel.");
  process.exit(0);
}

if (!existsSync(path.join(process.cwd(), "tests"))) {
  console.log("Tests ignorés : aucun dossier tests/.");
  process.exit(0);
}

if (!versionSuffisante()) {
  console.log(
    `Tests ignorés : Node ${process.versions.node} ne sait pas exécuter le ` +
      `TypeScript directement (il faut la 22.6 ou plus récente).`
  );
  process.exit(0);
}

const r = spawnSync(
  process.execPath,
  [
    ...typesADepouiller(),
    "--import",
    "./scripts/alias-register.mjs",
    "--test",
    "tests/*.test.ts",
  ],
  { stdio: "inherit" }
);

if (r.status !== 0) {
  console.error(
    "\nDes tests ont échoué. La construction s'arrête : corrige, ou retire le " +
      "test s'il dit une règle qui a changé."
  );
}

process.exit(r.status ?? 1);
