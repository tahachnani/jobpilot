/**
 * L'annonce parle-t-elle assez de l'entreprise pour qu'on n'ait rien à
 * chercher ? (D109)
 *
 * Une recherche web coûte 1 ¢ plus le contenu rapporté. La lancer alors que
 * l'annonce contient déjà « groupe national en constitution, 80 000 logements,
 * 35 organismes du réseau » serait payer pour apprendre ce qu'on sait.
 *
 * La décision se prend **sans IA**, par comptage dans le texte déjà stocké :
 * c'est gratuit, instantané, rétroactif sur toutes les offres, et surtout
 * reproductible — on peut dire à l'écran pourquoi la recherche n'a pas eu
 * lieu, en montrant les faits trouvés.
 *
 * Le seuil est volontairement bas. Se tromper en cherchant coûte 3 ¢ ; se
 * tromper en ne cherchant pas coûte un paragraphe inventé, que personne ne
 * rattrape. Deux faits suffisent donc à renoncer à la recherche, mais il faut
 * qu'ils soient de vrais faits et non le mot « leader ».
 */

/**
 * Ce qui, dans une annonce, décrit réellement l'entreprise.
 *
 * Chaque motif cherche un **nombre accompagné de son unité** : c'est la seule
 * forme qui ne puisse pas être du remplissage. « Acteur majeur du secteur » ne
 * compte pas ; « 1 200 collaborateurs » compte.
 */
const FAITS_CHIFFRES: { motif: RegExp; quoi: string }[] = [
  {
    motif:
      /(\d[\d\s.,]{0,12})\s*(?:collaborateurs?|salari[ée]s?|employ[ée]s?|personnes?|effectifs?)/i,
    quoi: "effectif",
  },
  {
    motif:
      /(\d[\d\s.,]{0,12})\s*(?:millions?|milliards?|m€|md€|k€)[^.]{0,40}(?:chiffre d'affaires|ca\b|budget)|chiffre d'affaires[^.]{0,30}(\d[\d\s.,]{0,12})/i,
    quoi: "chiffre d'affaires",
  },
  {
    motif:
      /(\d[\d\s.,]{0,12})\s*(?:logements?|lits?|magasins?|agences?|sites?|filiales?|[ée]tablissements?|usines?|boutiques?|points? de vente|organismes?|entit[ée]s?|adh[ée]rents?)/i,
    quoi: "périmètre",
  },
  {
    motif: /(?:depuis|cr[ée][ée]e? en|fond[ée]e? en)\s*(1[89]\d\d|20[0-2]\d)/i,
    quoi: "ancienneté",
  },
  {
    motif: /(\d[\d\s.,]{0,12})\s*(?:pays|r[ée]gions?|d[ée]partements?)/i,
    quoi: "implantation",
  },
];

/**
 * Les en-têtes de la section « qui nous sommes ».
 *
 * Leur présence ne suffit pas : beaucoup d'annonces titrent « À propos » et
 * enchaînent sur trois adjectifs. Elle compte pour un demi-fait, et c'est tout
 * ce qu'elle mérite.
 */
const SECTION_ENTREPRISE =
  /(?:[àa]\s+propos(?:\s+de\s+nous)?|qui\s+sommes[-\s]nous|notre\s+(?:entreprise|groupe|soci[ée]t[ée]|histoire|mission)|pr[ée]sentation\s+de\s+(?:l[''\s]entreprise|la\s+soci[ée]t[ée])|mieux\s+nous\s+conna[îi]tre|notre\s+ADN)/i;

export interface Documentation {
  /** Vrai si l'annonce dispense de chercher. */
  suffisante: boolean;
  /** Ce qui a été trouvé, pour l'afficher plutôt que de l'affirmer. */
  faits: string[];
  /** Vrai si l'annonce comporte une section de présentation. */
  section: boolean;
}

/**
 * @param contenu Le texte brut de l'annonce, tel qu'il a été collé.
 */
export function documentationEntreprise(contenu: string | null): Documentation {
  if (!contenu || contenu.trim().length < 200) {
    return { suffisante: false, faits: [], section: false };
  }

  const faits: string[] = [];
  for (const f of FAITS_CHIFFRES) {
    const trouve = contenu.match(f.motif);
    if (!trouve) continue;
    // On garde le passage trouvé et non le nom du critère : à l'écran, « 80 000
    // logements » est une preuve, « périmètre » est une affirmation.
    faits.push(trouve[0].replace(/\s+/g, " ").trim().slice(0, 60));
  }

  const section = SECTION_ENTREPRISE.test(contenu);

  // Deux faits chiffrés, ou un fait et une section de présentation. Un seul
  // chiffre isolé ne fait pas un paragraphe : beaucoup d'annonces donnent un
  // effectif et rien d'autre.
  const suffisante = faits.length >= 2 || (faits.length >= 1 && section);

  return { suffisante, faits, section };
}
