import { SECTEURS, noteSecteur } from "@/config/secteurs";
import type { OffreExtraite } from "@/lib/extraction-offre";
import type { ExperienceCV } from "@/lib/cv/donnees";
import type { MissionRetenue } from "@/lib/cv/selection";

/**
 * Classer les expériences face à l'offre (D125).
 *
 * Le prompt de la lettre affirmait depuis D100 : « l'expérience t'est imposée,
 * c'est celle que le moteur a classée la plus proche de cette offre ». Le code
 * écrivait `retenues[0]`, où `retenues` vient de `donnees.experiences.map(…)`
 * — **l'ordre du profil, c'est-à-dire l'ordre chronologique**. Aucun tri face à
 * l'offre n'avait lieu. L'expérience « classée la plus proche » était, à chaque
 * lettre et quelle que soit l'annonce, *la plus récente qui porte une mission*.
 *
 * Le 6 octobre, offre DIM — lingerie, site d'Autun, secteur
 * `industrie_textile`. Le candidat a fait un stage de contrôle de gestion chez
 * TRIUMPH, lingerie, secteur `industrie_textile` : le même. La lettre a
 * raconté Le Mans Métropole Habitat et la valorisation de résidences HLM.
 *
 * Deux manques se cumulaient. Le tri n'existait pas ; et même existant, il
 * n'aurait rien changé, puisque rien dans la chaîne de la lettre ne lisait le
 * secteur. On ajoute donc les deux, et le secteur pèse lourd : devant un
 * employeur de la lingerie, avoir travaillé dans une usine de lingerie se dit
 * en trois mots et vaut un paragraphe d'arguments.
 */

/**
 * Prime de proximité sectorielle, ajoutée à la somme des notes de missions.
 *
 * Quarante points représentent, en pratique, cinq missions parfaitement
 * alignées : assez pour qu'un secteur identique renverse un classement serré,
 * pas assez pour qu'une expérience sans rapport avec l'annonce passe devant
 * une expérience qui y répond mission par mission.
 */
const PRIME_SECTEUR_IDENTIQUE = 40;
const PRIME_MEME_FAMILLE = 15;

export interface ExperienceClassee {
  experience: ExperienceCV;
  missions: MissionRetenue[];
  /** Somme des notes de missions, prime sectorielle comprise. */
  note: number;
  /** Vrai si l'employeur relève exactement du secteur de l'offre. */
  memeSecteur: boolean;
  /** Le secteur de l'employeur, en toutes lettres, quand il est connu. */
  secteur: string | null;
}

/** La prime que vaut le secteur d'une expérience face à celui de l'offre. */
function primeSectorielle(
  secteurOffre: string | null,
  secteurExperience: string | null
): { prime: number; identique: boolean } {
  if (!secteurOffre || !secteurExperience) {
    return { prime: 0, identique: false };
  }

  // On réutilise le barème des secteurs plutôt que d'en réécrire un : il sait
  // déjà qu'un office public d'habitat relève à la fois de l'immobilier et du
  // public (D116), et cette connaissance-là ne doit exister qu'à un endroit.
  const { note } = noteSecteur(secteurOffre, [secteurExperience]);
  if (note >= 100) return { prime: PRIME_SECTEUR_IDENTIQUE, identique: true };
  if (note >= 75) return { prime: PRIME_MEME_FAMILLE, identique: false };
  return { prime: 0, identique: false };
}

/**
 * Les expériences, de la plus proche de l'offre à la plus lointaine.
 *
 * L'ordre chronologique départage les égalités : à pertinence égale, le plus
 * récent se défend mieux.
 */
export function classerExperiences(
  retenues: { experience: ExperienceCV; missions: MissionRetenue[] }[],
  offre: OffreExtraite
): ExperienceClassee[] {
  return retenues
    .map(({ experience, missions }) => {
      const { prime, identique } = primeSectorielle(
        offre.secteur_code,
        experience.secteurCode
      );
      return {
        experience,
        missions,
        note: missions.reduce((t, m) => t + m.note, 0) + prime,
        memeSecteur: identique,
        secteur: experience.secteurCode
          ? (SECTEURS[experience.secteurCode] ?? experience.secteurCode)
          : null,
      };
    })
    .sort((a, b) =>
      b.note !== a.note ? b.note - a.note : a.experience.ordre - b.experience.ordre
    );
}
