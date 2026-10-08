import { test } from "node:test";
import assert from "node:assert/strict";
import {
  LIBELLES_PORTEE,
  VISIBILITES,
  estPortee,
  porteeDe,
  type Portee,
} from "@/lib/profil/portee";

/**
 * La portée d'une expérience (D131).
 *
 * Le menu lit deux colonnes et en déduit un choix ; le formulaire fait le
 * chemin inverse. Une inversion entre les deux ne se verrait pas à l'écran —
 * on afficherait « CV comptable seulement », on validerait sans rien toucher,
 * et l'expérience basculerait sur l'autre CV. D'où le tour complet.
 */

const TOUTES = Object.keys(VISIBILITES) as Portee[];

test("l'aller-retour menu / colonnes ne déforme rien", () => {
  for (const portee of TOUTES) {
    assert.equal(porteeDe(VISIBILITES[portee]), portee, portee);
  }
});

test("chaque combinaison de colonnes a un choix, et un seul", () => {
  const vus = new Set<Portee>();
  for (const cdg of [true, false]) {
    for (const compta of [true, false]) {
      const p = porteeDe({ visible_cdg: cdg, visible_compta: compta });
      assert.ok(estPortee(p));
      assert.deepEqual(VISIBILITES[p], {
        visible_cdg: cdg,
        visible_compta: compta,
      });
      vus.add(p);
    }
  }
  assert.equal(vus.size, 4, "quatre états, quatre choix distincts");
});

test("les libellés nomment le bon CV", () => {
  // Le piège exact : un libellé qui dit « comptable » sur l'état cdg.
  assert.match(LIBELLES_PORTEE[porteeDe(VISIBILITES.compta)], /comptable/i);
  assert.match(
    LIBELLES_PORTEE[porteeDe(VISIBILITES.cdg)],
    /contrôle de gestion/i
  );
  assert.equal(TOUTES.length, Object.keys(LIBELLES_PORTEE).length);
});

test("une valeur inventée est refusée", () => {
  assert.equal(estPortee("les_trois"), false);
  assert.equal(estPortee(""), false);
  assert.equal(estPortee("toString"), false);
});
