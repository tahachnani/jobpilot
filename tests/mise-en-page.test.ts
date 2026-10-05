import { test } from "node:test";
import assert from "node:assert/strict";
import {
  HAUTEUR_UTILE,
  LARGEUR_UTILE,
  MESURES,
  hauteurTexte,
  nombreDeLignes,
} from "@/lib/cv/mise-en-page";

/**
 * L'estimateur d'encombrement du CV.
 *
 * Il décide combien de missions tiennent sur la page. Sa largeur de caractère
 * a été mesurée sur un CV réellement composé : la valeur théorique de 0,505
 * faisait retirer des missions pour rien. Ce test empêche qu'on la « corrige »
 * vers la théorie sans refaire la mesure.
 */

test("la largeur de caractère reste celle mesurée sur un CV composé", () => {
  assert.equal(MESURES.largeurCaractere, 0.452);
});

test("la page utile a des dimensions positives et plausibles", () => {
  assert.ok(HAUTEUR_UTILE > 600 && HAUTEUR_UTILE < 800);
  assert.ok(LARGEUR_UTILE > 400 && LARGEUR_UTILE < 600);
});

test("un texte vide n'occupe aucune ligne", () => {
  assert.equal(nombreDeLignes("", 9, LARGEUR_UTILE), 0);
});

test("un texte court tient sur une ligne", () => {
  assert.equal(nombreDeLignes("Reporting mensuel", 9, LARGEUR_UTILE), 1);
});

test("doubler la longueur ne réduit jamais le nombre de lignes", () => {
  const court = "Production du reporting mensuel des résidences";
  const long = court + " " + court;
  assert.ok(
    nombreDeLignes(long, 9, LARGEUR_UTILE) >=
      nombreDeLignes(court, 9, LARGEUR_UTILE)
  );
});

test("une police plus grande occupe au moins autant de hauteur", () => {
  const t = "Production du reporting mensuel des résidences et des budgets";
  assert.ok(hauteurTexte(t, 10, LARGEUR_UTILE) >= hauteurTexte(t, 8, LARGEUR_UTILE));
});

test("une colonne plus étroite n'occupe jamais moins de lignes", () => {
  const t = "Production du reporting mensuel des résidences et des budgets";
  assert.ok(
    nombreDeLignes(t, 9, LARGEUR_UTILE / 2) >= nombreDeLignes(t, 9, LARGEUR_UTILE)
  );
});
