import type { OffreExtraite } from "@/lib/extraction-offre";
import type { LigneCorpus } from "@/lib/cv/corpus";

/**
 * Classer les lignes de corpus face à une offre (D110).
 *
 * D100 avait corrigé **quelle expérience** la lettre raconte : le moteur
 * classait Le Mans Métropole Habitat en tête pour une offre de bailleur
 * social, et la lettre allait raconter une usine à Fès parce qu'on lui avait
 * interdit le reste.
 *
 * La même erreur se rejouait un cran plus bas. L'expérience imposée arrivait
 * avec **tout** son corpus, dans l'ordre de saisie, sans aucun classement. Le
 * modèle a donc raconté une histoire de délai de relocation et de remise en
 * commercialisation — de la gestion locative — alors que les faits les plus
 * solides pour un poste de contrôle de gestion étaient le quittancement de
 * 18 000 logements et les écarts de charges récupérables. Du financier.
 *
 * Corriger le choix de l'expérience sans classer ce qu'elle contient ne faisait
 * que déplacer le problème. Le classement reprend donc exactement la logique de
 * `noterMission` : les codes d'activité de l'annonce, pondérés par l'importance
 * que l'annonce leur donne. Gratuit, déterministe, et cohérent avec le score
 * affiché — il serait absurde que la lettre et la note ne soient pas d'accord
 * sur ce qui compte dans cette offre.
 */

export interface LigneClassee {
  texte: string;
  note: number;
  /** Les codes que cette ligne partage avec l'annonce. */
  codesPartages: string[];
}

/** Vrai si la ligne porte un nombre : un fait mesuré vaut mieux qu'une tâche. */
function contientChiffre(texte: string): boolean {
  return /\d/.test(texte);
}

/**
 * @param lignes Le corpus d'UNE expérience. Le cloisonnement est préservé :
 * ce qui a été fait chez un employeur ne classe rien chez un autre.
 */
export function classerSituations(
  lignes: LigneCorpus[],
  offre: OffreExtraite
): LigneClassee[] {
  const notees = lignes.map((l): LigneClassee => {
    let note = 0;
    const partages = new Set<string>();

    for (const attendue of offre.missions) {
      const communs = attendue.codes.filter((c) => l.codes.includes(c));
      if (communs.length === 0) continue;
      note += communs.length * attendue.importance;
      communs.forEach((c) => partages.add(c));
    }

    return { texte: l.texte, note, codesPartages: [...partages] };
  });

  return notees.sort((a, b) => {
    if (b.note !== a.note) return b.note - a.note;
    // À note égale, la ligne chiffrée passe devant — même règle que pour les
    // missions du CV, pour que les deux écrans ne se contredisent pas.
    const ca = contientChiffre(a.texte);
    const cb = contientChiffre(b.texte);
    if (ca !== cb) return ca ? -1 : 1;
    // Puis la plus longue : dans un corpus, une ligne détaillée porte le
    // contexte qu'une ligne brève n'a pas, et c'est le contexte qu'on cherche.
    if (b.texte.length !== a.texte.length) return b.texte.length - a.texte.length;
    return a.texte.localeCompare(b.texte);
  });
}
