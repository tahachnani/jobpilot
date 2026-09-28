/**
 * D'où vient une candidature, et par quel canal on la relance (D83, D84).
 *
 * Le commentaire libre saisi à l'envoi ne servait à rien : on n'a jamais
 * rien à y écrire au moment où l'on clique. Une liste fermée, elle, se
 * compte — et couplée aux issues de D68, elle répond à la seule question qui
 * vaille : quel canal donne des entretiens.
 *
 * La liste est volontairement courte. Les cabinets spécialisés en finance
 * passent sous « Cabinet de recrutement » : distinguer Fed Finance de Robert
 * Half n'apprendrait rien qu'on ne sache déjà.
 */

export interface GroupeOrigine {
  titre: string;
  codes: string[];
}

export const ORIGINES: Record<string, string> = {
  apec: "APEC",
  welcome: "Welcome to the Jungle",
  hellowork: "HelloWork",
  indeed: "Indeed",
  linkedin: "LinkedIn",
  monster: "Monster",
  cadremploi: "Cadremploi",
  glassdoor: "Glassdoor",
  talent: "Talent.com",
  france_travail: "France Travail",
  jobteaser: "JobTeaser",

  site_carriere: "Site carrière de l'entreprise",
  spontanee: "Candidature spontanée",
  cooptation: "Cooptation ou réseau",
  cabinet: "Cabinet de recrutement",
  autre: "Autre",
};

/** Regroupement d'affichage : le sélecteur reste lisible à seize entrées. */
export const GROUPES_ORIGINE: GroupeOrigine[] = [
  {
    titre: "Plateformes",
    codes: [
      "apec",
      "welcome",
      "hellowork",
      "indeed",
      "linkedin",
      "monster",
      "cadremploi",
      "glassdoor",
      "talent",
      "france_travail",
      "jobteaser",
    ],
  },
  {
    titre: "Hors plateforme",
    codes: ["site_carriere", "spontanee", "cooptation", "cabinet", "autre"],
  },
];

/** Libellé d'une origine, ou le code brut s'il est inconnu. */
export function libelleOrigine(code: string | null): string | null {
  if (!code) return null;
  return ORIGINES[code] ?? code;
}

/**
 * Par où relancer (D83).
 *
 * La plupart des plateformes ne donnent aucune adresse : la relance passe par
 * leur messagerie, ou par LinkedIn. Le canal change ce qu'on écrit — un
 * message LinkedIn fait quatre lignes, un email en fait quinze — donc il est
 * demandé avant la rédaction, pas après.
 */
export const CANAUX_RELANCE: Record<string, string> = {
  plateforme: "Messagerie de la plateforme",
  linkedin: "LinkedIn",
  email: "Email",
  telephone: "Téléphone",
};

export const CANAL_PAR_DEFAUT = "plateforme";

/** Ce que le canal impose à la rédaction. Repris tel quel dans le prompt. */
export const CONSIGNES_CANAL: Record<string, string> = {
  plateforme:
    "Message court dans la messagerie d'un site d'emploi : quatre à six lignes, pas d'objet, pas de formule d'adresse solennelle. Le destinataire voit déjà la candidature à côté.",
  linkedin:
    "Message LinkedIn : quatre lignes maximum, ton direct et poli, pas d'objet, pas de formule de politesse longue. Le destinataire est une personne, pas un service.",
  email:
    "Email de relance classique : objet court rappelant le poste, formule d'appel, dix à quinze lignes, formule de politesse.",
  telephone:
    "Ce n'est pas un message à envoyer mais un aide-mémoire pour un appel : l'accroche en une phrase, les deux points à dire, la question à poser. Pas de formule écrite.",
};
