import type { CodeVolet } from "@/config/volets";
import type { OffreExtraite } from "@/lib/extraction-offre";
import { normaliser } from "@/lib/texte";
import { motsSignificatifs, termePresent } from "@/lib/termes";
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

export interface Potentiel {
  niveau: "faible" | "moyen" | "fort";
  /**
   * Absent du CV mais présent ailleurs dans le parcours — corpus, formations,
   * compétences. Une reformulation peut le faire apparaître.
   */
  recuperables: string[];
  /**
   * Absent du parcours entier. Rien à en faire, et ce n'est pas un défaut :
   * un CV n'a pas à couvrir toutes les annonces.
   */
  horsPortee: string[];
  /** Part des termes de l'annonce déjà présents dans le CV, en pourcentage. */
  couverture: number;
}

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
 * Mesure ce que l'annonce réclame et que le CV ne dit pas, en séparant ce qui
 * est récupérable de ce qui ne l'est pas.
 *
 * Le niveau affiché ne dépend que du récupérable : c'est le seul sur lequel
 * une reformulation peut agir. Crier « fort » pour du hors-portée pousserait à
 * payer un appel qui ne pouvait rien produire.
 *
 * @param parcours Corpus, formations et compétences — tout ce que Taha a fait
 * ou appris, au-delà de ce que le CV a la place de dire.
 */
export function potentielAdaptation(
  analyse: OffreExtraite,
  selectionOffre: Selection,
  parcours = ""
): Potentiel {
  const attendus = [
    ...analyse.mots_cles_ats,
    ...analyse.outils,
    ...analyse.competences.map((c) => c.libelle),
  ].filter(digneDeCompte);

  if (attendus.length === 0) {
    return { niveau: "faible", recuperables: [], horsPortee: [], couverture: 100 };
  }

  const motsDuCv = motsSignificatifs(
    [
      ...textesMissions(selectionOffre),
      ...selectionOffre.competences.map((c) => c.libelle),
    ].join(" ")
  );
  const motsDuParcours = motsSignificatifs(parcours);

  const vus = new Set<string>();
  const absents = attendus.filter((terme) => {
    const n = normaliser(terme);
    if (vus.has(n)) return false;
    vus.add(n);
    return !termePresent(terme, motsDuCv);
  });

  const recuperables = absents.filter((t) => termePresent(t, motsDuParcours));
  const horsPortee = absents.filter((t) => !termePresent(t, motsDuParcours));

  const total = vus.size;
  const couverture = Math.round(((total - absents.length) / total) * 100);

  // Seuils empiriques, réglables ici. Comptés sur le récupérable seul.
  const partRecuperable = recuperables.length / total;
  const niveau =
    partRecuperable >= 0.25 ? "fort" : partRecuperable >= 0.1 ? "moyen" : "faible";

  return {
    niveau,
    recuperables: recuperables.slice(0, 12),
    horsPortee: horsPortee.slice(0, 12),
    couverture,
  };
}

export const LIBELLES_POTENTIEL: Record<Potentiel["niveau"], string> = {
  faible: "Rien de récupérable : ton CV dit déjà ce que ton parcours permet",
  moyen: "Quelques termes de l'annonce sont récupérables de ton parcours",
  fort: "Ton parcours couvre plusieurs termes que ton CV ne dit pas",
};

export type { CodeVolet };
