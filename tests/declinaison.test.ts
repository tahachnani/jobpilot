import { test } from "node:test";
import assert from "node:assert/strict";
import { NIVEAUX, selectionner, teteDeclinee } from "@/lib/cv/selection";
import type { CompetenceCV, DonneesCV } from "@/lib/cv/donnees";
import type { OffreExtraite } from "@/lib/extraction-offre";

/**
 * Une ligne par métier (D130).
 *
 * CV compta du 7 octobre, offre « Comptable junior H/F » chez GIE GCCL. Huit
 * lignes de compétences, dont « Comptabilité générale », « Comptabilité
 * analytique » — les deux exigées par l'annonce — et, en dernière position,
 * « Comptabilité fournisseurs », que l'annonce ne demande nulle part.
 *
 * Elle est entrée par la note de famille : l'annonce exigeant « Comptabilité
 * générale », `familleDeclaree` déclare tout le métier comptable exigé, et
 * **chaque** ligne de la catégorie compta en reçoit une note. Trois fois le
 * même mot en tête de bloc sur un CV d'une page.
 */

function competence(p: Partial<CompetenceCV> & { libelle: string }): CompetenceCV {
  return {
    id: p.libelle,
    codeNormalise: "",
    categorie: "compta",
    precision: null,
    niveau: 1,
    ordre: 1,
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

/** Le profil réel de Taha, réduit aux lignes que l'offre fait remonter. */
const PROFIL_COMPTA = [
  competence({ libelle: "Comptabilité générale", niveau: 3 }),
  competence({ libelle: "Comptabilité analytique", niveau: 3 }),
  competence({ libelle: "Rapprochements bancaires et lettrage", niveau: 2 }),
  competence({ libelle: "Déclarations fiscales et sociales", niveau: 2 }),
  competence({ libelle: "Clôtures mensuelles et annuelles", niveau: 2 }),
  competence({ libelle: "Révision des comptes", niveau: 2 }),
  competence({ libelle: "Comptabilité fournisseurs", niveau: 1 }),
  competence({ libelle: "Comptabilité clients", niveau: 1 }),
];

const GIE_GCCL = offre({
  intitule: "Comptable junior H/F",
  competences: [
    { libelle: "Comptabilité générale", caractere: "indispensable" },
    { libelle: "Comptabilité analytique", caractere: "indispensable" },
    { libelle: "Rapprochements bancaires", caractere: "indispensable" },
  ],
  mots_cles_ats: ["comptable junior", "BTS comptabilité"],
});

const libelles = (d: DonneesCV, o: OffreExtraite, niveau = NIVEAUX[4]) =>
  selectionner(d, o, niveau).competences.map((c) => c.libelle);

test("la compta fournisseurs ne complète plus un bloc qui porte déjà la compta générale", () => {
  const retenues = libelles(donneesAvec(PROFIL_COMPTA), GIE_GCCL);

  assert.ok(
    retenues.includes("Comptabilité générale"),
    "l'exigence nommée reste"
  );
  assert.ok(
    !retenues.includes("Comptabilité fournisseurs"),
    `déclinaison générique conservée : ${JSON.stringify(retenues)}`
  );
  assert.ok(!retenues.includes("Comptabilité clients"));
});

test("une déclinaison maîtrisée garde sa place, une déclinaison de notions non", () => {
  /**
   * Offre FIDUCIAL du 8 octobre, « Assistant comptable » : elle exige la
   * comptabilité générale, et ne nomme ni l'analytique ni les fournisseurs.
   *
   * La première version de la règle écartait les deux, et la place libérée
   * revenait à « Tenue comptable », au niveau notions. Elle sacrifiait une
   * compétence maîtrisée pour en remonter une qui ne l'est pas, au seul motif
   * que la première partageait sa tête et la seconde non.
   *
   * Une déclinaison ne cède donc sa place que si elle n'est **ni nommée par
   * l'annonce, ni tenue au cœur du métier** — c'est-à-dire si elle n'était là
   * que par le rattrapage de famille de D124.
   */
  const fiducial = offre({
    intitule: "Assistant comptable",
    competences: [
      { libelle: "Comptabilité générale", caractere: "indispensable" },
      { libelle: "Fiscalité", caractere: "indispensable" },
    ],
    mots_cles_ats: ["assistant comptable", "comptabilité", "cabinet comptable"],
  });

  const retenues = libelles(donneesAvec(PROFIL_COMPTA), fiducial);

  assert.ok(retenues.includes("Comptabilité générale"), "exigée nommément");
  assert.ok(
    retenues.includes("Comptabilité analytique"),
    `maîtrisée et au cœur du métier, elle reste : ${JSON.stringify(retenues)}`
  );
  assert.ok(!retenues.includes("Comptabilité fournisseurs"), "notions, elle sort");
  assert.ok(!retenues.includes("Comptabilité clients"), "notions, elle sort");
});

test("une déclinaison exigée par l'annonce passe malgré la règle", () => {
  // La Française cherchait un comptable fournisseurs : la ligne doit sortir,
  // et la comptabilité générale déjà retenue n'a pas à l'en empêcher.
  const laFrancaise = offre({
    intitule: "Comptable Fournisseurs Junior",
    competences: [
      { libelle: "Comptabilité générale", caractere: "indispensable" },
      { libelle: "Comptabilité fournisseurs", caractere: "indispensable" },
    ],
  });

  const retenues = libelles(donneesAvec(PROFIL_COMPTA), laFrancaise);
  assert.ok(retenues.includes("Comptabilité fournisseurs"));
  assert.ok(retenues.includes("Comptabilité générale"));
});

test("la place libérée revient à une ligne qui dit autre chose", () => {
  const avant = libelles(
    donneesAvec(PROFIL_COMPTA.filter((c) => c.libelle !== "Comptabilité clients")),
    GIE_GCCL
  );
  // Sans la déclinaison, le bloc descend chercher plus bas dans le profil.
  assert.ok(avant.includes("Révision des comptes"));
  assert.ok(avant.includes("Clôtures mensuelles et annuelles"));
});

/**
 * Le périmètre de la liste fermée. C'est elle qui fait la différence entre
 * « on ne cite pas toutes les comptas » et « on ampute le CV ».
 */

test("deux qualités qui commencent par le même mot ne sont pas une déclinaison", () => {
  for (const libelle of [
    "Esprit critique",
    "Esprit d'initiative",
    "Capacité d'analyse",
    "Capacité d'adaptation",
    "Sens du détail et fiabilité des données",
    "Gestion des stocks",
    "Gestion de la paie",
  ]) {
    assert.equal(teteDeclinee(libelle), null, libelle);
  }
});

test("le contrôle de gestion se décline, le contrôle tout court non", () => {
  assert.equal(teteDeclinee("Contrôle de gestion industriel"), "controle de gestion");
  assert.equal(teteDeclinee("Contrôle de gestion sociale"), "controle de gestion");
  // Deux métiers différents, qui perdraient une ligne avec la tête « controle ».
  assert.equal(teteDeclinee("Contrôle budgétaire et suivi des écarts"), null);
  assert.equal(teteDeclinee("Contrôle interne et procédures"), null);
});

test("la tête doit ouvrir le libellé, pas s'y trouver", () => {
  assert.equal(teteDeclinee("Comptabilité fournisseurs"), "comptabilite");
  assert.equal(teteDeclinee("Comptabilité"), "comptabilite");
  // « comptables » n'est pas « comptabilite », et la tête n'est pas en tête.
  assert.equal(teteDeclinee("Logiciels comptables"), null);
  assert.equal(teteDeclinee("Normes comptables et fiscales"), "normes");
});

test("les deux meilleures lignes de chaque métier ne se mangent pas entre elles", () => {
  // Analyse financière (n3) doit survivre à Analyse de données (n1), et non
  // l'inverse : le tri passe avant la règle.
  const profil = [
    competence({ libelle: "Analyse de données", categorie: "cdg", niveau: 1 }),
    competence({ libelle: "Analyse financière", categorie: "cdg", niveau: 3 }),
  ];
  const cdg = offre({ intitule: "Contrôleur de gestion H/F" });
  const retenues = libelles(donneesAvec(profil), cdg);

  assert.deepEqual(retenues, ["Analyse financière"]);
});

test("la ligne d'outils ne répète pas la même famille d'outils", () => {
  const profil = [
    competence({ libelle: "Outils comptables", categorie: "outil", niveau: 2 }),
    competence({ libelle: "Outils décisionnels", categorie: "outil", niveau: 2 }),
    competence({ libelle: "Sage 100", categorie: "outil", niveau: 2 }),
  ];
  const retenues = libelles(donneesAvec(profil), offre({ outils: ["Sage 100"] }));

  const ligne = retenues.find((l) => l.includes("Sage 100")) ?? "";
  assert.ok(ligne.includes("Sage 100"));
  assert.ok(ligne.includes("Outils comptables"));
  assert.ok(
    !ligne.includes("Outils décisionnels"),
    `deux « Outils … » sur la même ligne : ${ligne}`
  );
});
