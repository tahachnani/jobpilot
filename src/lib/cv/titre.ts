import { VOLETS, type CodeVolet } from "@/config/volets";
import { LIBELLES_CONTRAT } from "@/config/activites";
import { normaliser } from "@/lib/texte";
import type { OffreExtraite } from "@/lib/extraction-offre";

/**
 * Le titre imprimé en haut du CV (D121).
 *
 * Il était figé par volet : `intitulesCibles[0]`, c'est-à-dire « CONTRÔLEUR DE
 * GESTION » ou « COMPTABLE », quelle que soit l'annonce. Une candidature à un
 * poste d'auditeur junior partait donc avec « COMPTABLE » en première ligne —
 * le premier mot que lit un recruteur, et il contredit l'objet de la lettre.
 *
 * La tentation était d'ouvrir un troisième volet pour l'audit. C'eût été payer
 * une structure entière (trois colonnes par table, quinze branches de code qui
 * retombent silencieusement sur « compta », et trente-six formulations à
 * réécrire) pour une ligne de texte. Le reste du CV, lui, s'adapte déjà offre
 * par offre : la sélection des missions suit les codes d'activité de
 * l'annonce, pas le volet.
 *
 * Le titre suit donc l'offre, et le volet ne sert plus que de dernier recours.
 * Trois sources, dans cet ordre :
 *
 *   1. ce que tu as écrit toi-même pour cette offre ;
 *   2. l'intitulé de l'annonce, débarrassé de ce qui n'est pas le poste ;
 *   3. l'intitulé cible du volet, comme avant.
 *
 * Le nettoyage est volontairement **timide**. Les annonces mettent dans leur
 * titre deux choses très différentes : du bruit administratif (« H/F »,
 * « CDI », la ville) et de la spécialisation qui vaut de l'or sur un CV
 * (« Business Partner Logistique », « Charges Locatives », « Audit et gestion
 * des immobilisations »). Les deux arrivent après le même tiret. On ne coupe
 * donc jamais « tout ce qui suit un séparateur » : on retire seulement ce
 * qu'on sait nommer.
 */

/** Longueur au-delà de laquelle le titre passerait sur deux lignes. */
const LONGUEUR_MAX = 60;

/**
 * Mentions de contrat et de temps de travail, telles qu'elles s'écrivent dans
 * un titre d'annonce. Liste fermée, comme la taxonomie : on ne devine pas.
 */
const MENTIONS_CONTRAT = [
  ...Object.values(LIBELLES_CONTRAT),
  "CDI",
  "CDD",
  "Intérim",
  "Interim",
  "Stage",
  "Alternance",
  "Apprentissage",
  "Freelance",
  "Temps plein",
  "Temps partiel",
  "Temps complet",
  "Full time",
  "Internship",
  "VIE",
];

/** Les séparateurs de segments qu'emploient les annonces. */
const SEPARATEURS = /\s*[|•·]\s*|\s+[-–—]\s+/;

/**
 * Marqueurs de mixité : « H/F », « (F/H) », « H/F/X », « M/W/D ».
 *
 * Le motif exige les barres obliques : sans elles, un « F » isolé serait un
 * mot comme un autre et « Contrôleur de Gestion F » n'existe pas, mais
 * « Pôle F » pourrait.
 */
const MIXITE = /\(?\s*\b[hfmwdx](?:\s*[/\-]\s*[hfmwdx])+\b\s*\)?/gi;

/** Référence interne de l'annonce : « Réf. 12345 », « (ref: ABC-12) ». */
const REFERENCE = /\(?\s*\b(?:réf|ref|reference|référence)\b\.?\s*:?\s*[\w-]+\s*\)?/gi;

/** Les terminaisons féminines que les annonces accolent au masculin. */
const FEMININ = "e|se|ne|te|rice|euse|eure|ère|ere";

/**
 * Forme inclusive collée au mot, dans ses trois notations :
 * « Assistant(e) », « Contrôleur.euse », « Contrôleur-euse », « CHARGÉ.E ».
 * On garde le masculin, qui est la forme que porte le CV.
 */
const INCLUSIF_PARENTHESE = new RegExp(`(\\p{L})\\((?:${FEMININ})\\)`, "giu");
const INCLUSIF_POINT = new RegExp(
  `(\\p{L}{3,})[.·‧-](?:${FEMININ})\\b`,
  "giu"
);

/** Article de tête des annonces publiques : « UN(E) CHARGÉ.E DE … ». */
const ARTICLE_INITIAL = /^(?:un|une|le|la|les|des)\s+/i;

/**
 * Le doublon féminin après une barre oblique.
 *
 * « Contrôleur de gestion immobilier/Contrôleuse de gestion immobilier » est
 * un seul poste écrit deux fois. « Contrôleur de Gestion / Analyste Financier
 * Real Estate » en est deux, et il faut les garder tous les deux. On tranche
 * sur le recouvrement du vocabulaire : au-delà de la moitié des mots en
 * commun, c'est la même chose dite au féminin.
 */
function retirerDoublonFeminin(texte: string): string {
  const parts = texte.split("/");
  if (parts.length !== 2) return texte;

  const mots = (s: string) =>
    new Set(normaliser(s).split(/\s+/).filter((m) => m.length > 2));
  const a = mots(parts[0]);
  const b = mots(parts[1]);
  if (a.size === 0 || b.size === 0) return texte;

  const communs = [...a].filter((m) => b.has(m)).length;
  const recouvrement = communs / Math.min(a.size, b.size);

  return recouvrement > 0.5 ? parts[0].trim() : texte;
}

/**
 * Le seul mot redit au féminin : « Contrôleur/Contrôleuse de gestion junior »,
 * « Contrôleur ou Contrôleuse de gestion commercial ».
 *
 * Ici le doublon ne porte que sur le nom du poste, et la suite de la phrase
 * n'appartient qu'à la seconde moitié : la règle du recouvrement de
 * vocabulaire ne la voit pas. On compare donc le mot qui précède le
 * connecteur et celui qui suit, et on les tient pour un même mot s'ils
 * partagent cinq lettres de racine — de quoi séparer « contrôleur /
 * contrôleuse » de « contrôleur / analyste ».
 */
const RACINE_COMMUNE_MIN = 5;

/**
 * L'allongement maximal du féminin sur le masculin.
 *
 * Sans cette borne, « Contrôleur de Gestion / Gestionnaire de contrats »
 * devenait « Contrôleur de Gestion de contrats » : « gestion » et
 * « gestionnaire » partagent sept lettres de racine et le second finit par un
 * « e », donc la règle y voyait un féminin. Ce sont deux mots différents.
 * Un féminin n'ajoute jamais plus de trois lettres au masculin —
 * contrôleur/contrôleuse en ajoute une, directeur/directrice aussi.
 */
const ALLONGEMENT_MAX = 3;

const FIN_FEMININE = new RegExp(`(?:${FEMININ})$`, "i");

function retirerDoubletDeMot(texte: string): string {
  return texte.replace(
    /(\p{L}{4,})\s*(?:\/|\s+ou\s+)\s*(\p{L}{4,})/giu,
    (tout, masculin: string, feminin: string) => {
      const a = normaliser(masculin);
      const b = normaliser(feminin);
      if (a === b) return masculin;

      if (!FIN_FEMININE.test(b)) return tout;
      if (b.length < a.length || b.length - a.length > ALLONGEMENT_MAX) {
        return tout;
      }

      let i = 0;
      while (i < a.length && i < b.length && a[i] === b[i]) i += 1;
      return i >= RACINE_COMMUNE_MIN ? masculin : tout;
    }
  );
}

/** Un segment n'est-il que du bruit administratif ? */
function estDuBruit(segment: string, localisation: string | null): boolean {
  const s = segment.trim();
  if (s.length === 0) return true;

  const n = normaliser(s);
  if (MENTIONS_CONTRAT.some((m) => normaliser(m) === n)) return true;

  // La localisation telle que l'analyse l'a lue : « Paris 11e », « Clamart,
  // Hauts-de-Seine ». On la compare entière, pas par mots — « Gestion
  // administrative » ne doit pas disparaître parce que l'offre est à Gestion,
  // commune de la Creuse.
  if (localisation && normaliser(localisation) === n) return true;

  // Un département seul : « (92) », « 75 ».
  if (/^\(?\d{2,3}\)?$/.test(s)) return true;

  return false;
}

/**
 * Met un intitulé d'annonce en état de figurer en tête de CV.
 *
 * Ne touche jamais au fond : si rien n'est reconnu comme du bruit, l'intitulé
 * ressort tel quel. Un titre vidé par le nettoyage est un nettoyage raté, et
 * on rend alors l'original.
 */
export function nettoyerIntitulePoste(
  brut: string | null | undefined,
  contexte: { localisation?: string | null } = {}
): string {
  const original = (brut ?? "").trim();
  if (!original) return "";

  let t = original.replace(MIXITE, " ").replace(REFERENCE, " ");
  t = t.replace(INCLUSIF_PARENTHESE, "$1").replace(INCLUSIF_POINT, "$1");
  t = t.replace(/\s+/g, " ").trim().replace(ARTICLE_INITIAL, "");

  const segments = t
    .split(SEPARATEURS)
    .map((s) => s.trim())
    .filter((s) => !estDuBruit(s, contexte.localisation ?? null));

  t = retirerDoubletDeMot(retirerDoublonFeminin(segments.join(" - ")));

  // Ponctuation et parenthèses orphelines laissées par les retraits.
  t = t
    .replace(/\(\s*\)/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[\s,;:/|•·–—-]+|[\s,;:/|•·–—-]+$/g, "")
    .trim();

  if (t.length < 3) return original;
  return t.length > LONGUEUR_MAX ? raccourcir(t, LONGUEUR_MAX) : t;
}

/**
 * Ramène un titre trop long sous la limite d'une ligne.
 *
 * On sacrifie d'abord les segments de queue entiers : « Contrôleur de Gestion
 * Opérationnel Junior » vaut mieux que « Contrôleur de Gestion Opérationnel
 * Junior - Gestion », qui s'interrompt au milieu d'une idée. La coupe au mot
 * n'intervient que si le premier segment dépasse à lui seul.
 */
function raccourcir(texte: string, limite: number): string {
  const segments = texte.split(" - ");
  while (segments.length > 1 && segments.join(" - ").length > limite) {
    segments.pop();
  }

  // Sacrifier un segment ne vaut que si ce qui reste dit encore le poste.
  // « Assistant de direction » tiré de « Assistant de direction - Gestion
  // administrative et contrôle de gestion » perd la moitié de la candidature ;
  // mieux vaut alors couper au mot et garder la spécialisation entamée.
  const parSegments = segments.join(" - ");
  if (parSegments.length <= limite && parSegments.length >= limite / 2) {
    return parSegments;
  }

  const tronque = texte.slice(0, limite);
  const espace = tronque.lastIndexOf(" ");
  const coupe = espace > limite / 2 ? tronque.slice(0, espace) : tronque;
  return sansMotDeLiaisonFinal(coupe);
}

/** Mots qui ne peuvent pas terminer un titre coupé : « … administrative et ». */
const LIAISONS_FINALES =
  /(?:[\s,;:/|•·–—-]+|\s+\b(?:et|ou|de|du|des|la|le|les|en|à|a|pour|sur|dans|avec)\b)+$/gi;

function sansMotDeLiaisonFinal(texte: string): string {
  let t = texte;
  let avant = "";
  while (t !== avant) {
    avant = t;
    t = t.replace(LIAISONS_FINALES, "").trim();
  }
  return t;
}

/**
 * Le titre du CV pour une offre donnée.
 *
 * `manuel` l'emporte toujours : c'est toi qui as le dernier mot, et une saisie
 * à la main ne se fait jamais écraser par une regénération.
 */
export function titreCV(
  volet: CodeVolet,
  offre: Pick<OffreExtraite, "intitule" | "localisation"> | null,
  manuel?: string | null
): string {
  const saisi = (manuel ?? "").trim();
  if (saisi) return saisi.slice(0, LONGUEUR_MAX);

  const depuisOffre = nettoyerIntitulePoste(offre?.intitule, {
    localisation: offre?.localisation ?? null,
  });
  if (depuisOffre) return depuisOffre;

  return VOLETS[volet].intitulesCibles[0];
}
