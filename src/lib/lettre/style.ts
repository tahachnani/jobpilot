import { normaliser } from "@/lib/texte";

/**
 * Le contrôle de style de la lettre (D93, refondu en D96).
 *
 * L'ancrage vérifie que la lettre ne mente pas. Il ne dit rien de la façon dont
 * elle est écrite — et c'est là que trois lettres sur quatre déçoivent.
 *
 * Constat du 29 septembre, sur une lettre réelle : aucune phrase principale
 * n'avait de sujet humain. « le pilotage s'est accompagné de », « la
 * construction a nécessité de », « le parcours traverse », « ce passage a
 * construit une capacité ». Des travaux qui se font tout seuls, une prose de
 * note de service. S'y ajoutaient trois énumérations annoncées — quatre
 * expériences, deux expériences, trois secteurs — et une phrase qui recopiait
 * les besoins de l'annonce en les annonçant comme tels.
 *
 * D96 — les règles ci-dessous ne sont plus de mon invention. Elles viennent de
 * ce que publient ceux qui lisent ces lettres pour de vrai :
 *
 * - France Travail nomme la « signature ChatGPT » et en cite les formules mot
 *   pour mot : « Actuellement en recherche active, je souhaite mettre mes
 *   compétences en … au service de votre entreprise », « Je suis convaincu que
 *   mon dynamisme et ma rigueur … », « Fort de mon expérience … ».
 *   https://www.francetravail.fr/candidat/vos-recherches/preparer-votre-candidature/cv-lettre-de-motivation-e-mail/et-si-votre-lettre-de-motivation.html
 * - Welcome to the Jungle a fait juger des lettres IA par des recruteuses.
 *   Verdict : « bien rédigées et bien structurées » mais « les lettres de l'IA
 *   manquent de personnalité ». Formules relevées : « c'est avec un vif intérêt
 *   que … ».
 *   https://www.welcometothejungle.com/fr/articles/lettre-motivation-redigee-par-ia
 * - L'Office québécois de la langue française, sur la lettre d'accompagnement :
 *   « Énumérer les réalisations (cela relève du CV) » et « rédiger comme une
 *   circulaire avec phrases toutes faites ». C'est exactement le reproche fait
 *   ici le 1er octobre — « quatre missions, deux expériences, trois secteurs, à
 *   quoi sert ? ».
 *   https://vitrinelinguistique.oqlf.gouv.qc.ca/22813/…/redaction-de-la-lettre-daccompagnement-du-curriculum-vitae
 * - Le repérage d'une lettre IA tient aussi au rythme : « absence de variations
 *   rythmiques naturelles », « adverbes et modalisateurs disproportionnés »,
 *   « ton uniformément élogieux, peu crédible ».
 *   https://lucide.ai/detecter-ia-lettre-de-motivation-recruteurs/
 *
 * Comme le contrôle de reformulation, celui-ci ne bloque rien : il nomme. Une
 * lettre se relit et se corrige à la main, et la signaler coûte zéro appel.
 */

export interface DefautStyle {
  /** Le nom du défaut, tel qu'il s'affiche. */
  tournure: string;
  /** Le passage fautif, tronqué. */
  extrait: string;
  /** Pourquoi c'est un défaut, en une phrase. */
  pourquoi: string;
}

/**
 * Noms d'action qui, pris comme sujet, effacent celui qui a fait le travail.
 *
 * La liste est volontairement courte et tirée de lettres réelles : un
 * dictionnaire complet attraperait des phrases légitimes.
 */
const NOMS_ABSTRAITS = [
  "pilotage",
  "construction",
  "calcul",
  "parcours",
  "passage",
  "suivi",
  "elaboration",
  "automatisation",
  "parametrage",
  "mise en place",
  "montee en competence",
  "contribution",
  "demarche",
  "approche",
  "experience",
  "experiences",
  "mission",
  "missions",
  "realisation",
  "production",
  // Ajoutés après coup, sachant que la liste ne sera jamais complète : c'est
  // la mesure de première personne, plus bas, qui attrape le reste.
  "pistes",
  "resultats",
  "travaux",
  "analyses",
  "donnees",
  "chiffres",
  "ecarts",
  "indicateurs",
  "conclusions",
  "recommandations",
  // D106 — la phrase de résultat est celle qui compte, et c'est précisément
  // celle que la prose impersonnelle vole au candidat : « Ce constat a orienté
  // les priorités d'action ».
  "constat",
  "travail",
  "diagnostic",
  "chantier",
  "bilan",
];

/**
 * Catégories d'outils, qui ne nomment rien (D105).
 *
 * « Excel reste mon outil principal, complété par une pratique des ERP
 * métier » — écrit par quelqu'un qui connaît ULIS Sopra à 3/3, pour un
 * bailleur social. Nommer le logiciel du secteur prouve l'expérience ; dire
 * « les ERP métier » prouve qu'on ne veut pas le dire.
 *
 * Le motif s'applique au texte BRUT, pas au normalisé : « l'ERP SILOG » doit
 * passer et « les ERP métier » non, ce qui se joue sur la majuscule.
 */
const CATEGORIES_OUTILS =
  /\bERP\s+m[ée]tiers?\b|\bprogiciels?\b|\boutils?\s+(?:m[ée]tiers?|d[ée]cisionnels?|bureautiques?|informatiques?|comptables?|de\s+reporting)\b|\bles\s+ERP\b/i;

/**
 * Adverbes d'intensité : le marqueur le plus mécanique de la prose générée.
 *
 * Aucun n'est fautif seul. C'est leur accumulation qui trahit, d'où le seuil
 * plutôt que l'interdiction.
 */
const ADVERBES_INTENSITE = [
  "particulierement",
  "pleinement",
  "parfaitement",
  "veritablement",
  "profondement",
  "resolument",
  "notamment",
  "reellement",
  "totalement",
  "fortement",
  "vivement",
  "solidement",
  "naturellement",
  "idealement",
];

/** Découpe en phrases, sans casser sur les nombres ni les sigles. */
function phrases(texte: string): string[] {
  return texte
    .split(/(?<=[.!?])\s+(?=[A-ZÀ-Þ])/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

/**
 * Les marques de première personne : la preuve qu'une personne parle.
 *
 * Le motif d'origine — `\b(je|j['’]|mon|ma|mes|m['’])` — n'avait **pas de
 * limite de mot finale**. « ma » y correspondait donc au début de
 * « management », « marge », « maintenant », « mesure », « montant ». La
 * phrase « Les pistes de marge identifiées ont nourri les recommandations
 * transmises au management opérationnel » était ainsi tenue pour écrite à la
 * première personne, et le contrôle de D93 la sautait — alors que c'est
 * exactement le défaut qu'il avait été écrit pour attraper.
 *
 * Un faux positif ici est silencieux : il ne produit pas d'erreur, il éteint
 * une règle. Trois jours de lettres sont passées à côté pour deux caractères
 * manquants.
 */
function parleALaPremierePersonne(phrase: string): boolean {
  return /\b(?:je|mon|ma|mes|me|moi)\b|\b[jm]['’]/i.test(phrase);
}

function extrait(texte: string, taille = 90): string {
  const t = texte.trim();
  return t.length > taille ? `${t.slice(0, taille)}…` : t;
}

function mots(phrase: string): number {
  return phrase.split(/\s+/).filter(Boolean).length;
}

/**
 * Un fait vérifiable dans la phrase : un chiffre, ou un nom propre.
 *
 * Le nom propre se repère à une majuscule qui n'ouvre pas la phrase — TRIUMPH,
 * SILOG, Le Mans. Grossier, et c'est voulu : il ne s'agit pas d'analyser la
 * phrase mais de distinguer « J'ai repris le calcul chez TRIUMPH » d'« Un
 * chiffre juste change une décision ».
 */
function porteUnFait(phrase: string): boolean {
  if (/\d/.test(phrase)) return true;
  const sansPremierMot = phrase.replace(/^\W*\w+\s*/, "");
  return /[A-ZÀ-Þ]/.test(sansPremierMot);
}

/**
 * Tournures à bannir, repérées sur le texte normalisé.
 *
 * Chacune vient soit d'une lettre produite par l'application, soit d'une source
 * citée en tête de fichier — jamais d'une intuition.
 *
 * ATTENTION, piège coûteux : `normaliser` remplace TOUTE ponctuation par une
 * espace. « c'est » devient « c est », « l'annonce » devient « l annonce ».
 * Écrire ici `c['’]est` ne peut donc jamais correspondre à rien. Trois motifs
 * ont vécu ainsi, muets, plusieurs jours : ils passaient les tests parce
 * qu'une autre alternative de la même expression attrapait le cas. Toute
 * apostrophe s'écrit `\s` dans ce fichier.
 */
const TOURNURES: { motif: RegExp; tournure: string; pourquoi: string }[] = [
  // ---- Signature ChatGPT, formules citées par France Travail ----
  {
    motif: /\bfort(e)? de (mon|mes|ma|cette|une) /,
    tournure: "Signature ChatGPT : « Fort de mon… »",
    pourquoi:
      "France Travail cite cette ouverture comme le marqueur numéro un d'une lettre générée. Un recruteur qui la lit arrête de lire.",
  },
  {
    motif: /en recherche active|actuellement a la recherche d\sun (nouveau |)(poste|defi|challenge)/,
    tournure: "Signature ChatGPT : « en recherche active »",
    pourquoi:
      "Formule relevée mot pour mot par France Travail parmi les tics de l'IA. Elle dit ta situation, pas ta candidature.",
  },
  {
    motif: /mettre mes competences (en |au service|a votre service)|mettre mon (expertise|experience) au service/,
    tournure: "Signature ChatGPT : « mettre mes compétences au service de »",
    pourquoi:
      "France Travail la donne en exemple de phrase clonée. Elle vaut pour n'importe quel poste, donc pour aucun.",
  },
  {
    motif: /je suis (convaincu|persuade|certain)e? que (mon|ma|mes)|(mon dynamisme|ma rigueur|ma motivation) et (ma|mon|mes)/,
    tournure: "Signature ChatGPT : « convaincu que ma rigueur… »",
    pourquoi:
      "Deuxième formule citée par France Travail. Se déclarer rigoureux n'est pas vérifiable : montre un travail qui l'a exigé.",
  },
  {
    motif: /c\sest avec (un vif |un grand |beaucoup d\s)?(interet|enthousiasme|attention)/,
    tournure: "Formule creuse : « c'est avec un vif intérêt »",
    pourquoi:
      "Relevée par les recruteuses interrogées par Welcome to the Jungle comme la marque d'une lettre sans personnalité.",
  },
  {
    motif: /competences (polyvalentes|transversales et|variees)|enthousiasme communicatif|exceptionnellement qualifie/,
    tournure: "Qualificatif passe-partout",
    pourquoi:
      "Ces mots ne décrivent rien de précis : ils remplissent la ligne. Remplace-les par ce que tu as fait.",
  },

  // ---- Énumération : le reproche du 1er octobre ----
  {
    motif: /\b(deux|trois|quatre|cinq|six)\s+(experiences?|secteurs?|missions?|axes?|points?|elements?|postes?|environnements?|annees? d\sexperience)\b/,
    tournure: "Énumération annoncée",
    pourquoi:
      "Compter ses expériences structure un rapport, pas une lettre. L'OQLF est net : énumérer les réalisations relève du CV.",
  },
  {
    motif: /\b(illustrent|illustre|temoignent|temoigne|demontrent|demontre)\s+(cette|ce|cet|ma|mon|mes)\b/,
    tournure: "Annonce de plan",
    pourquoi:
      "Annoncer ce qu'on va démontrer renvoie souvent à une idée qui n'a pas encore été posée. Démontre, n'annonce pas.",
  },
  {
    motif: /(besoins?|attentes?|missions?)\s+(identifie|decrit|mentionne)[a-z]*\s+dans\s+l\s?annonce|recouvrent les besoins|correspondent? aux attentes/,
    tournure: "Recopie de l'annonce",
    pourquoi:
      "Le recruteur sait ce qu'il a écrit. Conclure à sa place que tu corresponds affaiblit la démonstration.",
  },

  // ---- Ton et clôture ----
  {
    motif: /\bvs\b/,
    tournure: "Abréviation anglaise",
    pourquoi: "« vs » n'a pas sa place dans une lettre française : écris « par rapport au ».",
  },
  {
    motif: /disponible immediatement[\s\S]{0,80}(sans delai|des a present|immediatement)/,
    tournure: "Disponibilité dite deux fois",
    pourquoi: "« Disponible immédiatement » et « sans délai » disent la même chose.",
  },
  {
    motif: /a (votre |entiere )?disposition pour (echanger|convenir)|modalites d\sun entretien/,
    tournure: "Clôture administrative",
    pourquoi:
      "On demande un entretien, on ne négocie pas ses modalités. Cette formule s'excuse d'exister.",
  },
  {
    motif: /s\sinscrit dans cette continuite|dans cette continuite|n\shesitez pas/,
    tournure: "Formule creuse",
    pourquoi: "La phrase n'ajoute aucune information : elle occupe une ligne.",
  },
  {
    motif: /votre (prestigieuse|renommee|belle) |leader (mondial|europeen|francais|du marche)|acteur (majeur|incontournable|de reference)/,
    tournure: "Éloge de l'entreprise",
    pourquoi:
      "Un ton uniformément élogieux n'est pas crédible, et ces mots-là ne viennent pas de toi. Cite un fait de l'annonce à la place.",
  },
];

/**
 * @param paragraphes Le corps de la lettre, formules d'appel et de politesse
 * exclues : elles ont leurs propres conventions.
 */
export function verifierStyle(paragraphes: string[]): DefautStyle[] {
  const defauts: DefautStyle[] = [];
  const texte = paragraphes.join("\n");
  const n = normaliser(texte);

  for (const t of TOURNURES) {
    const trouve = n.match(t.motif);
    if (!trouve) continue;
    defauts.push({
      tournure: t.tournure,
      extrait: extrait(trouve[0], 60),
      pourquoi: t.pourquoi,
    });
  }

  /**
   * Les phrases dont le sujet est un nom d'action et non une personne.
   *
   * Le complément de lieu initial — « Chez TECHNICAPS, le pilotage… » — est
   * sauté : c'est précisément la forme que prend le défaut.
   */
  const nominales: string[] = [];
  for (const p of phrases(texte)) {
    if (parleALaPremierePersonne(p)) continue;
    const debut = normaliser(p).replace(/^[^,]{0,60},\s*/, "");
    const sujet = debut.match(/^(?:le|la|les|l|ce|cet|cette|ces)\s+([a-z ]{3,30})/);
    if (!sujet) continue;
    if (NOMS_ABSTRAITS.some((mot) => sujet[1].startsWith(mot))) {
      nominales.push(p);
    }
  }

  if (nominales.length > 0) {
    defauts.push({
      tournure: `Phrase sans sujet humain (${nominales.length})`,
      extrait: extrait(nominales[0]),
      pourquoi:
        "Le travail s'y fait tout seul : c'est le pilotage, la construction ou le parcours qui agissent. Reprends la phrase avec « j'ai ».",
    });
  }

  /**
   * L'inventaire déguisé (D96).
   *
   * « J'ai piloté le budget, construit les tableaux de bord, fiabilisé les
   * clôtures et formé les équipes » ne compte rien et passe donc le contrôle
   * précédent — mais c'est bien une liste, et c'est celle-là qui fatigue. Une
   * phrase qui empile quatre groupes ou plus est un extrait de CV recollé en
   * prose.
   */
  for (const p of phrases(texte)) {
    const groupes = p.split(",").filter((g) => g.trim().split(/\s+/).length >= 2);
    if (groupes.length >= 4) {
      defauts.push({
        tournure: `Inventaire déguisé (${groupes.length} groupes)`,
        extrait: extrait(p),
        pourquoi:
          "Cette phrase est une liste sans puces. Garde le fait le plus parlant et développe-le ; le reste est déjà sur le CV.",
      });
      break;
    }
  }

  /**
   * Le rythme plat (D96).
   *
   * Le repère le plus fiable d'une prose générée n'est pas le vocabulaire mais
   * la régularité : toutes les phrases de la même longueur, aucune respiration.
   * Une lettre écrite à la main a toujours une phrase brève quelque part.
   */
  const longueurs = phrases(texte).map(mots);
  if (longueurs.length >= 4) {
    const bref = Math.min(...longueurs);
    // Le seuil porte sur la phrase la plus courte, pas sur la moyenne : une
    // moyenne élevée peut venir d'une seule longue phrase, ce qui n'est pas un
    // défaut. C'est l'absence totale de respiration qui trahit. Le prompt
    // demande une phrase de moins de dix mots par paragraphe ; le contrôle
    // laisse quatre mots de marge pour ne pas crier sur une lettre correcte.
    if (bref >= 14) {
      defauts.push({
        tournure: "Rythme plat",
        extrait: `${longueurs.length} phrases, la plus courte fait ${bref} mots`,
        pourquoi:
          "Aucune phrase brève : le texte avance au même pas du début à la fin, ce qui se lit comme de la prose automatique. Coupe-en une en deux.",
      });
    }
  }

  /**
   * La maxime (D101).
   *
   * D96 exigeait « au moins une phrase de moins de dix mots par paragraphe »
   * pour casser le rythme plat. La contrainte a été respectée, et remplie avec
   * du vide : « Un périmètre large exige des indicateurs fiables », « Un
   * chiffre juste change une décision », « Je reste attentif aux signaux
   * faibles » — trois proverbes dans une même lettre.
   *
   * La leçon vaut au-delà de ce cas : une contrainte de FORME sans contrainte
   * de CONTENU se remplit toujours par le chemin le plus court. Une phrase
   * brève doit donc porter un fait — un chiffre ou un nom propre —, faute de
   * quoi elle n'est pas une respiration, c'est un remplissage.
   */
  /**
   * La première personne est le discriminant, et il a été trouvé en essayant.
   *
   * Sans elle, la règle attrapait « Disponible immédiatement, je souhaite
   * échanger sur ces missions lors d'un entretien » — une clôture
   * irréprochable — et « C'est ce terrain qui m'intéresse ». Une maxime est
   * une vérité GÉNÉRALE : elle ne parle de personne. Dès que le candidat y
   * figure, la phrase est brève, pas creuse.
   *
   * Précision plutôt que couverture, délibérément : un panneau qui se trompe
   * deux fois sur cinq cesse d'être lu, et il ne restait plus rien.
   */
  const maximes = phrases(texte).filter(
    (p) =>
      mots(p) <= 11 &&
      !porteUnFait(p) &&
      !parleALaPremierePersonne(p) &&
      // Second discriminant, trouvé lui aussi en se trompant : « Certaines
      // agences dépassaient largement ce délai » était signalée, alors que
      // c'est la phrase la plus utile du paragraphe. Un démonstratif renvoie à
      // ce qui précède ; une maxime, par définition, ne renvoie à rien.
      !/\b(ce|cet|cette|ces|celui|celle|celles|ceux|y)\b/i.test(p)
  );
  if (maximes.length > 0) {
    defauts.push({
      tournure: `Maxime (${maximes.length})`,
      extrait: extrait(maximes[0]),
      pourquoi:
        "Phrase courte sans aucun fait : elle resterait vraie dans n'importe quelle autre lettre. Donne-lui un chiffre, un outil ou un employeur, ou supprime-la.",
    });
  }

  /**
   * Le conditionnel en rafale (D102).
   *
   * « Je consoliderais les indicateurs, j'objectiverais les écarts, je
   * resterais attentif » : trois hypothèses à la suite ne décrivent rien. Le
   * paragraphe de projection en mérite un, pas trois.
   */
  const FAUX_AMIS = new Set(["vrais", "frais", "marais", "engrais", "jamais"]);
  const conditionnels = [
    ...n.matchAll(/\b[a-z]{2,}r(?:ais|ait|aient|ions|iez)\b/g),
  ]
    .map((m) => m[0])
    .filter((m) => !FAUX_AMIS.has(m));
  if (conditionnels.length >= 3) {
    defauts.push({
      tournure: `Conditionnel en rafale (${conditionnels.length})`,
      extrait: [...new Set(conditionnels)].join(", "),
      pourquoi:
        "Tout est supposé, rien n'est affirmé. Écris au présent ce qui est vrai aujourd'hui et garde le conditionnel pour la seule phrase qui projette.",
    });
  }

  /**
   * Le renvoi à l'annonce comme document (D102).
   *
   * Le motif « Recopie de l'annonce » ci-dessus visait la liste resservie. Il
   * ne couvrait pas « les projets data évoqués dans l'annonce », qui cite
   * l'offre comme une source — le recruteur l'a écrite.
   */
  const renvoi = n.match(
    /\b(evoque|mentionne|decrit|indique|precise|cite|presente|detaille)[a-z]*\s+(?:dans|par|sur)\s+(?:l\s+annonce|votre\s+annonce|l\s+offre|votre\s+offre|le\s+descriptif)/
  );
  if (renvoi) {
    defauts.push({
      tournure: "Renvoi à l'annonce",
      extrait: extrait(renvoi[0], 60),
      pourquoi:
        "Le recruteur a écrit cette annonce : la citer comme source lui renvoie son propre texte. Nomme la chose, pas l'endroit où tu l'as lue.",
    });
  }

  /**
   * La part de phrases sans première personne (D103).
   *
   * « Les pistes de marge identifiées ont nourri les recommandations
   * transmises au management opérationnel » est le défaut que D93 visait, et
   * il est passé : la liste `NOMS_ABSTRAITS` est fermée, et « pistes » n'y
   * était pas. Elle n'y sera jamais toute — c'est la nature d'une liste.
   *
   * Cette mesure-ci ne dépend d'aucun vocabulaire. Dans une lettre écrite à la
   * première personne, une phrase sur trois sans « je », « mon » ni « me » est
   * une prose qui parle du travail au lieu de parler du candidat. Le seuil
   * laisse passer l'ouverture sur l'entreprise, qui n'a légitimement pas de
   * première personne.
   */
  const toutes = phrases(texte);
  const impersonnelles = toutes.filter((p) => !parleALaPremierePersonne(p));
  if (impersonnelles.length >= 3 && impersonnelles.length * 3 > toutes.length) {
    defauts.push({
      tournure: `Phrases sans « je » (${impersonnelles.length} sur ${toutes.length})`,
      extrait: extrait(impersonnelles.find((p) => mots(p) > 10) ?? impersonnelles[0]),
      pourquoi:
        "Plus d'une phrase sur trois ne nomme pas le candidat : le travail s'y fait tout seul. Reprends-les avec « j'ai ».",
    });
  }

  /**
   * L'ouverture qui récite l'annonce (D104).
   *
   * « Le poste s'inscrit dans la création d'un groupe national… Ce groupe
   * réunit près de 80 000 logements. » Deux phrases pour expliquer au
   * recruteur l'organisation de sa propre entreprise, et le candidat qui
   * n'apparaît qu'à la troisième.
   *
   * Le paragraphe « vous » doit ancrer la lettre dans l'offre, pas la résumer.
   * Une phrase suffit à montrer qu'on a lu ; au-delà, c'est du remplissage pris
   * dans le texte de l'annonce — le même réflexe que la maxime, appliqué à une
   * autre contrainte.
   */
  const ouverture = phrases(paragraphes[0] ?? "");
  const avantLeCandidat = ouverture.findIndex(parleALaPremierePersonne);
  // UNE phrase sur l'entreprise est le plan, pas un défaut : le seuil est donc
  // à deux. La première version exigeait le « je » dès la phrase d'ouverture,
  // et signalait la lettre modèle du prompt — un contrôle qui condamne sa
  // propre référence est faux, pas sévère.
  if (ouverture.length >= 2 && (avantLeCandidat === -1 || avantLeCandidat >= 2)) {
    defauts.push({
      tournure:
        avantLeCandidat === -1
          ? "Ouverture sans le candidat"
          : `Ouverture qui récite l'annonce (${avantLeCandidat} phrases avant « je »)`,
      extrait: extrait(ouverture[0]),
      pourquoi:
        "Le recruteur connaît son entreprise. Une phrase suffit à montrer que tu as lu l'annonce ; la suivante doit déjà être sur toi.",
    });
  }

  /**
   * La catégorie au lieu de l'outil (D105).
   */
  const categorie = texte.match(CATEGORIES_OUTILS);
  if (categorie) {
    defauts.push({
      tournure: "Catégorie au lieu d'un outil",
      extrait: extrait(categorie[0], 50),
      pourquoi:
        "Nomme le logiciel : ULIS Sopra, SILOG, Sage 100, Qlik Sense. Une catégorie ne prouve rien, et devant un employeur du secteur, le nom de son propre outil vaut un paragraphe.",
    });
  }

  /**
   * Les adverbes d'intensité (D96).
   *
   * Un seul passe. Trois font un texte qui insiste au lieu de démontrer.
   */
  const adverbes = ADVERBES_INTENSITE.flatMap((a) =>
    [...n.matchAll(new RegExp(`\\b${a}\\b`, "g"))].map(() => a)
  );
  if (adverbes.length >= 3) {
    defauts.push({
      tournure: `Adverbes d'intensité (${adverbes.length})`,
      extrait: [...new Set(adverbes)].join(", "),
      pourquoi:
        "Insister n'est pas convaincre. Un fait n'a pas besoin d'être « particulièrement » quoi que ce soit ; supprime-les, la phrase tient debout.",
    });
  }

  return defauts;
}
