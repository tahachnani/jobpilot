import { test } from "node:test";
import assert from "node:assert/strict";
import { verifierStyle } from "@/lib/lettre/style";
import { formuleAppel } from "@/lib/lettre/destinataire";

/**
 * D93 — le contrôle de style de la lettre.
 *
 * Les cas ci-dessous sont tirés mot pour mot d'une lettre produite par
 * l'application le 29 septembre, pour l'offre Audition Conseil. Tant qu'ils
 * échouent, le prompt n'a pas tenu.
 */

const LETTRE_FAUTIVE = [
  "Le contrôle de gestion et l'audit constituent le socle de ma formation. Quatre expériences en reporting, budget et pilotage m'ont amené à travailler sur des périmètres multi-entités. Le poste s'inscrit dans cette continuité.",
  "Deux expériences illustrent cette contribution. Chez TECHNICAPS, le pilotage des indicateurs d'activité s'est accompagné de l'automatisation du reporting mensuel. Ces missions recouvrent les besoins identifiés dans l'annonce : reporting de performance, analyse des écarts vs budget et forecast.",
  "Le parcours traverse trois secteurs distincts. Ce passage par plusieurs ERP a construit une capacité à s'approprier rapidement un nouvel environnement.",
  "Disponible immédiatement, je peux rejoindre l'équipe finance sans délai. Je reste à disposition pour échanger sur les modalités d'un entretien.",
];

test("l'énumération annoncée est repérée", () => {
  const d = verifierStyle(LETTRE_FAUTIVE);
  assert.ok(
    d.some((x) => x.tournure === "Énumération annoncée"),
    d.map((x) => x.tournure).join(" / ")
  );
});

test("l'annonce de plan est repérée", () => {
  const d = verifierStyle(LETTRE_FAUTIVE);
  assert.ok(d.some((x) => x.tournure === "Annonce de plan"));
});

test("la recopie de l'annonce et le « vs » sont repérés", () => {
  const d = verifierStyle(LETTRE_FAUTIVE);
  assert.ok(d.some((x) => x.tournure === "Recopie de l'annonce"));
  assert.ok(d.some((x) => x.tournure === "Abréviation anglaise"));
});

test("la disponibilité dite deux fois est repérée", () => {
  const d = verifierStyle(LETTRE_FAUTIVE);
  assert.ok(d.some((x) => x.tournure === "Disponibilité dite deux fois"));
});

test("la clôture administrative et la formule creuse sont repérées", () => {
  const d = verifierStyle(LETTRE_FAUTIVE);
  assert.ok(d.some((x) => x.tournure === "Clôture administrative"));
  assert.ok(d.some((x) => x.tournure === "Formule creuse"));
});

test("les phrases sans sujet humain sont comptées", () => {
  const d = verifierStyle(LETTRE_FAUTIVE);
  const nominales = d.find((x) => x.tournure.startsWith("Phrase sans sujet"));
  assert.ok(nominales, d.map((x) => x.tournure).join(" / "));
  // « le pilotage… », « Le parcours traverse… », « Ce passage… »
  assert.match(nominales!.tournure, /\((?:[3-9]|\d{2})\)/);
});

/**
 * Une lettre correctement écrite ne doit rien déclencher : un contrôle qui
 * crie sur tout ne sert à rien.
 */
const LETTRE_SAINE = [
  "Formé au contrôle de gestion et à l'audit, j'ai passé quatre ans à produire du reporting et à construire des budgets, en industrie comme en logement social.",
  "Chez TECHNICAPS, j'ai piloté les indicateurs d'activité et automatisé le reporting mensuel. J'ai paramétré la comptabilité analytique dans l'ERP SILOG pour fiabiliser les données de clôture.",
  "Chez TRIUMPH, j'ai calculé les coûts de revient et identifié des pistes d'optimisation de marge de 5 à 10 %. Passer d'un ERP à l'autre m'a appris à m'approprier vite un environnement de données.",
  "Disponible immédiatement, je serais heureux de vous exposer ces travaux de vive voix.",
];

test("une lettre écrite à la première personne ne déclenche rien", () => {
  const d = verifierStyle(LETTRE_SAINE);
  assert.deepEqual(d, [], d.map((x) => `${x.tournure} : ${x.extrait}`).join(" / "));
});

/**
 * D96 — les règles venues des sources, pas de mon intuition.
 *
 * France Travail publie la « signature ChatGPT » ; l'OQLF interdit d'énumérer
 * les réalisations ; le repérage d'une lettre générée tient aussi au rythme et
 * aux adverbes. Chaque cas ci-dessous correspond à une de ces sources.
 */
test("la signature ChatGPT relevée par France Travail est repérée", () => {
  const d = verifierStyle([
    "Fort de mon expérience en contrôle de gestion, je souhaite mettre mes compétences au service de votre entreprise.",
  ]);
  const noms = d.map((x) => x.tournure).join(" / ");
  assert.ok(noms.includes("« Fort de mon…"), noms);
  assert.ok(noms.includes("mettre mes compétences au service de"), noms);
});

test("« convaincu que ma rigueur » et « c'est avec un vif intérêt » sont repérés", () => {
  const d = verifierStyle([
    "C'est avec un vif intérêt que je vous adresse ma candidature.",
    "Je suis convaincu que mon dynamisme et ma rigueur seront des atouts.",
  ]);
  const noms = d.map((x) => x.tournure).join(" / ");
  assert.ok(noms.includes("vif intérêt"), noms);
  assert.ok(noms.includes("convaincu que ma rigueur"), noms);
});

test("l'inventaire déguisé est repéré même sans compter", () => {
  const d = verifierStyle([
    "Chez TECHNICAPS, j'ai piloté le budget, construit les tableaux de bord, fiabilisé les clôtures et formé les équipes du site.",
  ]);
  const inv = d.find((x) => x.tournure.startsWith("Inventaire déguisé"));
  assert.ok(inv, d.map((x) => x.tournure).join(" / "));
  assert.match(inv!.tournure, /\(4 groupes\)/);
});

/**
 * Le rythme plat : aucune phrase ne respire, toutes avancent au même pas.
 * C'est le repère le plus fiable d'une prose automatique, et le plus invisible
 * à la relecture.
 */
test("le rythme plat est repéré quand aucune phrase n'est brève", () => {
  const d = verifierStyle([
    "J'ai construit les budgets annuels de trois entités industrielles en lien direct avec les responsables de production.",
    "J'ai fiabilisé les clôtures mensuelles en reprenant l'ensemble des écritures de stock sur un exercice complet.",
    "J'ai paramétré la comptabilité analytique de l'ERP pour que chaque atelier porte enfin ses propres charges.",
    "J'ai présenté chaque mois les écarts entre le réalisé et le budget devant le comité de direction du groupe.",
  ]);
  assert.ok(
    d.some((x) => x.tournure === "Rythme plat"),
    d.map((x) => x.tournure).join(" / ")
  );
});

test("les adverbes d'intensité ne sont signalés qu'à partir de trois", () => {
  const deux = verifierStyle([
    "J'ai particulièrement travaillé la fiabilité des clôtures, et pleinement repris le paramétrage analytique.",
  ]);
  assert.ok(!deux.some((x) => x.tournure.startsWith("Adverbes")));

  const trois = verifierStyle([
    "J'ai particulièrement travaillé la fiabilité des clôtures, pleinement repris le paramétrage et parfaitement tenu les délais.",
  ]);
  assert.ok(
    trois.some((x) => x.tournure.startsWith("Adverbes d'intensité")),
    trois.map((x) => x.tournure).join(" / ")
  );
});

test("l'éloge de l'entreprise est repéré", () => {
  const d = verifierStyle([
    "Rejoindre votre prestigieuse entreprise, leader mondial de son marché, serait une chance.",
  ]);
  assert.ok(
    d.some((x) => x.tournure === "Éloge de l'entreprise"),
    d.map((x) => x.tournure).join(" / ")
  );
});

/**
 * D92 — la formule d'appel se calcule, elle ne se demande pas au modèle.
 *
 * L'usage français veut qu'elle ne porte pas le patronyme : « Monsieur, » et
 * non « Monsieur Dupont, ». Le nom figure dans le bloc destinataire.
 */
test("la civilité écrite donne la formule d'appel", () => {
  assert.equal(formuleAppel("Monsieur Dupont"), "Monsieur,");
  assert.equal(formuleAppel("M. Dupont"), "Monsieur,");
  assert.equal(formuleAppel("Mme Martin"), "Madame,");
  assert.equal(formuleAppel("Madame Martin"), "Madame,");
});

test("sans civilité, la formule reste neutre : on ne devine pas un genre", () => {
  assert.equal(formuleAppel("Camille Dupont"), "Madame, Monsieur,");
  assert.equal(formuleAppel(""), "Madame, Monsieur,");
  assert.equal(formuleAppel(null), "Madame, Monsieur,");
});
