import { test } from "node:test";
import assert from "node:assert/strict";
import {
  dateDansNJours,
  dateDeRelanceParDefaut,
  joursDepuis,
  relanceDue,
} from "@/lib/suivi";
import { CHAINE_PREPARATION, DELAI_RELANCE_JOURS, STATUTS } from "@/config/volets";

/**
 * Le suivi de candidature.
 *
 * La règle qui compte : rien ne devient « envoyée » tout seul, et la
 * préparation n'avance que vers l'avant.
 */

test("une offre non envoyée n'est jamais à relancer", () => {
  assert.equal(relanceDue("cv_genere", "2020-01-01"), false);
  assert.equal(relanceDue("entretien", "2020-01-01"), false);
});

test("une offre envoyée sans date de relance n'est pas à relancer", () => {
  assert.equal(relanceDue("envoyee", null), false);
});

test("une relance datée d'hier est due, une relance lointaine ne l'est pas", () => {
  assert.equal(relanceDue("envoyee", dateDansNJours(-1)), true);
  assert.equal(relanceDue("envoyee", dateDansNJours(30)), false);
});

test("la relance du jour même est due", () => {
  assert.equal(relanceDue("envoyee", dateDansNJours(0)), true);
});

test("la relance par défaut tombe au délai annoncé", () => {
  assert.equal(dateDeRelanceParDefaut(), dateDansNJours(DELAI_RELANCE_JOURS));
});

test("joursDepuis tolère l'absence de date et ne rend jamais de négatif", () => {
  assert.equal(joursDepuis(null), null);
  assert.equal(joursDepuis("pas une date"), null);
  assert.ok((joursDepuis(dateDansNJours(5)) ?? -1) >= 0);
});

test("la chaîne de préparation est ordonnée et s'arrête avant l'envoi", () => {
  assert.equal(CHAINE_PREPARATION[0], "enregistree");
  assert.equal(CHAINE_PREPARATION[CHAINE_PREPARATION.length - 1], "email_genere");
  assert.ok(!(CHAINE_PREPARATION as readonly string[]).includes("envoyee"));
});

test("chaque statut de la chaîne a un libellé affichable", () => {
  for (const s of CHAINE_PREPARATION) {
    assert.ok(STATUTS[s], `libellé manquant pour ${s}`);
  }
});
