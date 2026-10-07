import { test } from "node:test";
import assert from "node:assert/strict";
import { verifierStyle } from "@/lib/lettre/style";
import { documentationEntreprise } from "@/lib/entreprise/documentee";
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

/**
 * D129 — le test de suffisance de l'annonce.
 *
 * Offre DIM du 7 octobre : l'annonce portait un paragraphe entier sur
 * l'employeur, et le test a rendu « 0 fait chiffré, insuffisante ». La
 * recherche web est partie, a coûté 2,7 ¢, et a rapporté ce que l'annonce
 * disait déjà.
 */

const DIM = `DBI ( Dim Brands International ) est un leader du sous-vêtement européen qui commercialise de nombreuses marques réputées ( Dim, Nur Die, Lovable, Playtex ) et opère dans plus de dix pays. Porté par son savoir-faire et son programme d'innovation, DBI développe des produits essentiels du quotidien qui s'adressent à l'ensemble des publics. Notre siège européen se situe à Rueil-Malmaison (92), et à Autun (71), en Bourgogne, se trouve notre siège social historique, où sont répartis divers services tels que la fabrication, le contrôle de la qualité et la logistique. Grâce à cet atelier de fabrication dans le centre de la France, plus de 5 milliards de collants ont déjà été confectionnés depuis la création de la marque DIM en 1953 !`;

test("un paragraphe de présentation dispense de chercher", () => {
  const d = documentationEntreprise(DIM, "DIM");
  assert.equal(d.suffisante, true);
  assert.ok(d.paragraphe, "le paragraphe doit être reconnu");
});

test("les trois faits que les anciens motifs rataient sont attrapés", () => {
  const d = documentationEntreprise(DIM, "DIM");
  const tous = d.faits.join(" | ");
  // Nombre écrit en lettres.
  assert.match(tous, /dix pays/i);
  // Unité absente de toute liste fermée — aucune ne contiendra « collants ».
  assert.match(tous, /milliards de collants/i);
  // L'année ne suit pas immédiatement « depuis ».
  assert.match(tous, /1953/);
});

test("le pied de page d'un site d'emploi n'est pas une présentation", () => {
  const chrome = `Afficher plus d'offres Découvrez d'autres services web Réussir son CV et sa lettre de motivation Suscitez l'intérêt du recruteur et donnez-lui envie de vous rencontrer. B.A.BA Entretien Apprenez à préparer votre prochain entretien avec nos conseils métier, secteur et marché. Notre réseau de clients et nos agences vous accompagnent.`;
  assert.equal(documentationEntreprise(chrome, "Antin Résidences").paragraphe, null);
});

test("une description de poste tutoyante n'est pas une présentation", () => {
  const poste = `Tes missions : Dans le cadre du développement de notre activité, nous recherchons un contrôleur travaux HTB. Concrètement, tes missions seront réparties entre la supervision sur nos sites, le suivi client, la coordination avec nos agences et le reporting métier auprès du groupe. Tu seras rattaché au responsable de secteur.`;
  assert.equal(documentationEntreprise(poste, "AtlantiC Ingénierie").paragraphe, null);
});

test("le cabinet qui recrute pour un client ne présente pas l'employeur", () => {
  const intermediaire = `A propos ODAS CONSEIL : Le talent juste, au bon endroit, au bon moment. Parce que le bon profil au bon endroit change tout, ŌDAS Conseil, expert du recrutement en Expertise Comptable et Paie, recrute pour le compte de l'un de ses clients, un cabinet implanté depuis 30 ans, présent sur plusieurs sites et reconnu sur son marché.`;
  assert.equal(
    documentationEntreprise(intermediaire, "Cabinet d'expertise comptable").paragraphe,
    null
  );
});

test("une annonce sans rien sur l'employeur reste insuffisante", () => {
  const maigre = `Nous recherchons un contrôleur de gestion. Vous serez en charge du suivi budgétaire, de l'analyse des écarts et de la production du reporting mensuel. Vous êtes titulaire d'un master et justifiez d'une première expérience réussie sur un poste similaire. Le poste est à pourvoir immédiatement.`;
  const d = documentationEntreprise(maigre, "Société X");
  assert.equal(d.suffisante, false);
  assert.equal(d.paragraphe, null);
});
