import { randomUUID } from "crypto";
import { creerClientServeur } from "@/lib/supabase/server";
import { appelIA, ErreurIA, MODELE_REDACTION } from "@/lib/anthropic";
import { VOLETS, type CodeVolet } from "@/config/volets";
import type { OffreExtraite } from "@/lib/extraction-offre";
import { ErreurCV } from "@/lib/cv/generer";
import { chargerDonneesCV } from "@/lib/cv/donnees";
import { chargerCorpus } from "@/lib/cv/corpus";
import { choisirNiveau } from "@/lib/cv/compacite";
import { moisAnnee, periodeExperience } from "@/lib/cv/dates";
import { extraireJson } from "@/lib/extraction-json";
import { verifierAncrage, type Ancrage } from "@/lib/lettre/ancrage";
import { verifierStyle, type DefautStyle } from "@/lib/lettre/style";
import { formuleAppel } from "@/lib/lettre/destinataire";
import { purgerAnciennesVersions, SCHEMA_SELECTION } from "@/lib/documents";
import {
  lettreEnTexte,
  rendreLettre,
  type ModeleLettre,
} from "@/lib/lettre/document";
import type { ModeleCV } from "@/lib/cv/modele";

/**
 * Génération de la lettre de motivation et de l'email de candidature.
 *
 * Un seul appel produit les deux : ils disent la même chose à deux longueurs,
 * et les faire séparément reviendrait à payer deux fois pour risquer qu'ils se
 * contredisent.
 */

const SYSTEME = `Tu rédiges une lettre de motivation et un email de candidature pour un professionnel du contrôle de gestion et de la comptabilité.

CE QUE TU PEUX INVENTER
L'intérêt pour l'entreprise, le secteur, le poste, le projet professionnel. Aucune donnée ne les porte, c'est à toi de les écrire — à partir de ce que dit l'annonce, et de rien d'autre.

LA DATE ET LA DISPONIBILITÉ
La date du jour t'est donnée. Tu en tires les temps : une expérience achevée se raconte au passé, jamais au présent. N'écris jamais "actuellement en poste" pour un contrat déjà terminé.

Pour la disponibilité, si le dernier contrat est terminé, tu écris exactement l'idée "disponible immédiatement" et RIEN D'AUTRE sur le sujet. La phrase de disponibilité ne nomme ni la date de fin du dernier contrat, ni son employeur, ni sa nature. Interdit : "Mon CDD chez X s'est achevé en juin 2026, je suis disponible immédiatement." Attendu : "Disponible immédiatement, je ...". La date de fin figure sur le CV ; la répéter dans la lettre ne fait que souligner l'intervalle écoulé.

Si un contrat est en cours, alors seulement tu donnes sa date de fin.

À VÉRITÉ ÉGALE, CHOISIS LA FORMULATION QUI SERT
Quand plusieurs façons de dire sont également exactes, retiens celle qui sert la candidature. Taire un détail sans intérêt n'est pas mentir ; l'inventer, si.

CE QUE TU NE PEUX PAS INVENTER
- aucun chiffre, volume, pourcentage, durée qui ne soit dans le parcours fourni
- aucun employeur, école, diplôme, logiciel, outil, certification qui n'y soit
- aucune affirmation sur l'entreprise qui ne soit dans l'annonce : tu ne la connais pas. N'écris jamais qu'elle est "leader", "en forte croissance" ou "reconnue" si l'annonce ne le dit pas.
- aucun trait de caractère, aucune qualité relationnelle, aucune manière de travailler présentés comme acquis : "habitué à défendre un chiffre avec diplomatie", "reconnu pour sa rigueur" sont des affirmations invérifiables. Décris ce qui a été fait, pas la façon dont le candidat le ferait.
- aucun secteur, marché ou métier attribué à un employeur du parcours s'il n'est pas nommément dans les données. Si l'annonce parle de distribution et que le candidat a travaillé dans l'industrie, tu n'écris pas qu'il vient de la distribution. Les mots de l'annonce décrivent l'entreprise visée, jamais rétroactivement le parcours.

LA FORMATION — CE QUI NE SE DIT PAS
Tu n'écris JAMAIS que le candidat détient deux masters, ni "double master", ni "mes deux formations". Le cumul de diplômes ne prouve rien à un recruteur et se lit comme une exhibition ; le CV le dit déjà, en une ligne, sans insister.
Tu ne nommes AUCUN établissement, et en particulier jamais "Le Mans Université" : la candidature vise toute la France, et nommer une université régionale ancre le profil là où il ne veut pas l'être.
Si la formation doit apparaître, elle apparaît par sa SPÉCIALITÉ et rien d'autre — "formé au contrôle de gestion et à l'audit", "de formation comptabilité contrôle audit". Jamais l'intitulé complet, jamais l'école, jamais l'année.

CE QUE TU PRODUIS — LE PLAN VOUS / MOI / NOUS
TROIS paragraphes, pas quatre. C'est le plan attendu en France, et il tient parce que chaque paragraphe a un sujet différent : d'abord le poste, ensuite le candidat, enfin les deux ensemble.

1. VOUS — LE POSTE ET CE QU'IL DEMANDE (environ 450 signes)
Tu ouvres sur le poste, nommé, et sur UN élément concret pris dans l'annonce : un problème que ce recrutement doit résoudre, un contexte (création de poste, réorganisation, croissance, multi-sites), une mission qui structure le reste. Cet élément doit être une CITATION DE FAIT, pas un compliment — "vous ouvrez un poste pour structurer le suivi de trois sites" et non "votre entreprise est reconnue". Puis une phrase qui dit pourquoi ce point-là te parle.
Si l'annonce est vide de contexte et ne dit rien d'autre que des tâches, alors commence par toi et fais de ce paragraphe une ouverture brève : mieux vaut un paragraphe court qu'un paragraphe inventé.

2. MOI — UNE SITUATION, PAS UNE LISTE (environ 800 signes)
C'est la règle qui compte le plus dans tout ce document.
**L'EXPÉRIENCE EST IMPOSÉE.** Le message te donne, sous l'intitulé « EXPÉRIENCE À RACONTER », celle que le moteur a classée la plus proche de cette offre. Tu racontes une situation vécue LÀ. Tu ne choisis pas une autre expérience parce qu'elle contient un chiffre plus frappant : un chiffre venu d'un autre métier ne prouve rien au recruteur qui lit, et le décalage se voit immédiatement.
Tu racontes UNE SEULE situation vécue, en entier : ce qui n'allait pas ou ce qu'il fallait construire, ce que le candidat a fait, ce que ça a donné. Un fait développé convainc ; quatre faits empilés se lisent comme le CV recopié.
DEUX faits sont un maximum absolu, et le second n'est admis que s'il découle du premier — jamais comme deuxième article d'une liste.
INTERDIT dans ce paragraphe : plus de trois groupes séparés par des virgules dans une même phrase. "J'ai piloté le budget, construit les tableaux de bord, fiabilisé les clôtures et formé les équipes" est un inventaire déguisé, et c'est exactement ce qu'il ne faut pas écrire.
Le lecteur doit pouvoir se représenter une scène. S'il ne peut pas, le paragraphe est raté.

3. NOUS — CE QUE ÇA DONNERAIT (environ 450 signes)
Ce que le candidat ferait dans ce poste-là, dans les premiers mois, en partant des missions de l'annonce. Puis la disponibilité en une proposition, et la demande d'entretien. Debout, sans la quémander.
UN SEUL VERBE AU CONDITIONNEL dans tout le paragraphe. « Je consoliderais les indicateurs, j'objectiverais les écarts, je resterais attentif » : trois conditionnels d'affilée ne décrivent rien, ils supposent. Écris au présent ce qui est vrai aujourd'hui — ce que le candidat sait faire, ce que l'annonce demande — et garde le conditionnel pour la seule phrase qui projette.
Tu ne nommes JAMAIS l'annonce comme document. « Les projets data évoqués dans l'annonce », « les missions décrites dans votre offre » : le recruteur l'a écrite, lui renvoyer son texte en le citant comme source est une maladresse. Nomme la chose, pas l'endroit où tu l'as lue.

LONGUEUR — CONTRAINTE FERME
Les trois paragraphes réunis tiennent en 1 800 signes, espaces compris. C'est un plafond, pas un objectif : une lettre qui déborde n'est pas plus convaincante, elle est moins lue. Une seule page, toujours.

LE RYTHME — ET LE PIÈGE QUI VA AVEC
Une lettre écrite à la main respire : des phrases longues, et soudain une courte. Une prose dont toutes les phrases font la même longueur se reconnaît immédiatement comme automatique. Chaque paragraphe contient donc au moins une phrase brève.

MAIS une phrase brève doit porter un FAIT : un chiffre, un nom d'outil, un nom d'employeur, une action précise. « J'ai repris le calcul poste par poste. » « Le quittancement portait sur 18 000 logements. »

INTERDIT ABSOLU : la phrase brève qui énonce une vérité générale. Ce sont des maximes, elles n'apprennent rien, et trois d'affilée transforment la lettre en recueil de proverbes. Exemples de ce qu'il ne faut JAMAIS écrire :
- « Un périmètre large exige des indicateurs fiables. »
- « Un chiffre juste change une décision. »
- « Je reste attentif aux signaux faibles. »
Test : si la phrase reste vraie en la sortant de la lettre et en la mettant dans n'importe quelle autre, supprime-la. Mieux vaut un paragraphe sans phrase courte qu'un paragraphe avec une maxime.

LA VOIX — C'EST LA RÈGLE LA PLUS IMPORTANTE
Le candidat écrit cette lettre. Il est donc le SUJET des verbes principaux. Au moins trois paragraphes sur quatre ont "j'ai" ou "je" comme sujet de leur phrase principale.

INTERDIT : les noms d'action en sujet, qui font disparaître celui qui a fait le travail.
- "Le pilotage des indicateurs s'est accompagné de l'automatisation du reporting" → "J'ai piloté les indicateurs et automatisé le reporting"
- "La construction des tableaux de bord a nécessité de comparer les évolutions" → "J'ai construit les tableaux de bord en comparant les évolutions"
- "Le parcours traverse trois secteurs" → "J'ai travaillé dans l'industrie, le logement social et en cabinet"
- "Ce passage par plusieurs ERP a construit une capacité à" → "Passer d'un ERP à l'autre m'a appris à"
Sont notamment proscrits comme sujets : le pilotage, la construction, le calcul, le parcours, ce passage, l'élaboration, la mise en place, la montée en compétence, cette expérience, ces missions.

Écris des phrases courtes. Une phrase de plus de trente mots est presque toujours une phrase nominale déguisée.

LES FORMULES QUI TRAHISSENT UNE LETTRE ÉCRITE PAR UNE MACHINE
France Travail publie la liste de ce qu'il appelle la « signature ChatGPT » : les tournures auxquelles un recruteur reconnaît, en une seconde, une lettre générée. Elles sont INTERDITES, à la lettre et dans toutes leurs variantes :
- "Fort de mon expérience…", "Fort de mes…", "Forte de cette…"
- "Actuellement en recherche active…", "actuellement à la recherche d'un nouveau défi"
- "…mettre mes compétences au service de votre entreprise", "mettre mon expertise à votre service"
- "Je suis convaincu que mon dynamisme et ma rigueur…", "persuadé que mes qualités…"
- "C'est avec un vif intérêt que…", "c'est avec enthousiasme que…"
- "mes compétences polyvalentes", "mon enthousiasme communicatif", "profondément motivé"
Ces phrases valent pour n'importe quel poste : c'est pour cela qu'elles ne valent pour aucun.

INTERDIT AUSSI
- COMPTER. Jamais "Quatre expériences en…", "Deux expériences illustrent…", "trois secteurs distincts", "cinq ans d'expérience". Compter structure un rapport ; une lettre se lit d'un trait.
- ANNONCER SON PLAN. Pas de "Deux expériences illustrent cette contribution", pas de "Je vais détailler". On démontre, on n'annonce pas.
- RECOPIER L'ANNONCE EN LE DISANT. Jamais "Ces missions recouvrent les besoins identifiés dans l'annonce : …" suivi de la liste de l'offre. Le recruteur sait ce qu'il a écrit ; c'est à lui de conclure que le candidat correspond. Employer le vocabulaire de l'annonce, oui ; le lui resservir en liste, non.
- FLATTER. "Votre prestigieuse entreprise", "leader de son marché", "acteur incontournable" : tu ne sais rien de l'entreprise que ce que dit l'annonce, et un ton élogieux du début à la fin n'est pas crédible. Au plus UNE appréciation, dans le premier paragraphe, adossée à un fait de l'annonce.
- INSISTER. Les adverbes d'intensité — particulièrement, pleinement, parfaitement, véritablement, résolument, profondément — sont le tic le plus mécanique qui existe. Deux au maximum dans toute la lettre. Un fait n'a pas besoin d'être "particulièrement" quoi que ce soit.
- "vs", "&", "cf.", et toute abréviation anglaise.
- Dire deux fois la disponibilité : "Disponible immédiatement, je peux rejoindre sans délai" est une redondance.
- Les clôtures administratives : "Je reste à votre disposition pour échanger sur les modalités d'un entretien", "n'hésitez pas", "dans cette continuité". La dernière phrase demande un entretien, simplement et debout.

Exigences de fond :
- pas de généralités interchangeables : chaque phrase doit être invalide pour une autre offre. Test à s'appliquer soi-même avant de rendre : si une phrase peut être recopiée telle quelle dans une candidature chez un autre employeur, elle ne sert à rien — récris-la ou supprime-la.
- pas de recopie du CV, qui est joint : la lettre dit ce que la page n'a pas pu contenir
- verbe d'action, phrases courtes, vocabulaire du métier et de l'annonce
- pas de "Je suis passionné par", "dynamique et motivé"
- vouvoiement, registre professionnel français, jamais de superlatif sur soi

L'EMAIL
Cinq à huit lignes, sobre. Il annonce la candidature et les pièces jointes, donne une raison de lire la lettre, sans la répéter.

Tu réponds UNIQUEMENT par un objet JSON, sans préambule ni balises de code :
{
  "lettre": {
    "objet": "Objet : ...",
    "formuleAppel": "Madame, Monsieur,",
    "paragraphes": ["...", "...", "..."],
    "formulePolitesse": "..."
  },
  "email": { "objet": "...", "corps": "..." }
}`;

export interface ResultatLettre {
  documentLettreId: string;
  documentEmailId: string;
  version: number;
  modele: ModeleLettre;
  email: { objet: string; corps: string };
  ancrage: Ancrage;
  /** Les tournures repérées par le contrôle de style (D93). */
  style: DefautStyle[];
  coutUsd: number;
}

function nettoyer(parties: (string | null | undefined)[], sep: string) {
  return parties
    .map((p) => (p ?? "").trim())
    .filter(Boolean)
    .join(sep);
}

/** Le parcours complet, mis à plat pour le modèle. */
async function contexteParcours(volet: CodeVolet): Promise<{
  texte: string;
  corpus: string;
  profil: Record<string, string | null>;
}> {
  const supabase = creerClientServeur();

  const [profil, exps, comps, forms, langues, interets] = await Promise.all([
    supabase.from("profil").select("*").maybeSingle(),
    supabase
      .from("experiences")
      .select(
        `entreprise, ville, pays, date_debut, date_fin, type_contrat, ordre,
         titre_cdg, titre_compta,
         experience_periodes ( date_debut, date_fin, ordre ),
         missions ( actif, mission_formulations ( texte, volet, offre_id ) )`
      )
      .order("ordre"),
    supabase.from("competences").select("libelle, precision, niveau, categorie"),
    supabase.from("formations").select("diplome, etablissement, ville, date_debut, date_fin"),
    supabase.from("langues").select("langue, niveau, certification"),
    supabase.from("interets").select("libelle"),
  ]);

  const lignes: string[] = ["PARCOURS COMPLET", ""];

  for (const e of (exps.data ?? []) as Record<string, any>[]) {
    const titre =
      (volet === "cdg" ? e.titre_cdg : e.titre_compta) ??
      e.titre_cdg ??
      e.titre_compta ??
      "";
    const periodes = ((e.experience_periodes as Record<string, any>[]) ?? [])
      .sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0))
      .map((p) => ({ dateDebut: p.date_debut, dateFin: p.date_fin }));
    lignes.push(
      `${titre} — ${e.entreprise} (${nettoyer([e.ville, e.pays], ", ")}) — ` +
        `${periodeExperience(e.date_debut, e.date_fin, periodes)} — ${e.type_contrat}`
    );
    for (const m of ((e.missions as Record<string, any>[]) ?? []).filter(
      (m) => m.actif !== false
    )) {
      const f = ((m.mission_formulations as Record<string, any>[]) ?? []).filter(
        (f) => !f.offre_id
      );
      const retenue = f.find((x) => x.volet === volet) ?? f[0];
      if (retenue?.texte) lignes.push(`  • ${retenue.texte}`);
    }
    lignes.push("");
  }

  lignes.push("FORMATIONS");
  for (const f of (forms.data ?? []) as Record<string, any>[]) {
    lignes.push(
      `  • ${f.diplome} — ${nettoyer([f.etablissement, f.ville], ", ")} — ` +
        `${moisAnnee(f.date_debut)} à ${moisAnnee(f.date_fin)}`
    );
  }

  lignes.push("", "COMPÉTENCES");
  for (const c of (comps.data ?? []) as Record<string, any>[]) {
    if ((c.niveau ?? 0) < 1) continue;
    lignes.push(
      `  • ${c.libelle}${c.precision ? ` (${c.precision})` : ""} — niveau ${c.niveau}/3 — ${c.categorie}`
    );
  }

  lignes.push("", "LANGUES");
  for (const l of (langues.data ?? []) as Record<string, any>[]) {
    lignes.push(`  • ${nettoyer([l.langue, l.niveau, l.certification], " — ")}`);
  }

  lignes.push("", "CENTRES D'INTÉRÊT");
  lignes.push(
    "  " +
      ((interets.data ?? []) as Record<string, any>[])
        .map((i) => i.libelle)
        .join(", ")
  );

  const texte = lignes.join("\n");
  return {
    texte,
    corpus: texte,
    profil: (profil.data as Record<string, string | null>) ?? {},
  };
}

/**
 * Consignes de style, parcourues dans l'ordre à chaque réécriture (D80).
 *
 * Régénérer donnait presque la même lettre : mêmes phrases, mêmes tournures.
 * Deux causes, corrigées ensemble — le style était tiré au sort, donc
 * répétable, et le modèle ne voyait pas la version qu'on lui demandait de ne
 * pas reproduire.
 *
 * Les consignes se contredisent délibérément entre elles : un style qui
 * n'interdit rien ne change rien.
 */
const STYLES = [
  "Écris plus direct et plus court : phrases brèves, une seule subordonnée par phrase au maximum, aucun connecteur décoratif. Chaque paragraphe commence par une affirmation, jamais par une circonstance.",
  "Change de situation au paragraphe 2 : prends une autre expérience du parcours que celle de la version précédente, et raconte-la de la même façon — ce qu'il fallait régler, ce qui a été fait, ce que ça a donné.",
  "Inverse l'entrée : commence le paragraphe 1 par la situation du candidat plutôt que par le poste, puis rejoins l'annonce en fin de paragraphe. Le plan reste vous/moi/nous, seule la porte d'entrée change.",
  "Écris sobre et factuel, sur le ton d'une note interne : aucune formule d'enthousiasme, aucun adjectif sur soi, le raisonnement seul. Chaque paragraphe commence par un fait.",
];

export async function genererLettrePourOffre(
  offreId: string,
  changerDeStyle = false
): Promise<ResultatLettre> {
  const supabase = creerClientServeur();

  const { data: offreBrute } = await supabase
    .from("offres")
    .select(
      "id, volet, intitule, entreprise, localisation, contenu_brut, contact_nom, contact_adresse"
    )
    .eq("id", offreId)
    .maybeSingle();
  if (!offreBrute) throw new ErreurCV("Offre introuvable.");

  const offre = offreBrute as {
    volet: CodeVolet;
    intitule: string | null;
    entreprise: string | null;
    localisation: string | null;
    contenu_brut: string | null;
    contact_nom: string | null;
    contact_adresse: string | null;
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
      "Analyse l'offre avant de rédiger la lettre : sans elle, il n'y a rien à quoi répondre."
    );
  }
  const analyse = (analyseBrute as { resultat: OffreExtraite }).resultat;

  /**
   * L'expérience que la lettre doit raconter (D100).
   *
   * Constat du 1er octobre, sur une offre de bailleur social de 80 000
   * logements : la lettre est allée raconter un stage de 2023 dans une usine
   * de lingerie à Fès. Le moteur de sélection, lui, avait eu raison — il avait
   * classé Le Mans Métropole Habitat en première et deuxième position, avec le
   * quittancement d'un patrimoine de 18 000 logements et les charges
   * récupérables. TRIUMPH était dernier.
   *
   * La cause était dans le message, pas dans le modèle : le CV lui était
   * transmis sous l'intitulé « DÉJÀ SUR LE CV, À NE PAS REDIRE MOT POUR MOT ».
   * C'est-à-dire que la sélection la plus pertinente — celle que tout le
   * moteur travaille à produire — arrivait au rédacteur sous forme de **liste
   * noire**. Il l'a évitée, consciencieusement, et il est allé chercher la
   * seule expérience restante qui portait un chiffre.
   *
   * On lui nomme donc l'expérience, au lieu de la lui interdire. Le classement
   * est celui du CV, recalculé ici — `choisirNiveau` est gratuit et ne compose
   * aucun PDF — pour que la lettre soit juste même quand aucun CV n'a encore
   * été généré.
   */
  const donneesCV = await chargerDonneesCV(offre.volet, offreId);
  const retenues =
    donneesCV.experiences.length > 0
      ? choisirNiveau(donneesCV, analyse, offre.volet).selection.experiences.filter(
          (e) => e.missions.length > 0
        )
      : [];
  const aRaconter = retenues[0] ?? null;

  /**
   * Le corpus de cette expérience-là, et d'elle seule.
   *
   * Les puces du CV sont des résultats sans contexte — « Contrôlé
   * mensuellement le quittancement d'un patrimoine de 18 000 logements ». Pour
   * raconter une situation il faut ce qu'il y avait autour, et c'est dans le
   * corpus que ça se trouve. Cloisonné par expérience : ce qui a été fait chez
   * un employeur n'autorise rien chez un autre.
   */
  const corpusDeLExperience = aRaconter
    ? ((await chargerCorpus()).get(aRaconter.experience.id) ?? []).map(
        (l) => l.texte
      )
    : [];

  // Le CV déjà généré, pour que la lettre ne le répète pas mot pour mot.
  const { data: cvBrut } = await supabase
    .from("documents")
    .select("selection")
    .eq("offre_id", offreId)
    .eq("type", "cv")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const modeleCV = (cvBrut as { selection: { modele?: ModeleCV } } | null)
    ?.selection?.modele;

  /**
   * La lettre précédente, quand on demande un autre style (D80).
   *
   * « Réécrire dans un autre style » ne changeait presque rien, et la raison
   * était bête : on demandait au modèle de ne pas reprendre les tournures
   * d'une version qu'il n'avait jamais vue. Il retombait donc sur sa
   * formulation la plus probable — la même. On la lui montre désormais, avec
   * la consigne de s'en écarter.
   */
  const { data: lettrePrecedenteBrute } = changerDeStyle
    ? await supabase
        .from("documents")
        .select("contenu_texte, version")
        .eq("offre_id", offreId)
        .eq("type", "lettre")
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };

  const lettrePrecedente = lettrePrecedenteBrute as {
    contenu_texte: string | null;
    version: number;
  } | null;

  const parcours = await contexteParcours(offre.volet);

  // Sans la date du jour, le modèle a écrit « actuellement en poste jusqu'en
  // juin 2026 » trois mois après la fin du contrat. Il ne pouvait pas le
  // savoir : rien ne le lui disait.
  const aujourdhui = new Date().toLocaleDateString("fr-FR", {
    timeZone: "Europe/Paris",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const message = [
    `DATE DU JOUR : ${aujourdhui}`,
    "",
    `ANNONCE INTÉGRALE :\n${(offre.contenu_brut ?? "").slice(0, 8000)}`,
    "",
    `POSTE VISÉ : ${offre.intitule ?? ""} chez ${offre.entreprise ?? ""}`,
    // Le destinataire n'était pas transmis (D92) : le modèle rendait donc
    // toujours « Madame, Monsieur », et le code lui faisait confiance.
    offre.contact_nom
      ? `DESTINATAIRE : ${offre.contact_nom}. La lettre s'adresse à une personne identifiée : tu peux la citer dans le corps si c'est naturel, jamais de "Madame, Monsieur" à l'intérieur du texte.`
      : "DESTINATAIRE : inconnu. N'invente aucun nom et n'écris aucune formule nominative.",
    `VOLET : ${VOLETS[offre.volet].nom}`,
    "",
    `MISSIONS ATTENDUES : ${analyse.missions.map((m) => m.texte).join(" | ")}`,
    `COMPÉTENCES ATTENDUES : ${analyse.competences.map((c) => c.libelle).join(", ")}`,
    "",
    parcours.texte,
    "",
    // D100 — l'expérience est NOMMÉE, elle n'est plus laissée au choix du
    // rédacteur. C'est le classement du moteur face à cette offre précise, et
    // il est meilleur qu'une intuition de rédaction.
    aRaconter
      ? [
          "EXPÉRIENCE À RACONTER AU PARAGRAPHE 2 — CE N'EST PAS UN CHOIX :",
          `${aRaconter.experience.titre ?? ""} — ${aRaconter.experience.entreprise} ` +
            `(${aRaconter.experience.typeContrat})`,
          "C'est l'expérience que le moteur a classée la plus proche de cette offre, " +
            "sur les codes d'activité de l'annonce. Le paragraphe 2 raconte une situation " +
            "vécue LÀ, et nulle part ailleurs.",
          "",
          "Ce que le CV en dit déjà — la lettre ne recopie pas ces phrases, elle " +
            "raconte ce qu'il y avait autour : le problème, ce qui a été fait, ce que " +
            "ça a donné :",
          ...aRaconter.missions.map((m) => `  • ${m.texte}`),
          corpusDeLExperience.length > 0
            ? "\nLe détail de cette expérience, d'où tirer le contexte et la situation " +
              "(aucune de ces lignes n'est sur le CV) :\n" +
              corpusDeLExperience.map((t) => `  • ${t}`).join("\n")
            : "",
          "",
          retenues[1]
            ? `Si et seulement si cette expérience ne contient rien qui réponde à l'annonce, ` +
              `prends ${retenues[1].experience.entreprise} — et dis-le en une phrase avant le JSON.`
            : "",
        ]
          .filter(Boolean)
          .join("\n")
      : "",
    "",
    modeleCV
      ? `LE RESTE DU CV JOINT, À NE PAS RECOPIER MOT POUR MOT :\n${modeleCV.experiences
          .flatMap((e) => e.missions.map((m) => `  • ${m.texte}`))
          .join("\n")}`
      : "",
    lettrePrecedente?.contenu_texte
      ? `VERSION PRÉCÉDENTE DE CETTE LETTRE — tu dois t'en écarter nettement. N'en reprends aucune phrase, aucune ouverture, aucune transition. Les faits, eux, restent les mêmes :\n${lettrePrecedente.contenu_texte.slice(
          0,
          3000
        )}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  /**
   * Le style tourne avec la version, au lieu d'être tiré au sort.
   *
   * Quatre styles tirés au hasard, c'est une chance sur quatre de retomber
   * sur le même — et l'impression, justifiée, que le bouton ne fait rien.
   */
  const style = changerDeStyle
    ? STYLES[(lettrePrecedente?.version ?? 0) % STYLES.length]
    : "";

  const reponse = await appelIA({
    modele: MODELE_REDACTION,
    systeme: style ? `${SYSTEME}\n\nCONSIGNE DE STYLE POUR CETTE VERSION\n${style}\nNe reprends pas les tournures d'une version précédente.` : SYSTEME,
    message,
    // Une lettre et un email, en JSON avec ses
    // échappements, dépassent largement 3000 jetons : la réponse était coupée
    // en plein milieu et le JSON illisible. Le premier essai a coûté deux
    // appels facturés pour rien.
    maxTokens: 8000,
    tache: "lettre_motivation",
    offreId,
  });

  let brut: {
    lettre: {
      objet: string;
      formuleAppel: string;
      paragraphes: string[];
      formulePolitesse: string;
    };
    email: { objet: string; corps: string };
  };
  try {
    brut = JSON.parse(extraireJson(reponse.texte));
    if (!brut.lettre?.paragraphes?.length) throw new Error("format");
  } catch {
    // Le début de la réponse brute est remonté : sans lui, il faut aller
    // fouiller les journaux pour comprendre, comme cela s'est produit.
    throw new ErreurIA(
      "La réponse du modèle n'était pas exploitable. Début reçu : " +
        reponse.texte.trim().slice(0, 200)
    );
  }

  const p = parcours.profil;
  const ville = (offre.localisation ?? "").split(",")[0].trim();
  const villeExpediteur = (p.localisation ?? "").split(",")[0].trim();

  const modele: ModeleLettre = {
    expediteur: [
      nettoyer([p.prenom, p.nom], " "),
      p.localisation ?? "",
      p.telephone ?? "",
      p.email ?? "",
    ].filter(Boolean),
    // Sans nom d'entreprise, on adresse le service plutôt que la ville : une
    // lettre dont l'en-tête ne portait que « Troyes » ne ressemblait à rien.
    destinataire: [
      offre.entreprise?.trim() || "Service recrutement",
      offre.contact_nom ?? "",
      offre.contact_adresse ?? "",
      ville,
    ].filter(Boolean),
    // Fuseau explicite : le serveur travaille en UTC, et une lettre rédigée
    // après minuit affichait la veille.
    lieuDate: `${villeExpediteur || "France"}, le ${new Date().toLocaleDateString(
      "fr-FR",
      {
        timeZone: "Europe/Paris",
        day: "numeric",
        month: "long",
        year: "numeric",
      }
    )}`,
    objet: brut.lettre.objet,
    // La formule d'appel est calculée, plus demandée au modèle (D92) : une
    // civilité est un fait, elle n'a pas à dépendre d'une génération.
    formuleAppel: formuleAppel(offre.contact_nom),
    paragraphes: brut.lettre.paragraphes,
    formulePolitesse: brut.lettre.formulePolitesse,
    signature: nettoyer([p.prenom, p.nom], " "),
    meta: { volet: offre.volet, genereLe: new Date().toISOString() },
  };

  // Ancrage : chaque fait vérifiable doit exister dans le parcours ou dans
  // l'annonce. Le résultat est signalé, jamais bloquant.
  const corpus = [parcours.corpus, offre.contenu_brut ?? "", offre.entreprise ?? ""].join(
    "\n"
  );
  const ancrage = verifierAncrage(
    [...modele.paragraphes, modele.objet].join("\n"),
    corpus
  );

  // Style : ce que l'ancrage ne voit pas (D93). Formules d'appel et de
  // politesse exclues — elles ont leurs propres conventions, et « Madame,
  // Monsieur » n'est pas une phrase nominale à corriger.
  const defautsStyle = verifierStyle(modele.paragraphes);

  const { data: derniere } = await supabase
    .from("documents")
    .select("version")
    .eq("offre_id", offreId)
    .eq("type", "lettre")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const version = ((derniere as { version: number } | null)?.version ?? 0) + 1;

  const documentLettreId = randomUUID();
  const documentEmailId = randomUUID();
  const chemin = `lettre/${offreId}/${documentLettreId}.pdf`;

  const pdf = await rendreLettre(modele);
  const { error: erreurStockage } = await supabase.storage
    .from("documents")
    .upload(chemin, pdf, { contentType: "application/pdf", upsert: true });

  const { error } = await supabase.from("documents").insert([
    {
      id: documentLettreId,
      offre_id: offreId,
      type: "lettre",
      volet: offre.volet,
      version,
      storage_path: erreurStockage ? null : chemin,
      contenu_texte: lettreEnTexte(modele),
      selection: { schema: SCHEMA_SELECTION, modele, ancrage, style: defautsStyle },
      cout_usd: reponse.coutUsd,
    },
    {
      id: documentEmailId,
      offre_id: offreId,
      type: "email",
      volet: offre.volet,
      version,
      contenu_texte: `${brut.email.objet}\n\n${brut.email.corps}`,
      selection: { email: brut.email },
      cout_usd: 0,
    },
  ]);

  if (error) {
    throw new ErreurCV(
      `La lettre a été rédigée mais n'a pas pu être enregistrée : ${error.message}`
    );
  }

  await purgerAnciennesVersions(offreId, "lettre");
  await purgerAnciennesVersions(offreId, "email");

  return {
    documentLettreId,
    documentEmailId,
    version,
    modele,
    email: brut.email,
    ancrage,
    style: defautsStyle,
    coutUsd: reponse.coutUsd,
  };
}

/** Réenregistre une lettre corrigée à la main et recompose le PDF. */
export async function enregistrerLettreCorrigee(
  documentId: string,
  paragraphes: string[]
): Promise<void> {
  const supabase = creerClientServeur();

  const { data } = await supabase
    .from("documents")
    .select("id, offre_id, selection, storage_path")
    .eq("id", documentId)
    .maybeSingle();
  const doc = data as {
    offre_id: string;
    selection: { modele?: ModeleLettre; ancrage?: Ancrage };
    storage_path: string | null;
  } | null;
  if (!doc?.selection?.modele) throw new ErreurCV("Lettre introuvable.");

  const modele: ModeleLettre = {
    ...doc.selection.modele,
    paragraphes: paragraphes.filter((p) => p.trim().length > 0),
  };

  const pdf = await rendreLettre(modele);
  const chemin = doc.storage_path ?? `lettre/${doc.offre_id}/${documentId}.pdf`;
  await supabase.storage
    .from("documents")
    .upload(chemin, pdf, { contentType: "application/pdf", upsert: true });

  await supabase
    .from("documents")
    .update({
      contenu_texte: lettreEnTexte(modele),
      selection: { ...doc.selection, modele },
      storage_path: chemin,
    })
    .eq("id", documentId);
}

const SYSTEME_EMAIL = `Tu rédiges l'email qui accompagne une candidature déjà rédigée.

Cinq à huit lignes, sobres. Il annonce la candidature et les pièces jointes, donne une raison de lire la lettre, sans la répéter ni la résumer. Aucun fait qui ne soit dans la lettre fournie.

Registre professionnel français, vouvoiement, pas de "n'hésitez pas", pas de superlatif.

Tu réponds UNIQUEMENT par un objet JSON :
{"objet": "...", "corps": "..."}`;

/**
 * Réécrit le seul email, sans retoucher la lettre.
 *
 * Souvent la lettre convient et l'email tombe à côté. Tout régénérer coûterait
 * un appel complet et ferait perdre une lettre validée.
 */
export async function regenererEmailPourOffre(offreId: string): Promise<void> {
  const supabase = creerClientServeur();

  const { data: offreBrute } = await supabase
    .from("offres")
    .select("volet, intitule, entreprise")
    .eq("id", offreId)
    .maybeSingle();
  if (!offreBrute) throw new ErreurCV("Offre introuvable.");
  const offre = offreBrute as {
    volet: CodeVolet;
    intitule: string | null;
    entreprise: string | null;
  };

  const { data: lettreBrute } = await supabase
    .from("documents")
    .select("contenu_texte, version")
    .eq("offre_id", offreId)
    .eq("type", "lettre")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const lettre = lettreBrute as { contenu_texte: string; version: number } | null;
  if (!lettre) {
    throw new ErreurCV("Rédige d'abord la lettre : l'email s'appuie dessus.");
  }

  const reponse = await appelIA({
    modele: MODELE_REDACTION,
    systeme: SYSTEME_EMAIL,
    message: [
      `POSTE : ${offre.intitule ?? ""} chez ${offre.entreprise ?? "l'entreprise"}`,
      "",
      "LETTRE JOINTE :",
      lettre.contenu_texte,
    ].join("\n"),
    maxTokens: 1200,
    tache: "email_candidature",
    offreId,
  });

  let email: { objet: string; corps: string };
  try {
    email = JSON.parse(extraireJson(reponse.texte));
    if (!email.corps) throw new Error("format");
  } catch {
    throw new ErreurIA(
      "La réponse du modèle n'était pas exploitable. Début reçu : " +
        reponse.texte.trim().slice(0, 200)
    );
  }

  const { data: derniere } = await supabase
    .from("documents")
    .select("version")
    .eq("offre_id", offreId)
    .eq("type", "email")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  await supabase.from("documents").insert({
    offre_id: offreId,
    type: "email",
    volet: offre.volet,
    version: ((derniere as { version: number } | null)?.version ?? 0) + 1,
    contenu_texte: `${email.objet}\n\n${email.corps}`,
    selection: { email },
    cout_usd: reponse.coutUsd,
  });

  await purgerAnciennesVersions(offreId, "email");
}
