import { chargerTaxonomie, codesActifs } from "@/lib/taxonomie";
import { SECTEURS } from "@/config/secteurs";
import {
  appelIA,
  analyserJson,
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
  /**
   * Le niveau d'exigence du poste (D64). Null quand l'annonce n'en dit rien :
   * il est alors déduit ailleurs, et la déduction est affichée comme telle.
   */
  seniorite: "junior" | "confirme" | "senior" | "responsable" | null;
  /** Nombre de personnes encadrées, si l'annonce le chiffre. */
  encadrement: number | null;
  /** Ce que l'annonce dit du périmètre : entités, sites, budget piloté. */
  perimetre: string | null;
  formation: string | null;
  langues: string[];
  mots_cles_ats: string[];
}


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

const SENIORITES = ["junior", "confirme", "senior", "responsable"];

function senioriteValide(v: unknown): OffreExtraite["seniorite"] {
  const s = String(v ?? "").toLowerCase().trim();
  return (SENIORITES.includes(s) ? s : null) as OffreExtraite["seniorite"];
}

function nombreValide(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
const CODES_SECTEURS = Object.keys(SECTEURS);

/**
 * Le prompt système est désormais construit à l'appel (D74).
 *
 * La liste des codes vient de la table, pas du fichier : ajouter
 * « amélioration continue » depuis l'écran Taxonomie doit suffire pour que le
 * modèle sache classer une mission dedans, sans redéploiement.
 */
const systeme = (codes: string[]) => `Tu extrais des données structurées d'offres d'emploi françaises en finance, contrôle de gestion et comptabilité.

RÈGLES ABSOLUES :
- Tu n'inventes rien. Un champ absent de l'offre vaut null, jamais une estimation.
- Tu ne déduis pas un salaire, une localisation ou une durée d'expérience qui ne sont pas écrits.
- Tu classes chaque mission dans la liste fermée de codes fournie. Aucun code inventé.
- Tu réponds uniquement par un objet JSON, sans texte autour, sans balises de code.

CODES D'ACTIVITÉ AUTORISÉS :
${codes.join(", ")}

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
  "seniorite": "junior"|"confirme"|"senior"|"responsable"|null,
  "encadrement": number|null,
  "perimetre": string|null,
  "formation": string|null,
  "langues": [string],
  "mots_cles_ats": [string]
}

PRÉCISIONS :
- importance 3 = mission centrale du poste, 2 = importante, 1 = accessoire.
- caractere "indispensable" seulement si l'offre l'exige explicitement (requis, impératif, indispensable, maîtrise exigée).
- competences : uniquement des savoir-faire ou des connaissances que le candidat pourrait revendiquer sur un CV. Un type d'entreprise, un secteur ou un contexte de travail n'en est pas un : « expérience en environnement industriel » ou « en grand groupe » relève du secteur, pas de la compétence, et n'a rien à faire dans cette liste.
- Un libellé de compétence tient en quelques mots et se suffit à lui-même. N'y mets pas de phrase entière, et ne mets pas plusieurs compétences dans un même libellé séparées par des virgules : fais-en autant d'entrées distinctes. Une parenthèse d'exemples — « (CIR, subventions, brevets) » — reste attachée à son libellé, elle ne se découpe pas.
- annees_experience : le nombre minimal demandé. Si l'offre dit "débutant accepté" ou ne précise rien, mets null.
- seniorite : le niveau d'exigence du poste. "junior" si débutant accepté ou première expérience, "confirme" si autonomie attendue sur le métier, "senior" si expertise ou référent, "responsable" si le poste encadre ou pilote une équipe. Mets null si l'annonce ne permet pas de trancher — ne devine pas à partir du seul intitulé.
- encadrement : le nombre de personnes encadrées, uniquement s'il est écrit. Sinon null.
- perimetre : une phrase courte reprenant ce que l'annonce dit de l'étendue du poste — nombre d'entités, de sites, de filiales, montant du budget ou du chiffre d'affaires suivi. Uniquement ce qui est écrit, jamais une estimation. Sinon null.
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

  // La taxonomie est lue à chaque extraction : le modèle doit classer dans la
  // liste d'aujourd'hui, pas dans celle du dernier déploiement.
  const taxonomie = await chargerTaxonomie();
  const codesAutorises = codesActifs(taxonomie);

  const r = await appelIA({
    modele: MODELE_EXTRACTION,
    systeme: systeme(codesAutorises),
    message: `Voici l'offre d'emploi à extraire :\n\n${contenu.slice(0, 40000)}`,
    // 4000 a été la limite exacte de trois troncatures ailleurs dans l'app :
    // une offre longue avec beaucoup de missions y arrive aussi.
    maxTokens: 8000,
    tache: "extraction_offre",
    offreId,
  });

  const brut = analyserJson<Partial<OffreExtraite>>(r.texte);

  // Nettoyage : on écarte tout code hors taxonomie plutôt que de le stocker.
  const missions: MissionOffre[] = (brut.missions ?? [])
    .filter((m) => m && typeof m.texte === "string" && m.texte.trim().length > 0)
    .map((m) => ({
      texte: m.texte.trim(),
      codes: (m.codes ?? []).filter((c) => codesAutorises.includes(c)),
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
    seniorite: senioriteValide(brut.seniorite),
    encadrement: nombreValide(brut.encadrement),
    perimetre:
      typeof brut.perimetre === "string" && brut.perimetre.trim().length > 2
        ? brut.perimetre.trim().slice(0, 300)
        : null,
    formation: brut.formation ?? null,
    langues: brut.langues ?? [],
    mots_cles_ats: brut.mots_cles_ats ?? [],
  };

  return { donnees, coutUsd: r.coutUsd, modele: MODELE_EXTRACTION };
}
