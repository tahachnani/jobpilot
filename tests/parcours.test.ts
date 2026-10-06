import { test } from "node:test";
import assert from "node:assert/strict";
import { verifierStyle } from "@/lib/lettre/style";
import { classerExperiences } from "@/lib/lettre/experiences";
import type { ExperienceCV } from "@/lib/cv/donnees";
import type { MissionRetenue } from "@/lib/cv/selection";
import type { OffreExtraite } from "@/lib/extraction-offre";

/**
 * Le parcours (D125, D127).
 *
 * Offre DIM du 6 octobre : lingerie, site d'Autun, secteur
 * `industrie_textile`. Taha a fait un stage de contrôle de gestion chez
 * TRIUMPH, lingerie, `industrie_textile` — le même secteur. La lettre a
 * raconté Le Mans Métropole Habitat et la valorisation de résidences HLM, sur
 * six lignes, sans nommer TRIUMPH.
 *
 * Deux causes : aucun classement des expériences n'existait — `retenues[0]`
 * rendait l'ordre chronologique — et rien ne lisait le secteur.
 */

function experience(p: Partial<ExperienceCV> & { entreprise: string }): ExperienceCV {
  return {
    id: p.entreprise,
    ville: null,
    pays: null,
    dateDebut: "2024-01-01",
    dateFin: null,
    periodes: [],
    typeContrat: "stage",
    titre: "Contrôleur de gestion",
    ordre: 1,
    secteurCode: null,
    missions: [],
    ...p,
  };
}

function mission(note: number): MissionRetenue {
  return {
    id: `m${note}`,
    experienceId: "e",
    texte: "Mission",
    voletFormulation: "cdg",
    empruntee: false,
    adaptee: false,
    codes: [],
    contientChiffre: false,
    pertinence: 0,
    ordre: 0,
    note,
    codesPartages: [],
  };
}

const OFFRE_DIM = {
  secteur_code: "industrie_textile",
} as unknown as OffreExtraite;

test("à notes proches, le secteur identique fait passer l'expérience devant", () => {
  const classees = classerExperiences(
    [
      {
        // La plus récente, bien notée, mais dans un tout autre univers.
        experience: experience({
          entreprise: "Le Mans Métropole Habitat",
          secteurCode: "immobilier_social",
          ordre: 1,
        }),
        missions: [mission(20), mission(15)],
      },
      {
        // Le stage en usine de lingerie, moins bien noté sur les codes.
        experience: experience({
          entreprise: "TRIUMPH",
          secteurCode: "industrie_textile",
          ordre: 4,
        }),
        missions: [mission(8), mission(5)],
      },
    ],
    OFFRE_DIM
  );

  assert.equal(classees[0].experience.entreprise, "TRIUMPH");
  assert.equal(classees[0].memeSecteur, true);
  assert.equal(classees[0].secteur, "Industrie textile");
});

test("le secteur ne renverse pas une expérience franchement plus pertinente", () => {
  const classees = classerExperiences(
    [
      {
        experience: experience({
          entreprise: "Le Mans Métropole Habitat",
          secteurCode: "immobilier_social",
          ordre: 1,
        }),
        missions: [mission(40), mission(30), mission(25)],
      },
      {
        experience: experience({
          entreprise: "TRIUMPH",
          secteurCode: "industrie_textile",
          ordre: 4,
        }),
        missions: [mission(5)],
      },
    ],
    OFFRE_DIM
  );

  // 95 contre 45 : quarante points de prime ne suffisent pas, et c'est voulu.
  assert.equal(classees[0].experience.entreprise, "Le Mans Métropole Habitat");
});

test("à égalité parfaite, la plus récente l'emporte", () => {
  const classees = classerExperiences(
    [
      { experience: experience({ entreprise: "B", ordre: 3 }), missions: [mission(10)] },
      { experience: experience({ entreprise: "A", ordre: 1 }), missions: [mission(10)] },
    ],
    OFFRE_DIM
  );
  assert.equal(classees[0].experience.entreprise, "A");
});

/** Les contrôles de fond. */

const CONTEXTE = {
  employeurs: ["TRIUMPH", "Le Mans Métropole Habitat"],
  employeurDuSecteur: "TRIUMPH",
  secteurPartage: "Industrie textile",
  ficheDisponible: true,
  format: "lettre" as const,
};

const PARAGRAPHES_OK = [
  "Je vous adresse ma candidature au poste de Contrôleur de Gestion Industriel.",
  "Vous produisez sur un site intégré, et ce poste existe pour que le coût de fabrication se lise jusqu'à l'atelier.",
  "Chez TRIUMPH, usine de lingerie, j'ai suivi les indicateurs de rendement industriel et calculé les coûts cachés d'une unité de production. Chez Le Mans Métropole Habitat, j'ai contrôlé chaque mois le quittancement d'un patrimoine de 18 000 logements.",
  "Dans ce poste, j'analyserais les écarts entre standards et réel. Je travaille sous Excel et Qlik Sense.",
];

test("un paragraphe qui nomme les deux employeurs passe", () => {
  const d = verifierStyle(PARAGRAPHES_OK, CONTEXTE);
  assert.equal(
    d.filter((x) => /Parcours|Secteur partagé/.test(x.tournure)).length,
    0,
    JSON.stringify(d, null, 1)
  );
});

test("un paragraphe qui n'en nomme qu'un est signalé", () => {
  const p = [...PARAGRAPHES_OK];
  p[2] =
    "Chez Le Mans Métropole Habitat, les résidences destinées à la vente n'avaient pas de méthode fiable. J'ai construit un modèle de calcul croisant le capital restant dû et la valeur nette comptable, puis rapproché les loyers et la grille de vente. Le comité de direction a disposé d'une valorisation homogène.";
  const d = verifierStyle(p, CONTEXTE);
  assert.ok(
    d.some((x) => x.tournure === "Parcours étroit"),
    JSON.stringify(d.map((x) => x.tournure))
  );
});

test("le secteur partagé tu est signalé, où qu'il manque", () => {
  const p = [...PARAGRAPHES_OK];
  p[2] =
    "Chez Le Mans Métropole Habitat, j'ai contrôlé le quittancement. Chez TECHNICAPS, j'ai audité les stocks.";
  const d = verifierStyle(p, { ...CONTEXTE, employeurs: ["Le Mans Métropole Habitat", "TECHNICAPS"] });
  assert.ok(
    d.some((x) => x.tournure === "Secteur partagé ignoré"),
    JSON.stringify(d.map((x) => x.tournure))
  );
});

test("un second employeur relégué à la dernière ligne compte comme un déséquilibre", () => {
  const p = [...PARAGRAPHES_OK];
  p[2] =
    "Chez TRIUMPH, j'ai suivi les indicateurs de rendement industriel, le taux de rendement synthétique et le délai de traitement des commandes. " +
    "J'ai calculé les coûts cachés d'une unité de production, entre absentéisme, accidents du travail et rotation du personnel. " +
    "J'ai proposé des actions d'amélioration continue des procédures internes, puis suivi leur application mois après mois sur l'ensemble des lignes. " +
    "J'ai aussi travaillé chez Le Mans Métropole Habitat.";
  const d = verifierStyle(p, CONTEXTE);
  assert.ok(
    d.some((x) => x.tournure === "Parcours déséquilibré"),
    JSON.stringify(d.map((x) => x.tournure))
  );
});

test("un §2 court sans fiche dit pourquoi il est court", () => {
  const p = [...PARAGRAPHES_OK];
  p[1] = "Votre entreprise recrute pour son site de production.";
  const d = verifierStyle(p, { ...CONTEXTE, ficheDisponible: false });
  assert.ok(
    d.some((x) => x.tournure === "Entreprise muette, faute de matière"),
    JSON.stringify(d.map((x) => x.tournure))
  );
});

test("un message qui ne parle que d'une expérience est signalé", () => {
  const d = verifierStyle(
    [
      "Pendant six mois chez Le Mans Métropole Habitat, j'ai construit un modèle de valorisation des résidences et rapproché les loyers de la grille de vente. Disponible immédiatement.",
      "Chez TRIUMPH j'ai suivi le rendement industriel. Chez Le Mans Métropole Habitat, le quittancement.",
    ],
    { ...CONTEXTE, format: "messages" }
  );
  assert.ok(
    d.some((x) => x.tournure === "Message 1 — parcours étroit"),
    JSON.stringify(d.map((x) => x.tournure))
  );
});
