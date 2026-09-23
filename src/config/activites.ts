/**
 * Le socle de la taxonomie des activités (spécification §8, puis D74).
 *
 * C'est le pivot du scoring : l'IA ne compare rien, elle classe dans cette
 * liste. La comparaison devient ensuite purement arithmétique, donc
 * reproductible.
 *
 * Depuis D74, la vérité du moteur est la table `activites`, modifiable depuis
 * l'onglet « Taxonomie ». Ce fichier garde deux rôles, et deux seulement :
 * il **amorce** la table à la migration 0011, et il sert de **repli** quand
 * celle-ci est vide ou inatteignable — un score doit rester calculable.
 *
 * Il ne faut donc plus lire cette liste pour afficher un libellé : passer par
 * `libelleDe` de `@/lib/taxonomie`, sans quoi un code ajouté à l'usage
 * s'afficherait sous sa forme brute.
 */

export type CodeActivite = keyof typeof ACTIVITES;

export const ACTIVITES = {
  // Contrôle de gestion
  reporting: { libelle: "Reporting", famille: "cdg" },
  budget: { libelle: "Budget", famille: "cdg" },
  previsionnel: { libelle: "Prévisionnel", famille: "cdg" },
  analyse_ecarts: { libelle: "Analyse des écarts", famille: "cdg" },
  tableaux_bord: { libelle: "Tableaux de bord", famille: "cdg" },
  kpi: { libelle: "KPI", famille: "cdg" },
  couts_revient: { libelle: "Coûts de revient", famille: "cdg" },
  marges: { libelle: "Marges", famille: "cdg" },
  rentabilite: { libelle: "Rentabilité", famille: "cdg" },
  analyse_financiere: { libelle: "Analyse financière", famille: "cdg" },
  business_partner: { libelle: "Business partner", famille: "cdg" },
  consolidation: { libelle: "Consolidation", famille: "cdg" },
  tresorerie: { libelle: "Trésorerie", famille: "cdg" },
  investissements: { libelle: "Investissements", famille: "cdg" },

  // Comptabilité
  compta_generale: { libelle: "Comptabilité générale", famille: "compta" },
  compta_analytique: { libelle: "Comptabilité analytique", famille: "compta" },
  compta_fournisseurs: { libelle: "Comptabilité fournisseurs", famille: "compta" },
  compta_clients: { libelle: "Comptabilité clients", famille: "compta" },
  rapprochements: { libelle: "Rapprochements", famille: "compta" },
  lettrage: { libelle: "Lettrage", famille: "compta" },
  cloture: { libelle: "Clôture", famille: "compta" },
  revision: { libelle: "Révision", famille: "compta" },
  declarations_fiscales: { libelle: "Déclarations fiscales", famille: "compta" },
  tva: { libelle: "TVA", famille: "compta" },
  paie: { libelle: "Paie", famille: "compta" },
  immobilisations: { libelle: "Immobilisations", famille: "compta" },

  // Transverse
  fiabilisation_donnees: { libelle: "Fiabilisation des données", famille: "transverse" },
  audit_interne: { libelle: "Audit interne", famille: "transverse" },
  parametrage_erp: { libelle: "Paramétrage ERP", famille: "transverse" },
  automatisation: { libelle: "Automatisation", famille: "transverse" },
} as const;

export const CATEGORIES_COMPETENCE: Record<string, string> = {
  outil: "Outils et logiciels",
  cdg: "Contrôle de gestion",
  compta: "Comptabilité",
  transversale: "Compétences transversales",
  langue: "Langues",
};

export const LIBELLES_CONTRAT: Record<string, string> = {
  cdi: "CDI",
  cdd: "CDD",
  alternance: "Alternance",
  stage: "Stage",
  interim: "Intérim",
  freelance: "Freelance",
  autre: "Autre",
};
