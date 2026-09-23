import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SOCLE,
  codeRecevable,
  codesActifs,
  libelleDe,
  normaliserCode,
  type Taxonomie,
} from "@/lib/taxonomie";
import { calculerScore, type Bareme, type ProfilPourScoring } from "@/lib/scoring";
import type { OffreExtraite } from "@/lib/extraction-offre";

/**
 * D74 — la taxonomie devient modifiable.
 *
 * Ces tests figent les deux promesses de la bascule : un code saisi en clair
 * devient un identifiant utilisable, et un code absent du fichier versionné
 * est bel et bien pris en compte dès qu'il est dans la liste passée au
 * moteur. Sans le second, on aurait déplacé la source sans changer le
 * comportement.
 */

test("un libellé français devient un code utilisable", () => {
  assert.equal(normaliserCode("Amélioration continue"), "amelioration_continue");
  assert.equal(normaliserCode("  Coûts de revient  "), "couts_de_revient");
  assert.equal(normaliserCode("R&D / innovation"), "r_d_innovation");
});

test("un code déjà normalisé traverse sans changer", () => {
  assert.equal(normaliserCode("analyse_ecarts"), "analyse_ecarts");
});

test("un code doit commencer par une lettre et tenir trois caractères", () => {
  assert.equal(codeRecevable("amelioration_continue"), true);
  assert.equal(codeRecevable("kpi"), true);
  assert.equal(codeRecevable("ab"), false);
  assert.equal(codeRecevable("2024_budget"), false);
  assert.equal(codeRecevable(""), false);
});

test("le socle de repli couvre les trente codes d'origine", () => {
  assert.equal(Object.keys(SOCLE).length, 30);
  assert.equal(SOCLE.reporting.libelle, "Reporting");
  assert.equal(SOCLE.cloture.famille, "compta");
});

test("un code hors service n'est plus proposé, mais reste compris", () => {
  const t: Taxonomie = {
    reporting: { libelle: "Reporting", famille: "cdg", actif: true },
    lettrage: { libelle: "Lettrage", famille: "compta", actif: false },
  };

  assert.deepEqual(codesActifs(t), ["reporting"]);
  // Compris : le libellé se lit encore, sinon les missions qui le portent
  // s'afficheraient sous leur identifiant brut.
  assert.equal(libelleDe(t, "lettrage"), "Lettrage");
});

test("un code inconnu se lit tel quel plutôt que de disparaître", () => {
  assert.equal(libelleDe(SOCLE, "amelioration_continue"), "amelioration_continue");
});

/* ------------------------------------------------------------------ */

const BAREME: Bareme = {
  version: "6",
  poids: { missions: 100, competences: 0, experience: 0, secteur: 0 },
  plafondEcartBloquant: 79,
  coefficients: { cdi: 1 },
};

/** Une offre dont la seule mission porte un code absent du socle. */
const OFFRE: OffreExtraite = {
  intitule: "Contrôleur de gestion",
  entreprise: null,
  localisation: null,
  departement: null,
  contrat: "cdi",
  salaire_min: null,
  salaire_max: null,
  salaire_periode: null,
  teletravail: null,
  date_publication: null,
  secteur_code: null,
  missions: [
    {
      texte: "Proposer des pistes d'amélioration continue des processus",
      codes: ["amelioration_continue"],
      importance: 3,
    },
  ],
  competences: [],
  outils: [],
  annees_experience: null,
  seniorite: null,
  encadrement: null,
  perimetre: null,
  formation: null,
  langues: [],
  mots_cles_ats: [],
};

const PROFIL: ProfilPourScoring = {
  missions: [
    {
      codes: ["amelioration_continue"],
      pertinence: 3,
      texte: "Proposition de pistes d'amélioration continue des processus budgétaires",
    },
  ],
  competences: [],
  experiences: [],
};

test("un code ajouté à l'usage porte un vrai libellé dans l'explication", () => {
  const vivante: Taxonomie = {
    ...SOCLE,
    amelioration_continue: {
      libelle: "Amélioration continue",
      famille: "transverse",
      actif: true,
    },
  };

  const r = calculerScore(OFFRE, PROFIL, "cdg", BAREME, vivante);

  assert.equal(r.missions.mesurable, true);
  assert.ok(
    r.missions.lignes[0].explication.includes("Amélioration continue"),
    r.missions.lignes[0].explication
  );
  assert.ok(r.missions.note >= 60, `note ${r.missions.note}`);
});

test("sans taxonomie passée, le calcul tient encore debout", () => {
  // Le repli sur le socle ne doit pas transformer un code inconnu en zéro :
  // le moteur compare des codes, pas des entrées de dictionnaire. C'est
  // l'extraction, en amont, qui refuse un code hors liste.
  const r = calculerScore(OFFRE, PROFIL, "cdg", BAREME);
  assert.equal(r.missions.mesurable, true);
  assert.ok(r.missions.lignes[0].explication.includes("amelioration_continue"));
});
