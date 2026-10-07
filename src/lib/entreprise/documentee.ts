/**
 * L'annonce parle-t-elle assez de l'entreprise pour qu'on n'ait rien à
 * chercher ? (D109, refondu en D129)
 *
 * Une recherche web coûte 2,7 ¢. La lancer alors que l'annonce contient déjà
 * la présentation de l'employeur, c'est payer pour apprendre ce qu'on sait.
 *
 * La décision se prend **sans IA**, par lecture du texte déjà stocké : c'est
 * gratuit, instantané, rétroactif sur toutes les offres, et surtout
 * reproductible — on peut dire à l'écran pourquoi la recherche n'a pas eu
 * lieu, en montrant ce qui a été trouvé.
 *
 * ── Ce qui n'allait pas ──
 *
 * La première version ne cherchait que des **nombres accompagnés de leur
 * unité**, au motif qu'un chiffre ne peut pas être du remplissage. Le
 * 7 octobre, offre DIM, elle a rendu :
 *
 *     suffisante : false   ·   faits chiffrés trouvés : 0
 *
 * sur une annonce dont le paragraphe d'entreprise dit : « DBI commercialise
 * de nombreuses marques réputées (Dim, Nur Die, Lovable, Playtex) et opère
 * dans plus de dix pays. […] à Autun (71) se trouve notre siège social
 * historique, où sont répartis la fabrication, le contrôle de la qualité et la
 * logistique. […] plus de 5 milliards de collants confectionnés depuis la
 * création de la marque DIM en 1953. »
 *
 * Trois faits, trois échecs, chacun pour une raison bête :
 * « plus de **dix** pays » — le nombre est écrit en lettres ; « 5 milliards de
 * **collants** » — le mot n'était pas dans la liste fermée des unités ; « depuis
 * **la création de la marque DIM en** 1953 » — le motif exigeait l'année collée
 * à « depuis ». Et la détection de section ne cherchait que « À propos » ou
 * « Qui sommes-nous », titres qu'une annonce LinkedIn n'a jamais.
 *
 * La recherche est donc partie, a coûté 2,7 ¢, et le §2 a été écrit avec la
 * seule chose que le modèle avait déjà : 1953 et Autun, tous deux dans
 * l'annonce.
 *
 * ── Ce qu'on mesure maintenant ──
 *
 * Ce qu'une annonce porte sur son employeur, ce n'est presque jamais un
 * chiffre isolé : c'est un **paragraphe de prose**. On le reconnaît donc comme
 * tel, et les motifs chiffrés restent en complément, élargis.
 *
 * Le seuil penche toujours du même côté : se tromper en cherchant coûte
 * 2,7 ¢, se tromper en ne cherchant pas coûte un paragraphe inventé que
 * personne ne rattrape.
 */

/**
 * Le vocabulaire par lequel une entreprise se présente.
 *
 * Liste fermée, comme la taxonomie. Chacun de ces mots peut apparaître
 * ailleurs ; c'est leur **concentration dans un même paragraphe** qui signale
 * une présentation, et c'est ce qu'on compte.
 */
const MOTS_DE_PRESENTATION = [
  "leader",
  "spécialis",
  "specialis",
  "groupe",
  "filiale",
  "marque",
  "enseigne",
  "siège",
  "siege",
  "implant",
  "présent dans",
  "present dans",
  "fond[ée]",
  "cré[ée]",
  "créée en",
  "savoir-faire",
  "savoir faire",
  "métier",
  "metier",
  "activité",
  "activite",
  "chiffre d'affaires",
  "collaborateur",
  "salari",
  "effectif",
  "adhérent",
  "adherent",
  "client",
  "pays",
  "site",
  "usine",
  "agence",
  "magasin",
  "établissement",
  "etablissement",
  "réseau",
  "reseau",
  "histoire",
  "fondation",
  "mission",
  "secteur",
  "marché",
  "marche",
  "croissance",
  "filière",
  "filiere",
];

/**
 * Ce qui trahit un paragraphe de **poste** et non d'entreprise.
 *
 * Une annonce dit « vous serez rattaché », « votre mission consistera »,
 * « profil recherché ». Ces blocs-là contiennent aussi « mission », « métier »
 * et « secteur » : sans ce garde-fou, la description du poste compterait pour
 * une présentation de l'employeur.
 */
const MOTS_DU_POSTE =
  /\b(?:vous (?:serez|aurez|êtes|etes|devrez|participerez|assurerez)|votre mission|vos missions|profil recherché|profil recherche|rattach[ée]|le poste|ce poste|nous recherchons|nous recrutons|titulaire d['’]un)\b/gi;

/**
 * Ce qui disqualifie un bloc d'un seul coup.
 *
 * Trois faux positifs relevés en calibrant sur les 121 annonces de la base, et
 * chacun aurait supprimé la recherche sur une annonce qui ne dit rien de
 * l'employeur :
 *
 * - **le pied de page du site d'emploi** — « Afficher plus d'offres ·
 *   Découvrez d'autres services web · Réussir son CV et sa lettre de
 *   motivation · B.A.BA Entretien ». Six mots de présentation, zéro mot sur
 *   l'entreprise ;
 * - **la description de poste tutoyante** — « Tes missions : dans le cadre du
 *   développement de notre activité… ». Le garde-fou ne connaissait que le
 *   vouvoiement ;
 * - **le cabinet de recrutement qui se présente** — « ŌDAS Conseil, expert du
 *   recrutement, recrute pour le compte de l'un de ses clients ». C'est une
 *   présentation, mais pas celle de l'employeur, et le §2 parlerait de
 *   l'intermédiaire.
 */
const DISQUALIFIANT =
  /(?:afficher plus d['’]offres|découvrez d['’]autres services|réussir son cv|b\.a\.ba|créez? une alerte|politique de confidentialité|conditions d['’]utilisation|identifiez-vous|inscrivez-vous|tes missions|ton profil|tu seras|tu es rattach|recrute pour le compte|pour le compte de l['’]un de ses clients|notre client recherche)/i;

/**
 * Ce qui, dans une annonce, décrit l'entreprise par un chiffre.
 *
 * Les motifs acceptent désormais les nombres **écrits en lettres**, et
 * n'exigent plus que l'année suive immédiatement « depuis » : « depuis la
 * création de la marque en 1953 » compte.
 */
const NOMBRE = "(?:\\d[\\d\\s.,]{0,12}|une?|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|douze|quinze|vingt|trente|quarante|cinquante|cent|mille)";

const FAITS_CHIFFRES: { motif: RegExp; quoi: string }[] = [
  {
    motif: new RegExp(
      `${NOMBRE}\\s*(?:collaborateurs?|salari[ée]s?|employ[ée]s?|personnes?|effectifs?)`,
      "i"
    ),
    quoi: "effectif",
  },
  {
    motif:
      /(\d[\d\s.,]{0,12})\s*(?:millions?|milliards?|m€|md€|k€)[^.]{0,40}(?:chiffre d'affaires|ca\b|budget)|chiffre d'affaires[^.]{0,30}(\d[\d\s.,]{0,12})/i,
    quoi: "chiffre d'affaires",
  },
  {
    /**
     * Le périmètre, sans liste fermée d'unités.
     *
     * « 5 milliards de **collants** » n'entrait dans aucune de mes catégories,
     * et aucune liste ne contiendra jamais le produit de chaque employeur. On
     * accepte donc n'importe quel nom commun après un ordre de grandeur, et on
     * garde la liste fermée pour les unités sans ordre de grandeur.
     */
    motif: new RegExp(
      `${NOMBRE}\\s*(?:millions?|milliards?|milliers?)\\s+d[eu']\\s*\\w+` +
        `|${NOMBRE}\\s*(?:logements?|lits?|magasins?|agences?|sites?|filiales?|[ée]tablissements?|usines?|boutiques?|points? de vente|organismes?|entit[ée]s?|adh[ée]rents?|marques?|r[ée]f[ée]rences?)`,
      "i"
    ),
    quoi: "périmètre",
  },
  {
    // « depuis 1953 », mais aussi « depuis la création de la marque en 1953 ».
    motif:
      /(?:depuis|cr[ée][ée]e? en|fond[ée]e? en|cr[ée]ation[^.]{0,40}en)\s*(?:[^.]{0,40}?)\b(1[89]\d\d|20[0-2]\d)\b/i,
    quoi: "ancienneté",
  },
  {
    motif: new RegExp(`${NOMBRE}\\s*(?:pays|r[ée]gions?|d[ée]partements?|continents?)`, "i"),
    quoi: "implantation",
  },
];

/** Les en-têtes explicites, quand elles existent. Elles sont rares. */
const SECTION_ENTREPRISE =
  /(?:[àa]\s+propos(?:\s+de\s+nous)?|qui\s+sommes[-\s]nous|notre\s+(?:entreprise|groupe|soci[ée]t[ée]|histoire|mission)|pr[ée]sentation\s+de\s+(?:l[''\s]entreprise|la\s+soci[ée]t[ée])|mieux\s+nous\s+conna[îi]tre|notre\s+ADN)/i;

export interface Documentation {
  /** Vrai si l'annonce dispense de chercher. */
  suffisante: boolean;
  /** Ce qui a été trouvé, pour l'afficher plutôt que de l'affirmer. */
  faits: string[];
  /** Vrai si l'annonce comporte une section de présentation. */
  section: boolean;
  /** Le paragraphe qui présente l'employeur, s'il a été reconnu (D129). */
  paragraphe: string | null;
}

/** Longueur en deçà de laquelle un bloc ne peut pas présenter une entreprise. */
const LONGUEUR_PARAGRAPHE = 180;

/** Mots de présentation distincts exigés dans un même bloc. */
const MOTS_EXIGES = 4;

/** Découpe le texte en blocs, sur les sauts de ligne multiples. */
function blocs(contenu: string): string[] {
  return contenu
    .split(/\n\s*\n+/)
    .map((b) => b.replace(/\s+/g, " ").trim())
    .filter((b) => b.length >= LONGUEUR_PARAGRAPHE);
}

/**
 * Le bloc qui présente l'employeur, ou `null`.
 *
 * On retient celui qui concentre le plus de vocabulaire de présentation, à
 * condition qu'il en porte au moins quatre **distincts** et qu'il parle à la
 * première personne du pluriel ou nomme l'entreprise — sans quoi c'est une
 * description de marché, pas une présentation.
 */
function paragrapheEntreprise(
  contenu: string,
  entreprise: string | null
): string | null {
  const nom = (entreprise ?? "").trim().toLowerCase();
  const premierMot = nom.split(/[\s(]/).filter((m) => m.length >= 3)[0] ?? "";

  let meilleur: { bloc: string; score: number } | null = null;

  for (const bloc of blocs(contenu)) {
    const bas = bloc.toLowerCase();

    // Un bloc qui parle du poste, du site d'emploi ou de l'intermédiaire
    // n'est pas une présentation de l'employeur.
    if (DISQUALIFIANT.test(bloc)) continue;
    const marqueursPoste = (bloc.match(MOTS_DU_POSTE) ?? []).length;
    if (marqueursPoste >= 2) continue;

    const trouves = MOTS_DE_PRESENTATION.filter((m) =>
      new RegExp(m, "i").test(bas)
    ).length;
    if (trouves < MOTS_EXIGES) continue;

    const parleDeSoi =
      /\b(?:nous|notre|nos)\b/i.test(bloc) ||
      (premierMot.length >= 3 && bas.includes(premierMot));
    if (!parleDeSoi) continue;

    if (!meilleur || trouves > meilleur.score) {
      meilleur = { bloc, score: trouves };
    }
  }

  return meilleur?.bloc ?? null;
}

/**
 * @param contenu Le texte brut de l'annonce, tel qu'il a été collé.
 * @param entreprise Le nom de l'employeur, quand il est connu : il aide à
 * reconnaître le paragraphe qui parle de lui.
 */
export function documentationEntreprise(
  contenu: string | null,
  entreprise: string | null = null
): Documentation {
  if (!contenu || contenu.trim().length < 200) {
    return { suffisante: false, faits: [], section: false, paragraphe: null };
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
  const paragraphe = paragrapheEntreprise(contenu, entreprise);

  /**
   * Un paragraphe de présentation suffit à lui seul : c'est exactement ce
   * qu'une recherche web irait chercher, et il est déjà là, gratuit et à jour.
   * À défaut, deux faits chiffrés, ou un fait et une section — le seuil
   * d'origine, conservé.
   */
  const suffisante =
    paragraphe !== null || faits.length >= 2 || (faits.length >= 1 && section);

  return { suffisante, faits, section, paragraphe };
}
