import { test } from "node:test";
import assert from "node:assert/strict";
import {
  NIVEAUX,
  PLAFOND_MISSIONS,
  nombreDeMissions,
  prochaineAGarnir,
  selectionner,
} from "@/lib/cv/selection";
import type {
  DonneesCV,
  ExperienceCV,
  MissionCV,
} from "@/lib/cv/donnees";
import type { OffreExtraite } from "@/lib/extraction-offre";
import { choisirNiveau } from "@/lib/cv/compacite";
import { tientSurUnePage } from "@/lib/cv/encombrement";

/**
 * Le garnissage (D120).
 *
 * Constat du 4 octobre : un CV compta sorti au cran 4 — 3/3/2/2 missions —
 * avec trente-sept points de blanc en bas de page, soit trois puces. Le cran
 * au-dessus en ajoutait trois d'un coup *et* une compétence : il ne passait
 * pas, le code redescendait, et le blanc restait.
 *
 * Ces tests portent sur la mécanique de la place rendue : le quota augmenté,
 * l'ordre des paliers et le plafond. L'arbitrage par la composition réelle,
 * lui, vit dans le générateur et n'est pas vérifiable sans React-PDF.
 */

function mission(p: Partial<MissionCV> & { id: string }): MissionCV {
  return {
    experienceId: "e1",
    texte: `Mission ${p.id}`,
    voletFormulation: "compta",
    empruntee: false,
    adaptee: false,
    codes: [],
    contientChiffre: false,
    pertinence: 0,
    ordre: 0,
    ...p,
  };
}

/** Une expérience avec `n` missions candidates, toutes natives et neutres. */
function experience(id: string, n: number, ordre: number): ExperienceCV {
  return {
    id,
    entreprise: id,
    ville: null,
    pays: null,
    dateDebut: "2024-01-01",
    dateFin: null,
    periodes: [],
    typeContrat: "cdi",
    titre: "Comptable",
    ordre,
    missions: Array.from({ length: n }, (_, i) =>
      mission({ id: `${id}-${i}`, experienceId: id, ordre: i })
    ),
  };
}

function donneesAvec(tailles: number[]): DonneesCV {
  return {
    profil: null,
    experiences: tailles.map((n, i) => experience(`E${i}`, n, i)),
    competences: [],
    formations: [],
    langues: [],
    interets: [],
    accroche: null,
  };
}

const OFFRE_NEUTRE: OffreExtraite = {
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
};

/** Le cran le plus serré : 3/2/2/2, celui qui laissait le blanc. */
const CRAN_SERRE = NIVEAUX[NIVEAUX.length - 1];

test("un supplément rend une mission à l'expérience visée, et à elle seule", () => {
  const donnees = donneesAvec([5, 5, 5]);
  const avant = selectionner(donnees, OFFRE_NEUTRE, CRAN_SERRE);
  assert.deepEqual(
    avant.experiences.map((e) => e.missions.length),
    [3, 2, 2]
  );

  const apres = selectionner(donnees, OFFRE_NEUTRE, CRAN_SERRE, [0, 1, 0]);
  assert.deepEqual(
    apres.experiences.map((e) => e.missions.length),
    [3, 3, 2]
  );
});

test("le garnissage amène d'abord tout le monde à trois, puis seulement à quatre", () => {
  const donnees = donneesAvec([5, 5, 5]);
  const supplements = [0, 0, 0];
  const ordre: number[] = [];

  // On simule la boucle du générateur en supposant que la page accepte tout.
  for (let i = 0; i < 8; i += 1) {
    const selection = selectionner(donnees, OFFRE_NEUTRE, CRAN_SERRE, supplements);
    const cible = prochaineAGarnir(selection);
    if (cible === null) break;
    ordre.push(cible);
    supplements[cible] += 1;
  }

  // Cran 3/2/2 : E1 et E2 montent à 3 avant que E0 ne passe à 4.
  assert.deepEqual(ordre, [1, 2, 0, 1, 2]);

  const finale = selectionner(donnees, OFFRE_NEUTRE, CRAN_SERRE, supplements);
  assert.deepEqual(
    finale.experiences.map((e) => e.missions.length),
    [4, 4, 4]
  );
});

test("le garnissage ne dépasse jamais le plafond de missions", () => {
  const donnees = donneesAvec([9]);
  const selection = selectionner(donnees, OFFRE_NEUTRE, CRAN_SERRE, [99]);
  assert.equal(selection.experiences[0].missions.length, PLAFOND_MISSIONS);
  assert.equal(prochaineAGarnir(selection), null);
});

test("une expérience sans mission en réserve n'est pas proposée au garnissage", () => {
  // Deux missions candidates, quota de deux au cran serré : rien à rendre.
  const donnees = donneesAvec([4, 2]);
  const selection = selectionner(donnees, OFFRE_NEUTRE, CRAN_SERRE);
  assert.deepEqual(
    selection.experiences.map((e) => e.missions.length),
    [3, 2]
  );
  // E1 est au bout de ses candidates : le garnissage va directement à E0.
  assert.equal(prochaineAGarnir(selection), 0);
});

test("la sélection garde la trace des suppléments appliqués", () => {
  const donnees = donneesAvec([5, 5]);
  const selection = selectionner(donnees, OFFRE_NEUTRE, CRAN_SERRE, [1, 0]);
  assert.deepEqual(selection.supplements, [1, 0]);
  assert.equal(nombreDeMissions(selection), 6);
});

test("sans supplément, la sélection est celle du cran — le garnissage n'est pas rétroactif", () => {
  const donnees = donneesAvec([5, 5]);
  const selection = selectionner(donnees, OFFRE_NEUTRE, CRAN_SERRE);
  assert.deepEqual(selection.supplements, []);
  assert.equal(nombreDeMissions(selection), 5);
});

/**
 * L'invariant que le garnissage ne doit jamais casser : une page.
 *
 * `choisirNiveau` garnit à l'estimation. Ces tests vérifient les deux bouts :
 * la page reste tenue, et la place disponible est effectivement rendue.
 */

function donneesCompletes(tailles: number[]): DonneesCV {
  return {
    ...donneesAvec(tailles),
    profil: {
      nom: "Chnani",
      prenom: "Taha",
      email: "x@example.com",
      telephone: null,
      localisation: null,
      linkedin: null,
      permis: null,
    },
    formations: [
      {
        diplome: "Master - Contrôle de gestion et Audit Organisationnel",
        etablissement: "Le Mans Université",
        ville: "Le Mans",
        dateDebut: "2023-09-01",
        dateFin: "2025-08-31",
      },
    ],
    langues: [{ langue: "Français", niveau: "C1", certification: null }],
  };
}

test("choisirNiveau rend la place restante au lieu de la laisser vide", () => {
  // Cinq missions candidates par expérience : de quoi garnir largement.
  const donnees = donneesCompletes([5, 5, 5]);
  const { selection, modele } = choisirNiveau(donnees, OFFRE_NEUTRE, "compta");

  assert.ok(
    tientSurUnePage(modele),
    "le garnissage ne doit jamais faire déborder la page"
  );
  assert.ok(
    nombreDeMissions(selection) >
      nombreDeMissions(
        selectionner(donnees, OFFRE_NEUTRE, selection.niveau)
      ),
    "le CV garni doit porter plus de missions que le cran seul"
  );
});

test("le libellé du cran dit le garnissage appliqué", () => {
  const donnees = donneesCompletes([5, 5, 5]);
  const { selection, modele } = choisirNiveau(donnees, OFFRE_NEUTRE, "compta");
  const rendues = selection.supplements.reduce((n, s) => n + s, 0);

  if (rendues > 0) {
    assert.match(modele.meta.niveauLibelle, /Place restante rendue/);
  } else {
    assert.equal(modele.meta.niveauLibelle, selection.niveau.libelle);
  }
});

test("un profil sans mission en réserve n'est pas garni et tient quand même", () => {
  // Deux missions par expérience : au cran cible, tout passe déjà.
  const donnees = donneesCompletes([2, 2, 2]);
  const { selection, modele } = choisirNiveau(donnees, OFFRE_NEUTRE, "compta");
  assert.equal(nombreDeMissions(selection), 6);
  assert.ok(tientSurUnePage(modele));
  assert.equal(modele.meta.niveauLibelle, selection.niveau.libelle);
});
