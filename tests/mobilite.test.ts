import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mentionMobilite,
  noteLieu,
  zoneDeLOffre,
  VILLES_MOBILITE,
} from "@/config/mobilite";
import { ligneLieu } from "@/lib/cv/lieu";

/**
 * Le périmètre géographique (D122).
 *
 * Quarante-quatre offres sur quatre-vingt-dix-neuf étaient hors Île-de-France
 * et le barème n'en disait rien. Les cas ci-dessous sont tous tirés des
 * localisations réellement enregistrées : c'est là que les règles plausibles
 * se cassent.
 */

test("l'Île-de-France est le domicile, et elle ne porte aucune mention", () => {
  for (const [l, d] of [
    ["La Défense", "92"],
    ["Paris 16e", "75"],
    ["Stains (93)", "93"],
    ["LEVALLOIS-PERRET (92)", "92"],
    ["Île-de-France", null],
  ] as [string, string | null][]) {
    const z = zoneDeLOffre(l, d);
    assert.equal(z.zone, "domicile", `${l} (${d})`);
    assert.equal(mentionMobilite(z), null);
  }
});

test("le nom de la ville l'emporte sur le département", () => {
  // « Corbas (Lyon) » : le département dirait aussi Lyon, mais le nom doit
  // suffire — c'est lui qui rend la règle lisible quand le département manque.
  assert.deepEqual(zoneDeLOffre("Corbas (Lyon)", "69"), {
    zone: "mobilite",
    ville: "Lyon",
  });
  assert.deepEqual(zoneDeLOffre("Lille", null), {
    zone: "mobilite",
    ville: "Lille",
  });
  // Aix et Marseille partagent le 13 : le nom départage.
  assert.equal(zoneDeLOffre("Aix-en-Provence", "13").ville, "Aix-en-Provence");
});

test("le département rattache une commune à son agglomération", () => {
  // Tourcoing, Villeneuve d'Ascq et Capinghem sont la métropole lilloise ;
  // Vénissieux et Limonest, celle de Lyon ; Châteaugiron, celle de Rennes.
  assert.equal(zoneDeLOffre("Tourcoing", "59").ville, "Lille");
  assert.equal(zoneDeLOffre("Vénissieux", "69").ville, "Lyon");
  assert.equal(zoneDeLOffre("Châteaugiron", "35").ville, "Rennes");
  assert.equal(zoneDeLOffre("Sainte-Luce-sur-Loire", "44").ville, "Nantes");
});

test("hors périmètre reste candidatable, mais noté plus bas", () => {
  for (const [l, d] of [
    ["Alençon", "61"],
    ["Brive-la-Gaillarde", "19"],
    ["Annecy", "74"],
    ["Le Lamentin", "971"],
    ["Pau ou Mont-de-Marsan", "64, 40"],
  ] as [string, string][]) {
    assert.equal(zoneDeLOffre(l, d).zone, "hors", `${l} (${d})`);
  }
  const n = noteLieu(zoneDeLOffre("Alençon", "61"));
  assert.equal(n.note, 40);
  assert.ok(n.mesurable, "une offre lointaine reste mesurée, pas écartée");
});

/**
 * Le piège qui a coûté le plus : `"".padStart(2, "0")` rend `"00"`, un code de
 * département qui n'existe pas mais qui est une chaîne non vide. Sans garde,
 * « Siège social » et les onze offres sans localisation tombaient « hors
 * périmètre » et se voyaient coller 40 sur un critère non mesuré.
 */
test("un lieu non identifiable est écarté du calcul, pas puni", () => {
  for (const [l, d] of [
    ["Siège social", null],
    ["Halluin", null],
    ["Salins-Fontaine", null],
    [null, null],
  ] as [string | null, string | null][]) {
    const z = zoneDeLOffre(l, d);
    assert.equal(z.zone, "inconnue", `${l} (${d})`);
    assert.equal(noteLieu(z).mesurable, false);
  }
});

test("chaque note de lieu s'explique, et nomme la ville retenue", () => {
  const m = noteLieu(zoneDeLOffre("Vénissieux", "69"));
  assert.match(m.explication, /Lyon/);
  assert.ok(noteLieu(zoneDeLOffre("La Défense", "92")).explication.length > 10);
});

test("aucune ville de mobilité ne tombe en Île-de-France", () => {
  // Une ville du périmètre qui serait aussi francilienne ferait deux règles
  // qui se contredisent. Le domicile l'emporterait, et la ville ne servirait
  // jamais — autant que la liste ne la contienne pas.
  for (const v of VILLES_MOBILITE) {
    assert.notEqual(
      zoneDeLOffre(v.ville, v.departement).zone,
      "domicile",
      v.ville
    );
  }
});

/** La ligne telle qu'elle sera imprimée sur le CV. */

test("en Île-de-France, la ligne est la localisation seule", () => {
  assert.equal(
    ligneLieu("Saint-Denis (93)", { localisation: "La Défense", departement: "92" }),
    "Saint-Denis (93)"
  );
});

test("sur une ville de mobilité, la mention s'accole à la localisation", () => {
  assert.equal(
    ligneLieu("Saint-Denis (93)", { localisation: "Vénissieux", departement: "69" }),
    "Saint-Denis (93) — mobile Lyon"
  );
});

test("hors périmètre, aucune promesse n'est écrite", () => {
  assert.equal(
    ligneLieu("Saint-Denis (93)", { localisation: "Alençon", departement: "61" }),
    "Saint-Denis (93)"
  );
});

test("ta saisie remplace la déduction, où que soit l'offre", () => {
  assert.equal(
    ligneLieu(
      "Saint-Denis (93)",
      { localisation: "Alençon", departement: "61" },
      "installation prévue en Normandie"
    ),
    "Saint-Denis (93) — installation prévue en Normandie"
  );
  assert.equal(
    ligneLieu(
      "Saint-Denis (93)",
      { localisation: "Vénissieux", departement: "69" },
      "installation prévue à Lyon en janvier"
    ),
    "Saint-Denis (93) — installation prévue à Lyon en janvier"
  );
});

test("sans offre analysée, la ligne reste celle du profil", () => {
  assert.equal(ligneLieu("Saint-Denis (93)", null), "Saint-Denis (93)");
});
