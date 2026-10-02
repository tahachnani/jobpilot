import { test } from "node:test";
import assert from "node:assert/strict";
import { messageEnTexte, normaliserMessages } from "@/lib/lettre/messages";

/**
 * D112 — les messages de motivation courts.
 *
 * Le nettoyage est la seule garantie que le texte se colle tel quel dans un
 * formulaire. Le prompt interdit l'appareil de lettre, mais une interdiction de
 * prompt n'est jamais une garantie : c'est la leçon de D96, où trois règles
 * étaient écrites deux fois pour cette raison.
 */

const COURT =
  "Je réponds à votre offre de contrôleur de gestion au département Performance économique. Chez Le Mans Métropole Habitat, j'ai contrôlé chaque mois le quittancement de 18 000 logements et retrouvé l'origine d'écarts de charges que l'on croyait liés aux consommations. Disponible immédiatement, je travaille sous ULIS Sopra, Excel et Qlik Sense.";

const MOYEN =
  "Je réponds à votre offre de contrôleur de gestion au département Performance économique.\n\nChez Le Mans Métropole Habitat, je contrôlais chaque mois le quittancement d'un patrimoine de 18 000 logements. En rapprochant les charges récupérables prévisionnelles de celles réellement quittancées, j'ai trouvé des écarts qui ne venaient pas des consommations mais du découpage des groupes immobiliers.\n\nJe travaille sous ULIS Sopra, Excel et Qlik Sense. Disponible immédiatement.";

test("un message propre passe sans être touché", () => {
  const m = normaliserMessages({ court: COURT, moyen: MOYEN });
  assert.equal(m?.court, COURT);
  assert.equal(m?.moyen, MOYEN);
});

test("la formule d'appel en tête est retirée", () => {
  const m = normaliserMessages({
    court: `Madame, Monsieur,\n\n${COURT}`,
    moyen: `Bonjour,\n${MOYEN}`,
  });
  assert.ok(!/^Madame/.test(m!.court), m!.court.slice(0, 40));
  assert.ok(!/^Bonjour/.test(m!.moyen), m!.moyen.slice(0, 40));
  assert.ok(m!.court.startsWith("Je réponds"));
});

test("la formule de politesse et la signature finales sont retirées", () => {
  const m = normaliserMessages({
    court: `${COURT}\n\nJe vous prie d'agréer, Madame, Monsieur, l'expression de mes salutations distinguées.\n\nTaha CHNANI`,
    moyen: `${MOYEN}\n\nCordialement,\nTaha CHNANI`,
  });
  assert.ok(!/agréer/.test(m!.court), m!.court.slice(-60));
  assert.ok(!/CHNANI/.test(m!.court));
  assert.ok(!/Cordialement/.test(m!.moyen), m!.moyen.slice(-60));
  assert.ok(m!.moyen.endsWith("Disponible immédiatement."));
});

test("une ligne d'objet en tête est retirée", () => {
  const m = normaliserMessages({
    court: `Objet : Candidature au poste de Contrôleur de Gestion\n${COURT}`,
    moyen: MOYEN,
  });
  assert.ok(m!.court.startsWith("Je réponds"), m!.court.slice(0, 40));
});

/**
 * Le dépassement se coupe à la phrase, jamais au caractère : tronquer au
 * milieu d'une phrase est pire que de perdre la phrase, parce que le résultat
 * est collé sans relecture dans un formulaire.
 */
test("un message trop long est coupé à la dernière phrase entière", () => {
  const phrase = "J'ai contrôlé le quittancement de 18 000 logements. ";
  const m = normaliserMessages({
    court: phrase.repeat(20),
    moyen: phrase.repeat(40),
  });

  assert.ok(m!.court.length <= 500, String(m!.court.length));
  assert.ok(m!.moyen.length <= 1000, String(m!.moyen.length));
  // Coupé net après un point, pas au milieu d'un mot.
  assert.ok(m!.court.endsWith("."), m!.court.slice(-30));
  assert.ok(m!.moyen.endsWith("."), m!.moyen.slice(-30));
});

test("une réponse incomplète est refusée plutôt que rapiécée", () => {
  assert.equal(normaliserMessages(undefined), null);
  assert.equal(normaliserMessages({ court: COURT, moyen: "  " }), null);
  assert.equal(normaliserMessages({ court: "", moyen: MOYEN }), null);
});

test("le texte stocké annonce les longueurs réelles", () => {
  const m = normaliserMessages({ court: COURT, moyen: MOYEN })!;
  const texte = messageEnTexte(m);
  assert.match(texte, new RegExp(`VERSION COURTE \\(${m.court.length} signes\\)`));
  assert.match(texte, new RegExp(`VERSION MOYENNE \\(${m.moyen.length} signes\\)`));
  assert.ok(texte.includes(m.court));
  assert.ok(texte.includes(m.moyen));
});
