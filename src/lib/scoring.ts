import { noteSecteur } from "@/config/secteurs";
import { SOCLE, libelleDe, type Taxonomie } from "@/lib/taxonomie";
import type { CodeVolet } from "@/config/volets";
import type { OffreExtraite } from "@/lib/extraction-offre";
import { dureeMois } from "@/lib/base-pro";
import { estSavoirFaire, motsSignificatifs } from "@/lib/termes";
import {
  ANNEES_IMPLICITES,
  LIBELLES_SENIORITE,
  niveauDuPoste,
} from "@/lib/seniorite";

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
  /**
   * Faux quand la ligne est hors du calcul (D73).
   *
   * Sans cette marque, une exigence écartée faute de code d'activité
   * s'affichait « 0 » en rouge, exactement comme une exigence réellement non
   * couverte. Deux choses opposées — « je ne sais pas mesurer » et « tu ne
   * l'as pas » — portaient le même signe.
   */
  mesuree?: boolean;
}

export interface SousScore {
  note: number;
  poids: number;
  lignes: DetailLigne[];
  resume: string;
  /**
   * Faux quand l'annonce ne donne pas de quoi mesurer ce critère (D66).
   *
   * Un critère non mesurable sort du calcul : son poids est redistribué sur
   * les autres. Auparavant il recevait une note neutre — 70 pour des missions
   * sans code, 75 pour une expérience non chiffrée — et ces valeurs hautes
   * remontaient mécaniquement tous les scores. Sur cinq offres notées, quatre
   * n'annonçaient aucune durée d'expérience : trente-cinq pour cent du score
   * était une constante à 75.
   */
  mesurable: boolean;
}

export interface Resultat {
  global: number;
  plafonne: boolean;
  raisonPlafond: string | null;
  /**
   * Combien des quatre critères l'annonce n'a pas permis de mesurer (D66).
   *
   * Un score calculé sur deux critères vaut moins qu'un score calculé sur
   * quatre : l'écran le dit au lieu de laisser croire à la même solidité.
   */
  criteresEcartes: number;
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
  profil: ProfilPourScoring,
  taxonomie: Taxonomie
): SousScore {
  const libelle = (code: string) => libelleDe(taxonomie, code);

  if (offre.missions.length === 0) {
    return {
      note: 0,
      poids: 0,
      mesurable: false,
      lignes: [],
      resume:
        "Aucune mission identifiable dans l'offre : critère écarté du calcul.",
    };
  }

  const lignes: DetailLigne[] = [];
  let totalPondere = 0;
  let totalPoids = 0;

  let ecartees = 0;

  for (const m of offre.missions) {
    // Une mission que l'IA n'a pas su classer ne prouve rien, ni pour ni
    // contre : elle sort du calcul au lieu de valoir 70 (D66).
    if (m.codes.length === 0) {
      ecartees += 1;
      lignes.push({
        libelle: m.texte.length > 110 ? m.texte.slice(0, 110) + "…" : m.texte,
        note: 0,
        mesuree: false,
        explication:
          "Hors taxonomie : aucun code d'activité ne correspond, la ligne est écartée du calcul. Elle ne compte ni en bien ni en mal — et si le sujet revient souvent, c'est qu'il manque un code.",
      });
      continue;
    }

    let meilleure = 0;
    let couvertsMax: string[] = [];
    // On garde aussi *quelle* mission couvre l'exigence. Afficher le seul nom
    // du code — « Couvert par : Prévisionnel » — ne disait pas par quoi.
    let missionCouvrante = "";
    let vocabulaireRetenu = 0;

    const motsExiges = motsSignificatifs(m.texte);

    for (const p of profil.missions) {
      const communs = m.codes.filter((c) => p.codes.includes(c));
      if (communs.length === 0) continue;

      const taux = (communs.length / m.codes.length) * 100;
      // Une mission du profil très pertinente pour le volet compte plus.
      const bonus = p.pertinence >= 3 ? 1 : p.pertinence >= 2 ? 0.95 : 0.85;

      /**
       * Le vocabulaire départage ce que le code ne distingue pas (D65).
       *
       * La plupart des missions d'annonce ne portent qu'un seul code : le taux
       * de recouvrement ne valait donc que 0 ou 100, et un profil dont les
       * missions couvrent toute la taxonomie « couvrait » 90 % des offres du
       * métier. On mesure en plus la part des mots significatifs de l'exigence
       * qui se retrouvent dans la mission du parcours.
       *
       * Le facteur ne descend pas sous 0,6 : partager un code d'activité reste
       * une couverture réelle, même dit avec d'autres mots.
       */
      const motsTenus = motsSignificatifs(p.texte);
      const partagés = [...motsExiges].filter((mot) => motsTenus.has(mot)).length;
      const vocabulaire = motsExiges.size === 0 ? 1 : partagés / motsExiges.size;
      const facteur = 0.6 + 0.4 * vocabulaire;

      const note = Math.round(taux * bonus * facteur);
      if (note > meilleure) {
        meilleure = note;
        couvertsMax = communs;
        missionCouvrante = p.texte;
        vocabulaireRetenu = vocabulaire;
      }
    }

    totalPondere += meilleure * m.importance;
    totalPoids += m.importance;

    lignes.push({
      libelle: m.texte.length > 110 ? m.texte.slice(0, 110) + "…" : m.texte,
      note: meilleure,
      explication:
        couvertsMax.length > 0
          ? `Couvert par ta mission « ${
              missionCouvrante.length > 90
                ? missionCouvrante.slice(0, 90) + "…"
                : missionCouvrante
            } » — ${couvertsMax.map(libelle).join(", ")}. Vocabulaire commun : ${Math.round(
              vocabulaireRetenu * 100
            )} %.`
          : `Non couvert. Attendu : ${m.codes.map(libelle).join(", ")}.`,
    });
  }

  if (totalPoids === 0) {
    return {
      note: 0,
      poids: 0,
      mesurable: false,
      lignes,
      resume:
        "Aucune mission de l'offre n'a pu être rattachée à la taxonomie : critère écarté du calcul.",
    };
  }

  const note = Math.round(totalPondere / totalPoids);
  const couvertes = lignes.filter((l) => l.note >= 50).length;
  const mesurees = offre.missions.length - ecartees;

  return {
    note,
    poids: 0,
    mesurable: true,
    lignes,
    resume:
      `${couvertes} mission${couvertes > 1 ? "s" : ""} sur ${mesurees} couverte${
        couvertes > 1 ? "s" : ""
      } par ton profil, codes et vocabulaire confondus` +
      (ecartees > 0
        ? `. ${ecartees} ligne${ecartees > 1 ? "s" : ""} non classée${
            ecartees > 1 ? "s" : ""
          }, écartée${ecartees > 1 ? "s" : ""} du calcul.`
        : "."),
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
  profil: ProfilPourScoring,
  taxonomie: Taxonomie
): { sous: SousScore; manquantesIndispensables: string[] } {
  if (offre.competences.length === 0) {
    return {
      sous: {
        note: 0,
        poids: 0,
        mesurable: false,
        lignes: [],
        resume:
          "Aucune compétence explicite dans l'offre : critère écarté du calcul.",
      },
      manquantesIndispensables: [],
    };
  }

  const lignes: DetailLigne[] = [];
  const manquantesIndispensables: string[] = [];
  let obtenu = 0;
  let total = 0;

  const codesProfil = new Set(profil.missions.flatMap((m) => m.codes));

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
    /**
     * Une qualité comportementale compte moitié moins qu'un savoir-faire de
     * même caractère (D63).
     *
     * L'application refuse déjà de proposer « polyvalence » ou « rigueur » à
     * l'ajout : trop génériques pour valoir une ligne de CV. Le scoring, lui,
     * les notait à plein — une annonce pouvait donc coûter des points sur une
     * compétence que rien ne permettait d'acquérir. Les deux modules
     * s'appuient désormais sur la même définition, `estSavoirFaire`.
     *
     * Réduit plutôt qu'annulé : un recruteur qui écrit « polyvalence » en tête
     * de son annonce dit quelque chose du poste. Cela doit peser, sans jamais
     * faire basculer un score.
     */
    const comportementale = !estSavoirFaire(c.libelle);
    const poids = (c.caractere === "indispensable" ? 3 : 1) / (comportementale ? 2 : 1);
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
      explication = `Démontrée par tes missions — activité « ${libelleDe(
        taxonomie,
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
    // Une qualité absente ne plafonne pas le score global : on ne bloque pas
    // une candidature parce qu'une annonce réclame de la polyvalence.
    if (c.caractere === "indispensable" && note === 0 && !comportementale) {
      manquantesIndispensables.push(c.libelle);
    }

    lignes.push({
      libelle: c.libelle,
      note,
      explication: comportementale
        ? `${explication} Qualité comportementale : compte pour moitié.`
        : explication,
    });
  }

  const note = Math.round((obtenu / total) * 100);
  const acquises = lignes.filter((l) => l.note >= 60).length;

  return {
    sous: {
      note,
      poids: 0,
      mesurable: true,
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

  /**
   * L'exigence en années, lue ou déduite du niveau du poste (D64, D66).
   *
   * Quand l'annonce ne chiffre rien, on regarde ce qu'elle dit du niveau —
   * explicitement, par son intitulé, ou par l'encadrement annoncé. Faute de
   * quoi le critère sort du calcul plutôt que de recevoir une note neutre à
   * 75, qui figeait trente-cinq pour cent du score.
   */
  const chiffree = offre.annees_experience !== null && offre.annees_experience > 0;
  const niveau = niveauDuPoste(offre);

  if (!chiffree && niveau.niveau === null) {
    return {
      note: 0,
      poids: 0,
      mesurable: false,
      lignes: [
        {
          libelle: "Exigence non précisée",
          note: 0,
          mesuree: false,
          explication: `${detail} ${niveau.explication}`,
        },
      ],
      resume:
        "L'offre ne dit rien de l'expérience attendue : critère écarté du calcul, le score se fait sur les autres.",
    };
  }

  const demande = chiffree
    ? (offre.annees_experience as number)
    : ANNEES_IMPLICITES[niveau.niveau!];

  // Un poste ouvert aux débutants ne peut pas manquer d'expérience.
  if (demande === 0) {
    return {
      note: 100,
      poids: 0,
      mesurable: true,
      lignes: [
        {
          libelle: LIBELLES_SENIORITE.junior,
          note: 100,
          explication: `${detail} ${niveau.explication}`,
        },
      ],
      resume: "Poste ouvert aux profils débutants : ton ancienneté suffit.",
    };
  }

  const ecart = demande - annees;

  /**
   * Barème version 3 — D42.
   *
   * La courbe linéaire donnait 42 sur 100 à un profil auquel il manquait trois
   * ans sur cinq, et le score global restait à 72 : une offre de profil
   * confirmé passait pour une candidature solide. Au-delà d'un an d'écart,
   * chaque année manquante retire un quart de la note, plancher à 10.
   *
   * L'écart d'ancienneté n'est pas proportionnel à la distance : passer de
   * deux à trois ans manquants coûte plus qu'aller de zéro à un.
   */
  const lineaire = (annees / demande) * 100;
  const penalite = ecart > 1 ? Math.max(0.3, 1 - 0.25 * (ecart - 1)) : 1;
  const note =
    annees >= demande * 0.8
      ? 100
      : Math.max(10, Math.round(lineaire * penalite));

  return {
    note,
    poids: 0,
    mesurable: true,
    lignes: [
      {
        libelle: chiffree
          ? `${demande} an${demande > 1 ? "s" : ""} demandé${demande > 1 ? "s" : ""}`
          : `${demande} an${demande > 1 ? "s" : ""} attendus au niveau ${
              LIBELLES_SENIORITE[niveau.niveau!]
            }`,
        note,
        explication: chiffree
          ? detail
          : `${detail} ${niveau.explication} L'annonce ne chiffre aucune durée : l'exigence est déduite du niveau du poste.`,
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

/**
 * @param taxonomie La liste fermée des activités, telle qu'elle est en base
 * (D74). Le socle versionné sert de valeur par défaut : un score doit rester
 * calculable même si la table n'a pas encore été créée, et les tests n'ont pas
 * à monter une base pour vérifier une arithmétique.
 */
export function calculerScore(
  offre: OffreExtraite,
  profil: ProfilPourScoring,
  volet: CodeVolet,
  bareme: Bareme,
  taxonomie: Taxonomie = SOCLE
): Resultat {
  const missions = sousScoreMissions(offre, profil, taxonomie);
  const { sous: competences, manquantesIndispensables } = sousScoreCompetences(
    offre,
    profil,
    taxonomie
  );
  const experience = sousScoreExperience(offre, profil, bareme.coefficients);

  const secteursProfil = profil.experiences
    .map((e) => e.secteur_code)
    .filter((s): s is string => Boolean(s));
  const s = noteSecteur(offre.secteur_code, secteursProfil);
  const secteur: SousScore = {
    note: s.note,
    poids: 0,
    // Le secteur est toujours mesurable : une offre sans secteur identifié est
    // notée sur la proximité nulle, ce qui est une information, pas un trou.
    mesurable: offre.secteur_code !== null,
    lignes: [{ libelle: "Secteur", note: s.note, explication: s.explication }],
    resume: s.explication,
  };

  const p = bareme.poids;

  /**
   * Les poids sont redistribués sur les seuls critères mesurables (D66).
   *
   * Un critère que l'annonce ne permet pas d'évaluer ne reçoit plus de note
   * neutre : il sort du calcul, et sa part va aux autres. Le score répond
   * alors à « sur ce que l'offre dit, où j'en suis », au lieu de mélanger des
   * mesures et des valeurs de remplissage.
   */
  const parts: { sous: SousScore; poids: number }[] = [
    { sous: missions, poids: p.missions },
    { sous: competences, poids: p.competences },
    { sous: experience, poids: p.experience },
    { sous: secteur, poids: p.secteur },
  ];

  const mesurables = parts.filter((x) => x.sous.mesurable);
  const totalPoids = mesurables.reduce((t, x) => t + x.poids, 0);

  for (const x of parts) {
    // Le poids affiché est le poids réel dans ce score, pas celui du barème :
    // sinon l'écran annoncerait 35 % pour un critère qui n'a rien pesé.
    x.sous.poids = x.sous.mesurable
      ? Math.round((x.poids / totalPoids) * 100)
      : 0;
  }

  let global =
    totalPoids === 0
      ? 0
      : Math.round(
          mesurables.reduce((t, x) => t + x.sous.note * x.poids, 0) / totalPoids
        );

  const ecartes = parts.filter((x) => !x.sous.mesurable).length;

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
    criteresEcartes: ecartes,
    missions,
    competences,
    experience,
    secteur,
    versionBareme: bareme.version,
  };
}
