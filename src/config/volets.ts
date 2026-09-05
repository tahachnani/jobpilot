/**
 * Configuration métier des deux volets.
 * Versionnée dans Git plutôt qu'en base (décision D11) : relisible et réversible.
 */

export type CodeVolet = "cdg" | "compta";

export interface ConfigVolet {
  code: CodeVolet;
  slug: string;
  nom: string;
  nomCourt: string;
  emoji: string;
  couleur: string;
  classeAccent: string;
  intitulesCibles: string[];
  marcheCache: boolean;
}

export const VOLETS: Record<CodeVolet, ConfigVolet> = {
  cdg: {
    code: "cdg",
    slug: "controle-gestion",
    nom: "Contrôle de gestion",
    nomCourt: "CDG",
    emoji: "🎯",
    couleur: "#2563eb",
    classeAccent: "bg-blue-600",
    intitulesCibles: [
      "Contrôleur de gestion",
      "Business Controller",
      "Contrôleur financier",
      "Analyste financier",
      "FP&A",
    ],
    marcheCache: true,
  },
  compta: {
    code: "compta",
    slug: "comptabilite",
    nom: "Comptabilité",
    nomCourt: "Compta",
    emoji: "📊",
    couleur: "#0d9488",
    classeAccent: "bg-teal-600",
    intitulesCibles: [
      "Comptable",
      "Comptable général",
      "Comptable fournisseurs",
      "Comptable clients",
      "Gestionnaire comptable",
    ],
    marcheCache: false,
  },
};

export const LISTE_VOLETS = Object.values(VOLETS);

/** Retourne la config d'un volet à partir de son slug d'URL, ou null. */
export function voletDepuisSlug(slug: string): ConfigVolet | null {
  return LISTE_VOLETS.find((v) => v.slug === slug) ?? null;
}

/**
 * Libellés des statuts. L'ordre reflète le cycle de vie de la spécification (§2.4).
 * `envoyee` n'est jamais atteint automatiquement.
 */
export const STATUTS: Record<string, { libelle: string; classe: string }> = {
  enregistree: { libelle: "Offre enregistrée", classe: "bg-ardoise-100 text-ardoise-700" },
  analysee: { libelle: "Offre analysée", classe: "bg-sky-100 text-sky-800" },
  cv_genere: { libelle: "CV généré", classe: "bg-indigo-100 text-indigo-800" },
  lettre_generee: { libelle: "Lettre générée", classe: "bg-violet-100 text-violet-800" },
  email_genere: { libelle: "Email généré", classe: "bg-fuchsia-100 text-fuchsia-800" },
  envoyee: { libelle: "Candidature envoyée", classe: "bg-amber-100 text-amber-900" },
  entretien: { libelle: "Entretien", classe: "bg-emerald-100 text-emerald-800" },
  refusee: { libelle: "Refusée", classe: "bg-rose-100 text-rose-800" },
  sans_reponse: { libelle: "Sans réponse", classe: "bg-ardoise-100 text-ardoise-600" },
  cloturee: { libelle: "Offre clôturée", classe: "bg-ardoise-200 text-ardoise-700" },
};

/** Statuts qui comptent comme une candidature réellement envoyée. */
export const STATUTS_ENVOYES = [
  "envoyee",
  "entretien",
  "refusee",
  "sans_reponse",
];
