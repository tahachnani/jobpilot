import { nombres, nomsPropres } from "@/lib/cv/controle";
import { normaliser } from "@/lib/texte";

/**
 * Contrôle d'ancrage d'une lettre.
 *
 * Une reformulation se compare à son original ; une lettre n'a pas d'original.
 * On vérifie donc autre chose : que chaque fait vérifiable qu'elle avance —
 * un chiffre, un employeur, une école, un logiciel — se retrouve quelque part
 * dans la base professionnelle ou dans l'annonce.
 *
 * Le résultat ne bloque pas. Une reformulation peut être rejetée en bloc pour
 * un mot de trop ; une lettre non — on ne jette pas trois paragraphes parce
 * qu'un terme n'a pas été reconnu. Ce qui n'est adossé à rien est signalé, et
 * Taha tranche.
 */

/**
 * Mots à majuscule qui n'affirment aucun fait : civilités, formules,
 * jours et mois, pronoms en tête de proposition.
 */
const MOTS_NEUTRES = new Set(
  [
    "madame", "monsieur", "mesdames", "messieurs", "cordialement",
    "veuillez", "agreer", "expression", "sentiments", "salutations",
    "distingues", "respectueuses", "objet", "candidature", "je", "j",
    "mes", "mon", "ma", "notre", "votre", "vos", "vous", "nous", "le",
    "la", "les", "au", "aux", "en", "dans", "par", "pour", "avec", "sans",
    "cette", "ce", "ces", "il", "elle", "ils", "elles", "on", "fort",
    "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche",
    "janvier", "fevrier", "mars", "avril", "mai", "juin", "juillet",
    "aout", "septembre", "octobre", "novembre", "decembre",
    "france", "cv", "sincerement", "bien", "a", "de", "du", "des",
  ].map(normaliser)
);

export interface Ancrage {
  /** Chiffres qui n'existent ni dans la base ni dans l'annonce. */
  nombresOrphelins: string[];
  /** Noms propres et sigles qui n'existent ni dans la base ni dans l'annonce. */
  nomsOrphelins: string[];
}

/**
 * @param texte Le corps de la lettre, en-tête et formules exclus.
 * @param corpus Tout ce qui fait foi : missions, formations, compétences,
 * langues, intérêts, profil, et le texte intégral de l'annonce.
 */
export function verifierAncrage(texte: string, corpus: string): Ancrage {
  const nombresCorpus = nombres(corpus);
  const nomsCorpus = nomsPropres(corpus);
  const corpusNormalise = normaliser(corpus);

  const nombresOrphelins = [...nombres(texte)].filter(
    (n) => !nombresCorpus.has(n) && !corpusNormalise.includes(n)
  );

  const nomsOrphelins = [...nomsPropres(texte)]
    .filter((m) => !MOTS_NEUTRES.has(m))
    .filter((m) => m.length >= 3)
    .filter((m) => !nomsCorpus.has(m) && !corpusNormalise.includes(m));

  return { nombresOrphelins, nomsOrphelins };
}
