import { test } from "node:test";
import assert from "node:assert/strict";
import { calculerScore, type Bareme, type ProfilPourScoring } from "@/lib/scoring";
import type { OffreExtraite } from "@/lib/extraction-offre";

/**
 * Le barème version 3.
 *
 * Il a été refait parce qu'une offre réclamant cinq ans d'expérience sortait
 * à 72 % de compatibilité pour un profil qui en a deux : le score disait
 * « candidature solide » là où il manquait trois ans. Ces tests figent la
 * pénalité, sinon la prochaine retouche du barème la défera sans bruit.
 */

const BAREME: Bareme = {
  version: "3",
  poids: { missions: 30, competences: 25, experience: 35, secteur: 10 },
  plafondEcartBloquant: 79,
  coefficients: {
    cdi: 1,
    cdd: 1,
    alternance: 1,
    stage: 0.5,
    interim: 1,
    freelance: 1,
    autre: 0.5,
  },
};

function offre(anneesExperience: number | null): OffreExtraite {
  return {
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
    missions: [{ texte: "Reporting mensuel", codes: ["reporting"], importance: 3 }],
    competences: [{ libelle: "Excel", caractere: "indispensable" }],
    outils: ["Excel"],
    annees_experience: anneesExperience,
    formation: null,
    langues: [],
    mots_cles_ats: [],
  };
}

/** Un profil dont l'ancienneté pondérée vaut `mois`, en CDI. */
function profil(mois: number): ProfilPourScoring {
  return {
    missions: [
      { codes: ["reporting"], pertinence: 3, texte: "Production du reporting mensuel" },
    ],
    competences: [
      { libelle: "Excel", codeNormalise: "excel", niveau: 3, categorie: "outil" },
    ],
    experiences: [
      {
        date_debut: "2020-01",
        date_fin: null,
        duree_mois_forcee: mois,
        type_contrat: "cdi",
        secteur_code: null,
      },
    ],
  };
}

const note = (demande: number | null, mois: number) =>
  calculerScore(offre(demande), profil(mois), "cdg", BAREME).experience.note;

test("cinq ans demandés contre deux ans tenus : la note reste basse", () => {
  const n = note(5, 24);
  assert.ok(n <= 30, `note d'expérience attendue basse, obtenue ${n}`);
});

test("un écart de trois ans est plus durement noté qu'un écart d'un an", () => {
  assert.ok(note(5, 24) < note(3, 24));
});

test("à 80 % de l'ancienneté demandée, l'expérience est pleine", () => {
  assert.equal(note(5, 48), 100);
});

test("la note ne descend jamais sous 10", () => {
  assert.ok(note(15, 6) >= 10);
});

test("une offre qui ne précise pas d'expérience ne pénalise pas", () => {
  const n = note(null, 24);
  assert.ok(n >= 70, `note neutre attendue, obtenue ${n}`);
});

test("le score global reste dans les bornes et porte la version du barème", () => {
  const r = calculerScore(offre(3), profil(24), "cdg", BAREME);
  assert.ok(r.global >= 0 && r.global <= 100);
  assert.equal(r.versionBareme, "3");
});

test("les poids du barème sont ceux passés, pas des valeurs codées en dur", () => {
  const r = calculerScore(offre(3), profil(24), "cdg", BAREME);
  assert.equal(r.experience.poids, 35);
  assert.equal(r.missions.poids, 30);
});
