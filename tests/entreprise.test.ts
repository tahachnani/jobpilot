import { test } from "node:test";
import assert from "node:assert/strict";
import { documentationEntreprise } from "@/lib/entreprise/documentee";
import { cleEntreprise } from "@/lib/entreprise/fiche";
import { referenceAnnonce } from "@/lib/offre/reference";

/**
 * D109 — l'annonce suffit-elle, ou faut-il payer une recherche ?
 *
 * Les extraits ci-dessous sont les vrais débuts d'annonces de la base, au
 * 2 octobre. Ils commencent par la section « Entreprise » quand elle existe :
 * c'est là que vivent les faits sur l'employeur, et c'est donc l'endroit que
 * le détecteur doit savoir lire.
 *
 * Le seuil est asymétrique à dessein. Se tromper en cherchant coûte 3 ¢ ; se
 * tromper en ne cherchant pas coûte un paragraphe inventé, que personne ne
 * rattrape.
 */

const MSA = `Entreprise

La MSA, Sécurité sociale du monde agricole, est le 2ème régime de protection sociale en France. Avec ses 16 000 collaborateurs répartis au sein de ses 37 organismes, elle protège plus de 5 millions de personnes (agriculteurs, salariés agricoles, collaborateurs des organismes professionnels agricoles).

La Caisse Centrale de la MSA (CCMSA), 750 collaborateurs, est la tête du réseau. Elle contribue à la mise en œuvre de la politique sociale agricole et représente la MSA au niveau national auprès des Ministères et partenaires.

Poste

Au sein du département Performance économique, vous rejoindrez une équipe à taille humaine composée d'un responsable de service, de deux contrôleurs de gestion et d'un data analyst.`;

const INLI = `Entreprise

Découvrez votre nouveau projet professionnel !

Chez in'li, filiale du Groupe Action Logement, 1300 collaborateurs agissent chaque jour sur l'ensemble du territoire national et sont engagés pour faciliter l'accès au logement des salariés et des jeunes actifs.

Rejoindre in'li, ce n'est pas juste rejoindre le leader du logement à prix maîtrisé.

Poste

Dans un contexte de création d'un groupe national de près de plus de 80 000 logements et rattaché(e) directement au responsable du contrôle de gestion opérationnel IDF, le Contrôleur de gestion aura pour missions de.`;

/** Une annonce France Travail : des tâches, une référence, rien sur l'employeur. */
const RATP = `Offre d'emploi Contrôleur de Gestion / Gestionnaire de contrats H/F - 77 - Bussy-Saint-Martin - 214FCXS | France Travail

Offre n° 214FCXS Contrôleur de Gestion / Gestionnaire de contrats H/F 77 - Bussy-Saint-Martin

Actualisé le 22 septembre 2026
Le/la contrôleur de gestion / gestionnaire de contrats est sous l'autorité opérationnelle du Directeur Administratif et Financier.
Centraliser, classer et maintenir à jour l'ensemble des contrats (clients, fournisseurs, partenaires) ;
Suivre les échéances contractuelles (reconductions, renouvellements, résiliations) ;
Réaliser une veille juridique ciblée en droit des contrats (publics et/ou privés) ;
Tenir des tableaux de suivi contractuel et financier ;
Produire des reportings périodiques (échéances, révisions, risques et litiges potentiels).`;

/** Un cabinet : une page carrières bavarde et creuse, aucun fait. */
const CMG = `Carrières - Offres - Consultant(e) en Contrôle de Gestion - CMG Consulting Group

Chez CMG Consulting Group nous considérons qu'un environnement de travail positif et une forte cohésion d'équipe sont indispensables pour donner le meilleur de soi-même.

Consultant(e) en Contrôle de Gestion
Expérience : 2 à 5 ans
Métier : Gestion Financière
Description du poste :
Vous accompagnez nos clients dans le pilotage, le contrôle de la performance et la gestion prévisionnelle.
Élaborer et piloter le processus Budgétaire, définir les méthodologies de construction budgétaire, collecter, analyser et synthétiser les données budgétaires.
Localité : Île de France. Type de contrat : CDI.
Intégrer CMG Consulting Group, c'est faire partie d'une équipe qui croit en la valeur du collectif.`;

test("une annonce qui présente l'entreprise dispense de chercher", () => {
  for (const [nom, texte] of [
    ["MSA", MSA],
    ["in'li", INLI],
  ] as const) {
    const d = documentationEntreprise(texte);
    assert.equal(d.suffisante, true, `${nom} : ${JSON.stringify(d)}`);
    assert.ok(d.faits.length >= 2, `${nom} : ${d.faits.join(" / ")}`);
  }
});

test("les faits retenus sont les passages trouvés, pas des étiquettes", () => {
  const d = documentationEntreprise(MSA);
  // « 16 000 collaborateurs » est une preuve affichable ; « effectif » n'en
  // serait pas une.
  assert.ok(
    d.faits.some((f) => /16\s?000\s+collaborateurs/.test(f)),
    d.faits.join(" / ")
  );
  assert.ok(
    d.faits.some((f) => /37\s+organismes/.test(f)),
    d.faits.join(" / ")
  );
});

test("une annonce muette sur l'employeur déclenche la recherche", () => {
  for (const [nom, texte] of [
    ["RATP", RATP],
    ["CMG", CMG],
  ] as const) {
    const d = documentationEntreprise(texte);
    assert.equal(d.suffisante, false, `${nom} : ${d.faits.join(" / ")}`);
  }
});

test("une annonce trop courte ne suffit jamais", () => {
  assert.equal(documentationEntreprise("Contrôleur de gestion H/F").suffisante, false);
  assert.equal(documentationEntreprise(null).suffisante, false);
});

/**
 * D111 — la référence de l'annonce, pour l'objet de la lettre.
 */
test("la référence France Travail est trouvée", () => {
  assert.equal(referenceAnnonce(RATP), "214FCXS");
  assert.equal(
    referenceAnnonce("Offre n° 214DLDP Assistante de contrôle de gestion"),
    "214DLDP"
  );
});

test("la référence APEC et les mentions explicites sont trouvées", () => {
  assert.equal(
    referenceAnnonce("Candidature sur offre d'emploi N° 179510151W - GROUPE ADINFO"),
    "179510151W"
  );
  assert.equal(
    referenceAnnonce("Votre réponse à notre annonce pour l'offre 2026-132550 – Contrôleur"),
    "2026-132550"
  );
  assert.equal(referenceAnnonce("Référence : A084640 - Contrôleuse de gestion"), "A084640");
});

/**
 * Ce qui ressemble à une référence sans en être une. Chacun de ces cas
 * produirait « sous la référence … » en tête d'une lettre, et chacun est tiré
 * d'une annonce réelle de la base.
 */
test("ni le salaire, ni le code postal, ni l'année ne passent pour une référence", () => {
  assert.equal(referenceAnnonce("Salaire 40 - 40 k€ brut annuel"), null);
  assert.equal(referenceAnnonce("Montreuil - 93100, Île-de-France"), null);
  assert.equal(referenceAnnonce("création d'Hexafret au 01/01/2025"), null);
  assert.equal(referenceAnnonce("Expérience : 2 à 5 ans. Métier : Gestion"), null);
  assert.equal(referenceAnnonce(null), null);
});

/**
 * D108 — la clé de rapprochement : une fiche par employeur, pas par graphie.
 */
test("les formes juridiques et les parenthèses ne séparent pas deux fiches", () => {
  const attendu = cleEntreprise("in'li");
  assert.equal(cleEntreprise("IN'LI SAS"), attendu);
  assert.equal(cleEntreprise("in'li (Groupe Action Logement)"), attendu);
  assert.equal(cleEntreprise("  In'Li  "), attendu);
});

/**
 * Ce test disait d'abord le contraire — qu'« Irisolaris » et « Irisolaris
 * Groupe » devaient rester séparés — et il échouait. C'était l'attente qui
 * était fausse, pas le code : ces deux graphies désignent le même employeur,
 * et deux annonces de la base les portent. Les faire tomber sur la même fiche
 * est exactement la réutilisation qu'on cherche.
 *
 * Le risque inverse existe et il est réel : « Groupe SOS » se réduit à « sos »,
 * et un homonyme partagerait sa fiche. La fiche affiche toujours le nom avec
 * lequel elle a été construite, donc l'erreur serait visible — et le prompt de
 * recherche demande explicitement de signaler un doute d'homonymie plutôt que
 * de remplir au hasard.
 */
test("deux graphies du même employeur partagent une fiche", () => {
  assert.equal(cleEntreprise("Irisolaris"), cleEntreprise("Irisolaris Groupe"));
  assert.equal(cleEntreprise("Faurie"), cleEntreprise("Groupe Faurie"));
});

test("deux employeurs distincts gardent deux clés distinctes", () => {
  assert.notEqual(cleEntreprise("MSA"), cleEntreprise("MSA Mayenne Orne Sarthe"));
  assert.notEqual(cleEntreprise("in'li"), cleEntreprise("Action Logement"));
});
