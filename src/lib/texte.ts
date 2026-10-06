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

/**
 * Deux libellés se correspondent si l'un contient l'autre, **en mots entiers**.
 *
 * La limite de mot est arrivée le 5 octobre, sur le CV du cabinet comptable.
 * L'annonce demandait « Sage » ; le CV affichait « Réestimé, forecast et
 * atterris**sage** — souhaitée par l'offre : Sage ». Le test par sous-chaîne
 * trouvait « sage » au milieu d'« atterrissage », et la ligne la plus
 * étrangère à l'annonce remontait au-dessus de tout le reste.
 *
 * C'est la troisième fois que ce défaut se présente sous un autre nom : le
 * `\b` manquant qui faisait correspondre « ma » à « management », le mot
 * « Comptabilité » reconnu dans « Comptabilité analytique » (D124), et
 * maintenant « Sage » dans « atterrissage ». Une sous-chaîne n'est pas un mot.
 *
 * `normaliser` ayant déjà réduit le texte à des mots séparés par des espaces,
 * encadrer les deux chaînes suffit : « sage » ne se trouve plus dans
 * « atterrissage », mais « power bi » se trouve toujours dans « microsoft
 * power bi ».
 */
export function correspond(a: string, b: string): boolean {
  const x = normaliser(a);
  const y = normaliser(b);
  if (x.length < 3 || y.length < 3) return false;
  if (x === y) return true;
  return ` ${x} `.includes(` ${y} `) || ` ${y} `.includes(` ${x} `);
}
