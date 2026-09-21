import { normaliser } from "@/lib/texte";

/**
 * Le niveau d'exigence d'un poste.
 *
 * Constat qui a motivé D64 : la sélection et le scoring travaillaient sur des
 * codes d'activité, si bien qu'un poste de contrôleur de gestion junior
 * mono-site et une responsabilité du contrôle de gestion groupe sur douze
 * filiales obtenaient la même note — mêmes thèmes, même couverture. Ce qui
 * distingue les deux n'est pas le sujet mais l'exigence.
 *
 * Deux sources, dans cet ordre : ce que l'annonce dit explicitement, puis ce
 * que son intitulé et ses chiffres laissent déduire. La provenance est
 * toujours affichée — un niveau deviné ne doit pas se faire passer pour un
 * niveau lu.
 */

export type Seniorite = "junior" | "confirme" | "senior" | "responsable";

export const LIBELLES_SENIORITE: Record<Seniorite, string> = {
  junior: "Junior / débutant accepté",
  confirme: "Confirmé",
  senior: "Senior",
  responsable: "Responsable / encadrement",
};

/**
 * Années d'expérience qu'un niveau suppose, quand l'annonce n'en chiffre pas.
 *
 * Ce ne sont pas des seuils du marché : ce sont les valeurs qui permettent de
 * noter une offre muette sur l'expérience autrement qu'en lui donnant une
 * note neutre inventée.
 */
export const ANNEES_IMPLICITES: Record<Seniorite, number> = {
  junior: 0,
  confirme: 3,
  senior: 5,
  responsable: 7,
};

const ORDRE: Seniorite[] = ["junior", "confirme", "senior", "responsable"];

/** Le plus exigeant des deux niveaux. */
function plusHaut(a: Seniorite, b: Seniorite): Seniorite {
  return ORDRE.indexOf(a) >= ORDRE.indexOf(b) ? a : b;
}

const INDICES: { motif: RegExp; niveau: Seniorite }[] = [
  { motif: /\bresponsable\b|\bdirecteur\b|\bdirectrice\b|\bhead of\b|\bmanager\b|\bchef de (service|groupe)\b/, niveau: "responsable" },
  { motif: /\bsenior\b|\bexpert\b|\bconfirm[ée]\s*\+|\bexp[ée]riment[ée]\b/, niveau: "senior" },
  { motif: /\bconfirm[ée]\b|\bautonome\b/, niveau: "confirme" },
  { motif: /\bjunior\b|\bd[ée]butant\b|\bpremi[èe]re exp[ée]rience\b|\bjeune dipl[ôo]m[ée]\b|\balternan|\bstage\b/, niveau: "junior" },
];

export interface NiveauDuPoste {
  niveau: Seniorite | null;
  /** D'où vient la valeur : ce qui est écrit, ou ce qu'on en déduit. */
  source: "annonce" | "intitule" | "annees" | "encadrement" | "inconnu";
  explication: string;
}

/**
 * Détermine le niveau d'un poste à partir de ce qu'on sait de l'annonce.
 *
 * L'ordre des sources n'est pas négociable : une mention explicite l'emporte
 * sur une déduction, et un encadrement annoncé l'emporte sur un intitulé
 * trompeur — beaucoup d'annonces intitulées « Contrôleur de gestion » décrivent
 * en réalité un poste d'encadrement.
 */
export function niveauDuPoste(offre: {
  seniorite?: string | null;
  intitule?: string | null;
  annees_experience?: number | null;
  encadrement?: number | null;
}): NiveauDuPoste {
  const declare = (offre.seniorite ?? "") as Seniorite;
  if (ORDRE.includes(declare)) {
    return {
      niveau: declare,
      source: "annonce",
      explication: `Niveau annoncé : ${LIBELLES_SENIORITE[declare].toLowerCase()}.`,
    };
  }

  if ((offre.encadrement ?? 0) > 0) {
    return {
      niveau: "responsable",
      source: "encadrement",
      explication: `Déduit de l'encadrement annoncé (${offre.encadrement} personne${
        (offre.encadrement ?? 0) > 1 ? "s" : ""
      }).`,
    };
  }

  const titre = normaliser(offre.intitule ?? "");
  const trouve = INDICES.find((i) => i.motif.test(titre));
  if (trouve) {
    return {
      niveau: trouve.niveau,
      source: "intitule",
      explication: `Déduit de l'intitulé du poste — ${LIBELLES_SENIORITE[
        trouve.niveau
      ].toLowerCase()}.`,
    };
  }

  const annees = offre.annees_experience;
  if (typeof annees === "number" && annees > 0) {
    const niveau: Seniorite =
      annees >= 7 ? "responsable" : annees >= 5 ? "senior" : annees >= 2 ? "confirme" : "junior";
    return {
      niveau,
      source: "annees",
      explication: `Déduit des ${annees} an${annees > 1 ? "s" : ""} d'expérience demandés.`,
    };
  }

  return {
    niveau: null,
    source: "inconnu",
    explication:
      "L'annonce ne dit rien du niveau attendu, ni par son intitulé, ni par une durée d'expérience.",
  };
}

/**
 * Le niveau tiré du texte complet de l'annonce.
 *
 * Utilisé à l'extraction seulement, en dernier recours : le corps d'une
 * annonce parle plus souvent du niveau que son intitulé.
 */
export function niveauDansLeTexte(contenu: string): Seniorite | null {
  const t = normaliser(contenu);
  let trouve: Seniorite | null = null;
  for (const i of INDICES) {
    if (i.motif.test(t)) trouve = trouve ? plusHaut(trouve, i.niveau) : i.niveau;
  }
  return trouve;
}
