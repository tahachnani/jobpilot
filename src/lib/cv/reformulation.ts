import { creerClientServeur } from "@/lib/supabase/server";
import { appelIA, ErreurIA, MODELE_REDACTION } from "@/lib/anthropic";
import type { CodeVolet } from "@/config/volets";
import type { OffreExtraite } from "@/lib/extraction-offre";
import { chargerDonneesCV } from "@/lib/cv/donnees";
import { choisirNiveau } from "@/lib/cv/compacite";
import { controler, type Verdict } from "@/lib/cv/controle";
import { ErreurCV } from "@/lib/cv/generer";

/**
 * Reformulation des missions d'un CV pour une offre donnée.
 *
 * L'IA ne réécrit pas le parcours : elle redit chaque mission avec les mots de
 * l'annonce. Ce qu'elle propose passe d'abord un contrôle arithmétique, puis
 * sous les yeux de Taha. Rien n'entre dans un CV sans les deux.
 */

const SYSTEME = `Tu es un rédacteur de CV spécialisé en contrôle de gestion et en comptabilité. Tu adaptes des missions déjà vécues au vocabulaire et au contexte d'une offre précise.

CE QUE TU PRODUIS
Une phrase de professionnel du métier, pas une paraphrase molle. Concrètement :
- un verbe d'action précis en tête, jamais "participé à" ni "contribué à" quand un verbe plus juste existe
- le vocabulaire exact du secteur et de l'annonce : si l'offre dit "atterrissage", "OPEX", "réestimé", "clôture", emploie ces mots-là
- le résultat ou l'objet avant la méthode : ce qui a été obtenu compte plus que l'outil employé
- une syntaxe qui se lit d'une traite, sans enfilade de compléments
- le registre de l'annonce : une PME industrielle et un bailleur social ne parlent pas pareil

RÈGLE ABSOLUE
Tu redis exactement la même chose. Tu n'ajoutes JAMAIS :
- un chiffre, un pourcentage, un volume, une durée
- un logiciel, un outil, un ERP, un sigle
- une responsabilité, un périmètre, une taille d'équipe
- une compétence ou une réalisation

qui ne soit déjà dans la mission d'origine. Tu ne retires aucun chiffre non plus. Une phrase plus flatteuse que la réalité est un mensonge sur un document signé : elle sera rejetée.

Tu ne RETIRES rien non plus :
- tous les sigles et noms propres de l'original doivent se retrouver dans ta phrase : KPI reste KPI, CODIR reste CODIR, ULIS reste ULIS. Ne les remplace jamais par un terme générique.
- tu ne supprimes aucun élément d'une énumération : "par période, agence et catégorie" garde ses trois termes
- tu ne supprimes aucun qualificatif de périmètre : "coûts de production" ne devient pas "coûts", "management opérationnel" ne devient pas "management"

Tu ne NOMINALISES pas. Si l'original commence par un participe passé, ta phrase aussi : "Piloté" ne devient pas "Pilotage", "Optimisé" ne devient pas "Optimisation". Si l'original est déjà nominal, garde-le nominal.

Ce que tu peux faire : choisir de meilleurs mots, réordonner, remplacer une tournure vague par la formulation métier consacrée à contenu strictement identique.

FORME
- français professionnel, une seule phrase par mission
- longueur au plus égale à l'original, jamais plus de 20 % au-dessus
- pas de première personne, pas de superlatif, ni "notamment", "activement", "rigoureux", "diverses"
- conserve le temps grammatical de l'original

Si une mission n'a rien à gagner, renvoie exactement le texte d'origine : il sera écarté.

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
  const brute = (annonce ?? "").trim().slice(0, 8000);

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

  const message = [
    contexteOffre(analyse, offre.contenu_brut),
    "",
    "MISSIONS À ADAPTER :",
    ...aTraiter.map((m) => `[${m.id}] ${m.texte}`),
  ].join("\n");

  const reponse = await appelIA({
    modele: MODELE_REDACTION,
    systeme: SYSTEME,
    message,
    maxTokens: 4000,
    tache: "reformulation_missions",
    offreId,
  });

  let propositions: { id: string; texte: string }[];
  try {
    const brut = reponse.texte.trim().replace(/^```(?:json)?|```$/g, "").trim();
    propositions = JSON.parse(brut);
    if (!Array.isArray(propositions)) throw new Error("format");
  } catch {
    throw new ErreurIA(
      "La réponse du modèle n'était pas exploitable. Réessaie."
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

    const verdict = controler(mission.texte, proposee.texte, outilsConnus);
    details.push({
      missionId: mission.id,
      original: mission.texte,
      proposition: proposee.texte.trim(),
      verdict,
    });

    if (!verdict.accepte) continue;

    aInserer.push({
      mission_id: mission.id,
      volet: offre.volet,
      offre_id: offreId,
      texte: proposee.texte.trim(),
      origine: "ia_reformulee",
      validee: false,
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
    proposees: aInserer.length,
    rejetees: details.filter((d) => !d.verdict.accepte).length,
    ignorees,
    coutUsd: reponse.coutUsd,
    details,
  };
}
