import { creerClientServeur } from "@/lib/supabase/server";
import { appelIA, ErreurIA, MODELE_REDACTION } from "@/lib/anthropic";
import type { CodeVolet } from "@/config/volets";
import type { OffreExtraite } from "@/lib/extraction-offre";
import { chargerDonneesCV } from "@/lib/cv/donnees";
import { choisirNiveau } from "@/lib/cv/compacite";
import { controler, type Verdict } from "@/lib/cv/controle";
import { chargerCorpus, corpusEnTexte } from "@/lib/cv/corpus";
import { ErreurCV } from "@/lib/cv/generer";
import { extraireJson } from "@/lib/extraction-json";

/**
 * Reformulation des missions d'un CV pour une offre donnée.
 *
 * L'IA ne réécrit pas le parcours : elle redit chaque mission avec les mots de
 * l'annonce. Ce qu'elle propose passe d'abord un contrôle arithmétique, puis
 * sous les yeux de Taha. Rien n'entre dans un CV sans les deux.
 */

const SYSTEME = `Tu es un rédacteur de CV spécialisé en contrôle de gestion et en comptabilité. Tu adaptes des missions déjà vécues au vocabulaire d'une offre précise.

TA SEULE RAISON D'ÊTRE
Faire apparaître dans une mission un terme que l'annonce emploie et que la mission ne dit pas encore. Une reformulation qui se contente de changer un adjectif, de déplacer une proposition ou de remplacer "chaque semaine" par "hebdomadaire" ne sert à rien : elle sera rejetée automatiquement. Si tu ne vois aucun terme de l'annonce à faire entrer, renvoie le texte d'origine inchangé.

OÙ PRENDRE LA MATIÈRE
Chaque expérience est accompagnée de son CORPUS : le détail de ce qui y a été fait, plus riche que ce que la mission dit. Tu peux employer un terme du corpus de CETTE expérience même s'il est absent de la mission. C'est le même travail dit plus précisément.

Le corpus d'une expérience n'autorise rien dans la mission d'une autre. Ce qui a été fait chez un employeur ne se transporte pas chez un autre.

CE QUE TU NE PEUX PAS FAIRE
- ajouter un chiffre, un pourcentage, un volume, une durée absent de l'original
- retirer un chiffre présent dans l'original
- ajouter un outil, un logiciel, un ERP, un sigle qui ne soit ni dans l'original ni dans le corpus de cette expérience
- effacer un sigle de l'original : KPI reste KPI, CODIR reste CODIR, ULIS reste ULIS
- supprimer un élément d'énumération ou un qualificatif de périmètre
- nominaliser : si l'original commence par un participe passé, ta phrase aussi

FORME
- français professionnel, une seule phrase par mission
- longueur au plus égale à l'original, jamais plus de 20 % au-dessus
- pas de "notamment", "activement", "rigoureux", "diverses", pas de première personne
- verbe d'action précis, vocabulaire du métier

Tu réponds UNIQUEMENT par un tableau JSON, sans préambule ni balises de code :
[{"id": "<identifiant fourni>", "texte": "<reformulation>"}]`;

export interface PropositionEnregistree {
  missionId: string;
  original: string;
  proposition: string;
  verdict: Verdict;
}

export interface ResultatReformulation {
  proposees: number;
  rejetees: number;
  ignorees: number;
  coutUsd: number;
  details: PropositionEnregistree[];
}

/** Décrit l'offre au modèle, sans lui livrer l'annonce brute. */
function contexteOffre(offre: OffreExtraite, annonce: string | null): string {
  const missions = offre.missions
    .map((m) => `- ${m.texte} (importance ${m.importance})`)
    .join("\n");
  const competences = offre.competences
    .map((c) => `- ${c.libelle} (${c.caractere})`)
    .join("\n");

  // L'annonce brute en plus de l'analyse : l'extraction normalise le
  // vocabulaire et perd les tournures exactes, précisément celles qu'il faut
  // reprendre. Le ton, le secteur et le registre ne sont nulle part ailleurs.
  // 20 000 caractères et non 8 000 : la limite précédente était posée au jugé
  // et coupait plus de la moitié des annonces longues. Les jetons d'entrée
  // coûtent environ cinq fois moins que ceux de sortie — quelques centimes de
  // plus par offre, contre la moitié du texte perdue.
  const brute = (annonce ?? "").trim().slice(0, 20000);

  return [
    brute ? `ANNONCE INTÉGRALE :\n${brute}\n` : "",
    "MISSIONS ATTENDUES PAR L'OFFRE :",
    missions || "- (aucune)",
    "",
    "COMPÉTENCES ATTENDUES :",
    competences || "- (aucune)",
    "",
    `OUTILS CITÉS : ${offre.outils.join(", ") || "(aucun)"}`,
    `MOTS-CLÉS ATS : ${offre.mots_cles_ats.join(", ") || "(aucun)"}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function reformulerPourOffre(
  offreId: string
): Promise<ResultatReformulation> {
  const supabase = creerClientServeur();

  const { data: offreBrute } = await supabase
    .from("offres")
    .select("id, volet, contenu_brut")
    .eq("id", offreId)
    .maybeSingle();
  if (!offreBrute) throw new ErreurCV("Offre introuvable.");
  const offre = offreBrute as {
    id: string;
    volet: CodeVolet;
    contenu_brut: string | null;
  };

  const { data: analyseBrute } = await supabase
    .from("offre_analyses")
    .select("resultat")
    .eq("offre_id", offreId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!analyseBrute) {
    throw new ErreurCV(
      "Cette offre n'a pas d'analyse : sans le vocabulaire de l'annonce, " +
        "il n'y a rien vers quoi reformuler."
    );
  }
  const analyse = (analyseBrute as { resultat: OffreExtraite }).resultat;

  // On ne reformule que ce qui paraîtra sur le CV. Le reste serait payé pour
  // rien.
  const donnees = await chargerDonneesCV(offre.volet, offreId);
  const { selection } = choisirNiveau(donnees, analyse, offre.volet);
  const retenues = selection.experiences.flatMap((e) => e.missions);

  if (retenues.length === 0) {
    throw new ErreurCV("Aucune mission n'est retenue pour cette offre.");
  }

  // Une mission déjà adaptée et validée pour cette offre n'est pas retouchée :
  // ta validation ne se fait pas écraser par une regénération.
  const aTraiter = retenues.filter((m) => !m.adaptee);
  const ignorees = retenues.length - aTraiter.length;

  if (aTraiter.length === 0) {
    return { proposees: 0, rejetees: 0, ignorees, coutUsd: 0, details: [] };
  }

  const corpusParExperience = await chargerCorpus();

  // Les termes que l'annonce emploie : c'est ce que la reformulation doit
  // faire entrer, et rien d'autre ne justifie de la payer.
  const termesOffre = [
    ...analyse.mots_cles_ats,
    ...analyse.outils,
    ...analyse.competences.map((c) => c.libelle),
  ].filter((t) => t.trim().length >= 4);

  const experiences = donnees.experiences.filter((e) =>
    aTraiter.some((m) => m.experienceId === e.id)
  );

  const message = [
    contexteOffre(analyse, offre.contenu_brut),
    "",
    ...experiences.flatMap((e) => {
      const corpus = corpusEnTexte(corpusParExperience.get(e.id));
      const missions = aTraiter.filter((m) => m.experienceId === e.id);
      return [
        `=== ${e.entreprise} (${e.titre ?? ""}) ===`,
        corpus ? `CORPUS DE CETTE EXPÉRIENCE :\n${corpus}` : "(aucun corpus)",
        "",
        "MISSIONS À ADAPTER :",
        ...missions.map((m) => `[${m.id}] ${m.texte}`),
        "",
      ];
    }),
  ].join("\n");

  const reponse = await appelIA({
    modele: MODELE_REDACTION,
    systeme: SYSTEME,
    message,
    // Quatorze missions rédigées par Sonnet dépassent 4000 jetons : sept
    // appels sur huit ont été coupés au même endroit, chacun facturé pour
    // rien. Même défaut que la lettre, corrigé là-bas et pas ici.
    maxTokens: 8000,
    tache: "reformulation_missions",
    offreId,
  });

  let propositions: { id: string; texte: string }[];
  try {
    propositions = JSON.parse(extraireJson(reponse.texte));
    if (!Array.isArray(propositions)) throw new Error("format");
  } catch {
    // Le début de la réponse brute est remonté : sans lui, il faut fouiller
    // les journaux pour comprendre.
    throw new ErreurIA(
      "La réponse du modèle n'était pas exploitable. Début reçu : " +
        reponse.texte.trim().slice(0, 200)
    );
  }

  const outilsConnus = donnees.competences
    .filter((c) => c.categorie === "outil")
    .map((c) => c.libelle);

  const details: PropositionEnregistree[] = [];
  const aInserer: Record<string, unknown>[] = [];

  for (const mission of aTraiter) {
    const proposee = propositions.find((p) => p.id === mission.id);
    if (!proposee) continue;

    const verdict = controler(mission.texte, proposee.texte, {
      outilsConnus,
      corpus: corpusEnTexte(corpusParExperience.get(mission.experienceId)),
      termesOffre,
    });
    details.push({
      missionId: mission.id,
      original: mission.texte,
      proposition: proposee.texte.trim(),
      verdict,
    });

    // Les propositions écartées sont enregistrées elles aussi, avec leur
    // motif : elles restent visibles et acceptables. Un rejet muet fait
    // disparaître le travail payé sans laisser de trace.
    aInserer.push({
      mission_id: mission.id,
      volet: offre.volet,
      offre_id: offreId,
      texte: proposee.texte.trim(),
      origine: "ia_reformulee",
      validee: false,
      motif_rejet: verdict.accepte ? null : verdict.motifs.join(" "),
    });
  }

  // Les propositions en attente d'une précédente exécution sont remplacées ;
  // les validées ont été écartées plus haut et ne risquent rien.
  await supabase
    .from("mission_formulations")
    .delete()
    .eq("offre_id", offreId)
    .eq("volet", offre.volet)
    .eq("validee", false);

  if (aInserer.length > 0) {
    const { error } = await supabase
      .from("mission_formulations")
      .insert(aInserer);
    if (error) {
      throw new ErreurCV(
        `Les propositions n'ont pas pu être enregistrées : ${error.message}`
      );
    }
  }

  return {
    proposees: details.filter((d) => d.verdict.accepte).length,
    rejetees: details.filter((d) => !d.verdict.accepte).length,
    ignorees,
    coutUsd: reponse.coutUsd,
    details,
  };
}
