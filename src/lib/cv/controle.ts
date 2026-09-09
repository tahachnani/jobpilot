import { normaliser } from "@/lib/texte";

/**
 * Contrôle d'une reformulation, avant qu'elle ne soit montrée.
 *
 * Une reformulation redit la même chose avec le vocabulaire de l'annonce. Elle
 * n'ajoute rien. Ce fichier fait respecter cette règle par le calcul, pas par
 * la confiance : aucun modèle n'est consulté, on compare deux chaînes.
 *
 * Le contrôle penche volontairement du mauvais côté. Un faux rejet ne coûte
 * qu'une formulation d'origine conservée ; une invention laissée passer part
 * chez un recruteur sur un document signé.
 */

export interface Verdict {
  accepte: boolean;
  motifs: string[];
}

/** Rallongement maximal toléré, en proportion de l'original. */
export const RALLONGEMENT_MAX = 1.2;

/**
 * Tous les nombres d'un texte : « 18000 », « 5-10 % », « N/N-1 ».
 * On ne garde que la suite de chiffres, la ponctuation autour varie trop.
 */
function nombres(texte: string): Set<string> {
  const trouves = texte.match(/\d+(?:[.,]\d+)?/g) ?? [];
  return new Set(trouves.map((n) => n.replace(",", ".")));
}

/**
 * Noms propres, sigles et outils : « ULIS Sopra », « CODIR », « SILOG », « TVA ».
 *
 * On retient les mots tout en majuscules, et les mots à majuscule initiale qui
 * ne commencent pas une phrase. Approximatif par construction — mais l'erreur
 * penche vers le rejet, ce qui est le bon sens de l'erreur.
 */
function nomsPropres(texte: string): Set<string> {
  const mots = texte.split(/\s+/);
  const trouves = new Set<string>();
  let debutDePhrase = true;

  for (const brut of mots) {
    const mot = brut.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
    if (mot.length >= 2) {
      const toutMajuscules = mot === mot.toUpperCase() && /\p{Lu}/u.test(mot);
      const majusculeInitiale = /^\p{Lu}/u.test(mot);
      if (toutMajuscules || (majusculeInitiale && !debutDePhrase)) {
        trouves.add(normaliser(mot));
      }
    }
    debutDePhrase = /[.!?:]$/.test(brut);
  }
  return trouves;
}

/**
 * Vérifie qu'une proposition n'ajoute ni ne retire de fait par rapport à
 * l'original.
 *
 * @param outilsConnus Libellés des compétences de catégorie outil, pour
 * repérer un logiciel glissé dans la proposition même sans majuscule.
 */
export function controler(
  original: string,
  proposition: string,
  outilsConnus: string[] = []
): Verdict {
  const motifs: string[] = [];
  const texte = proposition.trim();

  if (!texte) {
    return { accepte: false, motifs: ["Proposition vide."] };
  }

  if (normaliser(texte) === normaliser(original)) {
    motifs.push("Identique à l'original : n'apporte rien.");
  }

  if (texte.length > original.length * RALLONGEMENT_MAX) {
    motifs.push(
      `Rallonge de ${Math.round((texte.length / original.length - 1) * 100)} %, ` +
        `au-delà des ${Math.round((RALLONGEMENT_MAX - 1) * 100)} % tolérés.`
    );
  }

  const nombresOriginal = nombres(original);
  const nombresProposition = nombres(texte);

  const ajoutes = [...nombresProposition].filter((n) => !nombresOriginal.has(n));
  if (ajoutes.length > 0) {
    motifs.push(`Chiffre absent de l'original : ${ajoutes.join(", ")}.`);
  }

  const perdus = [...nombresOriginal].filter((n) => !nombresProposition.has(n));
  if (perdus.length > 0) {
    motifs.push(`Chiffre de l'original perdu : ${perdus.join(", ")}.`);
  }

  const propresOriginal = nomsPropres(original);
  const propresAjoutes = [...nomsPropres(texte)].filter(
    (m) => !propresOriginal.has(m)
  );
  if (propresAjoutes.length > 0) {
    motifs.push(`Nom propre absent de l'original : ${propresAjoutes.join(", ")}.`);
  }

  // Un outil peut se glisser sans majuscule ; on le cherche nommément.
  const normalisedOriginal = normaliser(original);
  const normalisedProposition = normaliser(texte);
  const outilsGlisses = outilsConnus
    .map(normaliser)
    .filter((o) => o.length >= 3)
    .filter(
      (o) =>
        normalisedProposition.includes(o) && !normalisedOriginal.includes(o)
    );
  if (outilsGlisses.length > 0) {
    motifs.push(`Outil absent de l'original : ${outilsGlisses.join(", ")}.`);
  }

  return { accepte: motifs.length === 0, motifs };
}
