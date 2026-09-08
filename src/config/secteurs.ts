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

/** Familles sectorielles : deux secteurs d'une même famille sont proches. */
const FAMILLES: Record<string, string[]> = {
  immobilier: ["immobilier_social", "immobilier", "btp"],
  industrie: ["industrie", "industrie_textile", "agroalimentaire", "energie"],
  finance: ["banque_assurance", "expertise_comptable"],
  services: ["services", "conseil", "tech", "distribution", "transport_logistique"],
  public: ["public", "association", "sante"],
};

/** Secteurs qui recrutent tous les profils, donc jamais vraiment éloignés. */
const TRANSVERSES = ["conseil", "expertise_comptable", "services"];

function famille(code: string): string | null {
  for (const [nom, membres] of Object.entries(FAMILLES)) {
    if (membres.includes(code)) return nom;
  }
  return null;
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

  const fOffre = famille(secteurOffre);
  if (fOffre && secteursProfil.some((s) => famille(s) === fOffre)) {
    return {
      note: 75,
      explication: `Même famille sectorielle que ton parcours (${libelle}).`,
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
