import { normaliser } from "@/lib/texte";

/**
 * Comparaison de termes métier, mot à mot.
 *
 * La recherche de chaîne exacte échouait sur un simple article : « analyse
 * écarts » ne trouvait pas « analyse des écarts ». On compare donc des
 * ensembles de mots significatifs.
 */

const MOTS_OUTILS = new Set([
  "de", "des", "du", "la", "le", "les", "et", "en", "au", "aux", "un", "une",
  "sur", "pour", "par", "dans", "avec", "sans", "ou", "a", "l", "d", "ses",
  "son", "sa", "leur", "leurs", "ce", "ces", "cette",
]);

/** Mots d'un texte, accents et ponctuation retirés, mots-outils écartés. */
export function motsSignificatifs(texte: string): Set<string> {
  return new Set(
    normaliser(texte)
      .split(" ")
      .filter((m) => m.length >= 3 && !MOTS_OUTILS.has(m))
  );
}

/** Un terme est présent si tous ses mots significatifs le sont. */
export function termePresent(terme: string, mots: Set<string>): boolean {
  const attendus = [...motsSignificatifs(terme)];
  if (attendus.length === 0) return true;
  return attendus.every((m) => mots.has(m));
}

/** Termes d'une liste absents d'un texte. */
export function termesAbsents(termes: string[], texte: string): string[] {
  const mots = motsSignificatifs(texte);
  return termes.filter((t) => !termePresent(t, mots));
}
