import { test } from "node:test";
import assert from "node:assert/strict";
import { noterCompetence } from "@/lib/cv/selection";
import type { CompetenceCV } from "@/lib/cv/donnees";
import type { OffreExtraite } from "@/lib/extraction-offre";

/**
 * L'ordre des compétences sur le CV.
 *
 * Décision prise à l'étape 4 : quand l'offre réclame le cœur de métier, il
 * passe en premier — mais seulement s'il est tenu. Des notions ne doublent
 * pas une exigence explicite maîtrisée.
 */

function competence(p: Partial<CompetenceCV>): CompetenceCV {
  return {
    id: "x",
    libelle: "Excel",
    codeNormalise: "excel",
    categorie: "outil",
    precision: null,
    niveau: 3,
    ordre: 1,
    ...p,
  };
}

function offreAvec(competences: OffreExtraite["competences"]): OffreExtraite {
  return {
    intitule: null,
    entreprise: null,
    localisation: null,
    departement: null,
    contrat: null,
    salaire_min: null,
    salaire_max: null,
    salaire_periode: null,
    teletravail: null,
    date_publication: null,
    secteur_code: null,
    missions: [],
    competences,
    outils: [],
    annees_experience: null,
    formation: null,
    langues: [],
    mots_cles_ats: [],
  };
}

const OFFRE = offreAvec([
  { libelle: "Contrôle de gestion", caractere: "indispensable" },
  { libelle: "Excel", caractere: "indispensable" },
]);

test("le cœur de métier exigé et tenu passe devant l'outil exigé", () => {
  const coeur = noterCompetence(
    competence({ libelle: "Contrôle budgétaire", categorie: "cdg", niveau: 3 }),
    OFFRE
  );
  const outil = noterCompetence(competence({ niveau: 3 }), OFFRE);
  assert.ok(
    coeur.note > outil.note,
    `cœur ${coeur.note} devrait dépasser outil ${outil.note}`
  );
});

test("un cœur de métier dont on n'a que des notions ne double pas une exigence tenue", () => {
  // La compétence n'est pas nommée par l'annonce : seule sa famille l'est.
  // C'est exactement le cas que la règle de niveau doit arbitrer.
  const notions = noterCompetence(
    competence({
      libelle: "Élaboration budgétaire",
      codeNormalise: "elaboration budgetaire",
      categorie: "cdg",
      niveau: 1,
    }),
    OFFRE
  );
  const outil = noterCompetence(competence({ niveau: 3 }), OFFRE);
  assert.ok(
    notions.note < outil.note,
    `notions ${notions.note} devrait rester sous l'exigence tenue ${outil.note}`
  );
});

test("une compétence absente de l'offre note moins qu'une compétence souhaitée", () => {
  const souhaitee = noterCompetence(
    competence({ libelle: "Power BI", codeNormalise: "power bi" }),
    offreAvec([{ libelle: "Power BI", caractere: "souhaitee" }])
  );
  const inconnue = noterCompetence(
    competence({ libelle: "Power BI", codeNormalise: "power bi" }),
    offreAvec([{ libelle: "SAP", caractere: "souhaitee" }])
  );
  assert.ok(souhaitee.note > inconnue.note);
});

test("chaque note est accompagnée d'un motif lisible", () => {
  const r = noterCompetence(competence({}), OFFRE);
  assert.ok(r.motif.length > 5);
});
