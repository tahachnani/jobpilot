import { test } from "node:test";
import assert from "node:assert/strict";
import { NIVEAUX, secteurRevendique, selectionner } from "@/lib/cv/selection";
import type { CompetenceCV, DonneesCV } from "@/lib/cv/donnees";
import type { OffreExtraite } from "@/lib/extraction-offre";

/**
 * Les libellés qui revendiquent un secteur (D132).
 *
 * Offre Groupe Delcourt du 9 octobre — un éditeur de bandes dessinées — qui
 * exige « Contrôle de gestion », tout court. Trois lignes du profil contiennent
 * cette expression : industriel, opérationnel, sociale. Toutes notées 7, toutes
 * répondant au même besoin ; la déduplication n'en garde qu'une, et le
 * départage finit sur l'ordre alphabétique du libellé.
 *
 * « industriel » passe avant « opérationnel ». C'est l'alphabet qui a mis un
 * contrôleur de gestion industriel sur un CV pour un éditeur.
 */

function competence(p: Partial<CompetenceCV> & { libelle: string }): CompetenceCV {
  return {
    id: p.libelle,
    codeNormalise: "",
    categorie: "cdg",
    precision: null,
    niveau: 2,
    ordre: 900,
    ...p,
  };
}

function donneesAvec(competences: CompetenceCV[]): DonneesCV {
  return {
    profil: null,
    experiences: [],
    competences,
    formations: [],
    langues: [],
    interets: [],
    accroche: null,
  };
}

function offre(p: Partial<OffreExtraite> = {}): OffreExtraite {
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
    competences: [],
    outils: [],
    annees_experience: null,
    formation: null,
    langues: [],
    mots_cles_ats: [],
    ...p,
  };
}

const TROIS_CDG = [
  competence({ libelle: "Contrôle de gestion industriel" }),
  competence({ libelle: "Contrôle de gestion opérationnel" }),
  competence({ libelle: "Contrôle de gestion sociale", niveau: 1 }),
];

const EXIGE_CDG = [
  { libelle: "Contrôle de gestion", caractere: "indispensable" as const },
];

const libelles = (d: DonneesCV, o: OffreExtraite) =>
  selectionner(d, o, NIVEAUX[3]).competences.map((c) => c.libelle);

test("l'éditeur de bandes dessinées reçoit le contrôle de gestion opérationnel", () => {
  const delcourt = offre({
    intitule: "Contrôleur de gestion junior (H/F)",
    secteur_code: "autre",
    competences: EXIGE_CDG,
    mots_cles_ats: ["contrôleur de gestion", "édition", "reporting"],
  });

  const retenues = libelles(donneesAvec(TROIS_CDG), delcourt);
  assert.ok(!retenues.includes("Contrôle de gestion industriel"), JSON.stringify(retenues));
  assert.ok(
    retenues.includes("Contrôle de gestion opérationnel"),
    `le besoin doit rester servi : ${JSON.stringify(retenues)}`
  );
});

test("l'offre industrielle garde la mention industrielle", () => {
  const eurenco = offre({
    intitule: "Contrôleur de gestion industriel H/F",
    secteur_code: "industrie",
    competences: EXIGE_CDG,
  });
  assert.ok(
    libelles(donneesAvec(TROIS_CDG), eurenco).includes(
      "Contrôle de gestion industriel"
    )
  );
});

test("toute la famille industrie compte, pas seulement le code exact", () => {
  // DIM est en `industrie_textile`, Cooperl en `agroalimentaire` : deux usines.
  for (const secteur of ["industrie_textile", "agroalimentaire", "energie"]) {
    const o = offre({ secteur_code: secteur, competences: EXIGE_CDG });
    assert.ok(
      libelles(donneesAvec(TROIS_CDG), o).includes("Contrôle de gestion industriel"),
      secteur
    );
  }
});

test("les libellés immobiliers sortent sur les offres immobilières", () => {
  const profil = [
    competence({ libelle: "Comptabilité immobilière", categorie: "compta" }),
    competence({ libelle: "Comptabilité générale", categorie: "compta", niveau: 3 }),
  ];
  const bailleur = offre({
    intitule: "Comptable Immobilier",
    secteur_code: "immobilier_social",
    competences: [
      { libelle: "Comptabilité immobilière", caractere: "indispensable" },
    ],
  });
  assert.ok(
    libelles(donneesAvec(profil), bailleur).includes("Comptabilité immobilière")
  );
});

test("une annonce qui emploie le mot le réclame, même sans secteur reconnu", () => {
  // Le filet de sécurité : l'extraction de secteur a échoué, mais l'intitulé
  // dit « Immobilier ». La ligne doit sortir quand même.
  const profil = [
    competence({ libelle: "Comptabilité immobilière", categorie: "compta" }),
  ];
  const o = offre({
    intitule: "Collaborateur comptable immobilier",
    secteur_code: null,
    competences: [{ libelle: "Comptabilité", caractere: "indispensable" }],
  });
  assert.ok(libelles(donneesAvec(profil), o).includes("Comptabilité immobilière"));
});

test("un secteur absent ne vaut pas autorisation", () => {
  const o = offre({ secteur_code: null, competences: EXIGE_CDG });
  const retenues = libelles(donneesAvec(TROIS_CDG), o);
  assert.ok(!retenues.includes("Contrôle de gestion industriel"), JSON.stringify(retenues));
  assert.ok(retenues.includes("Contrôle de gestion opérationnel"));
});

test("le mot doit être un mot, pas un morceau", () => {
  assert.equal(secteurRevendique("Contrôle de gestion industriel"), "industrie");
  assert.equal(secteurRevendique("Comptabilité copropriété"), "immobilier");
  assert.equal(secteurRevendique("Gestion locative et copropriété"), "immobilier");
  assert.equal(secteurRevendique("ULIS Sopra"), null);
  // « Industrie » seule n'est pas une revendication de spécialité ; et rien
  // dans « Immobilisations et amortissements » ne parle d'immobilier.
  assert.equal(secteurRevendique("Immobilisations et amortissements"), null);
  assert.equal(secteurRevendique("Expérience en environnement industriel"), "industrie");
});
