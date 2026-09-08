import { ACTIVITES, libelleActivite } from "@/config/activites";
import { noteSecteur } from "@/config/secteurs";
import type { CodeVolet } from "@/config/volets";
import type { OffreExtraite } from "@/lib/extraction-offre";
import { dureeMois } from "@/lib/base-pro";

/**
 * Scoring 100 % déterministe (spécification §8).
 *
 * L'IA a classé ; ici on ne fait que compter. Le même couple offre/profil
 * produit toujours le même score, et chaque sous-score expose le détail de
 * son calcul pour être affiché tel quel.
 */

export interface DetailLigne {
  libelle: string;
  note: number;
  explication: string;
}

export interface SousScore {
  note: number;
  poids: number;
  lignes: DetailLigne[];
  resume: string;
}

export interface Resultat {
  global: number;
  plafonne: boolean;
  raisonPlafond: string | null;
  missions: SousScore;
  competences: SousScore;
  experience: SousScore;
  secteur: SousScore;
  versionBareme: string;
}

export interface ProfilPourScoring {
  missions: { codes: string[]; pertinence: number; texte: string }[];
  competences: {
    libelle: string;
    codeNormalise: string;
    niveau: number;
    categorie: string;
  }[];
  experiences: {
    date_debut: string;
    date_fin: string | null;
    duree_mois_forcee: number | null;
    type_contrat: string;
    secteur_code: string | null;
  }[];
}

export interface Bareme {
  version: string;
  poids: { missions: number; competences: number; experience: number; secteur: number };
  plafondEcartBloquant: number;
  coefficients: Record<string, number>;
}

/** Normalise un libellé pour la comparaison : minuscules, sans accents. */
function normaliser(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Deux libellés se correspondent si l'un contient l'autre. */
function correspond(a: string, b: string): boolean {
  const x = normaliser(a);
  const y = normaliser(b);
  if (x.length < 3 || y.length < 3) return false;
  return x === y || x.includes(y) || y.includes(x);
}

function sousScoreMissions(
  offre: OffreExtraite,
  profil: ProfilPourScoring
): SousScore {
  if (offre.missions.length === 0) {
    return {
      note: 70,
      poids: 0,
      lignes: [],
      resume: "Aucune mission identifiable dans l'offre — valeur neutre.",
    };
  }

  const lignes: DetailLigne[] = [];
  let totalPondere = 0;
  let totalPoids = 0;

  for (const m of offre.missions) {
    let meilleure = 0;
    let couvertsMax: string[] = [];

    if (m.codes.length === 0) {
      // Sans code, on ne peut rien mesurer : neutre, et on le dit.
      meilleure = 70;
    } else {
      for (const p of profil.missions) {
        const communs = m.codes.filter((c) => p.codes.includes(c));
        const taux = (communs.length / m.codes.length) * 100;
        // Une mission du profil très pertinente pour le volet compte plus.
        const bonus = p.pertinence >= 3 ? 1 : p.pertinence >= 2 ? 0.95 : 0.85;
        const note = Math.round(taux * bonus);
        if (note > meilleure) {
          meilleure = note;
          couvertsMax = communs;
        }
      }
    }

    totalPondere += meilleure * m.importance;
    totalPoids += m.importance;

    lignes.push({
      libelle: m.texte.length > 110 ? m.texte.slice(0, 110) + "…" : m.texte,
      note: meilleure,
      explication:
        m.codes.length === 0
          ? "Aucun code d'activité identifié — non mesurable."
          : couvertsMax.length > 0
            ? `Couvert par : ${couvertsMax.map(libelleActivite).join(", ")}.`
            : `Non couvert. Attendu : ${m.codes.map(libelleActivite).join(", ")}.`,
    });
  }

  const note = Math.round(totalPondere / totalPoids);
  const couvertes = lignes.filter((l) => l.note >= 50).length;

  return {
    note,
    poids: 0,
    lignes,
    resume: `${couvertes} mission${couvertes > 1 ? "s" : ""} sur ${
      offre.missions.length
    } couverte${couvertes > 1 ? "s" : ""} par ton profil.`,
  };
}

/** Une compétence vaut selon le niveau déclaré. */
function noteDuNiveau(niveau: number): number {
  if (niveau >= 3) return 100;
  if (niveau >= 2) return 85;
  if (niveau >= 1) return 60;
  return 0;
}

const LIBELLE_NIVEAU: Record<number, string> = {
  3: "maîtrise",
  2: "niveau opérationnel",
  1: "notions",
};

/** Les grandes familles, que les offres nomment souvent telles quelles. */
const FAMILLES: Record<string, string> = {
  cdg: "Contrôle de gestion",
  compta: "Comptabilité",
};

function sousScoreCompetences(
  offre: OffreExtraite,
  profil: ProfilPourScoring
): { sous: SousScore; manquantesIndispensables: string[] } {
  if (offre.competences.length === 0) {
    return {
      sous: {
        note: 70,
        poids: 0,
        lignes: [],
        resume: "Aucune compétence explicite dans l'offre — valeur neutre.",
      },
      manquantesIndispensables: [],
    };
  }

  const lignes: DetailLigne[] = [];
  const manquantesIndispensables: string[] = [];
  let obtenu = 0;
  let total = 0;

  const codesProfil = new Set(profil.missions.flatMap((m) => m.codes));

  const taxonomie = ACTIVITES as Record<
    string,
    { libelle: string; famille: string }
  >;

  /** Familles réellement couvertes par les missions du parcours. */
  const famillesProfil = new Set(
    [...codesProfil].map((c) => taxonomie[c]?.famille).filter(Boolean)
  );

  /** Retrouve le code d'activité correspondant au libellé d'une compétence. */
  const activiteDepuisLibelle = (libelle: string): string | null => {
    for (const [code, def] of Object.entries(taxonomie)) {
      if (correspond(def.libelle, libelle)) return code;
    }
    return null;
  };

  /**
   * Une offre réclame souvent « Contrôle de gestion » tout court : un métier
   * entier, jamais listé comme une ligne de compétence. Sans ce rattrapage,
   * le cœur du métier vaudrait zéro.
   */
  const familleDepuisLibelle = (libelle: string): string | null => {
    for (const [code, nom] of Object.entries(FAMILLES)) {
      if (correspond(nom, libelle)) return code;
    }
    return null;
  };

  for (const c of offre.competences) {
    const poids = c.caractere === "indispensable" ? 3 : 1;
    total += poids;

    const codeDemontre = activiteDepuisLibelle(c.libelle);
    const familleDemontree = familleDepuisLibelle(c.libelle);
    const trouvee = profil.competences.find(
      (p) =>
        correspond(p.libelle, c.libelle) ||
        correspond(p.codeNormalise, c.libelle)
    );

    let note = 0;
    let explication: string;

    if (codeDemontre && codesProfil.has(codeDemontre)) {
      // Le parcours réel prime sur le déclaratif.
      note = 100;
      explication = `Démontrée par tes missions — activité « ${libelleActivite(
        codeDemontre
      )} ».`;
    } else if (familleDemontree && famillesProfil.has(familleDemontree)) {
      note = 100;
      explication = `Cœur de métier — tes missions couvrent la famille ${FAMILLES[familleDemontree]}.`;
    } else if (trouvee && trouvee.niveau > 0) {
      note = noteDuNiveau(trouvee.niveau);
      explication = `Déclarée en base — ${LIBELLE_NIVEAU[trouvee.niveau]}.`;
    } else {
      explication =
        c.caractere === "indispensable"
          ? "Absente de ta base — exigée par l'offre."
          : "Absente de ta base — souhaitée seulement.";
    }

    obtenu += (poids * note) / 100;

    // Le plafond ne se déclenche plus que sur une absence totale : avoir des
    // notions sur une exigence, c'est être en dessous du niveau attendu, pas
    // hors-jeu.
    if (c.caractere === "indispensable" && note === 0) {
      manquantesIndispensables.push(c.libelle);
    }

    lignes.push({ libelle: c.libelle, note, explication });
  }

  const note = Math.round((obtenu / total) * 100);
  const acquises = lignes.filter((l) => l.note >= 60).length;

  return {
    sous: {
      note,
      poids: 0,
      lignes: lignes.sort((a, b) => a.note - b.note),
      resume: `${acquises} compétence${acquises > 1 ? "s" : ""} sur ${
        offre.competences.length
      } couverte${acquises > 1 ? "s" : ""}, pondérées selon leur caractère et ton niveau.`,
    },
    manquantesIndispensables,
  };
}

function sousScoreExperience(
  offre: OffreExtraite,
  profil: ProfilPourScoring,
  coefficients: Record<string, number>
): SousScore {
  const mois = profil.experiences.reduce((total, e) => {
    const coef = coefficients[e.type_contrat] ?? 1;
    return total + dureeMois(e) * coef;
  }, 0);
  const annees = mois / 12;

  const detail = `Ancienneté pondérée : ${Math.floor(annees)} an${
    annees >= 2 ? "s" : ""
  } et ${Math.round(mois % 12)} mois.`;

  if (offre.annees_experience === null || offre.annees_experience === 0) {
    return {
      note: 75,
      poids: 0,
      lignes: [{ libelle: "Exigence non précisée", note: 75, explication: detail }],
      resume: "L'offre ne précise aucune exigence — valeur neutre, non mesurée.",
    };
  }

  const demande = offre.annees_experience;
  const note =
    annees >= demande * 0.8
      ? 100
      : Math.round((annees / demande) * 100);

  return {
    note,
    poids: 0,
    lignes: [
      {
        libelle: `${demande} an${demande > 1 ? "s" : ""} demandé${demande > 1 ? "s" : ""}`,
        note,
        explication: detail,
      },
    ],
    resume:
      note === 100
        ? "Ton ancienneté couvre l'exigence de l'offre."
        : `Il te manque environ ${Math.max(
            0,
            Math.round((demande - annees) * 10) / 10
          )} an d'expérience selon le barème.`,
  };
}

export function calculerScore(
  offre: OffreExtraite,
  profil: ProfilPourScoring,
  volet: CodeVolet,
  bareme: Bareme
): Resultat {
  const missions = sousScoreMissions(offre, profil);
  const { sous: competences, manquantesIndispensables } = sousScoreCompetences(
    offre,
    profil
  );
  const experience = sousScoreExperience(offre, profil, bareme.coefficients);

  const secteursProfil = profil.experiences
    .map((e) => e.secteur_code)
    .filter((s): s is string => Boolean(s));
  const s = noteSecteur(offre.secteur_code, secteursProfil);
  const secteur: SousScore = {
    note: s.note,
    poids: 0,
    lignes: [{ libelle: "Secteur", note: s.note, explication: s.explication }],
    resume: s.explication,
  };

  const p = bareme.poids;
  missions.poids = p.missions;
  competences.poids = p.competences;
  experience.poids = p.experience;
  secteur.poids = p.secteur;

  let global = Math.round(
    (missions.note * p.missions +
      competences.note * p.competences +
      experience.note * p.experience +
      secteur.note * p.secteur) /
      (p.missions + p.competences + p.experience + p.secteur)
  );

  let plafonne = false;
  let raisonPlafond: string | null = null;

  if (manquantesIndispensables.length > 0 && global > bareme.plafondEcartBloquant) {
    plafonne = true;
    raisonPlafond = `Score plafonné à ${bareme.plafondEcartBloquant} : ${
      manquantesIndispensables.length
    } compétence${manquantesIndispensables.length > 1 ? "s" : ""} exigée${
      manquantesIndispensables.length > 1 ? "s" : ""
    } manque${manquantesIndispensables.length > 1 ? "nt" : ""} — ${manquantesIndispensables.join(
      ", "
    )}.`;
    global = bareme.plafondEcartBloquant;
  }

  void volet;

  return {
    global,
    plafonne,
    raisonPlafond,
    missions,
    competences,
    experience,
    secteur,
    versionBareme: bareme.version,
  };
}
