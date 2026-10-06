import type { OffreExtraite } from "@/lib/extraction-offre";
import { correspond, normaliser } from "@/lib/texte";
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
  /** L'exigence précise de l'annonce que cette ligne satisfait (D124). */
  besoin: string | null;
}

export interface Selection {
  niveau: NiveauCompacite;
  experiences: { experience: ExperienceCV; missions: MissionRetenue[] }[];
  competences: CompetenceRetenue[];
  nbEmprunts: number;
  /** Missions ajoutées au quota du cran, expérience par expérience (D120). */
  supplements: readonly number[];
}

/**
 * Nombre maximal de missions sur une expérience, garnissage compris.
 *
 * Au-delà de quatre puces, l'expérience cesse d'être lue et devient une liste.
 * C'est aussi le plafond du cran le plus généreux.
 */
export const PLAFOND_MISSIONS = 4;

/**
 * Paliers de garnissage (D120).
 *
 * On amène d'abord toutes les expériences à trois missions, puis seulement on
 * passe les premières à quatre. Une expérience qui n'en porte que deux paraît
 * maigre, où qu'elle soit sur la page ; une quatrième puce sur la première,
 * elle, n'est qu'un bonus.
 */
export const PALIERS_GARNISSAGE = [3, PLAFOND_MISSIONS] as const;

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
 * Les grandes familles, et les formulations qui les **déclarent** (D124).
 *
 * Une annonce réclame « Contrôle de gestion » ou « Comptabilité » : un métier
 * entier, qu'aucune ligne de compétence ne contient littéralement. Sans ce
 * rattrapage, le cœur du métier passait derrière Excel et Power BI.
 *
 * Le rattrapage s'est retourné contre lui-même le 5 octobre, sur l'offre
 * EURENCO — contrôleur de gestion industriel. Le code cherchait le mot
 * « Comptabilité » **à l'intérieur** des libellés de l'annonce ; celle-ci
 * demandait « Comptabilité **analytique** », une compétence précise. Le test
 * passait, et les sept lignes de la catégorie compta recevaient le bonus de
 * famille : comptabilité générale, rapprochements bancaires, déclarations
 * fiscales, clôtures, révision des comptes — toutes au-dessus d'« Analyse
 * financière » et de « KPI industriels », pourtant nommément demandées.
 * Six lignes de comptabilité sur huit, sur un CV de contrôle de gestion.
 *
 * Symétriquement, la famille `cdg` ne se déclenchait **jamais** : l'annonce
 * n'écrit « contrôle de gestion » ni dans ses compétences ni nulle part où le
 * code regardait — c'est dans l'intitulé du poste et les mots-clés ATS. Sur
 * une offre de contrôleur de gestion : bonus pour la comptabilité, rien pour
 * le contrôle de gestion. L'inversion était parfaite.
 *
 * Deux corrections, donc. La famille doit être **nommée en entier**, pas
 * reconnue par un morceau de libellé ; et elle se lit aussi dans l'intitulé du
 * poste et les mots-clés, là où un métier se déclare vraiment.
 *
 * Les formes de déclaration sont une liste fermée, comme la taxonomie : on
 * reconnaît ce qu'on a écrit, on ne devine pas.
 */
const FAMILLES: Record<string, { nom: string; declarations: string[] }> = {
  cdg: {
    nom: "Contrôle de gestion",
    declarations: [
      "controle de gestion",
      "controleur de gestion",
      "controleuse de gestion",
      "controle financier",
      "business controller",
      "controlling",
      "fp a",
    ],
  },
  compta: {
    nom: "Comptabilité",
    declarations: [
      "comptabilite",
      "comptabilite generale",
      "comptable",
      "collaborateur comptable",
      "expertise comptable",
    ],
  },
};

/** Une famille déclarée par l'annonce, et l'endroit où elle l'est. */
interface FamilleDeclaree {
  ou: string;
  exigee: boolean;
}

/**
 * L'annonce déclare-t-elle ce métier, et avec quelle force ?
 *
 * Trois endroits, du plus fort au plus faible. Une **compétence de l'annonce
 * qui est exactement la famille** — pas qui la contient : « Comptabilité
 * analytique » n'est pas une déclaration du métier comptable, c'est une
 * compétence précise, et elle sera notée comme telle plus bas. L'**intitulé du
 * poste** ensuite, qui est la déclaration la plus franche qui soit : une
 * annonce titrée « Contrôleur de gestion » réclame le métier, même si sa liste
 * de compétences ne le répète pas. Les **mots-clés** enfin, qui valent
 * indication et non exigence.
 */
function familleDeclaree(
  categorie: string,
  offre: OffreExtraite
): FamilleDeclaree | null {
  const famille = FAMILLES[categorie];
  if (!famille) return null;

  const formes = famille.declarations;
  const estLaFamille = (libelle: string) => formes.includes(normaliser(libelle));

  const nommee = offre.competences.find((c) => estLaFamille(c.libelle));
  if (nommee) {
    return { ou: nommee.libelle, exigee: nommee.caractere === "indispensable" };
  }

  // L'intitulé, lui, est une phrase : on y cherche la forme entière.
  const intitule = normaliser(offre.intitule ?? "");
  if (intitule && formes.some((f) => intitule.includes(f))) {
    return { ou: offre.intitule as string, exigee: true };
  }

  const motCle = offre.mots_cles_ats.find((m) => {
    const n = normaliser(m);
    return formes.some((f) => n === f || n.includes(f));
  });
  if (motCle) return { ou: motCle, exigee: false };

  return null;
}

/**
 * Note d'une compétence face à une offre.
 *
 * **Ce que l'annonce nomme passe avant ce qu'elle implique** (D124). La
 * famille est un rattrapage : elle fait remonter le cœur du métier au-dessus
 * des outils et des mots-clés, qui sinon occupaient tout le bloc. Elle ne
 * doit pas pour autant doubler une exigence écrite noir sur blanc.
 *
 * L'ordre inverse avait été essayé le 5 octobre, en corrigeant le périmètre
 * de la famille : sur l'offre EURENCO, les huit lignes devenaient du contrôle
 * de gestion générique et « Rigueur » et « Esprit critique » — deux
 * indispensables de l'annonce — sortaient du CV. Un excès remplaçait l'autre.
 *
 * Encore faut-il tenir la famille : une famille dont Taha n'a que des notions
 * ne double pas une exigence explicite qu'il maîtrise. La note de famille
 * reste donc conditionnée au niveau acquis.
 *
 *   7  exigée nommément        4  cœur de métier attendu
 *   6  souhaitée nommément     3  cœur de métier, niveau insuffisant
 *   5  cœur de métier exigé    2  outil cité · 1  mot-clé · 0  rien
 */
export function noterCompetence(
  competence: CompetenceCV,
  offre: OffreExtraite
): { note: number; motif: string; besoin: string | null } {
  const cible = [competence.libelle, competence.codeNormalise].filter(Boolean);
  const teste = (libelle: string) => cible.some((c) => correspond(c, libelle));

  const tenue = competence.niveau >= 2;
  const famille = familleDeclaree(competence.categorie, offre);

  /**
   * `besoin` nomme l'exigence précise que cette ligne satisfait (D124).
   *
   * Il sert au dédoublonnage : l'annonce EURENCO demandait « Communication »
   * une fois, et trois lignes du profil y répondaient — « Communication avec
   * les opérationnels », « Relationnel et communication », « Sens de la
   * communication et pédagogie ». Elles occupaient trois des huit places pour
   * un seul besoin.
   *
   * Les notes de famille n'en portent pas : un métier réclamé mérite
   * légitimement plusieurs lignes, c'est tout l'objet du rattrapage.
   */

  const exigee = offre.competences.find(
    (c) => c.caractere === "indispensable" && teste(c.libelle)
  );
  if (exigee) {
    return {
      note: 7,
      motif: `Exigée par l'offre : ${exigee.libelle}.`,
      besoin: normaliser(exigee.libelle),
    };
  }

  const souhaitee = offre.competences.find((c) => teste(c.libelle));
  if (souhaitee) {
    return {
      note: 6,
      motif: `Souhaitée par l'offre : ${souhaitee.libelle}.`,
      besoin: normaliser(souhaitee.libelle),
    };
  }

  if (famille?.exigee && tenue) {
    return {
      note: 5,
      motif: `Cœur de métier exigé par l'offre : ${famille.ou}.`,
      besoin: null,
    };
  }

  if (famille && tenue) {
    return {
      note: 4,
      motif: `Cœur de métier attendu par l'offre : ${famille.ou}.`,
      besoin: null,
    };
  }

  if (famille) {
    return {
      note: 3,
      motif: `Cœur de métier de l'offre, mais niveau déclaré insuffisant pour passer devant.`,
      besoin: null,
    };
  }

  const outil = offre.outils.find((o) => teste(o));
  if (outil) {
    return {
      note: 2,
      motif: `Outil cité par l'offre : ${outil}.`,
      besoin: normaliser(outil),
    };
  }

  const motCle = offre.mots_cles_ats.find((m) => teste(m));
  if (motCle) {
    return {
      note: 1,
      motif: `Mot-clé ATS de l'offre : ${motCle}.`,
      besoin: normaliser(motCle),
    };
  }

  return { note: 0, motif: "Non réclamée par l'offre.", besoin: null };
}

/**
 * Nombre d'outils listés sur la ligne qui leur est consacrée.
 * Au-delà, la ligne passe sur deux lignes composées et le gain disparaît.
 */
const MAX_OUTILS_GROUPES = 6;

/**
 * Regroupe les outils et logiciels sur une seule ligne.
 *
 * Le rattrapage par famille avait un effet de bord : sur une offre de contrôle
 * de gestion, toutes les compétences de la famille passaient devant, et le CV
 * sortait sans Excel, sans Power BI et sans le moindre ERP — exactement ce
 * qu'un analyseur cherche en premier. Une ligne leur est donc réservée, et
 * elle en porte six au lieu d'un : c'est aussi ce que faisaient les deux CV
 * d'origine.
 *
 * La précision du meilleur outil est conservée entre parenthèses : « TCD,
 * RECHERCHEV » sont des mots-clés, pas de la décoration.
 */
function grouperOutils(outils: CompetenceRetenue[]): CompetenceRetenue | null {
  if (outils.length === 0) return null;

  /**
   * Un besoin, une place — ici aussi (D124).
   *
   * Le CV du cabinet comptable sortait « Sage 100, ERP Sage, Pennylane,
   * Sage X3, Excel, ULIS Sopra » : trois des six places pour le seul « Sage »
   * que l'annonce demandait. La ligne doit couvrir six outils différents, pas
   * répéter le même sous trois références.
   */
  const servis = new Set<string>();
  const retenus = outils
    .filter((o) => {
      if (!o.besoin) return true;
      if (servis.has(o.besoin)) return false;
      servis.add(o.besoin);
      return true;
    })
    .slice(0, MAX_OUTILS_GROUPES);

  // La précision suit son outil, où qu'il soit dans la liste. La première
  // version ne gardait que celle du premier : le jour où un nouvel outil est
  // passé devant Excel, « TCD, RECHERCHEV, modèles de reporting » a disparu du
  // CV — trois mots-clés perdus par un détail de rang.
  const libelle = retenus
    .map((o) => (o.precision ? `${o.libelle} (${o.precision})` : o.libelle))
    .join(", ");

  return {
    ...retenus[0],
    libelle,
    precision: null,
    motif: `Outils regroupés : ${retenus.map((o) => o.libelle).join(", ")}.`,
  };
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

/**
 * Quota du cran pour une expérience, hors garnissage.
 *
 * Au-delà des quotas listés, on prolonge avec le dernier : sinon une
 * cinquième expérience recevrait plus de missions que la quatrième dans les
 * crans les plus serrés.
 */
function quotaDuCran(niveau: NiveauCompacite, index: number): number {
  return (
    niveau.quotas[index] ??
    niveau.quotas[niveau.quotas.length - 1] ??
    QUOTAS.parDefaut
  );
}

/**
 * Construit la sélection complète pour un niveau de compacité donné.
 *
 * `supplements` ajoute des missions au quota du cran, expérience par
 * expérience. C'est le levier du garnissage (D120) : plutôt que d'inventer des
 * crans intermédiaires, on part du cran qui tient et on rend une place à la
 * fois. Chaque appel repart des mêmes données et du même barème — deux
 * sélections avec les mêmes suppléments sont identiques.
 */
export function selectionner(
  donnees: DonneesCV,
  offre: OffreExtraite,
  niveau: NiveauCompacite,
  supplements: readonly number[] = []
): Selection {
  let empruntsRestants = MAX_EMPRUNTS_TOTAL;

  const experiences = donnees.experiences.map((experience, index) => {
    const quota = Math.min(
      PLAFOND_MISSIONS,
      quotaDuCran(niveau, index) + (supplements[index] ?? 0)
    );

    const candidates: MissionRetenue[] = experience.missions.map((m) => ({
      ...m,
      ...noterMission(m, offre),
    }));

    const missions = retenirPourExperience(candidates, quota, empruntsRestants);
    empruntsRestants -= missions.filter((m) => m.empruntee).length;

    return { experience, missions };
  });

  const notees = donnees.competences
    .map((c) => ({ ...c, ...noterCompetence(c, offre) }))
    .sort(comparerCompetences);

  const ligneOutils = grouperOutils(notees.filter((c) => c.categorie === "outil"));

  /**
   * Un besoin de l'annonce ne prend qu'une place (D124).
   *
   * EURENCO demandait « Communication » une seule fois ; trois lignes du
   * profil y répondaient et occupaient trois des huit places disponibles. Le
   * bloc doit couvrir le plus d'exigences possible, pas répéter la même sous
   * trois formulations. On garde la meilleure — le tri a déjà tranché — et on
   * passe à l'exigence suivante.
   *
   * Les lignes sans besoin nommé (cœur de métier, ou rien du tout) ne sont pas
   * concernées : un métier réclamé mérite plusieurs lignes.
   */
  const besoinsServis = new Set<string>();
  const metier = notees
    .filter((c) => c.categorie !== "outil")
    .filter((c) => {
      if (!c.besoin) return true;
      if (besoinsServis.has(c.besoin)) return false;
      besoinsServis.add(c.besoin);
      return true;
    })
    .slice(0, niveau.nbCompetences - (ligneOutils ? 1 : 0));

  const competences = (ligneOutils ? [...metier, ligneOutils] : metier).sort(
    comparerCompetences
  );

  return {
    niveau,
    experiences,
    competences,
    nbEmprunts: MAX_EMPRUNTS_TOTAL - empruntsRestants,
    supplements,
  };
}

/**
 * La prochaine expérience à garnir, ou `null` si la page est déjà au plafond.
 *
 * On balaie les paliers dans l'ordre, et pour chaque palier les expériences
 * dans l'ordre du CV. Une expérience qui n'a plus de mission en réserve est
 * sautée : lui accorder une place ne changerait rien et coûterait une
 * composition pour rien.
 */
export function prochaineAGarnir(selection: Selection): number | null {
  for (const palier of PALIERS_GARNISSAGE) {
    for (let i = 0; i < selection.experiences.length; i += 1) {
      const { experience, missions } = selection.experiences[i];
      if (missions.length >= palier) continue;
      if (missions.length >= PLAFOND_MISSIONS) continue;
      // Une place de plus n'a de sens que s'il reste de quoi la remplir. Le
      // plafond d'emprunts peut encore empêcher l'ajout ; l'appelant s'en rend
      // compte en constatant que le total n'a pas bougé.
      if (missions.length >= experience.missions.length) continue;
      return i;
    }
  }
  return null;
}

/** Nombre de missions effectivement retenues, toutes expériences confondues. */
export function nombreDeMissions(selection: Selection): number {
  return selection.experiences.reduce((n, e) => n + e.missions.length, 0);
}
