/**
 * L'adresse à qui envoyer la candidature, trouvée dans l'annonce (D94).
 *
 * Certaines offres ne passent pas par un formulaire : « Un simple mail avec un
 * CV à Jonathan THIRIONET, Responsable Recrutement : j.thirionet@… ». Cette
 * information était dans `contenu_brut` depuis le premier jour, lue et payée
 * avec le reste — et jetée. Il fallait rouvrir l'annonce pour la retrouver.
 *
 * Rien ici ne passe par un modèle, et c'est délibéré. Une adresse mail est un
 * **motif**, pas une question de langue : l'expression régulière la trouve
 * gratuitement, rétroactivement sur toutes les offres déjà analysées, et —
 * contrairement à un modèle — elle ne peut pas en inventer une.
 *
 * Le tri fait le vrai travail. Sur les sept adresses trouvées dans la base au
 * 29 septembre, deux seulement étaient des adresses de candidature : les cinq
 * autres étaient des mentions RGPD, un référent Mission Handicap et le
 * `exemple@exemple.fr` d'un formulaire de connexion.
 */

export interface ContactAnnonce {
  email: string;
  /** La phrase de l'annonce qui porte l'adresse. Ses mots, pas les nôtres. */
  phrase: string;
  /** Le nom du destinataire, quand la phrase le donne sans ambiguïté. */
  nom: string | null;
  /** Plus il est élevé, plus l'adresse ressemble à celle de candidature. */
  rang: number;
}

const MOTIF_EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

/** Adresses qui ne servent jamais à candidater. */
const LOCALES_EXCLUES =
  /^(no[-_.]?reply|donotreply|ne[-_.]?pas[-_.]?repondre|dpo|rgpd|privacy|donnees|protectiondesdonnees|exemple|example|nom\.prenom|prenom\.nom|votre[-_.]?email)/i;

/** Domaines des plateformes : leur adresse n'est jamais celle du recruteur. */
const DOMAINES_EXCLUS = [
  "hellowork",
  "indeed",
  "apec.fr",
  "welcometothejungle",
  "linkedin",
  "monster",
  "cadremploi",
  "glassdoor",
  "talent.com",
  "francetravail",
  "pole-emploi",
  "taleez",
  "digitalrecruiters",
  "werecruit",
  "smartrecruiters",
  "flatchr",
  "softy.pro",
  "recruitee",
  "talentview",
  "profils.org",
  "jobteaser",
  "meteojob",
  "regionsjob",
  "septeo.com",
];

/** Ce qui, dans la phrase, désigne une adresse de candidature. */
const MOTS_CANDIDATURE =
  /(candidatur|postul|envoy|adress|transmett|c\.?v\.?\b|curriculum|lettre de motivation|recrutement)/i;

/** Ce qui, dans la phrase, désigne tout sauf une adresse de candidature. */
const MOTS_HORS_SUJET =
  /(rgpd|donn[ée]es personnelles|droit d.acc|mission handicap|handicap|diversit|d[ée]sabonn|mot de passe|espace candidat|conditions g[ée]n[ée]rales)/i;

/** Un patronyme dans l'adresse : j.thirionet, marie.dupont. */
const LOCALE_PERSONNE = /^[a-z]+[._][a-z-]{2,}$/i;

/**
 * Décode les entités HTML les plus courantes.
 *
 * Les annonces collées depuis un site en sont pleines — `&#x27;`, `&#xE9;` —
 * et une phrase affichée telle quelle serait illisible.
 */
function decoderEntites(texte: string): string {
  return texte
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

/** La phrase qui entoure une position, bornée et nettoyée. */
function phraseAutour(texte: string, position: number): string {
  const fenetre = texte.slice(
    Math.max(0, position - 260),
    Math.min(texte.length, position + 200)
  );
  const relatif = position - Math.max(0, position - 260);

  const avant = fenetre.slice(0, relatif);
  const apres = fenetre.slice(relatif);

  // On coupe à la ponctuation forte ou au retour à la ligne, jamais au point
  // d'une adresse : celui-ci est toujours suivi d'une lettre.
  const debut = Math.max(
    avant.lastIndexOf(". "),
    avant.lastIndexOf("! "),
    avant.lastIndexOf("? "),
    avant.lastIndexOf("\n")
  );
  const finRelative = apres.search(/[.!?](?:\s|$)|\n/);

  const brut =
    avant.slice(debut + 1) + (finRelative === -1 ? apres : apres.slice(0, finRelative + 1));

  return decoderEntites(brut).replace(/\s+/g, " ").trim().slice(0, 240);
}

/**
 * Le nom du destinataire, quand la phrase l'annonce clairement.
 *
 * Seulement la forme « à Prénom NOM » : deviner au-delà produirait des noms
 * faux, et la phrase entière est affichée de toute façon — c'est elle qui fait
 * foi.
 */
function nomDansLaPhrase(phrase: string): string | null {
  // Pas de `\b` devant « à » : la limite de mot de JavaScript ne connaît que
  // l'alphabet ASCII, et « à » n'en fait pas partie — la recherche échouait
  // silencieusement sur le seul cas qui comptait.
  const m = phrase.match(
    /(?:^|\s)(?:à|a|auprès de|aupres de)\s+([A-ZÀ-Þ][\p{L}'’-]+(?:\s+[A-ZÀ-Þ][\p{L}'’-]+){1,2})/u
  );
  if (!m) return null;

  const candidat = m[1].trim();
  // « à Monsieur », « à Madame » : une civilité seule n'est pas un nom.
  if (/^(Monsieur|Madame|Mademoiselle|Service|Direction)\b/i.test(candidat)) {
    return null;
  }
  return candidat;
}

/**
 * @param contenu Le texte brut de l'annonce, tel qu'il a été collé.
 * @returns Les adresses plausibles, la plus probable en tête. Vide si aucune.
 */
export function contactsDansAnnonce(contenu: string | null): ContactAnnonce[] {
  if (!contenu) return [];

  const vus = new Set<string>();
  const trouves: ContactAnnonce[] = [];

  for (const trouve of contenu.matchAll(MOTIF_EMAIL)) {
    const email = trouve[0].replace(/[.,;:]+$/, "");
    const cle = email.toLowerCase();
    if (vus.has(cle)) continue;
    vus.add(cle);

    const [locale, domaine = ""] = cle.split("@");
    if (LOCALES_EXCLUES.test(locale)) continue;
    if (DOMAINES_EXCLUS.some((d) => domaine.includes(d))) continue;

    const phrase = phraseAutour(contenu, trouve.index ?? 0);

    // Une mention RGPD ou un référent handicap portent une vraie adresse, mais
    // pas celle-là. Écartées, pas déclassées : les afficher créerait le doute.
    if (MOTS_HORS_SUJET.test(phrase)) continue;

    let rang = 0;
    if (MOTS_CANDIDATURE.test(phrase)) rang += 3;
    if (LOCALE_PERSONNE.test(locale)) rang += 2;
    if (/^(recrut|rh|emploi|job|candidatur)/i.test(locale)) rang += 2;

    trouves.push({ email, phrase, nom: nomDansLaPhrase(phrase), rang });
  }

  return trouves.sort((a, b) => b.rang - a.rang).slice(0, 3);
}

/** L'adresse la plus probable, ou null s'il n'y en a aucune de crédible. */
export function contactPrincipal(contenu: string | null): ContactAnnonce | null {
  return contactsDansAnnonce(contenu)[0] ?? null;
}
