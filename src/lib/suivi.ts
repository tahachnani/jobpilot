import { creerClientServeur } from "@/lib/supabase/server";
import {
  CHAINE_PREPARATION,
  DELAI_RELANCE_JOURS,
  type StatutPreparation,
} from "@/config/volets";

/**
 * Le statut de l'offre, et ce qui a le droit d'y toucher.
 *
 * Deux régimes, qui ne se mélangent jamais (D43, D44) : la préparation avance
 * toute seule quand un document est produit, l'envoi et ses suites se
 * déclarent à la main. Une offre sortie de la chaîne de préparation — envoyée,
 * en entretien, refusée, sans réponse, clôturée — n'est plus jamais touchée
 * par un traitement automatique.
 */

/** Une date au format `YYYY-MM-DD`, décalée de `jours`. */
export function dateDansNJours(jours: number, depuis?: Date): string {
  const d = depuis ? new Date(depuis) : new Date();
  d.setDate(d.getDate() + jours);
  return d.toISOString().slice(0, 10);
}

export function dateDeRelanceParDefaut(depuis?: Date): string {
  return dateDansNJours(DELAI_RELANCE_JOURS, depuis);
}

/** Nombre de jours entiers écoulés depuis une date, ou null si elle manque. */
export function joursDepuis(date: string | null | undefined): number | null {
  if (!date) return null;
  const t = new Date(date).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / 86_400_000));
}

/** Une relance est due quand sa date est atteinte. */
export function relanceDue(
  statut: string,
  relancePrevueLe: string | null | undefined
): boolean {
  if (statut !== "envoyee" || !relancePrevueLe) return false;
  return relancePrevueLe <= new Date().toISOString().slice(0, 10);
}

/** Affichage court d'une date stockée, en français. */
export function jour(date: string | null | undefined): string {
  if (!date) return "—";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * Avance le statut d'une offre le long de la chaîne de préparation.
 *
 * Ne fait rien si l'offre est déjà plus loin, ou si elle est sortie de la
 * chaîne. Le déclencheur `trg_journaliser_statut` écrit l'historique tout
 * seul ; on ne l'appelle jamais à la main.
 */
export async function avancerPreparation(
  offreId: string,
  cible: StatutPreparation
): Promise<void> {
  const supabase = creerClientServeur();

  const { data } = await supabase
    .from("offres")
    .select("statut")
    .eq("id", offreId)
    .maybeSingle();
  if (!data) return;

  const courant = (data as { statut: string }).statut;
  const rangCourant = (CHAINE_PREPARATION as readonly string[]).indexOf(courant);

  // Statut hors chaîne : l'offre est envoyée ou classée, elle ne recule pas.
  if (rangCourant === -1) return;

  const rangCible = (CHAINE_PREPARATION as readonly string[]).indexOf(cible);
  if (rangCible <= rangCourant) return;

  await supabase.from("offres").update({ statut: cible }).eq("id", offreId);
}

/**
 * Écrit un commentaire sur la dernière ligne d'historique d'une offre.
 *
 * Le déclencheur insère la ligne sans commentaire au moment de la mise à jour
 * du statut : le commentaire saisi ne peut donc être posé qu'après coup.
 */
export async function commenterDernierStatut(
  offreId: string,
  commentaire: string
): Promise<void> {
  const texte = commentaire.trim();
  if (!texte) return;

  const supabase = creerClientServeur();
  const { data } = await supabase
    .from("statuts_historique")
    .select("id")
    .eq("offre_id", offreId)
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return;

  await supabase
    .from("statuts_historique")
    .update({ commentaire: texte })
    .eq("id", (data as { id: string }).id);
}
