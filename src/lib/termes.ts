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

/**
 * Racine approximative d'un mot : les six premiers caractères.
 *
 * Sans cela « régularisation » et « régularisées » sont deux mots étrangers
 * l'un à l'autre, et une reformulation qui reprenait exactement le vocabulaire
 * de l'annonce était rejetée pour n'avoir rien apporté. La troncature est
 * grossière mais suffit : en français, les variantes d'un même terme métier
 * partagent presque toujours leurs premières lettres.
 *
 * Elle produit quelques rapprochements indus — « comptable » et
 * « comptabilisé » — sans conséquence ici : ce sont des termes du même champ.
 */
function racine(mot: string): string {
  return mot.length > 6 ? mot.slice(0, 6) : mot;
}

/** Racines des mots d'un texte, mots-outils écartés. */
export function motsSignificatifs(texte: string): Set<string> {
  return new Set(
    normaliser(texte)
      .split(" ")
      .filter((m) => m.length >= 3 && !MOTS_OUTILS.has(m))
      .map(racine)
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


/**
 * Marqueurs de qualité comportementale.
 *
 * Une annonce mêle des savoir-faire — régularisation des charges, clôtures,
 * consolidation — et des qualités : rigueur, écoute active, force de
 * proposition. Les secondes ne se font pas entrer dans une phrase de mission,
 * et les compter dans le potentiel d'adaptation promettait une reformulation
 * que rien ne pouvait produire.
 */
const MARQUEURS_COMPORTEMENT = [
  "rigueur", "autonomie", "organisation", "communication", "pedagogie",
  "ecoute", "proposition", "adaptation", "synthese", "esprit", "capacite",
  "aisance", "motivation", "dynamisme", "curiosite", "relationnel",
  "orientation terrain", "travail en equipe", "polyvalence", "reactivite",
  "interet", "sens du", "sens de", "gout", "appetence", "implication",
];

/**
 * Retire les tournures d'annonce : « maîtrise de », « connaissance des »,
 * « capacité à ». Ce qui reste est le savoir-faire lui-même.
 */
export function noyauDuTerme(brut: string): string {
  return brut
    .trim()
    .replace(
      /^(tr[eè]s\s+bonne\s+|bonne\s+|solide\s+|excellentes?\s+|excellente\s+|forte\s+)?(ma[iî]trise|connaissances?|pratique|capacit[ée]s?)\s*(d'|de\s+la\s+|de\s+l'|des\s+|du\s+|de\s+|en\s+|[aà]\s+)?/i,
      ""
    )
    .replace(/\s*\(.*?\)\s*$/, "")
    .trim();
}

/** Le terme décrit-il un savoir-faire, et non une qualité ? */
export function estSavoirFaire(terme: string): boolean {
  // Trois caractères suffisent : SAP, ERP et TVA sont des savoir-faire.
  const n = normaliser(noyauDuTerme(terme));
  if (n.length < 3) return false;
  return !MARQUEURS_COMPORTEMENT.some((m) => n.includes(normaliser(m)));
}
