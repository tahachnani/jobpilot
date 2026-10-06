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

/**
 * Ce test affirmait que le cœur de métier passe devant **l'outil exigé**.
 * L'attente était fausse, et elle a été réécrite le 5 octobre (D124).
 *
 * Ce que la règle voulait obtenir, c'est que le contrôle de gestion ne soit
 * pas enterré sous Excel et Power BI — des outils que l'annonce **cite**. Pas
 * qu'il double une compétence que l'annonce déclare **indispensable** : sur
 * l'offre EURENCO, cette version-là sortait « Rigueur » et « Esprit critique »
 * du CV au profit de huit lignes de contrôle de gestion générique.
 *
 * Et la comparaison du test ne se produit même pas sur un CV : Excel est un
 * outil, il part sur la ligne groupée et ne dispute aucune place aux lignes
 * métier.
 */
test("le cœur de métier tenu passe devant un outil simplement cité", () => {
  const offre = { ...offreAvec([{ libelle: "Contrôle de gestion", caractere: "indispensable" as const }]), outils: ["Excel"] };
  const coeur = noterCompetence(
    competence({
      libelle: "Contrôle budgétaire",
      codeNormalise: "controle budgetaire",
      categorie: "cdg",
      niveau: 3,
    }),
    offre
  );
  const outil = noterCompetence(competence({ niveau: 3 }), offre);
  assert.ok(
    coeur.note > outil.note,
    `cœur ${coeur.note} devrait dépasser outil ${outil.note}`
  );
});

test("ce que l'annonce nomme passe devant ce qu'elle implique", () => {
  const nommee = noterCompetence(competence({ niveau: 3 }), OFFRE);
  const famille = noterCompetence(
    competence({
      libelle: "Contrôle budgétaire",
      codeNormalise: "controle budgetaire",
      categorie: "cdg",
      niveau: 3,
    }),
    OFFRE
  );
  assert.ok(
    nommee.note > famille.note,
    `nommée ${nommee.note} devrait dépasser famille ${famille.note}`
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

/**
 * D124 — le bloc COMPÉTENCES de l'offre EURENCO, contrôleur de gestion
 * industriel. Le CV sortait avec **six lignes de comptabilité sur huit** :
 * comptabilité générale, rapprochements bancaires, déclarations fiscales,
 * clôtures, révision des comptes. Trois règles s'étaient liguées.
 */

const EURENCO = {
  ...offreAvec([
    { libelle: "Comptabilité analytique", caractere: "souhaitee" },
    { libelle: "Analyse financière", caractere: "souhaitee" },
    { libelle: "Communication", caractere: "souhaitee" },
    { libelle: "Rigueur", caractere: "indispensable" },
  ]),
  intitule: "Contrôleur de gestion",
  mots_cles_ats: ["contrôleur de gestion", "analyse écarts", "KPI"],
};

test("une compétence précise ne déclare pas la famille qui la contient", () => {
  // « Comptabilité analytique » est une compétence, pas le métier comptable.
  // Le test par inclusion y voyait une déclaration de famille et décorait les
  // sept lignes de la catégorie compta.
  const r = noterCompetence(
    competence({
      libelle: "Rapprochements bancaires et lettrage",
      codeNormalise: "rapprochements lettrage",
      categorie: "compta",
      niveau: 3,
    }),
    EURENCO
  );
  assert.equal(r.note, 0, r.motif);
});

test("la compétence que l'annonce nomme vraiment reste notée", () => {
  const r = noterCompetence(
    competence({
      libelle: "Comptabilité analytique",
      codeNormalise: "compta analytique",
      categorie: "compta",
      niveau: 3,
    }),
    EURENCO
  );
  assert.equal(r.note, 6, r.motif);
});

test("l'intitulé du poste déclare le métier, même si la liste ne le répète pas", () => {
  // EURENCO n'écrit « contrôle de gestion » nulle part dans ses compétences :
  // c'est dans le titre. La famille cdg ne se déclenchait donc jamais, sur une
  // offre de contrôleur de gestion.
  const r = noterCompetence(
    competence({
      libelle: "Contrôle budgétaire et suivi des écarts",
      codeNormalise: "controle budgetaire",
      categorie: "cdg",
      niveau: 3,
    }),
    EURENCO
  );
  assert.equal(r.note, 5, r.motif);
  assert.match(r.motif, /Contrôleur de gestion/);
});

test("un besoin de l'annonce est nommé, pour qu'il ne soit servi qu'une fois", () => {
  // Trois lignes du profil répondaient à l'unique « Communication » demandée
  // et occupaient trois des huit places.
  const a = noterCompetence(
    competence({
      libelle: "Communication avec les opérationnels",
      codeNormalise: "communication operationnels",
      categorie: "transversale",
      niveau: 2,
    }),
    EURENCO
  );
  const b = noterCompetence(
    competence({
      libelle: "Relationnel et communication",
      codeNormalise: "relationnel communication",
      categorie: "transversale",
      niveau: 2,
    }),
    EURENCO
  );
  assert.equal(a.besoin, b.besoin, "même besoin, donc une seule place");
  assert.equal(a.besoin, "communication");
});

test("le cœur de métier ne porte pas de besoin : il mérite plusieurs lignes", () => {
  const r = noterCompetence(
    competence({
      libelle: "Élaboration et analyse des tableaux de bord",
      codeNormalise: "tableaux bord reporting",
      categorie: "cdg",
      niveau: 3,
    }),
    EURENCO
  );
  assert.equal(r.besoin, null, r.motif);
});
