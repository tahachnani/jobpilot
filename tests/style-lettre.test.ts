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

/**
 * D100–D103 — la lettre in'li du 1er octobre.
 *
 * Trois paragraphes, une seule situation, aucune énumération, aucune signature
 * ChatGPT : D96 a tenu sur la forme. Et la lettre est mauvaise quand même.
 * Les cas ci-dessous figent les quatre défauts que D96 ne voyait pas.
 */
const LETTRE_INLI = [
  "Vous ouvrez ce poste de Contrôleur de Gestion Opérationnel dans un contexte de constitution d'un groupe national de près de 80 000 logements, rattaché au responsable du contrôle de gestion opérationnel IDF. Un périmètre large exige des indicateurs fiables. C'est ce terrain, entre patrimoine immobilier et pilotage budgétaire, qui m'intéresse.",
  "Chez Triumph, à Fès, j'ai dû évaluer la rentabilité d'une unité de production dont les coûts de revient restaient mal connus. J'ai repris le calcul poste par poste et confronté les résultats aux indicateurs de rendement industriel suivis sur place. Les pistes de marge identifiées, de 5 à 10 points, ont nourri les recommandations transmises au management opérationnel. Un chiffre juste change une décision.",
  "Dans ce poste, je consoliderais les indicateurs par portefeuille et objectiverais les écarts budgétaires auprès des directions opérationnelles, en lien avec les projets data évoqués dans l'annonce. Je resterais attentif aux signaux faibles. Disponible immédiatement, je souhaite échanger sur ces missions lors d'un entretien.",
];

test("les maximes de la lettre in'li sont repérées", () => {
  const d = verifierStyle(LETTRE_INLI);
  const m = d.find((x) => x.tournure.startsWith("Maxime"));
  assert.ok(m, d.map((x) => x.tournure).join(" / "));
  // « Un périmètre large exige des indicateurs fiables. » et « Un chiffre
  // juste change une décision. »
  assert.match(m!.tournure, /\([2-9]\)/);
});

/**
 * Ce test exigeait d'abord qu'on signale les trois conditionnels de la lettre
 * in'li. Il a été retourné en D114, parce que la règle mesurait la mauvaise
 * chose.
 *
 * Comparons. in'li : « je consoliderais les indicateurs et objectiverais les
 * écarts […] Je resterais attentif aux signaux faibles » — trois conditionnels,
 * et le paragraphe ne dit rien. MSA : « je participerais au déploiement de la
 * comptabilité analytique, je construirais les tableaux comparant les coûts,
 * j'analyserais les écarts » — trois conditionnels, et chacun nomme une mission
 * de l'annonce.
 *
 * Le nombre ne distingue pas les deux ; seul le contenu le fait, et un contrôle
 * de forme ne sait pas le juger. Le seuil est donc relevé à cinq, ce qui
 * n'attrape plus que l'accumulation manifeste. La lettre in'li reste signalée
 * par quatre autres règles, qui, elles, visent juste.
 */
test("des conditionnels groupés qui portent du contenu ne sont pas signalés", () => {
  const d = verifierStyle([
    "Dans ce poste, je participerais au déploiement de la comptabilité analytique au sein du réseau, je construirais des tableaux de bord comparant les coûts de gestion entre organismes et j'analyserais les écarts entre eux.",
  ]);
  assert.ok(
    !d.some((x) => x.tournure.startsWith("Conditionnel")),
    d.map((x) => x.tournure).join(" / ")
  );
});

test("l'accumulation manifeste de conditionnels reste signalée", () => {
  const d = verifierStyle([
    "Je consoliderais les indicateurs, j'objectiverais les écarts, je resterais attentif aux signaux, je proposerais des axes et je construirais les tableaux.",
  ]);
  assert.ok(
    d.some((x) => x.tournure.startsWith("Conditionnel en rafale")),
    d.map((x) => x.tournure).join(" / ")
  );
});

/**
 * D114 — le remplissage du §2, relevé sur la lettre MSA du 2 octobre.
 */
test("l'affirmation vague sur le parcours est repérée", () => {
  const d = verifierStyle([
    "Rapprocher des chiffres remontés par des entités différentes pour en tirer une lecture commune est l'exercice que j'ai mené dans mes expériences précédentes en contrôle de gestion.",
  ]);
  assert.ok(
    d.some((x) => x.tournure === "Affirmation vague sur le parcours"),
    d.map((x) => x.tournure).join(" / ")
  );
});

test("une expérience nommée et datée n'est pas une affirmation vague", () => {
  const d = verifierStyle([
    "Chez Le Mans Métropole Habitat, j'ai contrôlé le quittancement de 18 000 logements pendant dix-huit mois.",
  ]);
  assert.ok(
    !d.some((x) => x.tournure === "Affirmation vague sur le parcours"),
    d.map((x) => x.tournure).join(" / ")
  );
});

test("le renvoi à l'annonce comme document est repéré", () => {
  const d = verifierStyle(LETTRE_INLI);
  assert.ok(
    d.some((x) => x.tournure === "Renvoi à l'annonce"),
    d.map((x) => x.tournure).join(" / ")
  );
});

test("la phrase « les pistes ont nourri » ne passe plus", () => {
  const d = verifierStyle(LETTRE_INLI);
  const noms = d.map((x) => x.tournure).join(" / ");
  // Deux filets : la liste de noms abstraits, et la mesure de première
  // personne qui, elle, ne dépend d'aucun vocabulaire.
  assert.ok(
    noms.includes("Phrase sans sujet humain") || noms.includes("Phrases sans « je »"),
    noms
  );
});

test("une clôture correcte n'est pas prise pour une maxime", () => {
  const d = verifierStyle([
    "Disponible immédiatement, je souhaite échanger sur ces missions lors d'un entretien.",
    "C'est ce terrain, entre patrimoine immobilier et pilotage budgétaire, qui m'intéresse.",
  ]);
  assert.ok(
    !d.some((x) => x.tournure.startsWith("Maxime")),
    d.map((x) => `${x.tournure} : ${x.extrait}`).join(" / ")
  );
});

/**
 * D107 — la lettre modèle du prompt doit passer son propre contrôle.
 *
 * C'est le test le plus important du fichier. Le prompt enseigne désormais par
 * l'exemple : si cet exemple déclenche un défaut, il enseigne le défaut. La
 * première version du contrôle d'ouverture exigeait le « je » dès la phrase
 * d'ouverture et condamnait donc la référence — un contrôle qui condamne sa
 * propre référence est faux, pas sévère.
 *
 * Toute modification du contrôle de style se vérifie ici en premier.
 */
const LETTRE_MODELE_DU_PROMPT = [
  "Vous réunissez 80 000 logements sous une direction unique et cherchez quelqu'un pour en consolider le pilotage auprès des directions opérationnelles. J'ai fait ce travail dix-huit mois chez un bailleur de 18 000 logements, et c'est le changement d'échelle qui m'intéresse.",
  "Chez Le Mans Métropole Habitat, je contrôlais chaque mois le quittancement du patrimoine : loyers, charges, nouvelles locations, vacance. En rapprochant les charges récupérables prévisionnelles de celles réellement quittancées, j'ai trouvé des écarts qui ne venaient pas des consommations mais du découpage : deux sous-groupes immobiliers voisins étaient régularisés sur des périmètres différents. J'ai harmonisé ce découpage et neutralisé les écarts d'exercice. Je n'ai plus eu à réexpliquer les mêmes anomalies à chaque régularisation.",
  "Dans ce poste, je ferais le même travail à une autre échelle : consolider les indicateurs par portefeuille, et expliquer les écarts budgétaires aux directions opérationnelles plutôt que de les leur transmettre. Je travaille sous ULIS Sopra, Excel et Qlik Sense. Disponible immédiatement, je vous propose d'en parler de vive voix.",
];

test("la lettre modèle du prompt ne déclenche aucun défaut", () => {
  const d = verifierStyle(LETTRE_MODELE_DU_PROMPT);
  assert.deepEqual(d, [], d.map((x) => `${x.tournure} : ${x.extrait}`).join(" / "));
});

test("une phrase sur l'entreprise est le plan, deux sont un défaut", () => {
  const une = verifierStyle([
    "Vous ouvrez ce poste pour structurer le suivi de trois sites. J'ai fait ce travail deux ans en industrie.",
  ]);
  assert.ok(!une.some((x) => x.tournure.startsWith("Ouverture")));

  const deux = verifierStyle([
    "Vous ouvrez ce poste pour structurer le suivi de trois sites. Le groupe réunit quatre usines et six cents salariés. J'ai fait ce travail deux ans en industrie.",
  ]);
  assert.ok(
    deux.some((x) => x.tournure.startsWith("Ouverture")),
    deux.map((x) => x.tournure).join(" / ")
  );
});

test("la catégorie d'outil est repérée, le logiciel nommé passe", () => {
  assert.ok(
    verifierStyle(["Excel reste mon outil principal, complété par une pratique des ERP métier."]).some(
      (x) => x.tournure === "Catégorie au lieu d'un outil"
    )
  );
  assert.ok(
    !verifierStyle(["J'ai paramétré la comptabilité analytique dans l'ERP SILOG."]).some(
      (x) => x.tournure === "Catégorie au lieu d'un outil"
    )
  );
  assert.ok(
    !verifierStyle(["Passer d'un ERP à l'autre m'a appris à m'approprier vite un environnement."]).some(
      (x) => x.tournure === "Catégorie au lieu d'un outil"
    )
  );
});
