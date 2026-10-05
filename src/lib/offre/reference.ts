/**
 * La référence de l'annonce, pour le premier paragraphe de la lettre (D111).
 *
 * L'usage français veut que l'objet de la lettre nomme le poste et, quand
 * l'annonce en porte une, sa référence : « publié sur HelloWork sous la
 * référence 179510151W ». C'est une convention administrative, et c'est aussi
 * la preuve la plus simple qu'on répond à cette annonce-là et pas à une autre.
 *
 * L'information est dans `contenu_brut` depuis le premier jour. Comme pour
 * l'adresse de candidature (D94), un motif suffit : une référence est une
 * forme, pas une question de langue. Gratuit, rétroactif sur toutes les offres
 * déjà analysées, et incapable d'inventer.
 */

/**
 * Les formes rencontrées sur les plateformes françaises.
 *
 * L'ordre compte : les motifs les plus explicites d'abord, pour qu'un
 * « Référence : 2026-132550 » ne soit pas capté par le motif générique du
 * numéro d'offre.
 */
const MOTIFS: RegExp[] = [
  // « Référence : 2026-132550 », « Réf. ABC-123 », « référence interne 4567 »
  /r[ée]f(?:[ée]rence)?s?\.?\s*(?:interne\s*|de\s+l['’]offre\s*|annonce\s*)?[:n°#]*\s*([A-Z0-9][A-Z0-9._\/-]{3,24})/i,
  // APEC : « Candidature sur offre d'emploi N° 179510151W »
  /offre\s+d['’]emploi\s*n[°o]\s*([A-Z0-9][A-Z0-9._\/-]{3,24})/i,
  // « Offre n° 2026-17571 », « annonce n°212BXVM »
  /(?:offre|annonce|poste)\s*n[°o]\s*[:]?\s*([A-Z0-9][A-Z0-9._\/-]{3,24})/i,
  // « pour l'offre 2026-132550 », sans « n° » : un jeton alphanumérique à
  // séparateur juste après « offre » est une référence, pas une fourchette.
  // Le minimum de quatre caractères avant le tiret écarte « 35-40 k€ ».
  /(?:offre|annonce|poste)\s+(?:de\s+\w+\s+)?([A-Z0-9]{4,}[-_\/][A-Z0-9][A-Z0-9._\/-]{1,18})/i,
  // France Travail : « 196XYZB »
  /\b(\d{6,7}[A-Z]{1,2})\b/,
];

/**
 * Ce qui ressemble à une référence sans en être une.
 *
 * Un numéro de téléphone, un code postal, un SIRET, un montant, une année : les
 * écarter ici coûte une ligne, les laisser passer ferait écrire « sous la
 * référence 35000 » en tête d'une lettre.
 */
function plausible(brut: string): boolean {
  const r = brut.trim();
  if (r.length < 4) return false;
  // Que des chiffres : seulement si c'est long, et pas une année ni un code
  // postal ni un SIRET.
  if (/^\d+$/.test(r)) {
    if (r.length < 5 || r.length > 10) return false;
    if (/^(19|20)\d\d$/.test(r)) return false;
    if (r.length === 5) return false; // code postal
  }
  // Un numéro de téléphone français, même espacé puis recollé.
  if (/^0[1-9]\d{8}$/.test(r)) return false;
  // Il faut au moins un chiffre : « CDI », « TEMPS-PLEIN » ne sont pas des
  // références.
  if (!/\d/.test(r)) return false;
  return true;
}

/** @returns La référence trouvée, ou null. Jamais une approximation. */
export function referenceAnnonce(contenu: string | null): string | null {
  if (!contenu) return null;

  for (const motif of MOTIFS) {
    const trouve = contenu.match(motif);
    const brut = trouve?.[1];
    if (brut && plausible(brut)) return brut.trim().replace(/[.,;:]+$/, "");
  }
  return null;
}
