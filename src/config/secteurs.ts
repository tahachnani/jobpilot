/**
 * Liste fermée des secteurs et table de proximité.
 * Même principe que la taxonomie des activités : l'IA classe, le code calcule.
 */

export const SECTEURS: Record<string, string> = {
  immobilier_social: "Immobilier social",
  immobilier: "Immobilier",
  btp: "BTP / Construction",
  industrie: "Industrie",
  industrie_textile: "Industrie textile",
  agroalimentaire: "Agroalimentaire",
  energie: "Énergie",
  banque_assurance: "Banque / Assurance",
  expertise_comptable: "Expertise comptable",
  conseil: "Conseil",
  services: "Services",
  tech: "Tech / Numérique",
  distribution: "Distribution / Retail",
  transport_logistique: "Transport / Logistique",
  sante: "Santé / Médico-social",
  public: "Secteur public",
  association: "Association",
  autre: "Autre",
};

/**
 * Familles sectorielles : deux secteurs d'une même famille sont proches.
 *
 * **Un secteur peut appartenir à plusieurs familles** (D116), et c'est la
 * correction du 2 octobre. L'immobilier social relevait de la seule famille
 * « immobilier » ; une offre de l'ANCOLS, classée « secteur public », tombait
 * donc à 40 sur 100 avec la mention « Secteur public est éloigné de ton
 * parcours » — pour un candidat qui a passé dix-huit mois dans un office
 * **public** de l'habitat.
 *
 * L'erreur n'était pas dans le classement de l'offre ni dans celui du
 * parcours : les deux étaient justes. Elle était dans la structure, qui forçait
 * chaque secteur dans une case unique alors que certains en occupent deux.
 * Un OPH est un établissement public qui fait de l'immobilier ; le ranger d'un
 * côté revenait à nier l'autre.
 *
 * Les ESH, elles, sont des sociétés privées : la proximité avec le secteur
 * public est donc réelle sans être une identité. Elle vaut 75, pas 100.
 */
const FAMILLES: Record<string, string[]> = {
  immobilier: ["immobilier_social", "immobilier", "btp"],
  industrie: ["industrie", "industrie_textile", "agroalimentaire", "energie"],
  finance: ["banque_assurance", "expertise_comptable"],
  services: ["services", "conseil", "tech", "distribution", "transport_logistique"],
  public: ["public", "association", "sante", "immobilier_social"],
};

/**
 * Le secteur de l'offre appartient-il à cette famille (D132) ?
 *
 * Sert aux libellés de compétence qui revendiquent un secteur : « Contrôle de
 * gestion industriel » n'a de sens que face à une offre de la famille
 * `industrie`. Un secteur absent ou inconnu répond non — on ne revendique pas
 * une spécialité que l'annonce n'a pas réclamée.
 */
export function secteurDansFamille(
  code: string | null | undefined,
  famille: string
): boolean {
  if (!code) return false;
  return (FAMILLES[famille] ?? []).includes(code);
}

/** Secteurs qui recrutent tous les profils, donc jamais vraiment éloignés. */
const TRANSVERSES = ["conseil", "expertise_comptable", "services"];

/** Les familles d'un secteur. Plusieurs, parfois : voir FAMILLES. */
function famillesDe(code: string): string[] {
  return Object.entries(FAMILLES)
    .filter(([, membres]) => membres.includes(code))
    .map(([nom]) => nom);
}

/**
 * Note de proximité entre le secteur d'une offre et ceux du profil.
 * On retient la meilleure correspondance : une seule expérience dans le
 * bon secteur suffit à être pertinent.
 */
export function noteSecteur(
  secteurOffre: string | null,
  secteursProfil: string[]
): { note: number; explication: string } {
  if (!secteurOffre || !SECTEURS[secteurOffre]) {
    return {
      note: 70,
      explication: "Secteur non identifiable dans l'offre — valeur neutre.",
    };
  }

  const libelle = SECTEURS[secteurOffre];

  if (secteursProfil.includes(secteurOffre)) {
    return { note: 100, explication: `Secteur identique : ${libelle}.` };
  }

  /**
   * Le secteur du parcours qui fait le pont, et non le simple fait qu'il y en
   * ait un. « Même famille sectorielle » n'apprenait rien et ne se vérifiait
   * pas ; nommer les deux bouts permet de juger si le rapprochement tient.
   */
  const famillesOffre = famillesDe(secteurOffre);
  const pont = secteursProfil.find((s) =>
    famillesDe(s).some((f) => famillesOffre.includes(f))
  );
  if (pont) {
    return {
      note: 75,
      explication:
        `Proche de ton parcours : ton expérience en ${SECTEURS[pont] ?? pont} ` +
        `relève de la même famille que ${libelle}.`,
    };
  }

  if (TRANSVERSES.includes(secteurOffre)) {
    return {
      note: 60,
      explication: `${libelle} recrute des profils de tous horizons.`,
    };
  }

  return {
    note: 40,
    explication: `${libelle} est éloigné de ton parcours.`,
  };
}
