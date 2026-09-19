"use server";

import { creerClientServeur } from "@/lib/supabase/server";
import { VOLETS, type CodeVolet } from "@/config/volets";
import { enregistrerScore } from "@/lib/analyse";
import type { OffreExtraite } from "@/lib/extraction-offre";
import { ErreurCV, genererCVPourOffre } from "@/lib/cv/generer";
import {
  avancerPreparation,
  commenterDernierStatut,
  dateDeRelanceParDefaut,
  dateDansNJours,
} from "@/lib/suivi";
import { STATUTS } from "@/config/volets";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

/**
 * Supprime une offre et tout ce qui en dépend.
 *
 * Les analyses, scores, documents et historiques de statut partent en
 * cascade. La trace dans `appels_ia` est volontairement conservée : elle
 * porte le coût réellement dépensé, qui ne disparaît pas parce qu'on efface
 * l'offre. Le compteur du tableau de bord reste donc sincère.
 */
export async function supprimerOffre(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const volet = String(formData.get("volet") ?? "") as CodeVolet;
  if (!id) return;

  const supabase = creerClientServeur();
  await supabase.from("offres").delete().eq("id", id);

  const config = VOLETS[volet];
  redirect(config ? `/${config.slug}/offres` : "/");
}

/**
 * Recalcule le score à partir de l'analyse déjà stockée.
 *
 * Aucun appel IA, donc aucun coût : c'est ce qui permet de renoter les
 * offres existantes après une évolution du barème.
 */
export async function recalculerScore(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = creerClientServeur();

  const { data: offre } = await supabase
    .from("offres")
    .select("id, volet")
    .eq("id", id)
    .maybeSingle();
  if (!offre) return;

  const { data: analyse } = await supabase
    .from("offre_analyses")
    .select("id, resultat")
    .eq("offre_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Sans analyse stockée il n'y a rien à recalculer : il faudrait repasser
  // par l'IA, ce que ce bouton s'interdit.
  if (!analyse) return;

  const a = analyse as { id: string; resultat: OffreExtraite };

  await enregistrerScore({
    offreId: id,
    analyseId: a.id,
    volet: (offre as { volet: CodeVolet }).volet,
    donnees: a.resultat,
  });

  revalidatePath(`/offre/${id}`);
}

/**
 * Génère le CV de l'offre et l'enregistre comme nouvelle version.
 *
 * Aucun appel IA, donc aucun coût : régénérer autant de fois qu'on veut est
 * sans conséquence. L'offre avance à « CV généré » si elle était en deçà
 * (D43) ; une offre déjà envoyée ou classée ne bouge pas.
 */
export async function genererCV(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  try {
    await genererCVPourOffre(id);
  } catch (e) {
    // Une ErreurCV porte un message écrit pour toi. Toute autre exception est
    // un défaut technique : on en remonte le texte brut plutôt qu'un message
    // rassurant qui obligerait à ouvrir les journaux Vercel pour comprendre.
    const message =
      e instanceof ErreurCV
        ? e.message
        : `La composition du CV a échoué : ${
            e instanceof Error ? e.message : String(e)
          }`.slice(0, 400);
    redirect(`/offre/${id}?cv=erreur&message=${encodeURIComponent(message)}`);
  }

  await avancerPreparation(id, "cv_genere");

  revalidatePath(`/offre/${id}`);
  revalidatePath("/mes-cv");
  redirect(`/offre/${id}?cv=ok`);
}

/**
 * Déclare la candidature envoyée (D44).
 *
 * C'est le seul chemin vers `envoyee` : l'application n'envoie rien et ne
 * peut pas le deviner. La date est modifiable, parce qu'une candidature
 * partie hier et saisie aujourd'hui fausserait le délai de relance.
 */
export async function marquerEnvoyee(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const saisie = String(formData.get("date") ?? "").trim();
  const dateEnvoi = saisie ? new Date(saisie) : new Date();
  if (Number.isNaN(dateEnvoi.getTime())) return;

  const supabase = creerClientServeur();
  await supabase
    .from("offres")
    .update({
      statut: "envoyee",
      date_candidature: dateEnvoi.toISOString(),
      relance_prevue_le: dateDeRelanceParDefaut(dateEnvoi),
    })
    .eq("id", id);

  await commenterDernierStatut(id, String(formData.get("commentaire") ?? ""));

  revalidatePath(`/offre/${id}`);
  redirect(`/offre/${id}?suivi=envoyee`);
}

/**
 * Déclare une issue après l'envoi (D45), ou corrige un statut (D49).
 *
 * Aucun garde-fou volontairement : l'application a un seul utilisateur, et une
 * erreur de clic ne doit pas devenir définitive.
 */
export async function changerStatut(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const statut = String(formData.get("statut") ?? "");
  if (!id || !(statut in STATUTS)) return;

  const supabase = creerClientServeur();

  // Une offre qui sort de l'attente n'a plus de relance à prévoir.
  const enAttente = statut === "envoyee";
  await supabase
    .from("offres")
    .update({
      statut,
      ...(enAttente ? {} : { relance_prevue_le: null }),
    })
    .eq("id", id);

  await commenterDernierStatut(id, String(formData.get("commentaire") ?? ""));

  revalidatePath(`/offre/${id}`);
  redirect(`/offre/${id}?suivi=statut`);
}

/** Change ou efface la date de relance prévue (D46). */
export async function planifierRelance(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const saisie = String(formData.get("date") ?? "").trim();

  const supabase = creerClientServeur();
  await supabase
    .from("offres")
    .update({ relance_prevue_le: saisie || null })
    .eq("id", id);

  revalidatePath(`/offre/${id}`);
  redirect(`/offre/${id}?suivi=relance`);
}

/**
 * Enregistre une relance effectuée (D47).
 *
 * Le statut ne change pas : relancer n'est pas obtenir une réponse. La
 * prochaine relance est repoussée du même délai.
 */
export async function marquerRelancee(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = creerClientServeur();
  const { data } = await supabase
    .from("offres")
    .select("relances")
    .eq("id", id)
    .maybeSingle();
  if (!data) return;

  const aujourdhui = dateDansNJours(0);
  await supabase
    .from("offres")
    .update({
      relances: ((data as { relances: number | null }).relances ?? 0) + 1,
      derniere_relance_le: aujourdhui,
      relance_prevue_le: dateDeRelanceParDefaut(),
    })
    .eq("id", id);

  revalidatePath(`/offre/${id}`);
  revalidatePath("/");
  redirect(`/offre/${id}?suivi=relancee`);
}
