import { test } from "node:test";
import assert from "node:assert/strict";
import { motsSignificatifs, termePresent, termesAbsents } from "@/lib/termes";
import { normaliser, correspond } from "@/lib/texte";

/**
 * La comparaison de termes métier.
 *
 * Elle travaille mot à mot, sur des racines tronquées : « analyse écarts »
 * doit retrouver « analyse des écarts », et « régularisation » doit retrouver
 * « régularisées ». C'est ce qui décide si un terme de l'offre est déjà dans
 * le parcours ou s'il manque vraiment.
 */

test("les articles ne comptent pas dans la comparaison", () => {
  const mots = motsSignificatifs("Analyse des écarts budgétaires");
  assert.equal(termePresent("analyse écarts", mots), true);
});

test("une forme fléchie retrouve sa racine", () => {
  const mots = motsSignificatifs("Régularisations de charges locatives");
  assert.equal(termePresent("régularisation charges", mots), true);
});

test("un terme réellement absent est signalé", () => {
  const mots = motsSignificatifs("Production du reporting mensuel");
  assert.equal(termePresent("consolidation", mots), false);
});

test("termesAbsents ne retient que ce qui manque", () => {
  const manquants = termesAbsents(
    ["reporting", "consolidation"],
    "Production du reporting mensuel des résidences"
  );
  assert.deepEqual(manquants, ["consolidation"]);
});

test("normaliser efface accents, casse et ponctuation", () => {
  assert.equal(normaliser("Analyse des Écarts !"), normaliser("analyse des ecarts"));
});

test("correspond rapproche deux libellés écrits différemment", () => {
  assert.equal(correspond("Contrôle de gestion", "controle de gestion"), true);
});
