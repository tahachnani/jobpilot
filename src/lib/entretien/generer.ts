import { creerClientServeur } from "@/lib/supabase/server";
import { appelIA, analyserJson, ErreurIA, MODELE_REDACTION } from "@/lib/anthropic";
import { ErreurCV } from "@/lib/cv/generer";
import { purgerAnciennesVersions } from "@/lib/documents";
import { LIBELLES_SENIORITE, niveauDuPoste } from "@/lib/seniorite";
import type { OffreExtraite } from "@/lib/extraction-offre";
import type { Ecart, Potentiel } from "@/lib/cv/ecart";
import type { Resultat } from "@/lib/scoring";

/**
 * La fiche de préparation d'entretien (D70).
 *
 * C'est le seul endroit de l'application où les écarts servent à autre chose
 * qu'à décider d'une ligne de CV. Un recruteur qui convoque a lu le CV : il va
 * demander ce que le CV ne dit pas, et chercher ce qui manque. L'application
 * sait précisément ce qui manque — elle l'a calculé.
 *
 * Les règles sont celles de la lettre, en plus strictes sur un point : la
 * fiche ne fabrique aucune réponse toute faite. Elle pose les questions et
 * rappelle les faits du parcours qui permettent d'y répondre. Une réponse
 * apprise par cœur s'entend ; un fait qu'on a sous la main se raconte.
 */

export interface Preparation {
  /** Ce que le poste attend, en une phrase, tel que l'annonce le dit. */
  attendu: string;
  /** Questions probables, avec ce sur quoi s'appuyer pour répondre. */
  questions: { question: string; appui: string }[];
  /** Points faibles annoncés d'avance, avec la façon de les aborder. */
  fragilites: { point: string; posture: string }[];
  /** Chiffres et faits du parcours à avoir en tête. */
  aRetenir: string[];
  /** Questions à poser au recruteur. */
  aPoser: string[];
}

const SYSTEME = `Tu prépares un candidat à un entretien d'embauche en contrôle de gestion ou comptabilité, en français.

RÈGLES ABSOLUES :
- Tu n'inventes aucun fait sur le candidat. Tu ne cites que ce qui figure dans le dossier fourni : missions, chiffres, outils, employeurs. Si un chiffre n'y est pas, tu ne le mets pas.
- Tu ne rédiges jamais de réponse toute faite. Pour chaque question, tu indiques sur quoi le candidat peut s'appuyer — une mission précise, un chiffre, un outil — et lui formule la réponse lui-même.
- Tu ne minimises pas les écarts et tu ne conseilles jamais de les cacher. Un écart s'aborde de front, avec ce qui le compense.
- Pas de conseil générique sur la tenue, la ponctualité ou le sourire. Uniquement ce qui tient à ce poste et à ce parcours.
- Tu réponds uniquement par un objet JSON, sans texte autour, sans balises de code.

FORMAT DE RÉPONSE :
{
  "attendu": string,
  "questions": [{ "question": string, "appui": string }],
  "fragilites": [{ "point": string, "posture": string }],
  "aRetenir": [string],
  "aPoser": [string]
}

PRÉCISIONS :
- questions : six au maximum, les plus probables compte tenu des missions de l'annonce. "appui" nomme la mission ou le chiffre du dossier sur lequel s'appuyer, jamais une réponse rédigée.
- fragilites : trois au maximum, tirées des écarts mesurés qui te sont donnés. "posture" dit comment l'aborder honnêtement, avec ce qui compense.
- aRetenir : cinq au maximum. Uniquement des chiffres et faits présents dans le dossier, reformulés courts, prêts à être cités de mémoire.
- aPoser : trois au maximum. Des questions qui montrent qu'on a lu l'annonce et compris l'enjeu du poste, jamais sur le salaire ou les congés.`;

export async function genererPreparationPourOffre(
  offreId: string
): Promise<{ preparation: Preparation; version: number; coutUsd: number }> {
  const supabase = creerClientServeur();

  const { data: offreBrute } = await supabase
    .from("offres")
    .select("id, volet, intitule, entreprise")
    .eq("id", offreId)
    .maybeSingle();
  if (!offreBrute) throw new ErreurCV("Offre introuvable.");
  const offre = offreBrute as {
    volet: string;
    intitule: string | null;
    entreprise: string | null;
  };

  const [{ data: analyseBrute }, { data: scoreBrut }, { data: docsBruts }] =
    await Promise.all([
      supabase
        .from("offre_analyses")
        .select("resultat")
        .eq("offre_id", offreId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("scores")
        .select("detail")
        .eq("offre_id", offreId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("documents")
        .select("type, contenu_texte, selection, version")
        .eq("offre_id", offreId)
        .in("type", ["cv", "lettre"])
        .order("version", { ascending: false }),
    ]);

  const analyse = (analyseBrute as { resultat: OffreExtraite } | null)?.resultat;
  if (!analyse) {
    throw new ErreurCV(
      "Cette offre n'a pas d'analyse stockée : la préparation n'aurait rien à se mettre sous la dent."
    );
  }

  const documents = (docsBruts ?? []) as {
    type: string;
    contenu_texte: string | null;
    selection: { ecart?: Ecart; potentiel?: Potentiel } | null;
  }[];

  const cv = documents.find((d) => d.type === "cv");
  const lettre = documents.find((d) => d.type === "lettre");
  if (!cv?.contenu_texte) {
    throw new ErreurCV(
      "Aucun CV n'a été généré pour cette offre : génère-le d'abord, la préparation s'appuie dessus."
    );
  }

  const score = (scoreBrut as { detail: Resultat } | null)?.detail ?? null;
  const potentiel = cv.selection?.potentiel;
  const ecart = cv.selection?.ecart;

  const niveau = niveauDuPoste(analyse);

  /** Les manques mesurés, seule matière autorisée pour les fragilités. */
  const manques = [
    ...(potentiel?.horsPortee ?? []),
    ...(score?.competences.lignes ?? [])
      .filter((l) => l.note === 0)
      .map((l) => l.libelle),
    ...(score?.missions.lignes ?? [])
      .filter((l) => l.note === 0)
      .map((l) => l.libelle),
  ];

  const message = `ENTRETIEN À PRÉPARER

Poste : ${analyse.intitule ?? offre.intitule ?? "—"}
Entreprise : ${analyse.entreprise ?? offre.entreprise ?? "—"}
Niveau du poste : ${
    niveau.niveau ? LIBELLES_SENIORITE[niveau.niveau] : "non déterminé"
  } (${niveau.explication})
Périmètre annoncé : ${analyse.perimetre ?? "non précisé"}

MISSIONS DEMANDÉES PAR L'ANNONCE :
${analyse.missions.map((m) => `- [importance ${m.importance}/3] ${m.texte}`).join("\n")}

COMPÉTENCES DEMANDÉES :
${analyse.competences.map((c) => `- ${c.libelle} (${c.caractere})`).join("\n")}

LE CV ENVOYÉ (seule source de faits sur le candidat) :
${cv.contenu_texte}

${lettre?.contenu_texte ? `LA LETTRE ENVOYÉE :\n${lettre.contenu_texte}\n` : ""}
ÉCARTS MESURÉS PAR L'APPLICATION — c'est là-dessus que porteront les questions difficiles :
${manques.length > 0 ? manques.map((m) => `- ${m}`).join("\n") : "- Aucun écart mesuré."}
${
  ecart?.missionsEcartees?.length
    ? `\nCE QUE LE CV N'A PAS PU MONTRER, FAUTE DE PLACE (le candidat l'a pourtant fait) :\n${ecart.missionsEcartees
        .map((m) => `- ${m}`)
        .join("\n")}`
    : ""
}

Prépare la fiche.`;

  const reponse = await appelIA({
    modele: MODELE_REDACTION,
    systeme: SYSTEME,
    message,
    // Le modèle émet un raisonnement invisible compté en sortie : trois pannes
    // de cette application ont eu exactement cette cause.
    maxTokens: 12000,
    tache: "preparation_entretien",
    offreId,
  });

  const brut = analyserJson<Partial<Preparation>>(reponse.texte);
  if (!Array.isArray(brut.questions) || brut.questions.length === 0) {
    throw new ErreurIA(
      `La préparation rendue est inexploitable. Début reçu : ${reponse.texte.slice(0, 200)}`
    );
  }

  const liste = (v: unknown, max: number): string[] =>
    Array.isArray(v) ? v.filter((x) => typeof x === "string").slice(0, max) : [];

  const preparation: Preparation = {
    attendu: String(brut.attendu ?? "").trim(),
    questions: (brut.questions ?? [])
      .filter((q) => q && typeof q.question === "string")
      .slice(0, 6)
      .map((q) => ({
        question: String(q.question).trim(),
        appui: String(q.appui ?? "").trim(),
      })),
    fragilites: (brut.fragilites ?? [])
      .filter((f) => f && typeof f.point === "string")
      .slice(0, 3)
      .map((f) => ({
        point: String(f.point).trim(),
        posture: String(f.posture ?? "").trim(),
      })),
    aRetenir: liste(brut.aRetenir, 5),
    aPoser: liste(brut.aPoser, 3),
  };

  const { data: derniere } = await supabase
    .from("documents")
    .select("version")
    .eq("offre_id", offreId)
    .eq("type", "preparation")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const version = ((derniere as { version: number } | null)?.version ?? 0) + 1;

  await supabase.from("documents").insert({
    offre_id: offreId,
    type: "preparation",
    volet: offre.volet,
    version,
    contenu_texte: preparationEnTexte(preparation),
    selection: { preparation },
    cout_usd: reponse.coutUsd,
  });

  await purgerAnciennesVersions(offreId, "preparation");

  return { preparation, version, coutUsd: reponse.coutUsd };
}

/** La fiche en texte simple, pour la copier ou la relire hors de l'écran. */
export function preparationEnTexte(p: Preparation): string {
  const bloc = (titre: string, lignes: string[]) =>
    lignes.length > 0 ? `${titre}\n${lignes.join("\n")}\n` : "";

  return [
    p.attendu ? `CE QUE LE POSTE ATTEND\n${p.attendu}\n` : "",
    bloc(
      "QUESTIONS PROBABLES",
      p.questions.map((q) => `- ${q.question}\n  S'appuyer sur : ${q.appui}`)
    ),
    bloc(
      "CE QUI VA ÊTRE CHERCHÉ",
      p.fragilites.map((f) => `- ${f.point}\n  ${f.posture}`)
    ),
    bloc(
      "À AVOIR EN TÊTE",
      p.aRetenir.map((x) => `- ${x}`)
    ),
    bloc(
      "À POSER AU RECRUTEUR",
      p.aPoser.map((x) => `- ${x}`)
    ),
  ]
    .filter(Boolean)
    .join("\n");
}
