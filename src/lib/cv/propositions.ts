import { creerClientServeur } from "@/lib/supabase/server";
import { appelIA, ErreurIA, MODELE_REDACTION } from "@/lib/anthropic";
import { extraireJson } from "@/lib/extraction-json";
import { VOLETS, type CodeVolet } from "@/config/volets";
import { ACTIVITES } from "@/config/activites";
import type { OffreExtraite } from "@/lib/extraction-offre";
import { ErreurCV } from "@/lib/cv/generer";
import { chargerDonneesCV } from "@/lib/cv/donnees";
import { chargerCorpus, corpusEnTexte, type LigneCorpus } from "@/lib/cv/corpus";
import { nombres, nomsPropres } from "@/lib/cv/controle";
import { normaliser } from "@/lib/texte";
import {
  estSavoirFaire,
  motsSignificatifs,
  noyauDuTerme,
  termePresent,
} from "@/lib/termes";

/**
 * Missions nouvelles tirées du corpus.
 *
 * La reformulation ne sait que retoucher une mission existante. Quand une
 * offre réclame quelque chose que le corpus couvre et qu'aucune mission
 * n'exprime — l'audit des stocks chez TECHNICAPS, la régularisation des
 * charges chez Le Mans Métropole Habitat — elle ne peut rien faire : il n'y a
 * pas de ligne à modifier.
 *
 * Ce module rédige cette ligne. Chaque fait qu'elle avance doit exister dans
 * le corpus de l'expérience concernée, et la mission n'entre dans la base
 * qu'après validation explicite.
 */

/** Au-delà, la relecture devient une corvée et la qualité baisse. */
export const MAX_PROPOSITIONS = 3;

/**
 * Part de mots partagés au-delà de laquelle une proposition est considérée
 * comme redisant une mission existante.
 */
const SEUIL_DOUBLON = 0.7;

const SYSTEME = `Tu rédiges des missions de CV pour un professionnel du contrôle de gestion et de la comptabilité.

CE QUE TU FAIS
Une offre réclame des savoir-faire que les missions actuelles du CV n'expriment pas. Pour chaque expérience, tu disposes de son CORPUS : le détail de ce qui y a été fait, plus riche que ce que les missions disent. Tu rédiges des missions nouvelles à partir de ce corpus, qui répondent à l'offre.

RÈGLES ABSOLUES
- Chaque fait que tu avances doit être dans le corpus de CETTE expérience. Tu ne déduis pas, tu ne généralises pas, tu n'ajoutes aucun chiffre, outil ou responsabilité absent du corpus.
- Le corpus d'une expérience ne sert qu'à elle. Ce qui a été fait chez un employeur ne se transporte pas chez un autre.
- Une entrée de corpus marquée "exposition, non mission" décrit une simple familiarité : tu ne la transformes jamais en mission.
- Tu ne redis pas une mission qui existe déjà. Les missions actuelles te sont données : si le corpus ne dit rien de plus qu'elles, ne propose rien.
- Tu peux regrouper plusieurs entrées de corpus en une seule mission, à condition qu'elles relèvent du même travail.

CE QU'EST UNE MISSION, ET CE QUI N'EN EST PAS UNE
Une mission de CV dit SUR QUOI le travail portait et CE QU'IL A PRODUIT. La méthode, les outils et les interlocuteurs sont subordonnés à cela, jamais le sujet de la phrase.

Ne sont PAS des missions, et ne doivent jamais être le cœur d'une proposition :
- produire un document de méthode : "Formalisé un mode opératoire", "Rédigé une procédure", "Documenté un processus"
- un échange : "Conduit des entretiens avec…", "Participé à des réunions", "Échangé avec le service…"
- une étape d'un travail plus large : "Extrait les données", "Saisi les écritures", "Mis à jour un fichier"
- une posture : "Sensibilisé à…", "Familiarisé avec…", "Impliqué dans…"

Ces éléments peuvent figurer en complément de circonstance — "à partir d'extractions ULIS", "en lien avec les équipes comptables" — jamais comme verbe principal.

Tu ne nommes JAMAIS un service, une direction, un projet ou une application internes à l'entreprise : "l'Unité Charges et Contrats" ne dit rien à un lecteur extérieur. Les progiciels du marché (SILOG, SAP, AS/400, ULIS Sopra) sont en revanche autorisés.

STRUCTURE ATTENDUE
[verbe au participe passé] + [objet et périmètre] + [résultat, finalité ou constat] (+ méthode ou outil, facultatif)

MAUVAIS : "Formalisé un mode opératoire de rapprochement entre comptabilité générale et régularisation des charges par groupe immobilier."
→ le sujet est le document, pas le travail.

MAUVAIS : "Qualifié les écarts de charges non refacturées via entretiens avec l'Unité Charges et Contrats."
→ le moyen devient le sujet, et le service interne ne parle à personne.

BON : "Rapproché la comptabilité générale et les états de régularisation des charges sur l'ensemble du patrimoine, et identifié les charges non refacturées aux locataires ainsi que les régularisations excédentaires."
→ objet, périmètre, résultat.

BON : "Audité les stocks d'un site de production par inventaire physique et rapprochement avec l'ERP, et identifié les causes des écarts constatés."

FORME
- une seule phrase, commençant par un participe passé
- 110 à 200 caractères
- vocabulaire du métier et de l'annonce, verbe d'action précis
- pas de "notamment", "activement", "divers", pas de première personne
- les chiffres du corpus peuvent être repris, jamais inventés

Propose au plus ${MAX_PROPOSITIONS} missions, les plus utiles à cette offre. Si le corpus n'apporte rien que les missions actuelles ne disent déjà, renvoie un tableau vide.

LES CODES D'ACTIVITÉ
Tu classes chaque mission dans la liste fermée fournie avec le message. Tu emploies les identifiants exacts — minuscules, sans accent, avec tirets bas — et rien d'autre. Un code inventé rend la mission invisible au moteur de sélection : elle n'atteindra jamais un CV.

Tu réponds UNIQUEMENT par un tableau JSON, sans préambule ni balises de code :
[{"experienceId": "<identifiant fourni>", "texte": "<mission>", "codes": ["code1", "code2"]}]`;

export interface VerdictProposition {
  accepte: boolean;
  motifs: string[];
}

export interface ResultatPropositions {
  proposees: number;
  rejetees: number;
  coutUsd: number;
}

/**
 * Vérifie qu'une mission proposée est ancrée dans le corpus de son expérience.
 *
 * Contrairement à une reformulation, il n'y a pas d'original auquel comparer :
 * le corpus tient ce rôle. Tout chiffre et tout nom propre doit s'y trouver.
 */
function controlerProposition(
  texte: string,
  corpus: string,
  termesOffre: string[],
  missionsExistantes: string[]
): VerdictProposition {
  const motifs: string[] = [];

  // Les verbes de modalité décrivent comment on a travaillé, pas ce qu'on a
  // fait. Le modèle y revient spontanément ; on le lui interdit par le calcul.
  const VERBES_DE_MODALITE = [
    "formalise", "redige", "documente", "conduit des entretiens",
    "participe a des reunions", "echange avec", "sensibilise", "familiarise",
    "implique dans", "assiste a", "contribue a la redaction",
  ];
  const debut = normaliser(texte).slice(0, 40);
  const modalite = VERBES_DE_MODALITE.find((v) => debut.startsWith(normaliser(v)));
  if (modalite) {
    motifs.push(
      `Décrit une modalité de travail et non une mission : « ${modalite} ».`
    );
  }

  if (texte.length < 60) motifs.push("Trop courte pour une ligne de CV.");
  if (texte.length > 230) motifs.push("Trop longue pour une ligne de CV.");

  const nombresCorpus = nombres(corpus);
  const nombresAjoutes = [...nombres(texte)].filter(
    (n) => !nombresCorpus.has(n)
  );
  if (nombresAjoutes.length > 0) {
    motifs.push(`Chiffre absent du corpus : ${nombresAjoutes.join(", ")}.`);
  }

  const propresCorpus = nomsPropres(corpus);
  const propresAjoutes = [...nomsPropres(texte)].filter(
    (m) => !propresCorpus.has(m)
  );
  if (propresAjoutes.length > 0) {
    motifs.push(`Nom propre absent du corpus : ${propresAjoutes.join(", ")}.`);
  }

  const motsProposition = motsSignificatifs(texte);
  const apports = termesOffre.filter((t) => termePresent(t, motsProposition));
  if (termesOffre.length > 0 && apports.length === 0) {
    motifs.push("Ne répond à aucun savoir-faire réclamé par l'offre.");
  }

  // Doublon : une mission qui redit une existante encombrerait la base et la
  // sélection choisirait l'une ou l'autre au hasard des notes.
  for (const existante of missionsExistantes) {
    const motsExistante = motsSignificatifs(existante);
    const communs = [...motsProposition].filter((m) => motsExistante.has(m));
    const part = communs.length / Math.max(1, motsProposition.size);
    if (part >= SEUIL_DOUBLON) {
      motifs.push(`Redit une mission existante : « ${existante.slice(0, 70)}… »`);
      break;
    }
  }

  return { accepte: motifs.length === 0, motifs };
}

export async function proposerMissionsPourOffre(
  offreId: string
): Promise<ResultatPropositions> {
  const supabase = creerClientServeur();

  const { data: offreBrute } = await supabase
    .from("offres")
    .select("id, volet, intitule, contenu_brut")
    .eq("id", offreId)
    .maybeSingle();
  if (!offreBrute) throw new ErreurCV("Offre introuvable.");
  const offre = offreBrute as {
    volet: CodeVolet;
    intitule: string | null;
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
    throw new ErreurCV("Analyse l'offre d'abord.");
  }
  const analyse = (analyseBrute as { resultat: OffreExtraite }).resultat;

  const donnees = await chargerDonneesCV(offre.volet, offreId);
  const corpusParExperience = await chargerCorpus();

  const termesOffre = [
    ...analyse.mots_cles_ats,
    ...analyse.outils,
    ...analyse.competences.map((c) => c.libelle),
  ]
    .filter(estSavoirFaire)
    .map(noyauDuTerme)
    .filter((t) => t.length >= 4);

  // Seules les expériences qui ont un corpus peuvent nourrir une proposition.
  const experiences = donnees.experiences.filter(
    (e) => (corpusParExperience.get(e.id) ?? []).length > 0
  );
  if (experiences.length === 0) {
    throw new ErreurCV(
      "Aucune expérience ne dispose d'un corpus. Sans matière, il n'y a rien à proposer."
    );
  }

  const message = [
    `CODES D'ACTIVITÉ AUTORISÉS : ${Object.keys(ACTIVITES).join(", ")}`,
    "",
    `POSTE VISÉ : ${offre.intitule ?? ""} — volet ${VOLETS[offre.volet].nom}`,
    "",
    `SAVOIR-FAIRE RÉCLAMÉS PAR L'OFFRE : ${termesOffre.join(", ")}`,
    "",
    `MISSIONS ATTENDUES : ${analyse.missions.map((m) => m.texte).join(" | ")}`,
    "",
    ...experiences.flatMap((e) => [
      `=== EXPÉRIENCE [${e.id}] — ${e.entreprise}, ${e.titre ?? ""} ===`,
      "CORPUS :",
      corpusEnTexte(corpusParExperience.get(e.id)),
      "MISSIONS ACTUELLES DU CV :",
      ...e.missions.map((m) => `  • ${m.texte}`),
      "",
    ]),
  ].join("\n");

  const reponse = await appelIA({
    modele: MODELE_REDACTION,
    systeme: SYSTEME,
    message,
    // Le modèle produit un raisonnement invisible avant le JSON, qui compte
    // dans les jetons de sortie : 4000 étaient atteints pile, réponse coupée.
    // La limite est un plafond, pas un coût — seule la production est facturée.
    maxTokens: 8000,
    tache: "propositions_missions",
    offreId,
  });

  let brut: { experienceId: string; texte: string; codes?: string[] }[];
  try {
    brut = JSON.parse(extraireJson(reponse.texte));
    if (!Array.isArray(brut)) throw new Error("format");
  } catch {
    throw new ErreurIA(
      "La réponse du modèle n'était pas exploitable. Début reçu : " +
        reponse.texte.trim().slice(0, 200)
    );
  }

  let proposees = 0;
  let rejetees = 0;

  for (const p of brut.slice(0, MAX_PROPOSITIONS)) {
    const experience = experiences.find((e) => e.id === p.experienceId);
    if (!experience) continue;

    const texte = (p.texte ?? "").trim();
    const lignes: LigneCorpus[] = corpusParExperience.get(experience.id) ?? [];
    const verdict = controlerProposition(
      texte,
      corpusEnTexte(lignes),
      termesOffre,
      experience.missions.map((m) => m.texte)
    );

    if (!verdict.accepte) {
      rejetees += 1;
      continue;
    }

    // Les codes doivent appartenir à la taxonomie fermée : c'est sur eux que
    // le moteur de sélection compare une mission à une offre. Le modèle en a
    // inventé — « analyse financière », « Orientation business » — et les
    // missions acceptées n'atteignaient jamais un CV, faute de correspondance.
    let codes = (p.codes ?? []).filter((c) => c in ACTIVITES);

    // À défaut, on reprend ceux des entrées de corpus qui fondent la mission :
    // elles décrivent le même travail.
    if (codes.length === 0) {
      const textesFondateurs = fondements(texte, lignes, 3);
      codes = [
        ...new Set(
          lignes
            .filter((l) => textesFondateurs.includes(l.texte))
            .flatMap((l) => l.codes)
            .filter((c) => c in ACTIVITES)
        ),
      ];
    }

    if (codes.length === 0) {
      rejetees += 1;
      continue;
    }

    // La mission est créée inactive : elle existe, mais aucune sélection ne la
    // voit tant que Taha n'a pas dit oui.
    const { data: creee, error } = await supabase
      .from("missions")
      .insert({
        experience_id: experience.id,
        texte_source: texte,
        activites_codes: codes,
        contient_chiffre: /\d/.test(texte),
        pertinence_cdg: 3,
        pertinence_compta: 3,
        ordre: 900 + proposees,
        actif: false,
      })
      .select("id")
      .single();

    if (error || !creee) continue;

    await supabase.from("mission_formulations").insert({
      mission_id: (creee as { id: string }).id,
      volet: offre.volet,
      offre_id: offreId,
      texte,
      origine: "ia_reformulee",
      validee: false,
    });

    proposees += 1;
  }

  return { proposees, rejetees, coutUsd: reponse.coutUsd };
}

/**
 * Les entrées de corpus qui fondent une mission proposée.
 *
 * Calculées par recoupement de vocabulaire plutôt que demandées au modèle :
 * une justification produite par celui qu'on contrôle ne vaut pas grand-chose.
 */
export function fondements(
  texteMission: string,
  lignes: LigneCorpus[],
  combien = 2
): string[] {
  const mots = motsSignificatifs(texteMission);
  return lignes
    .map((l) => {
      const m = motsSignificatifs(l.texte);
      const communs = [...mots].filter((x) => m.has(x)).length;
      return { texte: l.texte, communs };
    })
    .filter((l) => l.communs >= 3)
    .sort((a, b) => b.communs - a.communs)
    .slice(0, combien)
    .map((l) => l.texte);
}
