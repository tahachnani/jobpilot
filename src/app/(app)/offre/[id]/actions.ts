"use server";

import { creerClientServeur } from "@/lib/supabase/server";
import { VOLETS, type CodeVolet } from "@/config/volets";
import { enregistrerScore } from "@/lib/analyse";
import type { OffreExtraite } from "@/lib/extraction-offre";
import { ErreurCV, genererCVPourOffre } from "@/lib/cv/generer";
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
 * sans conséquence. Le statut de l'offre n'est pas touché — le passage à
 * « CV généré » relève de l'étape 6, au même titre que « Marquer comme
 * envoyée ».
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

  revalidatePath(`/offre/${id}`);
  revalidatePath("/mes-cv");
  redirect(`/offre/${id}?cv=ok`);
}
