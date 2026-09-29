import type { CodeVolet } from "@/config/volets";
import type { OffreExtraite } from "@/lib/extraction-offre";
import { normaliser } from "@/lib/texte";
import {
  estSavoirFaire,
  motsSignificatifs,
  noyauDuTerme,
  termePresent,
} from "@/lib/termes";
import type { DonneesCV } from "@/lib/cv/donnees";
import { selectionner, type NiveauCompacite, type Selection } from "@/lib/cv/selection";

/**
 * Ce qu'une personnalisation apporte vraiment.
 *
 * Deux mesures, toutes deux arithmétiques et gratuites :
 *
 * - **l'écart** au CV de référence du volet, une fois le CV composé : ce que
 *   l'offre a fait remonter, ce qu'elle a fait tomber ;
 * - **le potentiel** d'adaptation, avant de payer une reformulation : ce que
 *   l'annonce réclame et que le CV ne dit nulle part.
 *
 * Le CV de référence n'existe pas en tant que document. C'est le CV que le
 * volet produirait sans aucune pondération d'offre : formulations génériques,
 * missions rangées par pertinence déclarée, compétences par niveau. Il sert
 * d'étalon, rien de plus.
 */

export interface Ecart {
  /** Missions que l'offre a fait entrer, absentes du CV de référence. */
  missionsMisesEnAvant: string[];
  /** Missions du CV de référence que l'offre a fait sortir. */
  missionsEcartees: string[];
  nbReformulees: number;
  nbEmpruntees: number;
  competencesAjoutees: string[];
  competencesRetirees: string[];
  /** Part des lignes du CV qui diffèrent de la référence, en pourcentage. */
  partModifiee: number;
}

/**
 * D'où vient un terme récupérable — et donc ce qu'on peut en faire.
 *
 * C'est toute la correction de D78. Les quatre sources n'autorisent pas le
 * même geste, et les confondre promettait une action impossible.
 */
export type SourcePotentiel = "corpus" | "mission" | "competence" | "formation";

export interface SourcesParcours {
  /** Les entrées de corpus : la seule matière dont une mission puisse naître. */
  corpus: string[];
  /** Les missions du volet, y compris celles que le quota n'a pas retenues. */
  missions: string[];
  competences: string[];
  formations: string[];
}

export interface Potentiel {
  niveau: "faible" | "moyen" | "fort";
  /**
   * Absent du CV mais présent ailleurs dans le parcours — corpus, missions non
   * retenues, compétences, formations. Conservé tel quel : les documents
   * générés avant D78 portent cette liste, et ils sont figés pour toujours.
   */
  recuperables: string[];
  /**
   * Absent du parcours entier. Rien à en faire, et ce n'est pas un défaut :
   * un CV n'a pas à couvrir toutes les annonces.
   */
  horsPortee: string[];
  /** Part des termes de l'annonce déjà présents dans le CV, en pourcentage. */
  couverture: number;
  /**
   * Schéma 4 — les récupérables ventilés par source (D78).
   *
   * Absent des documents antérieurs : les écrans doivent le traiter comme
   * facultatif, exactement comme `recuperables` l'a été avant l'étape 4ter.
   */
  parSource?: Record<SourcePotentiel, string[]>;
}

/** Ce que chaque source autorise réellement. Affiché tel quel. */
export const ACTIONS_PAR_SOURCE: Record<SourcePotentiel, string> = {
  corpus:
    "Une mission peut être proposée à partir de cette matière : c'est le seul cas où payer une génération a un sens.",
  mission:
    "La mission existe déjà dans ton parcours — elle n'a pas passé le quota de cette offre. Ni reformulation ni proposition n'y changeront rien.",
  competence:
    "Tu le revendiques déjà en compétence. Rien à générer : au mieux, le faire remonter dans la sélection.",
  formation:
    "C'est dans ta formation. Rien à générer, et le diplôme le dit déjà.",
};

export const LIBELLES_SOURCE: Record<SourcePotentiel, string> = {
  corpus: "Dans ton corpus",
  mission: "Dans une mission non retenue",
  competence: "Dans tes compétences",
  formation: "Dans tes formations",
};

/**
 * Une offre vidée de ses attentes : toutes les notes tombent à zéro, et la
 * sélection retombe sur ses critères propres — chiffre, pertinence déclarée,
 * ordre. C'est la définition même du CV de référence, obtenue sans écrire un
 * second moteur de sélection.
 */
function offreNeutre(analyse: OffreExtraite): OffreExtraite {
  return {
    ...analyse,
    missions: [],
    competences: [],
    outils: [],
    mots_cles_ats: [],
  };
}

function textesMissions(selection: Selection): string[] {
  return selection.experiences.flatMap((e) => e.missions.map((m) => m.texte));
}

export function comparerAuReference(
  donnees: DonneesCV,
  analyse: OffreExtraite,
  niveau: NiveauCompacite,
  selectionOffre: Selection
): Ecart {
  const reference = selectionner(donnees, offreNeutre(analyse), niveau);

  const missionsOffre = textesMissions(selectionOffre);
  const missionsReference = textesMissions(reference);

  // On compare les identifiants, pas les textes : une mission reformulée reste
  // la même mission, et la compter comme « mise en avant » serait faux.
  const idsOffre = new Set(
    selectionOffre.experiences.flatMap((e) => e.missions.map((m) => m.id))
  );
  const idsReference = new Set(
    reference.experiences.flatMap((e) => e.missions.map((m) => m.id))
  );

  const missionsMisesEnAvant = selectionOffre.experiences
    .flatMap((e) => e.missions)
    .filter((m) => !idsReference.has(m.id))
    .map((m) => m.texte);

  const missionsEcartees = reference.experiences
    .flatMap((e) => e.missions)
    .filter((m) => !idsOffre.has(m.id))
    .map((m) => m.texte);

  const libellesOffre = selectionOffre.competences.map((c) => c.libelle);
  const libellesReference = reference.competences.map((c) => c.libelle);

  const competencesAjoutees = libellesOffre.filter(
    (l) => !libellesReference.includes(l)
  );
  const competencesRetirees = libellesReference.filter(
    (l) => !libellesOffre.includes(l)
  );

  const nbReformulees = selectionOffre.experiences
    .flatMap((e) => e.missions)
    .filter((m) => m.adaptee).length;

  const lignes = missionsOffre.length + libellesOffre.length;
  const differentes =
    missionsMisesEnAvant.length + competencesAjoutees.length + nbReformulees;

  return {
    missionsMisesEnAvant,
    missionsEcartees,
    nbReformulees,
    nbEmpruntees: selectionOffre.nbEmprunts,
    competencesAjoutees,
    competencesRetirees,
    partModifiee: lignes > 0 ? Math.round((differentes / lignes) * 100) : 0,
  };
}

/** Termes trop courts ou trop généraux pour peser dans le calcul. */
function digneDeCompte(terme: string): boolean {
  const n = normaliser(terme);
  return n.length >= 4 && !["bac", "master", "ans", "poste"].includes(n);
}

/**
 * Mesure ce que l'annonce réclame et que le CV ne dit nulle part.
 *
 * Sert à décider **avant de payer** : un potentiel faible signifie que le CV
 * répond déjà, et qu'une reformulation dépenserait un appel pour rien.
 */
/**
 * Mesure ce que l'annonce réclame et que le CV ne dit pas, en disant **d'où**
 * chaque terme est récupérable.
 *
 * Un terme est récupérable si tous ses mots se trouvent dans **une même ligne**
 * du parcours. La première version les cherchait n'importe où dans le parcours
 * entier : « finance » dans une ligne, « entreprise » dans une autre, et
 * « Finance d'entreprise » était déclaré récupérable alors que rien ne le
 * portait.
 *
 * D78 corrige la seconde moitié du problème. Le parcours a quatre sources, et
 * **une seule peut produire une mission** : le corpus. Une compétence, un
 * diplôme ou une mission recalée par le quota rendaient le terme
 * « récupérable » et le niveau « fort », alors qu'aucun bouton ne pouvait rien
 * en faire. D'où le constat d'usage : potentiel fort, zéro proposition, et
 * l'impression que l'application se contredisait.
 *
 * Le niveau ne compte donc plus que le corpus. En valeur absolue et non en
 * part : ce qui décide, c'est la quantité de matière disponible pour écrire
 * une mission, et le générateur n'en propose jamais plus de trois.
 *
 * La couverture, elle, ne change pas : elle répond à une autre question —
 * « combien de ce que l'annonce réclame est déjà sur le CV » — et cette
 * question-là n'a rien à voir avec les sources.
 */
export function potentielAdaptation(
  analyse: OffreExtraite,
  selectionOffre: Selection,
  sources: SourcesParcours = {
    corpus: [],
    missions: [],
    competences: [],
    formations: [],
  },
  texteCV?: string
): Potentiel {
  const attendus = [
    ...analyse.mots_cles_ats,
    ...analyse.outils,
    ...analyse.competences.map((c) => c.libelle),
  ]
    // Seuls les savoir-faire comptent : une reformulation ne peut pas faire
    // entrer « écoute active » dans une mission, et le promettre revient à
    // pousser vers un appel qui ne produira rien.
    .filter(digneDeCompte)
    .filter(estSavoirFaire)
    .map(noyauDuTerme);

  const vide: Record<SourcePotentiel, string[]> = {
    corpus: [],
    mission: [],
    competence: [],
    formation: [],
  };

  if (attendus.length === 0) {
    return {
      niveau: "faible",
      recuperables: [],
      horsPortee: [],
      couverture: 100,
      parSource: vide,
    };
  }

  /**
   * Ce qui compte comme « déjà sur le CV » — le CV composé, en entier (D90).
   *
   * La version précédente ne regardait que les missions sélectionnées et les
   * libellés de compétences. Elle ignorait donc le **titre** du CV, l'accroche
   * et les intitulés de poste — c'est-à-dire le haut de la page.
   *
   * Conséquence mesurée le 29 septembre, sur une offre réelle : « contrôleur
   * de gestion » — imprimé en majuscules en tête du CV — et « business
   * partner » — écrit noir sur blanc dans l'accroche — étaient comptés comme
   * absents. Trois termes fantômes suffisaient à afficher « fort », et à faire
   * payer 4,4 ¢ une génération qui ne pouvait rien produire.
   *
   * Le texte composé est passé en paramètre : c'est littéralement ce qui sera
   * imprimé, et rien ne peut plus lui échapper. Le repli sur la sélection
   * existe pour les tests, qui n'ont pas de modèle à composer.
   */
  const motsDuCv = motsSignificatifs(
    texteCV ??
      [
        ...textesMissions(selectionOffre),
        ...selectionOffre.competences.map((c) => c.libelle),
      ].join(" ")
  );
  /**
   * Les quatre sources, préparées ligne à ligne et **dans l'ordre de ce
   * qu'elles autorisent**. Un terme présent à la fois dans le corpus et dans
   * une compétence est attribué au corpus : c'est la source qui ouvre une
   * action, et c'est celle-là qu'il faut montrer.
   */
  const parLigne: [SourcePotentiel, Set<string>[]][] = [
    ["corpus", sources.corpus.map(motsSignificatifs)],
    ["mission", sources.missions.map(motsSignificatifs)],
    ["competence", sources.competences.map(motsSignificatifs)],
    ["formation", sources.formations.map(motsSignificatifs)],
  ];

  const vus = new Set<string>();
  const absents = attendus.filter((terme) => {
    const n = normaliser(terme);
    if (vus.has(n)) return false;
    vus.add(n);
    return !termePresent(terme, motsDuCv);
  });

  const origine = (t: string): SourcePotentiel | null => {
    for (const [source, lignes] of parLigne) {
      if (lignes.some((mots) => termePresent(t, mots))) return source;
    }
    return null;
  };

  const parSource: Record<SourcePotentiel, string[]> = {
    corpus: [],
    mission: [],
    competence: [],
    formation: [],
  };
  const recuperables: string[] = [];
  const horsPortee: string[] = [];

  for (const t of absents) {
    const source = origine(t);
    if (source) {
      parSource[source].push(t);
      recuperables.push(t);
    } else {
      horsPortee.push(t);
    }
  }

  const total = vus.size;
  const couverture = Math.round(((total - absents.length) / total) * 100);

  /**
   * Le niveau ne compte que le corpus, en valeur absolue.
   *
   * Trois termes, c'est le plafond de propositions du générateur : au-delà,
   * annoncer « très fort » n'apporterait rien de plus. Un seul terme suffit à
   * justifier un essai, sans mériter qu'on crie au potentiel.
   */
  const n = parSource.corpus.length;
  const niveau = n >= 3 ? "fort" : n >= 1 ? "moyen" : "faible";

  return {
    niveau,
    recuperables: recuperables.slice(0, 12),
    horsPortee: horsPortee.slice(0, 12),
    couverture,
    parSource: {
      corpus: parSource.corpus.slice(0, 12),
      mission: parSource.mission.slice(0, 12),
      competence: parSource.competence.slice(0, 12),
      formation: parSource.formation.slice(0, 12),
    },
  };
}

export const LIBELLES_POTENTIEL: Record<Potentiel["niveau"], string> = {
  faible: "Rien à tirer de ton corpus : une reformulation ne produira rien",
  moyen: "Un ou deux termes de l'annonce dorment dans ton corpus",
  fort: "Plusieurs termes de l'annonce sont dans ton corpus, absents du CV",
};

/**
 * Le potentiel d'un document, quel que soit son âge.
 *
 * Un document d'avant l'étape 4ter n'a ni `recuperables` ni `horsPortee` ;
 * un document d'avant D78 n'a pas `parSource`. Les deux sont figés pour
 * toujours — ce qui est écrit dans `documents.selection` ne se recalcule
 * jamais. Tout écran passe donc par ici plutôt que de deviner la forme.
 */
export function lirePotentiel(
  brut: Potentiel | undefined | null,
  schema = 0
): {
  potentiel: Potentiel | null;
  /** Vrai quand le document est antérieur à D78 : la ventilation manque. */
  sansSource: boolean;
  /**
   * Vrai quand le document est antérieur à D90 : le potentiel a été mesuré
   * contre une partie du CV seulement, et surestime donc ce qui reste à
   * récupérer. Recomposer le CV suffit à le corriger, et ne coûte rien.
   */
  perime: boolean;
} {
  if (!brut) return { potentiel: null, sansSource: false, perime: false };

  return {
    potentiel: {
      ...brut,
      recuperables: brut.recuperables ?? [],
      horsPortee: brut.horsPortee ?? [],
    },
    sansSource: brut.parSource === undefined,
    perime: schema > 0 && schema < 5,
  };
}

export type { CodeVolet };
