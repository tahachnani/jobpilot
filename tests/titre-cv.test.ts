import { test } from "node:test";
import assert from "node:assert/strict";
import { nettoyerIntitulePoste, titreCV } from "@/lib/cv/titre";

/**
 * Le titre du CV (D121).
 *
 * Tous les cas ci-dessous sont des intitulés réellement enregistrés dans la
 * base — c'est la seule façon d'écrire un nettoyeur qui ne casse pas sur du
 * vrai texte d'annonce. Deux familles cohabitent dans ces titres : le bruit
 * administratif, qu'on retire, et la spécialisation, qui vaut de l'or sur un
 * CV et qu'on garde. Les deux arrivent après le même tiret.
 */

test("les marqueurs de mixité disparaissent, sous toutes leurs formes", () => {
  assert.equal(
    nettoyerIntitulePoste("Collaborateur Comptable Junior H/F"),
    "Collaborateur Comptable Junior"
  );
  assert.equal(
    nettoyerIntitulePoste("Contrôleur de Gestion (H/F)"),
    "Contrôleur de Gestion"
  );
  assert.equal(
    nettoyerIntitulePoste("Contrôleur de gestion F/H"),
    "Contrôleur de gestion"
  );
  assert.equal(
    nettoyerIntitulePoste("Contrôleur de gestion - H/F"),
    "Contrôleur de gestion"
  );
  assert.equal(
    nettoyerIntitulePoste("Assistant comptable (H/F/X)"),
    "Assistant comptable"
  );
});

test("la forme inclusive collée au mot revient au masculin", () => {
  assert.equal(
    nettoyerIntitulePoste("Assistant(e) Contrôleur de gestion Junior (H/F)"),
    "Assistant Contrôleur de gestion Junior"
  );
  assert.equal(
    nettoyerIntitulePoste("Chargé(e) de gestion budgétaire et comptable"),
    "Chargé de gestion budgétaire et comptable"
  );
  assert.equal(
    nettoyerIntitulePoste("Consultant(e) en Contrôle de Gestion"),
    "Consultant en Contrôle de Gestion"
  );
});

/**
 * Le cas qui interdit la règle facile « on coupe après le tiret ». Ces quatre
 * intitulés viennent de la base, et ce qui suit le séparateur est précisément
 * ce qui distingue la candidature.
 */
test("la spécialisation qui suit un séparateur est conservée", () => {
  assert.equal(
    nettoyerIntitulePoste("Contrôleur de Gestion - Business Partner Logistique H/F"),
    "Contrôleur de Gestion - Business Partner Logistique"
  );
  assert.equal(
    nettoyerIntitulePoste("Contrôleur de Gestion - Performance Économique"),
    "Contrôleur de Gestion - Performance Économique"
  );
  assert.equal(
    nettoyerIntitulePoste("Consultant junior – Audit et gestion des immobilisations"),
    "Consultant junior - Audit et gestion des immobilisations"
  );
  assert.equal(
    nettoyerIntitulePoste("Contrôleur de Gestion Comptabilité Charges Locatives H/F"),
    "Contrôleur de Gestion Comptabilité Charges Locatives"
  );
});

test("deux postes distincts séparés par une barre restent deux postes", () => {
  assert.equal(
    nettoyerIntitulePoste("Contrôleur de Gestion / Analyste Financier Real Estate"),
    "Contrôleur de Gestion / Analyste Financier Real Estate"
  );
  assert.equal(
    nettoyerIntitulePoste("Contrôleur de gestion / data analyst"),
    "Contrôleur de gestion / data analyst"
  );
});

test("le même poste redit au féminin n'est écrit qu'une fois", () => {
  assert.equal(
    nettoyerIntitulePoste(
      "Contrôleur de gestion immobilier/Contrôleuse de gestion immobilier"
    ),
    "Contrôleur de gestion immobilier"
  );
});

test("le contrat, la ville et la référence sont du bruit, pas le poste", () => {
  assert.equal(
    nettoyerIntitulePoste("Contrôleur de gestion - CDI - Paris", {
      localisation: "Paris",
    }),
    "Contrôleur de gestion"
  );
  assert.equal(
    nettoyerIntitulePoste("Alternance | Assistant comptable"),
    "Assistant comptable"
  );
  assert.equal(
    nettoyerIntitulePoste("Comptable général H/F – Réf. 12345"),
    "Comptable général"
  );
});

/**
 * Le garde-fou qui compte le plus : un nettoyage qui vide le titre est un
 * nettoyage raté. Mieux vaut un titre bruité qu'un CV sans titre.
 */
test("un intitulé que le nettoyage viderait ressort intact", () => {
  assert.equal(nettoyerIntitulePoste("H/F"), "H/F");
  assert.equal(nettoyerIntitulePoste("CDI"), "CDI");
});

test("un intitulé sans bruit n'est pas touché", () => {
  assert.equal(
    nettoyerIntitulePoste("Comptable Copropriété"),
    "Comptable Copropriété"
  );
  assert.equal(
    nettoyerIntitulePoste("Chargé de mission comptabilité"),
    "Chargé de mission comptabilité"
  );
});

test("un titre trop long pour la ligne est coupé à un mot entier", () => {
  const long =
    "Assistant(e) de direction - Gestion administrative et contrôle de gestion";
  const r = nettoyerIntitulePoste(long);
  assert.ok(r.length <= 60, `${r.length} caractères`);
  assert.ok(!/[\s-]$/.test(r), "pas de séparateur en fin de titre");
  assert.ok(r.startsWith("Assistant de direction"));
});

test("un intitulé vide ou absent ne produit rien", () => {
  assert.equal(nettoyerIntitulePoste(null), "");
  assert.equal(nettoyerIntitulePoste("   "), "");
});

/** L'ordre des sources : saisie manuelle, puis annonce, puis volet. */

test("ta saisie l'emporte sur l'annonce", () => {
  assert.equal(
    titreCV(
      "compta",
      { intitule: "Collaborateur Comptable Junior H/F", localisation: null },
      "Auditeur junior"
    ),
    "Auditeur junior"
  );
});

test("sans saisie, le titre vient de l'annonce nettoyée", () => {
  assert.equal(
    titreCV("compta", {
      intitule: "Collaborateur Comptable Junior H/F",
      localisation: null,
    }),
    "Collaborateur Comptable Junior"
  );
});

test("sans annonce exploitable, on retombe sur l'intitulé cible du volet", () => {
  assert.equal(titreCV("compta", null), "Comptable");
  assert.equal(titreCV("cdg", { intitule: null, localisation: null }), "Contrôleur de gestion");
  assert.equal(titreCV("compta", { intitule: "  ", localisation: null }, "  "), "Comptable");
});

/**
 * Les trois pièges relevés en passant le nettoyeur sur les 99 intitulés de la
 * base. Chacun est une règle qui marchait en théorie et se trompait sur du
 * vrai texte.
 */

test("deux mots qui partagent une racine ne sont pas un couple masculin/féminin", () => {
  // « gestion » et « gestionnaire » partagent sept lettres et le second finit
  // par un « e » : la règle de racine seule y voyait un féminin et rendait
  // « Contrôleur de Gestion de contrats ».
  assert.equal(
    nettoyerIntitulePoste("Contrôleur de Gestion / Gestionnaire de contrats H/F"),
    "Contrôleur de Gestion / Gestionnaire de contrats"
  );
});

test("le doublet d'un seul mot est réduit, barre oblique ou « ou »", () => {
  assert.equal(
    nettoyerIntitulePoste("Contrôleur/Contrôleuse de Gestion Junior F/H"),
    "Contrôleur de Gestion Junior"
  );
  assert.equal(
    nettoyerIntitulePoste("Contrôleur ou Contrôleuse de gestion commercial (H/F)"),
    "Contrôleur de gestion commercial"
  );
});

test("les formes inclusives au point et au tiret reviennent au masculin", () => {
  assert.equal(
    nettoyerIntitulePoste("Contrôleur.euse de Gestion"),
    "Contrôleur de Gestion"
  );
  assert.equal(
    nettoyerIntitulePoste("Contrôleur-euse de gestion junior"),
    "Contrôleur de gestion junior"
  );
  assert.equal(
    nettoyerIntitulePoste("UN(E) CHARGÉ.E DE SUIVI ADMINISTRATIF ET FINANCIER H/F"),
    "CHARGÉ DE SUIVI ADMINISTRATIF ET FINANCIER"
  );
});

test("sacrifier un segment ne doit pas amputer la candidature de moitié", () => {
  // Couper après le tiret rendait « Assistant de direction » : vingt-deux
  // caractères là où la limite en autorise soixante, et la spécialisation
  // perdue. On coupe au mot plutôt que de jeter le segment.
  assert.equal(
    nettoyerIntitulePoste(
      "Assistant(e) de direction - Gestion administrative et contrôle de gestion"
    ),
    "Assistant de direction - Gestion administrative et contrôle"
  );
  // À l'inverse, ici le premier segment suffit à nommer le poste.
  assert.equal(
    nettoyerIntitulePoste(
      "Contrôleur de Gestion Opérationnel Junior - Gestion Financière d'Agence H/F"
    ),
    "Contrôleur de Gestion Opérationnel Junior"
  );
});

test("un titre coupé ne se termine jamais sur un mot de liaison", () => {
  const r = nettoyerIntitulePoste(
    "Assistante de contrôle de gestion administrative et financière (H/F)"
  );
  assert.ok(r.length <= 60, `${r.length} caractères : ${r}`);
  assert.ok(!/\b(?:et|ou|de|du|des|la|le|en)$/i.test(r), `finit mal : ${r}`);
  assert.equal(r, "Assistante de contrôle de gestion administrative");
});
