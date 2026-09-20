import { test } from "node:test";
import assert from "node:assert/strict";
import { controler, nombres, nomsPropres } from "@/lib/cv/controle";

/**
 * Le contrôle de reformulation.
 *
 * C'est la fonction qui décide si une phrase retouchée par un modèle a le
 * droit d'arriver sur un CV signé. Elle penche volontairement du côté du
 * refus : chaque cas ci-dessous a été écrit après un incident réel ou pour
 * figer une règle décidée en conversation.
 */

const OFFRE = ["reporting", "tableaux de bord", "analyse des écarts"];

test("un chiffre inventé est refusé", () => {
  const v = controler(
    "Production du reporting mensuel",
    "Production du reporting mensuel pour 12 entités",
    { termesOffre: OFFRE }
  );
  assert.equal(v.accepte, false);
  assert.ok(v.motifs.length > 0);
});

test("un chiffre effacé est refusé au même titre", () => {
  const v = controler(
    "Suivi de 12 budgets de résidence",
    "Suivi des budgets de résidence et du reporting",
    { termesOffre: OFFRE }
  );
  assert.equal(v.accepte, false);
});

test("une proposition identique à l'original est refusée", () => {
  const t = "Production du reporting mensuel";
  const v = controler(t, t, { termesOffre: OFFRE });
  assert.equal(v.accepte, false);
});

test("une reformulation de pure forme, sans terme de l'offre, est refusée", () => {
  const v = controler(
    "Participation à la clôture annuelle",
    "Contribution à la clôture annuelle",
    { termesOffre: OFFRE }
  );
  assert.equal(v.accepte, false);
});

test("une reformulation qui fait entrer un terme de l'offre est acceptée", () => {
  const v = controler(
    "Production des états mensuels de suivi",
    "Production du reporting mensuel de suivi",
    { termesOffre: OFFRE }
  );
  assert.equal(v.accepte, true, v.motifs.join(" / "));
  assert.ok(v.apports.length > 0);
});

test("un outil connu qui disparaît est refusé", () => {
  const v = controler(
    "Construction des tableaux de bord sous Excel",
    "Construction des tableaux de bord et du reporting",
    { termesOffre: OFFRE, outilsConnus: ["Excel"] }
  );
  assert.equal(v.accepte, false);
});

test("nombres() ignore les mots et retient les quantités", () => {
  const n = nombres("Suivi de 12 budgets sur 3 exercices");
  assert.ok(n.has("12"));
  assert.ok(n.has("3"));
});

test("nomsPropres() retient les sigles et les noms, pas le premier mot", () => {
  const p = nomsPropres("Production du reporting sous SAP pour la Métropole");
  assert.ok(p.has("SAP") || p.has("sap"));
});
