"use server";

import { creerClientServeur } from "@/lib/supabase/server";
import { enregistrerScore } from "@/lib/analyse";
import type { OffreExtraite } from "@/lib/extraction-offre";
import type { CodeVolet } from "@/config/volets";
import { importerAdditif } from "@/lib/sauvegarde";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

/**
 * Édition des paramètres et recalcul des scores.
 *
 * Le barème vivait en base mais ne se modifiait qu'en SQL, et
 * `version_bareme` se mettait à jour à la main — ou pas. Des scores calculés
 * sur deux barèmes différents cohabitaient alors sans que rien ne le dise.
 * Ici, toute modification du barème incrémente sa version, et le recalcul est
 * à un clic.
 */

function retour(etat: string): never {
  revalidatePath("/parametres");
  redirect(`/parametres?etat=${etat}`);
}

/** Enregistre la valeur JSON d'un paramètre, après vérification de sa syntaxe. */
export async function modifierParametre(formData: FormData) {
  const cle = String(formData.get("cle") ?? "").trim();
  const brut = String(formData.get("valeur") ?? "").trim();
  if (!cle || !brut) return;

  let valeur: unknown;
  try {
    valeur = JSON.parse(brut);
  } catch {
    retour("json");
  }

  // Le barème porte son propre numéro de version : le laisser inchangé après
  // une retouche rendrait incomparables des scores calculés différemment.
  if (cle === "bareme" && valeur && typeof valeur === "object") {
    const v = valeur as Record<string, unknown>;
    const { data: avant } = await creerClientServeur()
      .from("parametres")
      .select("valeur")
      .eq("cle", "bareme")
      .maybeSingle();

    const ancienne = (avant as { valeur?: Record<string, unknown> } | null)?.valeur;
    const memeContenu =
      ancienne &&
      JSON.stringify({ ...ancienne, version: null }) ===
        JSON.stringify({ ...v, version: null });

    if (!memeContenu) {
      const n = Number(String(ancienne?.version ?? "0"));
      v.version = String((Number.isFinite(n) ? n : 0) + 1);
    }
  }

  const supabase = creerClientServeur();
  const { error } = await supabase
    .from("parametres")
    .update({ valeur, updated_at: new Date().toISOString() })
    .eq("cle", cle);

  retour(error ? "erreur" : "enregistre");
}

/**
 * Renote toutes les offres à partir de leur analyse déjà stockée.
 *
 * Aucun appel IA, donc aucun coût : c'est ce qui rend une évolution du barème
 * rattrapable. Une offre sans analyse est laissée telle quelle plutôt que de
 * repasser par le modèle.
 */
export async function recalculerTousLesScores() {
  const supabase = creerClientServeur();

  const { data: offres } = await supabase.from("offres").select("id, volet");

  let recalcules = 0;
  for (const o of (offres ?? []) as { id: string; volet: CodeVolet }[]) {
    const { data: analyse } = await supabase
      .from("offre_analyses")
      .select("id, resultat")
      .eq("offre_id", o.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!analyse) continue;

    const a = analyse as { id: string; resultat: OffreExtraite };
    await enregistrerScore({
      offreId: o.id,
      analyseId: a.id,
      volet: o.volet,
      donnees: a.resultat,
    });
    recalcules += 1;
  }

  revalidatePath("/");
  retour(`recalcul-${recalcules}`);
}

/**
 * Réinjecte une sauvegarde, sans rien écraser.
 *
 * Le détail de ce qui a été ajouté revient dans l'URL : c'est la seule chose
 * qu'on veut lire après un import, et cela évite d'inventer une table
 * d'historique pour une opération qu'on fera trois fois dans la vie de
 * l'application.
 */
export async function importerSauvegarde(formData: FormData) {
  const contenu = String(formData.get("contenu") ?? "").trim();
  if (!contenu) return;

  let donnees: unknown;
  try {
    donnees = JSON.parse(contenu);
  } catch {
    retour("import-json");
  }

  // `retour` redirige, et une redirection Next passe par une exception : elle
  // doit rester hors du `try`, sinon le `catch` l'attrape et la transforme en
  // message d'erreur.
  let total = 0;
  try {
    total = (await importerAdditif(donnees)).total;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    redirect(
      `/parametres?etat=import-erreur&message=${encodeURIComponent(
        message.slice(0, 200)
      )}`
    );
  }

  revalidatePath("/");
  retour(`import-${total}`);
}
