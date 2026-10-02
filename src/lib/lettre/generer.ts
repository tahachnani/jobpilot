import { randomUUID } from "crypto";
import { creerClientServeur } from "@/lib/supabase/server";
import {
  appelIA,
  ErreurIA,
  MODELE_EXTRACTION,
  MODELE_REDACTION,
} from "@/lib/anthropic";
import { VOLETS, type CodeVolet } from "@/config/volets";
import type { OffreExtraite } from "@/lib/extraction-offre";
import { ErreurCV } from "@/lib/cv/generer";
import { chargerDonneesCV } from "@/lib/cv/donnees";
import { chargerCorpus } from "@/lib/cv/corpus";
import { choisirNiveau } from "@/lib/cv/compacite";
import { classerSituations } from "@/lib/cv/situations";
import { ficheEnTexte, ficheOuRecherche } from "@/lib/entreprise/fiche";
import { referenceAnnonce } from "@/lib/offre/reference";
import { sousVerrou } from "@/lib/verrou";
import {
  messageEnTexte,
  normaliserMessages,
  type Messages,
} from "@/lib/lettre/messages";
import { libelleOrigine } from "@/config/origines";
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
2. LA LETTRE — QUATRE PARAGRAPHES
════════════════════════════════════════

Quatre paragraphes, 1 700 à 2 000 signes en tout, une page. C'est la structure
attendue en France : l'objet, l'entreprise, le candidat, la projection.

ELLE MONTE EN PUISSANCE. Un crescendo demande un départ plat : le premier
paragraphe est administratif et bref, et c'est voulu. N'ouvre JAMAIS sur
"Vous recherchez un contrôleur de gestion pour…" — attaquer sur le besoin de
l'annonce grille la montée et ne ressemble pas à une lettre.

§1 — L'OBJET (environ 250 signes, deux phrases au plus)
Le poste nommé, où l'annonce a été vue, et sa référence si le message en donne
une. Rien d'autre : ni argument, ni enthousiasme, ni "a retenu mon attention".
Exemple de ton : "Je vous adresse ma candidature au poste de Contrôleur de
Gestion Opérationnel, publié sur HelloWork sous la référence 2026-132550."

§2 — L'ENTREPRISE (environ 400 signes, UNE SEULE PHRASE SI C'EST TOUT CE QU'ON SAIT)
Pourquoi celle-là. Tu t'appuies UNIQUEMENT sur ce que le message te donne : la fiche entreprise si elle est présente, sinon les faits que l'annonce porte sur elle.

CE PARAGRAPHE NE PARLE PAS DU CANDIDAT. C'est la règle entière, et elle n'a pas d'exception.
Le §3 démontre ce qu'il sait faire, avec une situation vécue. Si le §2 l'annonce — "c'est l'exercice que j'ai mené dans mes expériences précédentes", "ce type de mission m'est familier", "mon parcours m'y a préparé" — il promet sans preuve ce que le paragraphe suivant va prouver, et il affaiblit les deux. Ces phrases sont INTERDITES.

LA LONGUEUR S'ADAPTE À LA MATIÈRE, ELLE NE SE REMPLIT PAS.
Si tu disposes d'un seul fait sur l'entreprise, tu écris UNE phrase et tu passes au §3. Un paragraphe court est honnête ; un paragraphe étiré avec une affirmation sur le candidat est du remplissage, et c'est exactement ce que le lecteur repère.
400 signes est un plafond, jamais un objectif à atteindre.

INTERDIT : les mots-valeurs. "Acteur reconnu", "valeurs d'excellence", "place l'humain au cœur de sa stratégie" sont du texte de plaquette ; un recruteur les lit cinquante fois par semaine et ils ne distinguent rien.

SI LE MESSAGE DIT QU'AUCUNE INFORMATION N'EST DISPONIBLE, tu écris une phrase sur ce qui attire dans le métier ou le secteur tels que l'annonce les décrit, et tu passes. Tu n'inventes rien sur l'entreprise : c'est le premier endroit qu'un recruteur vérifie.

§3 — LE CANDIDAT (environ 800 signes)
C'est le paragraphe qui porte la lettre.
L'EXPÉRIENCE T'EST IMPOSÉE : le message la nomme, c'est celle que le moteur a
classée la plus proche de cette offre.
LES SITUATIONS AUSSI SONT CLASSÉES : le message te donne les lignes de cette
expérience dans l'ordre de leur pertinence face à cette annonce. Tu prends la
PREMIÈRE, ou la deuxième si elle raconte mieux. Tu ne descends pas chercher au
bas de la liste une anecdote plus plaisante : si l'annonce porte sur du
contrôle de gestion, une histoire de gestion locative ne pèse rien, même bien
racontée.
Tu racontes UNE SEULE situation, en entier : ce qu'il y avait à régler, ce que
le candidat a fait, ce que ça a donné. Un fait développé convainc ; quatre
faits empilés sont le CV recopié, et le CV est joint.
La phrase de résultat a le candidat pour sujet. "Ce constat a orienté les
priorités" efface celui qui a fait le constat.
Si la matière fournie porte un chiffre, la lettre le porte.
Le lecteur doit pouvoir se représenter une scène. S'il ne peut pas, le
paragraphe est raté.

§4 — LA PROJECTION ET L'ENTRETIEN (environ 400 signes)
Ce que le candidat ferait dans ce poste, à partir des missions de l'annonce, et
en quoi son parcours y répond.
Les verbes de projection vont au conditionnel, et ils peuvent être plusieurs :
"je consoliderais, je construirais, j'identifierais" est correct. Ce qui est
interdit, c'est de mélanger les deux dans une même phrase coordonnée —
"je consoliderais les résultats et je construis les tableaux" est une faute.
Ce que le candidat sait faire aujourd'hui se dit au présent, dans une phrase
séparée.
Si tu nommes un outil, c'est l'un de ceux que le message liste, jamais une
catégorie. "Une pratique des ERP métier" ne prouve rien ; devant un employeur
du secteur, le nom de son propre logiciel vaut un paragraphe d'arguments. Tu ne
cites pas un outil que le message signale comme acquis en formation seulement.
Puis la disponibilité, et la demande d'entretien. Debout, sans la quémander.
L'intérêt pour le poste se montre par la précision de ce qui précède, jamais
par une déclaration d'enthousiasme.

════════════════════════════════════════
3. LA LETTRE QU'ON VISE
════════════════════════════════════════

Voici ce que tout ce qui précède doit donner. L'offre : contrôleur de gestion opérationnel, groupe de bailleurs sociaux en constitution, 80 000 logements répartis sur 35 organismes, Île-de-France.

« Je vous adresse ma candidature au poste de Contrôleur de Gestion Opérationnel, publié sur HelloWork sous la référence 179510151W.

Vous réunissez 35 organismes et 80 000 logements sous une direction unique, et ce poste existe pour que cette échelle devienne comparable d'un organisme à l'autre. C'est le travail que je préfère : rendre des chiffres venus de sources différentes effectivement comparables.

Chez Le Mans Métropole Habitat, je contrôlais chaque mois le quittancement d'un patrimoine de 18 000 logements : loyers, charges, nouvelles locations, vacance. En rapprochant les charges récupérables prévisionnelles de celles réellement quittancées, j'ai trouvé des écarts qui ne venaient pas des consommations mais du découpage : deux sous-groupes immobiliers voisins étaient régularisés sur des périmètres différents. J'ai harmonisé ce découpage et neutralisé les écarts d'exercice. Je n'ai plus eu à réexpliquer les mêmes anomalies à chaque régularisation.

Dans ce poste, je consoliderais les remontées des 35 organismes et je construirais les tableaux qui comparent leurs coûts de gestion. Décomposer un écart jusqu'à sa cause est ce que j'ai fait chaque mois pendant dix-huit mois, et c'est exactement ce que demande une comparaison entre entités. Je travaille sous ULIS Sopra, Excel et Qlik Sense. Disponible immédiatement, je vous propose d'en parler de vive voix. »

Observe ce que cette lettre fait, et refais-le : un premier paragraphe plat et bref ; une seule phrase sur l'entreprise, adossée à un fait, puis le candidat ; un chiffre dans chaque paragraphe qui en porte un ; le candidat sujet de chaque phrase de résultat ; les conditionnels groupés dans le dernier paragraphe, sans mélange avec le présent ; des logiciels nommés. Aucune qualité revendiquée, aucune formule d'enthousiasme, et pourtant on sait ce que ce candidat sait faire.

Cet exemple est construit sur un parcours de bailleur social. Le parcours que le message te donne peut être tout autre : tu en reprends la FORME et le DEGRÉ DE PRÉCISION, jamais les faits ni les tournures. En particulier, ne recopie aucune de ses phrases — « c'est le travail que je préfère », « jusqu'à sa cause » sont des formulations de cet exemple, pas des formules à réemployer.

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
6. LES DEUX MESSAGES COURTS
════════════════════════════════════════
Beaucoup de plateformes ne demandent pas de lettre mais un champ de texte plafonné en caractères. Tu produis donc deux messages, au même titre que la lettre.

UN MESSAGE N'EST PAS UNE LETTRE RACCOURCIE. Aucune formule d'appel, aucune formule de politesse, aucune signature, aucun objet : ces éléments n'ont pas de sens dans un champ de formulaire, et collés là ils signalent un texte recyclé. Le message commence directement par la première phrase utile et s'arrête à la dernière.

Il garde en revanche tout le reste des règles : aucun fait inventé, l'expérience imposée, la situation la mieux classée, le candidat sujet des verbes, un chiffre s'il y en a un, et aucune des formules de la section 4.

"court" — 380 à 450 signes. Trois phrases, au plus quatre. Il ne contient qu'une chose : le poste, UN fait du parcours qui y répond, la disponibilité. Rien sur l'entreprise : il n'y a pas la place, et une demi-phrase de contexte y serait du remplissage.

"moyen" — 800 à 900 signes, deux ou trois paragraphes. Le poste et ce qu'il demande, la situation racontée brièvement — problème, action, résultat — puis les outils et la disponibilité.

Les deux doivent pouvoir être collés tels quels. Compte les signes : un message qui dépasse sa cible oblige à couper à la main dans un formulaire, c'est-à-dire au pire moment.

════════════════════════════════════════
7. LA RÉPONSE
════════════════════════════════════════
Un objet JSON, sans préambule ni balises de code :
{
  "lettre": {
    "objet": "Objet : ...",
    "formuleAppel": "Madame, Monsieur,",
    "paragraphes": ["...", "...", "...", "..."],
    "formulePolitesse": "..."
  },
  "email": { "objet": "...", "corps": "..." },
  "messages": { "court": "...", "moyen": "..." }
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
  /** Les deux messages courts, produits dans le même appel (D112). */
  messages: Messages;
  documentMessageId: string | null;
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

/**
 * Tout ce qu'il faut pour rédiger, rassemblé une fois (D112).
 *
 * La lettre et les messages courts partent du même dossier : la même annonce,
 * le même parcours, la même expérience imposée, la même fiche entreprise, les
 * mêmes situations classées. Seul le prompt et la longueur attendue changent.
 *
 * L'assemblage est donc extrait ici plutôt que recopié. Deux copies d'une
 * centaine de lignes auraient divergé au premier correctif — et l'historique
 * de ce fichier montre qu'il y a un correctif par jour.
 */
interface Dossier {
  offre: {
    volet: CodeVolet;
    intitule: string | null;
    entreprise: string | null;
    localisation: string | null;
    contenu_brut: string | null;
    contact_nom: string | null;
    contact_adresse: string | null;
    origine: string | null;
  };
  message: string;
  style: string;
  parcours: { texte: string; corpus: string; profil: Record<string, string | null> };
  versionPrecedente: number;
  /**
   * La fiche entreprise telle qu'elle a servi, pour que la lettre puisse
   * enregistrer d'où vient son §2 (D114). Elle est résolue pendant l'assemblage
   * et consommée à l'enregistrement : sans ce passage, elle reste prisonnière
   * de `rassemblerDossier` — ce qui a cassé le build du 2 octobre.
   */
  fiche: Awaited<ReturnType<typeof ficheOuRecherche>> | null;
}


async function rassemblerDossier(
  offreId: string,
  changerDeStyle = false
): Promise<Dossier> {
  const supabase = creerClientServeur();

  const { data: offreBrute } = await supabase
    .from("offres")
    .select(
      "id, volet, intitule, entreprise, localisation, contenu_brut, contact_nom, contact_adresse, origine"
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
    origine: string | null;
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
  // Classées face à l'annonce (D110) et non dans l'ordre de saisie : corriger
  // le choix de l'expérience sans classer ce qu'elle contient ne faisait que
  // déplacer le problème d'un cran.
  const corpusDeLExperience = aRaconter
    ? classerSituations(
        (await chargerCorpus()).get(aRaconter.experience.id) ?? [],
        analyse
      ).map((l) => l.texte)
    : [];

  /**
   * La fiche entreprise, pour le §2 (D108).
   *
   * Trois issues, et deux d'entre elles ne coûtent rien : une fiche déjà en
   * base est réutilisée, une annonce qui se suffit dispense de chercher. La
   * recherche n'a lieu que dans le troisième cas.
   *
   * L'échec n'interrompt pas la rédaction : une lettre sans §2 documenté est
   * une lettre plus courte, pas une erreur. Le prompt prévoit explicitement ce
   * cas et demande deux lignes honnêtes plutôt qu'un paragraphe inventé.
   */
  let fiche: Awaited<ReturnType<typeof ficheOuRecherche>> | null = null;
  try {
    fiche = await ficheOuRecherche(
      offre.entreprise,
      offre.contenu_brut,
      offreId
    );
  } catch (e) {
    console.error(`[lettre] fiche entreprise indisponible : ${String(e)}`);
  }

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
    // Ce qu'il faut pour écrire le §1 sans rien inventer (D111). Chaque
    // élément absent est dit absent : sans cela le modèle comble, et une
    // référence inventée en tête de lettre est pire que pas de référence.
    `OÙ L'ANNONCE A ÉTÉ VUE : ${
      libelleOrigine(offre.origine) ??
      "inconnu — n'écris alors ni plateforme ni site, dis seulement le poste"
    }`,
    `RÉFÉRENCE DE L'ANNONCE : ${
      referenceAnnonce(offre.contenu_brut) ??
      "aucune trouvée — n'en invente pas, le §1 se passe de référence"
    }`,
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
    // D108 — la matière du §2. Soit la fiche cherchée, soit les faits que
    // l'annonce porte déjà, soit l'aveu qu'il n'y a rien : dans les trois cas
    // le modèle sait sur quoi il peut s'appuyer, et sur quoi il ne peut pas.
    fiche?.fiche
      ? ficheEnTexte(fiche.fiche)
      : fiche?.documentation.faits.length
        ? `CE QUE L'ANNONCE DIT DE L'ENTREPRISE — ta seule source pour le §2, aucune recherche n'a été faite :\n${fiche.documentation.faits
            .map((f) => `  • ${f}`)
            .join("\n")}`
        : "AUCUNE INFORMATION SUR L'ENTREPRISE. Le §2 ne doit donc rien affirmer d'elle : deux lignes sur ce qui attire dans le métier ou le secteur tel que l'annonce le décrit, et tu passes au §3.",
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

  return {
    offre,
    message,
    style,
    parcours,
    fiche,
    versionPrecedente: lettrePrecedente?.version ?? 0,
  };
}

export async function genererLettrePourOffre(
  offreId: string,
  changerDeStyle = false
): Promise<ResultatLettre> {
  // D115 — un second clic pendant qu'une génération tourne coûtait le prix
  // entier une deuxième fois. Le verrou est côté serveur parce que la
  // désactivation du bouton ne survit ni au rechargement ni à l'expiration
  // d'une requête de soixante secondes.
  return sousVerrou(`lettre:${offreId}`, () => redigerLettre(offreId, changerDeStyle));
}

async function redigerLettre(
  offreId: string,
  changerDeStyle: boolean
): Promise<ResultatLettre> {
  const supabase = creerClientServeur();
  const { offre, message, style, parcours, fiche } = await rassemblerDossier(
    offreId,
    changerDeStyle
  );


  const reponse = await appelIA({
    modele: MODELE_REDACTION,
    systeme: style ? `${SYSTEME}\n\nCONSIGNE DE STYLE POUR CETTE VERSION\n${style}\nNe reprends pas les tournures d'une version précédente.` : SYSTEME,
    message,
    // Une lettre et un email, en JSON avec ses
    // échappements, dépassent largement 3000 jetons : la réponse était coupée
    // en plein milieu et le JSON illisible. Le premier essai a coûté deux
    // appels facturés pour rien.
    /**
     * Redescendu de 20 000 à 12 000, et le raisonnement bridé (D114).
     *
     * Les 20 000 de D113 ont coûté 19,6 ¢ et 12 ¢ sur deux lettres, contre
     * 6 ¢ avant. Un plafond haut n'est pas une sécurité, c'est un budget : le
     * modèle l'occupe. 12 000 laisse largement la place aux 8 598 jetons de la
     * lettre réussie du 2 octobre, et borne la facture à environ 12 ¢ dans le
     * pire des cas.
     *
     * Ancien commentaire de D113, conservé parce qu'il explique l'échec que
     * 8 000 provoquait :
     *
     * Deux appels ont échoué le 2 octobre sur « blocs : thinking — réponse
     * coupée — 8 000 jetons produits » : le modèle a dépensé tout le budget en
     * raisonnement, sans place pour la réponse. Les jetons ont été facturés.
     *
     * 8 000 suffisaient pour trois paragraphes et un email. La sortie a grossi
     * depuis : quatre paragraphes, l'email, et DEUX messages courts. L'appel
     * réussi de 15 h 36 a consommé 6 129 jetons — la marge était de 30 %, et
     * le raisonnement du modèle l'a mangée.
     *
     * Le plafond ne se paie pas : seuls les jetons réellement produits sont
     * facturés. Le fixer large ne coûte rien, le fixer juste coûte un appel
     * entier à chaque fois qu'il est dépassé.
     */
    maxTokens: 12000,
    // Le raisonnement a de quoi travailler sans pouvoir manger le budget :
    // la lettre réussie du 2 octobre a produit 8 598 jetons au total.
    budgetRaisonnement: 3000,
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
    messages?: Messages;
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
  /**
   * Les messages n'existent que si le modèle les a rendus (D112).
   *
   * Une lettre générée avant cette version n'en a pas, et une réponse qui les
   * omettrait ne doit pas faire échouer la lettre : l'absence se voit à
   * l'écran, elle ne se paie pas deux fois.
   */
  const messages = normaliserMessages(brut.messages);
  const documentMessageId = messages ? randomUUID() : null;
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
      selection: {
        schema: SCHEMA_SELECTION,
        modele,
        ancrage,
        style: defautsStyle,
        /**
         * D'où vient la matière du §2 (D114).
         *
         * « Je dois savoir si la lettre contient des données d'internet ou si
         * c'est uniquement l'annonce. » La question est juste, et elle se pose
         * surtout avant un entretien : un fait tiré du web peut avoir vieilli,
         * un fait tiré de l'annonce est forcément à jour.
         *
         * Figé dans le document plutôt que recalculé : la fiche peut être
         * rafraîchie et l'annonce modifiée, mais cette lettre-là a été écrite
         * avec ce qu'il y avait ce jour-là.
         */
        sourceEntreprise: fiche?.fiche
          ? {
              type: "web" as const,
              faits: fiche.fiche.faits.map((f) => f.texte),
              sources: fiche.fiche.faits
                .map((f) => f.source)
                .filter((x): x is string => Boolean(x)),
            }
          : (fiche?.documentation.faits.length ?? 0) > 0
            ? {
                type: "annonce" as const,
                faits: fiche!.documentation.faits,
                sources: [],
              }
            : { type: "aucune" as const, faits: [], sources: [] },
      },
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

  /**
   * Les messages s'enregistrent SÉPARÉMENT de la lettre (D113).
   *
   * Ils étaient dans le même lot d'insertion. Or `type_document` est une
   * énumération, et la valeur `message` n'existe qu'après la migration 0014 :
   * sur une base où elle n'a pas été lancée, l'insertion du message faisait
   * échouer **tout le lot**, et la lettre payée neuf centimes était perdue.
   *
   * L'ordre importe autant que la séparation : la lettre est l'artefact cher,
   * elle s'enregistre d'abord et son échec reste bloquant. Les messages sont
   * un supplément à 0,5 ¢ ; leur échec se signale dans les journaux et ne
   * détruit rien.
   */
  let messagesEnregistres = messages;
  if (messages && documentMessageId) {
    const { error: erreurMessage } = await supabase.from("documents").insert({
      id: documentMessageId,
      offre_id: offreId,
      type: "message",
      volet: offre.volet,
      version,
      // Les deux longueurs dans un seul texte, séparées lisiblement : c'est ce
      // qui s'affiche si jamais `selection` devenait illisible.
      contenu_texte: messageEnTexte(messages),
      selection: { messages },
      // Le coût est porté par la lettre : les messages n'ont coûté que les
      // 0,5 ¢ de jetons de sortie déjà comptés là.
      cout_usd: 0,
    });
    if (erreurMessage) {
      console.error(
        `[lettre] messages courts non enregistrés (migration 0014 lancée ?) : ${erreurMessage.message}`
      );
      messagesEnregistres = null;
    }
  }

  await purgerAnciennesVersions(offreId, "lettre");
  await purgerAnciennesVersions(offreId, "email");
  if (messagesEnregistres) await purgerAnciennesVersions(offreId, "message");

  return {
    documentLettreId,
    documentEmailId,
    version,
    modele,
    email: brut.email,
    ancrage,
    style: defautsStyle,
    messages: messagesEnregistres ?? { court: "", moyen: "" },
    documentMessageId: messagesEnregistres ? documentMessageId : null,
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
    // Relevé de 1 200 (D113). Un email fait cinq à huit lignes, mais le
    // raisonnement du modèle n'est pas plafonné séparément : sur une sortie
    // courte, c'est lui qui consomme tout le budget, et l'appel rend « blocs :
    // thinking » pour zéro texte utile — facturé quand même. Le plafond ne se
    // paie pas, seuls les jetons produits le sont.
    maxTokens: 4000,
    budgetRaisonnement: 1500,
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

const SYSTEME_MESSAGES = `Tu rédiges deux messages de motivation courts pour un professionnel du contrôle de gestion et de la comptabilité qui candidate à une offre précise, par le formulaire d'une plateforme d'emploi.

UN MESSAGE N'EST PAS UNE LETTRE RACCOURCIE. Aucune formule d'appel, aucune formule de politesse, aucune signature, aucun objet : ces éléments n'ont pas de sens dans un champ de formulaire, et collés là ils signalent un texte recyclé. Le message commence par la première phrase utile et s'arrête à la dernière.

════════════════════════════════════════
LES FAITS — RIEN ICI NE SE NÉGOCIE
════════════════════════════════════════
Tu n'ajoutes rien qui ne soit dans le dossier fourni : aucun chiffre, aucune durée, aucun employeur, aucun logiciel, aucun diplôme.

Tu ne sais de l'entreprise que ce que le dossier en dit. Elle n'est ni "leader", ni "reconnue", si rien ne l'écrit.

Tu ne décris aucune qualité de caractère : "rigoureux", "dynamique" sont invérifiables. Tu décris ce qui a été fait.

LA FORMATION. Jamais "deux masters", jamais "double master", aucun nom d'établissement, et en particulier jamais "Le Mans Université". Si la formation apparaît, c'est par sa spécialité seule.

LA DISPONIBILITÉ. Si le dernier contrat est terminé : "disponible immédiatement", et rien d'autre sur le sujet — ni date de fin, ni employeur.

L'EXPÉRIENCE T'EST IMPOSÉE : le dossier la nomme, c'est celle que le moteur a classée la plus proche de cette offre. LES SITUATIONS AUSSI SONT CLASSÉES : tu prends la première, ou la deuxième si elle raconte mieux.

════════════════════════════════════════
LES DEUX LONGUEURS
════════════════════════════════════════
"court" — 380 à 450 signes. Trois phrases, au plus quatre. Le poste, UN fait du parcours qui y répond, la disponibilité. Rien sur l'entreprise : il n'y a pas la place, et une demi-phrase de contexte y serait du remplissage.

"moyen" — 800 à 900 signes, deux ou trois paragraphes. Le poste et ce qu'il demande ; la situation racontée brièvement — ce qu'il y avait à régler, ce que le candidat a fait, ce que ça a donné ; puis les outils nommés et la disponibilité.

Dans les deux, le candidat est le sujet des verbes. Si la matière porte un chiffre, le message le porte.

Si tu nommes un outil, c'est l'un de ceux que le dossier liste, jamais une catégorie — pas de "les ERP métier", pas de "les outils décisionnels".

════════════════════════════════════════
CE QUI FAIT QU'UN MESSAGE SONNE FABRIQUÉ
════════════════════════════════════════
Interdites, y compris leurs variantes : "Fort de mon expérience…", "Actuellement en recherche active…", "mettre mes compétences au service de votre entreprise", "Je suis convaincu que mon dynamisme et ma rigueur…", "C'est avec un vif intérêt que…", "votre prestigieuse entreprise".

Interdits aussi : compter ("quatre expériences", "trois secteurs"), la maxime — une phrase générale qui resterait vraie dans n'importe quel autre message — et la liste de tâches séparées par des virgules, qui est le CV recopié.

Un message de 420 signes est plus difficile à écrire qu'une page, pas plus facile : chaque mot doit porter. Préfère un fait précis à deux faits vagues.

Tu réponds UNIQUEMENT par un objet JSON, sans préambule ni balises de code :
{ "court": "...", "moyen": "..." }`;

export interface ResultatMessages {
  documentId: string;
  version: number;
  messages: Messages;
  /** Les tournures repérées, pour que le modèle bon marché reste surveillé. */
  style: DefautStyle[];
  coutUsd: number;
}

/**
 * Les deux messages, sans rédiger la lettre (D112).
 *
 * Beaucoup de candidatures passent par un formulaire et n'auront jamais besoin
 * de lettre. Payer une lettre de quatre paragraphes pour en extraire 420 signes
 * serait absurde : l'entrée est la même, mais la sortie d'une lettre coûte huit
 * fois celle de deux messages.
 *
 * Deux choix de coût, assumés :
 *
 * - **Le modèle d'extraction**, deux fois moins cher que celui de rédaction.
 *   Un texte court n'est pas un texte facile — c'est même l'inverse — mais ici
 *   toutes les décisions sont déjà prises avant l'appel : l'expérience est
 *   imposée, les situations classées, les outils nommés, les faits de
 *   l'entreprise fournis. Il ne reste qu'à formuler.
 * - **Le contrôle de style est appliqué aux messages**, ce qui ne coûte rien et
 *   détecte précisément ce qu'un modèle plus faible risque d'introduire. Si le
 *   panneau s'allume régulièrement, la décision se renverse en changeant une
 *   constante.
 *
 * Attention à l'enchaînement : prendre le message seul puis la lettre coûte
 * plus cher que la lettre seule, qui produit déjà les deux messages. L'écran le
 * dit.
 */
export async function genererMessagesPourOffre(
  offreId: string
): Promise<ResultatMessages> {
  return sousVerrou(`lettre:${offreId}`, () => redigerMessages(offreId));
}

async function redigerMessages(offreId: string): Promise<ResultatMessages> {
  const supabase = creerClientServeur();
  const { offre, message } = await rassemblerDossier(offreId, false);

  const reponse = await appelIA({
    modele: MODELE_EXTRACTION,
    systeme: SYSTEME_MESSAGES,
    message,
    // Même raison que pour l'email (D113) : deux messages font 1 300 signes
    // en tout, soit environ 400 jetons, mais le raisonnement peut en demander
    // dix fois plus avant d'écrire la première phrase.
    maxTokens: 6000,
    budgetRaisonnement: 2000,
    tache: "messages_motivation",
    offreId,
  });

  let brut: Messages;
  try {
    brut = JSON.parse(extraireJson(reponse.texte));
  } catch {
    throw new ErreurIA(
      "La réponse du modèle n'était pas exploitable. Début reçu : " +
        reponse.texte.trim().slice(0, 200)
    );
  }

  const messages = normaliserMessages(brut);
  if (!messages) {
    throw new ErreurIA(
      "Le modèle n'a pas rendu les deux longueurs. Reçu : " +
        reponse.texte.trim().slice(0, 200)
    );
  }

  // Les deux messages sont contrôlés ensemble : un défaut dans l'un ou l'autre
  // se corrige à la main, et c'est le seul garde-fou sur le modèle bon marché.
  const style = verifierStyle([messages.court, messages.moyen]);

  const { data: derniere } = await supabase
    .from("documents")
    .select("version")
    .eq("offre_id", offreId)
    .eq("type", "message")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const version = ((derniere as { version: number } | null)?.version ?? 0) + 1;

  const documentId = randomUUID();
  const { error } = await supabase.from("documents").insert({
    id: documentId,
    offre_id: offreId,
    type: "message",
    volet: offre.volet,
    version,
    contenu_texte: messageEnTexte(messages),
    selection: { messages, style },
    cout_usd: reponse.coutUsd,
  });

  if (error) {
    throw new ErreurCV(
      `Les messages ont été rédigés mais n'ont pas pu être enregistrés : ${error.message}`
    );
  }

  await purgerAnciennesVersions(offreId, "message");

  return { documentId, version, messages, style, coutUsd: reponse.coutUsd };
}
