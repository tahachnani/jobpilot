import type { OffreExtraite } from "@/lib/extraction-offre";
import { correspond } from "@/lib/texte";
import type {
  CompetenceCV,
  DonneesCV,
  ExperienceCV,
  MissionCV,
} from "@/lib/cv/donnees";

/**
 * Sélection du contenu d'un CV : quelles missions, dans quel ordre, quelles
 * compétences.
 *
 * Aucun appel IA. On compte des codes d'activité partagés et on trie. Deux
 * générations successives pour la même offre et le même profil donnent
 * exactement le même CV — c'est la condition pour qu'il soit vérifiable.
 */

/**
 * Quotas de missions par expérience, dans l'ordre d'apparition sur le CV.
 *
 * La spécification prévoyait la cible et un unique repli. Les mesures ont
 * montré que ces deux crans ne libèrent qu'une vingtaine de points : très
 * insuffisant pour tenir la contrainte d'une page en toutes circonstances.
 * L'échelle a donc été prolongée. Elle ne descend que si la page l'exige, un
 * cran à la fois, et le CV indique toujours le cran appliqué.
 */
export const QUOTAS = {
  cible: [4, 4, 3, 3],
  repli: [4, 3, 3, 3],
  parDefaut: 3,
} as const;

export const MAX_EMPRUNTS_PAR_EXPERIENCE = 1;
export const MAX_EMPRUNTS_TOTAL = 2;

export const COMPETENCES = { cible: 10, repli: 9 } as const;

/**
 * Crans de compacité, du plus généreux au plus serré. Le générateur descend
 * tant que la page déborde, jamais plus bas que le dernier.
 */
export interface NiveauCompacite {
  niveau: number;
  quotas: readonly number[];
  nbCompetences: number;
  libelle: string;
}

export const NIVEAUX: NiveauCompacite[] = [
  {
    niveau: 0,
    quotas: [4, 4, 3, 3],
    nbCompetences: 10,
    libelle: "Mise en page cible : 4/4/3/3 missions, 10 compétences.",
  },
  {
    niveau: 1,
    quotas: [4, 3, 3, 3],
    nbCompetences: 10,
    libelle: "Repli 4/3/3/3 missions, 10 compétences, pour tenir sur une page.",
  },
  {
    niveau: 2,
    quotas: [4, 3, 3, 3],
    nbCompetences: 9,
    libelle: "Repli 4/3/3/3 missions, 9 compétences, pour tenir sur une page.",
  },
  {
    niveau: 3,
    quotas: [3, 3, 3, 3],
    nbCompetences: 9,
    libelle: "Repli 3/3/3/3 missions, 9 compétences, pour tenir sur une page.",
  },
  {
    niveau: 4,
    quotas: [3, 3, 2, 2],
    nbCompetences: 8,
    libelle: "Repli 3/3/2/2 missions, 8 compétences, pour tenir sur une page.",
  },
  {
    niveau: 5,
    quotas: [3, 2, 2, 2],
    nbCompetences: 7,
    libelle: "Repli maximal 3/2/2/2 missions, 7 compétences.",
  },
];

export interface MissionRetenue extends MissionCV {
  note: number;
  codesPartages: string[];
}

export interface CompetenceRetenue extends CompetenceCV {
  note: number;
  motif: string;
}

export interface Selection {
  niveau: NiveauCompacite;
  experiences: { experience: ExperienceCV; missions: MissionRetenue[] }[];
  competences: CompetenceRetenue[];
  nbEmprunts: number;
}

/**
 * Note d'une mission face à une offre.
 *
 * Pour chaque mission de l'offre, on compte les codes d'activité partagés et
 * on pondère par l'importance que l'offre donne à cette mission-là. Une
 * mission qui répond à trois exigences centrales pèse donc plus qu'une
 * mission qui en effleure une accessoire.
 */
export function noterMission(
  mission: MissionCV,
  offre: OffreExtraite
): { note: number; codesPartages: string[] } {
  let note = 0;
  const partages = new Set<string>();

  for (const attendue of offre.missions) {
    const communs = attendue.codes.filter((c) => mission.codes.includes(c));
    if (communs.length === 0) continue;
    note += communs.length * attendue.importance;
    communs.forEach((c) => partages.add(c));
  }

  return { note, codesPartages: [...partages] };
}

/**
 * Ordre de préférence entre deux missions.
 *
 * Note décroissante d'abord. À égalité, la mission chiffrée passe devant :
 * c'est la règle de la spécification, un résultat mesuré vaut mieux qu'une
 * tâche décrite. Les critères suivants n'ont pas de portée métier, ils
 * existent pour que l'ordre soit total et donc reproductible.
 */
function comparerMissions(a: MissionRetenue, b: MissionRetenue): number {
  if (b.note !== a.note) return b.note - a.note;
  if (a.contientChiffre !== b.contientChiffre) return a.contientChiffre ? -1 : 1;
  if (b.pertinence !== a.pertinence) return b.pertinence - a.pertinence;
  if (a.ordre !== b.ordre) return a.ordre - b.ordre;
  return a.id.localeCompare(b.id);
}

/**
 * Retient au plus `quota` missions pour une expérience, en respectant le
 * plafond d'emprunts encore disponible.
 *
 * Une mission empruntée n'entre en lice que si l'offre la réclame vraiment
 * (note strictement positive) : l'emprunt est un appoint ciblé, jamais un
 * remplissage.
 */
function retenirPourExperience(
  candidates: MissionRetenue[],
  quota: number,
  empruntsRestants: number
): MissionRetenue[] {
  const triees = [...candidates].sort(comparerMissions);

  const plafondEmprunts = Math.min(
    MAX_EMPRUNTS_PAR_EXPERIENCE,
    Math.max(0, empruntsRestants)
  );

  const retenues: MissionRetenue[] = [];
  let emprunts = 0;

  // Un emprunt écarté ne laisse pas de trou : la boucle continue et la place
  // revient à la meilleure mission native suivante.
  for (const m of triees) {
    if (retenues.length >= quota) break;
    if (m.empruntee) {
      if (emprunts >= plafondEmprunts || m.note <= 0) continue;
      emprunts += 1;
    }
    retenues.push(m);
  }

  return retenues;
}

/**
 * Les grandes familles, que les offres nomment souvent telles quelles.
 *
 * Une annonce réclame « Contrôle de gestion » ou « Comptabilité » : un métier
 * entier, qu'aucune ligne de compétence ne contient littéralement. Sans ce
 * rattrapage, le cœur du métier passait derrière Excel et Power BI. Le barème
 * de l'étape 3 fait déjà ce rattrapage pour le score ; la sélection du CV le
 * fait maintenant pour l'ordre des lignes.
 */
const FAMILLES: Record<string, string> = {
  cdg: "Contrôle de gestion",
  compta: "Comptabilité",
};

/**
 * Note d'une compétence face à une offre.
 *
 * Une compétence du cœur de métier réclamé passe devant une compétence
 * nommément citée : sur une offre de contrôle de gestion, le contrôle de
 * gestion s'affiche avant Excel. Encore faut-il la tenir : une famille dont
 * Taha n'a que des notions ne double pas une exigence explicite qu'il
 * maîtrise. La note de famille est donc conditionnée au niveau acquis.
 */
export function noterCompetence(
  competence: CompetenceCV,
  offre: OffreExtraite
): { note: number; motif: string } {
  const cible = [competence.libelle, competence.codeNormalise].filter(Boolean);
  const teste = (libelle: string) => cible.some((c) => correspond(c, libelle));

  const nomFamille = FAMILLES[competence.categorie];
  const tenue = competence.niveau >= 2;

  const familleExigee = nomFamille
    ? offre.competences.find(
        (c) =>
          c.caractere === "indispensable" && correspond(nomFamille, c.libelle)
      )
    : undefined;

  if (familleExigee && tenue) {
    return {
      note: 7,
      motif: `Cœur de métier exigé par l'offre : ${familleExigee.libelle}.`,
    };
  }

  const exigee = offre.competences.find(
    (c) => c.caractere === "indispensable" && teste(c.libelle)
  );
  if (exigee) return { note: 6, motif: `Exigée par l'offre : ${exigee.libelle}.` };

  const familleSouhaitee = nomFamille
    ? offre.competences.find((c) => correspond(nomFamille, c.libelle))
    : undefined;

  if (familleSouhaitee && tenue) {
    return {
      note: 5,
      motif: `Cœur de métier attendu par l'offre : ${familleSouhaitee.libelle}.`,
    };
  }

  const souhaitee = offre.competences.find((c) => teste(c.libelle));
  if (souhaitee)
    return { note: 4, motif: `Souhaitée par l'offre : ${souhaitee.libelle}.` };

  if (familleExigee || familleSouhaitee) {
    return {
      note: 3,
      motif: `Cœur de métier de l'offre, mais niveau déclaré insuffisant pour passer devant.`,
    };
  }

  const outil = offre.outils.find((o) => teste(o));
  if (outil) return { note: 2, motif: `Outil cité par l'offre : ${outil}.` };

  const motCle = offre.mots_cles_ats.find((m) => teste(m));
  if (motCle) return { note: 1, motif: `Mot-clé ATS de l'offre : ${motCle}.` };

  return { note: 0, motif: "Non réclamée par l'offre." };
}

function comparerCompetences(
  a: CompetenceRetenue,
  b: CompetenceRetenue
): number {
  if (b.note !== a.note) return b.note - a.note;
  if (b.niveau !== a.niveau) return b.niveau - a.niveau;
  if (a.ordre !== b.ordre) return a.ordre - b.ordre;
  return a.libelle.localeCompare(b.libelle, "fr");
}

/** Construit la sélection complète pour un niveau de compacité donné. */
export function selectionner(
  donnees: DonneesCV,
  offre: OffreExtraite,
  niveau: NiveauCompacite
): Selection {
  let empruntsRestants = MAX_EMPRUNTS_TOTAL;

  const experiences = donnees.experiences.map((experience, index) => {
    // Au-delà des quotas listés, on prolonge avec le dernier : sinon une
    // cinquième expérience recevrait plus de missions que la quatrième dans
    // les crans les plus serrés.
    const quota =
      niveau.quotas[index] ?? niveau.quotas[niveau.quotas.length - 1] ??
      QUOTAS.parDefaut;

    const candidates: MissionRetenue[] = experience.missions.map((m) => ({
      ...m,
      ...noterMission(m, offre),
    }));

    const missions = retenirPourExperience(candidates, quota, empruntsRestants);
    empruntsRestants -= missions.filter((m) => m.empruntee).length;

    return { experience, missions };
  });

  const competences = donnees.competences
    .map((c) => ({ ...c, ...noterCompetence(c, offre) }))
    .sort(comparerCompetences)
    .slice(0, niveau.nbCompetences);

  return {
    niveau,
    experiences,
    competences,
    nbEmprunts: MAX_EMPRUNTS_TOTAL - empruntsRestants,
  };
}
