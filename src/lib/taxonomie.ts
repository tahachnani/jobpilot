import { ACTIVITES } from "@/config/activites";
import { creerClientServeur } from "@/lib/supabase/server";

/**
 * La taxonomie des activités, désormais tenue en base (D74).
 *
 * Elle reste **fermée** : le scoring compare des codes, jamais des mots, et
 * c'est ce qui rend une note reproductible. Ce qui change, c'est qui la ferme.
 * Le fichier `src/config/activites.ts` garde le rôle de socle — il amorce la
 * table et sert de repli — mais la vérité du moteur est la table.
 *
 * Aucune mémoire entre deux appels : une taxonomie modifiée puis un recalcul
 * lancé dans la foulée doivent donner le score de la nouvelle liste, pas celui
 * d'un cache. Trente lignes se relisent pour rien.
 */

export interface Activite {
  code: string;
  libelle: string;
  famille: string;
  socle: boolean;
  actif: boolean;
  ordre: number;
}

/** Ce dont le moteur a besoin : un libellé et une famille par code. */
export type Taxonomie = Record<
  string,
  { libelle: string; famille: string; actif: boolean }
>;

export const FAMILLES_ACTIVITE: Record<string, string> = {
  cdg: "Contrôle de gestion",
  compta: "Comptabilité",
  transverse: "Transverse",
};

/**
 * Le socle versionné, converti au format du moteur.
 *
 * Il sert quand la table n'existe pas encore — migration non lancée — ou
 * qu'elle est vide. Un score doit toujours pouvoir se calculer : une taxonomie
 * introuvable ne doit pas se traduire par « aucune mission classée, offre à
 * zéro ».
 */
export const SOCLE: Taxonomie = Object.fromEntries(
  Object.entries(ACTIVITES).map(
    ([code, a]): [string, Taxonomie[string]] => [
      code,
      { libelle: a.libelle, famille: a.famille as string, actif: true },
    ]
  )
);

/** Le libellé lisible d'un code, ou le code brut s'il est inconnu. */
export function libelleDe(taxonomie: Taxonomie, code: string): string {
  return taxonomie[code]?.libelle ?? code;
}

/**
 * Les codes proposés au modèle et à la saisie : les actifs seulement.
 *
 * Un code retiré du service reste compris par le moteur — les missions qui le
 * portent gardent leur sens — mais cesse d'être proposé. Sans cette
 * distinction, retirer un code reviendrait à effacer silencieusement ce qu'il
 * classait.
 */
export function codesActifs(taxonomie: Taxonomie): string[] {
  return Object.keys(taxonomie).filter((c) => taxonomie[c].actif);
}

/**
 * Transforme une saisie libre en code utilisable.
 *
 * « Amélioration continue » devient `amelioration_continue`. Le code est un
 * identifiant, pas un libellé : il vit dans des tableaux de texte en base, il
 * ne doit donc porter ni accent, ni espace, ni majuscule.
 */
export function normaliserCode(brut: string): string {
  return brut
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40)
    .replace(/_+$/g, "");
}

/** Un code est recevable s'il commence par une lettre et reste lisible. */
export function codeRecevable(code: string): boolean {
  return /^[a-z][a-z0-9_]{2,39}$/.test(code);
}

/**
 * Charge la taxonomie pour le moteur, avec repli sur le socle.
 *
 * Le repli est silencieux ici — le calcul ne doit pas s'interrompre — mais
 * l'écran « Taxonomie », lui, dit clairement que la table est absente ou vide :
 * c'est là qu'il faut le voir, pas au milieu d'un score.
 */
export async function chargerTaxonomie(): Promise<Taxonomie> {
  const { lignes } = await lireActivites();
  if (lignes.length === 0) return SOCLE;

  return Object.fromEntries(
    lignes.map((a): [string, Taxonomie[string]] => [
      a.code,
      { libelle: a.libelle, famille: a.famille, actif: a.actif },
    ])
  );
}

/**
 * Lit la table telle quelle, pour l'écran d'édition.
 *
 * `disponible` distingue les deux cas que l'appelant doit traiter
 * différemment : la table est vide (rien à afficher) ou elle n'existe pas
 * (migration 0011 non lancée). La leçon du 21 septembre — une colonne
 * manquante ne casse pas une ligne, elle vide un écran — a coûté assez cher
 * pour qu'on la dise ici.
 */
export async function lireActivites(): Promise<{
  lignes: Activite[];
  disponible: boolean;
}> {
  const supabase = creerClientServeur();
  const { data, error } = await supabase
    .from("activites")
    .select("code, libelle, famille, socle, actif, ordre")
    .order("famille")
    .order("ordre");

  if (error) return { lignes: [], disponible: false };

  return { lignes: (data ?? []) as Activite[], disponible: true };
}

/**
 * Incrémente la version du barème.
 *
 * Toute modification de la taxonomie change ce que le moteur sait classer :
 * les scores d'avant et d'après ne sont plus comparables. La version les
 * distingue, exactement comme pour une retouche des poids (Paramètres), et
 * l'écran invite à renoter — gratuitement, aucun appel IA.
 */
export async function incrementerVersionBareme(): Promise<string | null> {
  const supabase = creerClientServeur();
  const { data } = await supabase
    .from("parametres")
    .select("valeur")
    .eq("cle", "bareme")
    .maybeSingle();

  const valeur =
    ((data as { valeur?: Record<string, unknown> } | null)?.valeur ?? {}) as
      Record<string, unknown>;

  const n = Number(String(valeur.version ?? "0"));
  const suivante = String((Number.isFinite(n) ? n : 0) + 1);

  const { error } = await supabase
    .from("parametres")
    .update({
      valeur: { ...valeur, version: suivante },
      updated_at: new Date().toISOString(),
    })
    .eq("cle", "bareme");

  return error ? null : suivante;
}

/**
 * Compte ce qui porte un code : missions du parcours et entrées de corpus.
 *
 * Sert au garde-fou de suppression. Les analyses d'offres déjà stockées en
 * portent aussi, mais elles se renotent : un code supprimé y devient une ligne
 * hors calcul, ce que D73 affiche désormais honnêtement.
 */
export async function usagesDuCode(
  code: string
): Promise<{ missions: number; corpus: number }> {
  const supabase = creerClientServeur();

  const [m, c] = await Promise.all([
    supabase
      .from("missions")
      .select("id", { count: "exact", head: true })
      .contains("activites_codes", [code]),
    supabase
      .from("corpus_experience")
      .select("id", { count: "exact", head: true })
      .contains("activites_codes", [code]),
  ]);

  return { missions: m.count ?? 0, corpus: c.count ?? 0 };
}
