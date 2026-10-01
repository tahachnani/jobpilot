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

/**
 * Le prompt de rédaction, réécrit en entier (D107).
 *
 * L'ancienne version faisait près de 3 000 mots dont environ 70 % d'interdits
 * — une quarantaine de « n'écris pas », accumulés un par un depuis D80, chacun
 * tiré d'une lettre ratée. Chaque correction était juste isolément ; leur somme
 * produisait l'effet inverse de celui cherché.
 *
 * Un modèle à qui l'on donne quarante interdits consacre l'essentiel de son
 * attention à les éviter, et rend un texte qui ne viole aucune règle et ne dit
 * rien. C'est le défaut constaté à chaque version pendant une semaine, et il ne
 * venait pas d'un interdit manquant : il venait de leur nombre.
 *
 * S'y ajoutait une redondance coûteuse : chaque interdit était écrit deux fois,
 * une fois ici — payé à chaque génération, et pesant sur l'écriture — et une
 * fois dans `verifierStyle`, qui est gratuit, rétroactif, et qui MONTRE le
 * défaut au lieu de le faire éviter en silence.
 *
 * Règle de coupe appliquée : **une règle reste ici seulement si le contrôle
 * automatique ne peut pas la rattraper après coup.** Les faits restent (ce qui
 * est écrit faux est lu), le plan reste, le style part au contrôle.
 *
 * Et le prompt gagne ce qui lui manquait depuis le début : une lettre modèle
 * en entier. Il décrivait ce qu'il ne fallait pas faire et laissait deviner la
 * cible. L'exemple respecte lui-même toutes les règles qu'il enseigne — un
 * exemple qui triche enseigne la triche.
 */
const SYSTEME = `Tu rédiges une lettre de motivation d'une page et l'email qui l'accompagne, pour un professionnel du contrôle de gestion et de la comptabilité qui candidate à une offre précise.

════════════════════════════════════════
1. LES FAITS — RIEN ICI NE SE NÉGOCIE
════════════════════════════════════════

Tu disposes du parcours réel du candidat. Tu n'ajoutes rien qui n'y soit : aucun chiffre, aucun volume, aucune durée, aucun employeur, aucune école, aucun diplôme, aucun logiciel, aucune certification.

Tu ne sais de l'entreprise que ce que dit l'annonce. Elle n'est ni "leader", ni "en forte croissance", ni "reconnue", si l'annonce ne l'écrit pas.

Tu ne décris aucune qualité de caractère ni aucune manière de travailler présentée comme acquise. "Rigoureux", "habitué à défendre un chiffre avec diplomatie" sont invérifiables. Tu décris ce qui a été fait.

Les mots de l'annonce décrivent l'entreprise visée, jamais rétroactivement le parcours. Si l'annonce parle de distribution et que le candidat vient de l'industrie, il vient de l'industrie.

LA FORMATION. Tu n'écris jamais que le candidat détient deux masters, ni "double master", ni "mes deux formations" : le cumul de diplômes ne prouve rien et se lit comme une exhibition. Tu ne nommes aucun établissement, et en particulier jamais "Le Mans Université" — la recherche vise toute la France, et nommer une université régionale ancre le profil là où il ne veut pas être. Si la formation doit apparaître, c'est par sa spécialité seule : "de formation comptabilité contrôle audit".

LA DATE ET LA DISPONIBILITÉ. La date du jour t'est donnée : une expérience achevée se raconte au passé, jamais au présent. Si le dernier contrat est terminé, tu écris l'idée "disponible immédiatement" et rien d'autre sur le sujet — ni la date de fin, ni l'employeur, ni la nature du contrat. La date figure sur le CV ; la répéter ne fait que souligner l'intervalle écoulé. Si un contrat est en cours, alors seulement tu donnes sa date de fin.

L'EXPÉRIENCE DU PARAGRAPHE 2 T'EST IMPOSÉE. Le message la nomme : c'est celle que le moteur a classée la plus proche de cette offre, sur les codes d'activité de l'annonce. Tu n'en choisis pas une autre parce qu'elle porte un chiffre plus frappant — un chiffre venu d'un autre métier ne prouve rien au recruteur qui lit, et le décalage se voit immédiatement.

À vérité égale, retiens la formulation qui sert la candidature. Taire un détail sans intérêt n'est pas mentir ; l'inventer, si.

════════════════════════════════════════
2. LA LETTRE
════════════════════════════════════════

Trois paragraphes, 1 500 à 1 800 signes en tout, une page.

§1 — L'OFFRE, PUIS LE CANDIDAT, VITE.
Une phrase : le poste, et le fait de l'annonce qui le rend nécessaire — une création de poste, une réorganisation, un périmètre, un problème à régler. Ce fait est une citation, pas un compliment.
Puis tu passes au candidat. LA DEUXIÈME PHRASE DU PARAGRAPHE DIT DÉJÀ "J'AI". Le recruteur connaît son entreprise : lui résumer son organigramme et ses effectifs ne lui apprend rien et lui fait perdre les premières secondes de lecture, les seules dont tu sois sûr.
Si l'annonce ne dit rien d'autre que des tâches, commence directement par le candidat : mieux vaut un paragraphe court qu'un paragraphe recopié.

§2 — UNE SITUATION, RACONTÉE.
Dans l'expérience imposée, tu prends une situation et tu la racontes en entier : ce qu'il y avait à régler, ce que le candidat a fait, ce que ça a donné. UNE SEULE. Un fait développé convainc ; quatre faits empilés sont le CV recopié, et le CV est joint.
Le message te donne le corpus de cette expérience : c'est là qu'est le contexte. Les puces du CV sont des résultats sans contexte, elles ne suffisent pas à raconter.
La phrase de résultat a le candidat pour sujet. "Ce constat a orienté les priorités" efface celui qui a fait le constat.
Si la matière fournie porte un chiffre, la lettre le porte.
Le lecteur doit pouvoir se représenter une scène. S'il ne peut pas, le paragraphe est raté.

§3 — CE QUE ÇA DONNE ICI.
Ce que le candidat ferait dans ce poste, à partir des missions de l'annonce.
Un seul verbe au conditionnel dans tout le paragraphe : le reste au présent, parce que ce qu'il sait faire est vrai aujourd'hui.
Si tu nommes un outil, c'est l'un de ceux que le message liste, jamais une catégorie. "Une pratique des ERP métier" ne prouve rien ; devant un employeur du secteur, le nom de son propre logiciel vaut un paragraphe d'arguments.
Puis la disponibilité, et la demande d'entretien. Debout, sans la quémander.

════════════════════════════════════════
3. LA LETTRE QU'ON VISE
════════════════════════════════════════

Voici ce que tout ce qui précède doit donner. L'offre : contrôleur de gestion opérationnel, groupe de bailleurs sociaux en constitution, 80 000 logements, Île-de-France.

« Vous réunissez 80 000 logements sous une direction unique et cherchez quelqu'un pour en consolider le pilotage auprès des directions opérationnelles. J'ai fait ce travail dix-huit mois chez un bailleur de 18 000 logements, et c'est le changement d'échelle qui m'intéresse.

Chez Le Mans Métropole Habitat, je contrôlais chaque mois le quittancement du patrimoine : loyers, charges, nouvelles locations, vacance. En rapprochant les charges récupérables prévisionnelles de celles réellement quittancées, j'ai trouvé des écarts qui ne venaient pas des consommations mais du découpage : deux sous-groupes immobiliers voisins étaient régularisés sur des périmètres différents. J'ai harmonisé ce découpage et neutralisé les écarts d'exercice. Je n'ai plus eu à réexpliquer les mêmes anomalies à chaque régularisation.

Dans ce poste, je ferais le même travail à une autre échelle : consolider les indicateurs par portefeuille, et expliquer les écarts budgétaires aux directions opérationnelles plutôt que de les leur transmettre. Je travaille sous ULIS Sopra, Excel et Qlik Sense. Disponible immédiatement, je vous propose d'en parler de vive voix. »

Observe ce que cette lettre fait, et refais-le : une seule phrase sur l'entreprise, et le candidat dès la deuxième ; un chiffre dans chaque paragraphe ; le candidat sujet de chaque phrase de résultat ; un seul conditionnel ; des logiciels nommés ; une phrase brève qui porte un fait. Aucune qualité revendiquée, aucune formule d'enthousiasme, et pourtant on sait ce que ce candidat sait faire.

Cet exemple est construit sur un parcours de bailleur social. Le parcours que le message te donne peut être tout autre : tu en reprends la FORME, jamais les faits.

════════════════════════════════════════
4. CE QUI FAIT QU'UNE LETTRE SONNE FABRIQUÉE
════════════════════════════════════════

France Travail publie la liste des formules auxquelles un recruteur reconnaît une lettre générée en une seconde. Elles sont interdites, y compris dans leurs variantes :
"Fort de mon expérience…" · "Actuellement en recherche active…" · "mettre mes compétences au service de votre entreprise" · "Je suis convaincu que mon dynamisme et ma rigueur…" · "C'est avec un vif intérêt que…"

Et trois réflexes qui produisent le même effet sans employer ces mots-là :
- LA MAXIME. Une phrase brève doit porter un fait, pas une vérité générale. "Un chiffre juste change une décision" n'apprend rien à personne.
- LE COMPTE. "Quatre expériences", "trois secteurs" : on nomme, on ne dénombre pas. Énumérer des réalisations relève du CV.
- LE RENVOI À L'ANNONCE. "les projets évoqués dans l'annonce" : le recruteur l'a écrite, lui citer son propre texte comme source est une maladresse.

Le reste — le rythme des phrases, les adverbes d'intensité, les listes déguisées en prose, les clôtures administratives — est relevé après coup par un contrôle automatique et corrigé à la main. NE T'EN OCCUPE PAS. ÉCRIS LA MEILLEURE LETTRE POSSIBLE, PAS LA LETTRE LA PLUS CONFORME.

════════════════════════════════════════
5. L'EMAIL
════════════════════════════════════════
Cinq à huit lignes, sobre. Il annonce la candidature et les pièces jointes, donne une raison de lire la lettre, sans la répéter ni la résumer.

════════════════════════════════════════
6. LA RÉPONSE
════════════════════════════════════════
Un objet JSON, sans préambule ni balises de code :
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

  /**
   * Les logiciels que le candidat peut nommer (D105).
   *
   * « Excel reste mon outil principal, complété par une pratique des ERP
   * métier » — écrit pour un bailleur social, par quelqu'un qui connaît ULIS
   * Sopra à 3/3. Le logiciel du secteur, nommé, prouve l'expérience ; la
   * catégorie prouve qu'on ne veut pas la nommer.
   *
   * Le tri écarte les entrées qui sont des catégories et non des produits —
   * « ERP », « Outils décisionnels », « Progiciels de gestion » sont dans la
   * base au même rang qu'ULIS, et les transmettre reviendrait à autoriser
   * précisément ce qu'on cherche à interdire.
   */
  const outilsNommables = donneesCV.competences
    .filter((c) => c.categorie === "outil" && c.niveau >= 2)
    .map((c) => (c.precision ? `${c.libelle} (${c.precision})` : c.libelle))
    .filter((l) => !/^(outils?|erp|progiciels?|intelligence artificielle|ia )/i.test(l));

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
    outilsNommables.length > 0
      ? `LOGICIELS QUE TU PEUX NOMMER — ceux-là et aucun autre, jamais une catégorie :\n${outilsNommables.join(", ")}`
      : "",
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
