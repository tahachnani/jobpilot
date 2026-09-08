import { ACTIVITES } from "@/config/activites";
import { SECTEURS } from "@/config/secteurs";
import {
  appelIA,
  extraireJson,
  MODELE_EXTRACTION,
  ErreurIA,
} from "@/lib/anthropic";

export interface MissionOffre {
  texte: string;
  codes: string[];
  importance: number;
}

export interface CompetenceOffre {
  libelle: string;
  caractere: "indispensable" | "souhaitee";
}

export interface OffreExtraite {
  intitule: string | null;
  entreprise: string | null;
  localisation: string | null;
  departement: string | null;
  contrat: string | null;
  salaire_min: number | null;
  salaire_max: number | null;
  salaire_periode: string | null;
  teletravail: string | null;
  date_publication: string | null;
  secteur_code: string | null;
  missions: MissionOffre[];
  competences: CompetenceOffre[];
  outils: string[];
  annees_experience: number | null;
  formation: string | null;
  langues: string[];
  mots_cles_ats: string[];
}

const CODES_ACTIVITES = Object.keys(ACTIVITES);

/**
 * Ces trois champs partent directement dans des colonnes typées côté base.
 * Une valeur hors liste ferait échouer l'écriture après que l'appel IA a été
 * payé : on préfère perdre l'information que l'offre entière.
 */
const CONTRATS = [
  "cdi",
  "cdd",
  "alternance",
  "stage",
  "interim",
  "freelance",
  "autre",
];
const PERIODES = ["an", "mois"];

function contratValide(v: unknown): string | null {
  const s = String(v ?? "").toLowerCase().trim();
  return CONTRATS.includes(s) ? s : null;
}

function periodeValide(v: unknown): string | null {
  const s = String(v ?? "").toLowerCase().trim();
  return PERIODES.includes(s) ? s : null;
}

function dateValide(v: unknown): string | null {
  const s = String(v ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return Number.isNaN(new Date(s).getTime()) ? null : s;
}

function nombreValide(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
const CODES_SECTEURS = Object.keys(SECTEURS);

const SYSTEME = `Tu extrais des données structurées d'offres d'emploi françaises en finance, contrôle de gestion et comptabilité.

RÈGLES ABSOLUES :
- Tu n'inventes rien. Un champ absent de l'offre vaut null, jamais une estimation.
- Tu ne déduis pas un salaire, une localisation ou une durée d'expérience qui ne sont pas écrits.
- Tu classes chaque mission dans la liste fermée de codes fournie. Aucun code inventé.
- Tu réponds uniquement par un objet JSON, sans texte autour, sans balises de code.

CODES D'ACTIVITÉ AUTORISÉS :
${CODES_ACTIVITES.join(", ")}

CODES DE SECTEUR AUTORISÉS :
${CODES_SECTEURS.join(", ")}

FORMAT DE RÉPONSE :
{
  "intitule": string|null,
  "entreprise": string|null,
  "localisation": string|null,
  "departement": string|null,
  "contrat": "cdi"|"cdd"|"alternance"|"stage"|"interim"|"freelance"|"autre"|null,
  "salaire_min": number|null,
  "salaire_max": number|null,
  "salaire_periode": "an"|"mois"|null,
  "teletravail": string|null,
  "date_publication": "AAAA-MM-JJ"|null,
  "secteur_code": string|null,
  "missions": [{"texte": string, "codes": [string], "importance": 1|2|3}],
  "competences": [{"libelle": string, "caractere": "indispensable"|"souhaitee"}],
  "outils": [string],
  "annees_experience": number|null,
  "formation": string|null,
  "langues": [string],
  "mots_cles_ats": [string]
}

PRÉCISIONS :
- importance 3 = mission centrale du poste, 2 = importante, 1 = accessoire.
- caractere "indispensable" seulement si l'offre l'exige explicitement (requis, impératif, indispensable, maîtrise exigée).
- annees_experience : le nombre minimal demandé. Si l'offre dit "débutant accepté" ou ne précise rien, mets null.
- Une mission peut porter plusieurs codes. Si aucun code ne correspond, mets un tableau vide.`;

/** Réponse trop courte ou sans mission : extraction jugée insuffisante. */
export function extractionSuffisante(o: OffreExtraite): boolean {
  return o.missions.length > 0 || o.competences.length > 0;
}

export async function extraireOffre(
  contenu: string,
  offreId: string | null
): Promise<{ donnees: OffreExtraite; coutUsd: number; modele: string }> {
  if (contenu.trim().length < 200) {
    throw new ErreurIA(
      "Le contenu fourni est trop court pour être analysé sérieusement " +
        `(${contenu.trim().length} caractères). Colle l'offre complète.`
    );
  }

  const r = await appelIA({
    modele: MODELE_EXTRACTION,
    systeme: SYSTEME,
    message: `Voici l'offre d'emploi à extraire :\n\n${contenu.slice(0, 40000)}`,
    maxTokens: 4000,
    tache: "extraction_offre",
    offreId,
  });

  const brut = extraireJson<Partial<OffreExtraite>>(r.texte);

  // Nettoyage : on écarte tout code hors taxonomie plutôt que de le stocker.
  const missions: MissionOffre[] = (brut.missions ?? [])
    .filter((m) => m && typeof m.texte === "string" && m.texte.trim().length > 0)
    .map((m) => ({
      texte: m.texte.trim(),
      codes: (m.codes ?? []).filter((c) => CODES_ACTIVITES.includes(c)),
      importance: Math.min(3, Math.max(1, Number(m.importance) || 1)),
    }));

  const competences: CompetenceOffre[] = (brut.competences ?? [])
    .filter((c) => c && typeof c.libelle === "string")
    .map((c) => ({
      libelle: c.libelle.trim(),
      caractere: c.caractere === "indispensable" ? "indispensable" : "souhaitee",
    }));

  const secteur =
    brut.secteur_code && CODES_SECTEURS.includes(brut.secteur_code)
      ? brut.secteur_code
      : null;

  const donnees: OffreExtraite = {
    intitule: brut.intitule ?? null,
    entreprise: brut.entreprise ?? null,
    localisation: brut.localisation ?? null,
    departement: brut.departement ?? null,
    contrat: contratValide(brut.contrat),
    salaire_min: nombreValide(brut.salaire_min),
    salaire_max: nombreValide(brut.salaire_max),
    salaire_periode: periodeValide(brut.salaire_periode),
    teletravail: brut.teletravail ?? null,
    date_publication: dateValide(brut.date_publication),
    secteur_code: secteur,
    missions,
    competences,
    outils: brut.outils ?? [],
    annees_experience:
      typeof brut.annees_experience === "number" ? brut.annees_experience : null,
    formation: brut.formation ?? null,
    langues: brut.langues ?? [],
    mots_cles_ats: brut.mots_cles_ats ?? [],
  };

  return { donnees, coutUsd: r.coutUsd, modele: MODELE_EXTRACTION };
}
