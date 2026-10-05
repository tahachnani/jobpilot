import { test } from "node:test";
import assert from "node:assert/strict";
import {
  decouperLibelle,
  estExigenceDeContexte,
  nettoyerLibelle,
} from "@/lib/cv/competences-manquantes";

/**
 * Le découpage des libellés d'annonce.
 *
 * Chaque cas ci-dessous vient d'une offre réelle. Les deux premiers sont
 * l'incident du 22 septembre : un libellé correct proposé à l'ajout en quatre
 * morceaux, parenthèses cassées comprises.
 */

test("une énumération entre parenthèses reste d'un seul tenant", () => {
  const r = decouperLibelle(
    "Dispositifs de financement de l'innovation (CIR, subventions, brevets)"
  );
  assert.equal(r.length, 1);
  assert.ok(!r[0].includes("(CIR"), "parenthèse coupée");
});

test("une virgule ne découpe pas un contexte en fausses compétences", () => {
  const r = decouperLibelle(
    "Expérience en environnement industriel, R&D ou grand groupe"
  );
  assert.equal(r.length, 1);
});

test("le slash découpe, lui : c'est un vrai séparateur", () => {
  const r = decouperLibelle("Élaboration et analyse des tableaux de bord / reporting");
  assert.equal(r.length, 2);
  assert.ok(r.some((x) => /reporting/i.test(x)));
});

test("un terme métier d'un seul mot survit au découpage", () => {
  const r = decouperLibelle("Élaboration des budgets / consolidation");
  assert.ok(
    r.some((x) => /consolidation/i.test(x)),
    `terme perdu : ${r.join(" | ")}`
  );
});

test("un sigle seul est gardé : il se suffit à lui-même", () => {
  const r = decouperLibelle("Comptabilité générale / SAP");
  assert.ok(r.includes("SAP"), r.join(" | "));
});

test("la parenthèse de précision est retirée, son contenu ne devient pas des lignes", () => {
  const r = decouperLibelle("Outils de gestion budgétaire (ERP, Excel avancé)");
  assert.equal(r.length, 1);
  assert.ok(!r[0].includes("("), r[0]);
  assert.ok(!r.some((x) => /^excel avancé$/i.test(x)));
});

test("un libellé unique n'est jamais écarté, même court", () => {
  assert.deepEqual(decouperLibelle("Budget"), ["Budget"]);
});

test("les tournures d'annonce sont retirées, les sigles conservés", () => {
  assert.equal(nettoyerLibelle("Maîtrise d'Excel"), "Excel");
  assert.equal(nettoyerLibelle("SAP"), "SAP");
});

/**
 * D72 — une exigence de contexte n'est pas une compétence.
 *
 * Une expérience sectorielle se lit dans les employeurs du CV, pas dans une
 * ligne de compétence. Ces libellés sont affichés, jamais proposés à l'ajout.
 */
test("une exigence de secteur ou d'environnement est reconnue comme contexte", () => {
  for (const t of [
    "Expérience en environnement industriel",
    "Issu d'un grand groupe",
    "Connaissance du secteur public",
    "Première expérience en PME",
    "Formation supérieure Bac +5",
  ]) {
    assert.equal(estExigenceDeContexte(t), true, t);
  }
});

test("un savoir-faire n'est pas pris pour un contexte", () => {
  for (const t of [
    "Consolidation",
    "Élaboration budgétaire",
    "Excel avancé",
    "Analyse des écarts",
    "Comptabilité analytique",
  ]) {
    assert.equal(estExigenceDeContexte(t), false, t);
  }
});

test("les tournures d'expérience sont retirées du libellé retenu", () => {
  assert.equal(nettoyerLibelle("Expérience en consolidation"), "Consolidation");
  assert.equal(
    nettoyerLibelle("Expérience significative en contrôle de gestion"),
    "Contrôle de gestion"
  );
});
