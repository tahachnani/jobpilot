/**
 * Comparaison souple de libellés.
 *
 * Ces deux fonctions existent déjà, privées, dans `lib/scoring.ts`. Elles sont
 * reprises ici plutôt qu'extraites : le moteur de scoring est en production et
 * ne se touche pas pour un confort de rangement. La déduplication se fera
 * quand une évolution du barème imposera de toute façon d'y revenir.
 */

/** Minuscules, sans accents, sans ponctuation. */
export function normaliser(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Deux libellés se correspondent si l'un contient l'autre. */
export function correspond(a: string, b: string): boolean {
  const x = normaliser(a);
  const y = normaliser(b);
  if (x.length < 3 || y.length < 3) return false;
  return x === y || x.includes(y) || y.includes(x);
}
