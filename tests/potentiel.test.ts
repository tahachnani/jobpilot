import { test } from "node:test";
import assert from "node:assert/strict";
import { lirePotentiel, potentielAdaptation } from "@/lib/cv/ecart";
import type { Selection } from "@/lib/cv/selection";
import type { OffreExtraite } from "@/lib/extraction-offre";

/**
 * D78 — le potentiel d'adaptation, ventilé par source.
 *
 * Constat d'usage du 28 septembre : « souvent j'ai un potentiel fort
 * d'adaptation et aucune nouvelle mission à proposer ». Les deux indicateurs
 * ne mesuraient pas la même chose — le potentiel regardait quatre sources, les
 * propositions n'en exploitent qu'une. Ces tests figent la correction.
 */

/** Une sélection minimale : seuls les textes de missions et les libellés comptent. */
function selection(missions: string[], competences: string[]): Selection {
  return {
    niveau: { niveau: 0, quotas: [4], nbCompetences: 10, libelle: "" },
    experiences: [
      {
        experience: { id: "e1" },
        missions: missions.map((texte, i) => ({ id: `m${i}`, texte })),
      },
    ],
    competences: competences.map((libelle, i) => ({ id: `c${i}`, libelle })),
    nbEmprunts: 0,
  } as unknown as Selection;
}

function offre(termes: string[]): OffreExtraite {
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
    competences: termes.map((libelle) => ({
      libelle,
      caractere: "souhaitee" as const,
    })),
    outils: [],
    annees_experience: null,
    seniorite: null,
    encadrement: null,
    perimetre: null,
    formation: null,
    langues: [],
    mots_cles_ats: [],
  };
}

const CV = selection(["Production du reporting mensuel"], ["Excel"]);

test("un terme présent seulement dans une compétence ne rend pas le potentiel fort", () => {
  const p = potentielAdaptation(offre(["Consolidation"]), CV, {
    corpus: [],
    missions: [],
    competences: ["Consolidation des comptes"],
    formations: [],
  });

  assert.equal(p.parSource?.competence.length, 1);
  assert.equal(p.parSource?.corpus.length, 0);
  // C'était tout le défaut : « fort » annonçait une action impossible.
  assert.equal(p.niveau, "faible");
});

test("trois termes dans le corpus donnent un potentiel fort", () => {
  const p = potentielAdaptation(
    offre(["Consolidation", "Trésorerie", "Immobilisations"]),
    CV,
    {
      corpus: [
        "Travaux de consolidation des filiales",
        "Suivi de la trésorerie hebdomadaire",
        "Inventaire des immobilisations du parc",
      ],
      missions: [],
      competences: [],
      formations: [],
    }
  );

  assert.equal(p.parSource?.corpus.length, 3);
  assert.equal(p.niveau, "fort");
});

test("un seul terme dans le corpus donne un potentiel moyen", () => {
  const p = potentielAdaptation(offre(["Consolidation"]), CV, {
    corpus: ["Travaux de consolidation des filiales"],
    missions: [],
    competences: [],
    formations: [],
  });
  assert.equal(p.niveau, "moyen");
});

test("le corpus prime sur les autres sources : c'est lui qui ouvre une action", () => {
  const p = potentielAdaptation(offre(["Consolidation"]), CV, {
    corpus: ["Travaux de consolidation des filiales"],
    missions: ["Consolidation annuelle"],
    competences: ["Consolidation"],
    formations: [],
  });

  assert.equal(p.parSource?.corpus.length, 1);
  assert.equal(p.parSource?.mission.length, 0);
  assert.equal(p.parSource?.competence.length, 0);
});

test("un terme absent de tout le parcours reste hors de portée", () => {
  const p = potentielAdaptation(offre(["Consolidation"]), CV, {
    corpus: ["Suivi budgétaire des agences"],
    missions: [],
    competences: [],
    formations: [],
  });

  assert.equal(p.horsPortee.length, 1);
  assert.equal(p.niveau, "faible");
});

/**
 * D90 — le CV composé fait foi pour « ce qui est déjà dit ».
 *
 * Constat du 29 septembre : « contrôleur de gestion », imprimé en majuscules
 * en tête du CV, et « business partner », écrit dans l'accroche, étaient
 * comptés comme absents. Trois termes fantômes suffisaient à afficher « fort »
 * et à faire payer une génération qui ne pouvait rien produire.
 */
test("le titre et l'accroche du CV comptent comme déjà dits", () => {
  const texteCV = [
    "Taha Chnani",
    "CONTRÔLEUR DE GESTION",
    "PROFIL",
    "Prêt à intervenir en véritable business partner, à produire un reporting fiable.",
    "EXPÉRIENCES",
    "Production du reporting mensuel",
  ].join("\n");

  const p = potentielAdaptation(
    offre(["Contrôleur de gestion", "Business partner", "Consolidation"]),
    CV,
    {
      // Ces deux termes sont partout dans le corpus : c'est justement le piège.
      corpus: [
        "Missions de contrôleur de gestion au sein de la direction financière",
        "Rôle de business partner auprès des opérationnels",
        "Travaux de consolidation des filiales",
      ],
      missions: [],
      competences: [],
      formations: [],
    },
    texteCV
  );

  assert.deepEqual(p.parSource?.corpus, ["Consolidation"]);
  assert.equal(p.niveau, "moyen");
});

test("sans texte de CV, le repli sur la sélection reste en place", () => {
  const p = potentielAdaptation(offre(["Consolidation"]), CV, {
    corpus: ["Travaux de consolidation des filiales"],
    missions: [],
    competences: [],
    formations: [],
  });
  assert.equal(p.parSource?.corpus.length, 1);
});

test("la couverture reste ce qu'elle était : ce que le CV dit déjà", () => {
  // « Reporting » est sur le CV, « Consolidation » non : une moitié couverte.
  const p = potentielAdaptation(offre(["Reporting", "Consolidation"]), CV, {
    corpus: [],
    missions: [],
    competences: [],
    formations: [],
  });
  assert.equal(p.couverture, 50);
});

/**
 * D90 — la péremption d'un indice figé.
 *
 * Un document porte la forme qu'il avait le jour de sa composition. Un
 * potentiel de schéma 4 surestime ce qui reste à récupérer ; l'écran doit le
 * dire plutôt que l'afficher comme s'il valait encore.
 */
test("un potentiel d'avant D90 est signalé comme périmé", () => {
  const brut = {
    niveau: "fort" as const,
    recuperables: ["contrôleur de gestion"],
    horsPortee: [],
    couverture: 38,
    parSource: {
      corpus: ["contrôleur de gestion"],
      mission: [],
      competence: [],
      formation: [],
    },
  };

  assert.equal(lirePotentiel(brut, 4).perime, true);
  assert.equal(lirePotentiel(brut, 5).perime, false);
  // Schéma inconnu : on ne crie pas au périmé sans savoir.
  assert.equal(lirePotentiel(brut).perime, false);
});

test("un potentiel d'avant D78 est signalé comme sans ventilation", () => {
  const { sansSource } = lirePotentiel(
    { niveau: "moyen", recuperables: ["x"], horsPortee: [], couverture: 50 },
    3
  );
  assert.equal(sansSource, true);
});
