"use server";

import { creerClientServeur } from "@/lib/supabase/server";
import {
  chargerTaxonomie,
  codeRecevable,
  incrementerVersionBareme,
  normaliserCode,
  usagesDuCode,
} from "@/lib/taxonomie";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

/**
 * L'édition de la taxonomie (D74).
 *
 * Chaque écriture incrémente la version du barème : les scores d'avant et
 * d'après ne sont plus comparables, et l'écran le dit au lieu de laisser
 * cohabiter deux mesures sous le même nom.
 */

const FAMILLES = ["cdg", "compta", "transverse"];

function retour(etat: string, detail?: string): never {
  revalidatePath("/taxonomie");
  revalidatePath("/profil");
  redirect(
    `/taxonomie?etat=${etat}${
      detail ? `&detail=${encodeURIComponent(detail)}` : ""
    }`
  );
}

/**
 * Ajoute un code à la taxonomie.
 *
 * Le code est dérivé du libellé quand il n'est pas saisi : « Amélioration
 * continue » donne `amelioration_continue`. C'est un identifiant, pas un
 * texte — il vit dans des tableaux en base, et il ne se renomme jamais.
 */
export async function ajouterActivite(formData: FormData) {
  const libelle = String(formData.get("libelle") ?? "").trim();
  const famille = String(formData.get("famille") ?? "").trim();
  const saisi = String(formData.get("code") ?? "").trim();

  if (!libelle) retour("libelle");
  if (!FAMILLES.includes(famille)) retour("famille");

  const code = normaliserCode(saisi || libelle);
  if (!codeRecevable(code)) retour("code", code);

  const taxonomie = await chargerTaxonomie();
  if (code in taxonomie) retour("existe", code);

  const supabase = creerClientServeur();

  // Placé en fin de sa famille : l'ordre n'est qu'un confort d'affichage.
  const { data: dernier } = await supabase
    .from("activites")
    .select("ordre")
    .order("ordre", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("activites").insert({
    code,
    libelle,
    famille,
    socle: false,
    actif: true,
    ordre: ((dernier as { ordre: number } | null)?.ordre ?? 0) + 1,
  });

  if (error) retour("erreur", error.message);

  const version = await incrementerVersionBareme();
  retour("ajoute", `${code}|${version ?? ""}`);
}

/**
 * Corrige un code : son libellé, sa famille, son ordre, son service.
 *
 * Le code lui-même ne change pas. Il est stocké tel quel dans les missions,
 * les entrées de corpus et les analyses d'offres déjà payées : le renommer
 * rendrait ces lignes muettes sans prévenir. Pour changer de code, il faut en
 * créer un autre et réaffecter — ce qui est visible, donc réparable.
 */
export async function modifierActivite(formData: FormData) {
  const code = String(formData.get("code") ?? "").trim();
  const libelle = String(formData.get("libelle") ?? "").trim();
  const famille = String(formData.get("famille") ?? "").trim();
  const actif = formData.get("actif") === "1";
  const ordre = Number(formData.get("ordre") ?? 0);

  if (!code) return;
  if (!libelle) retour("libelle");
  if (!FAMILLES.includes(famille)) retour("famille");

  const supabase = creerClientServeur();
  const { error } = await supabase
    .from("activites")
    .update({
      libelle,
      famille,
      actif,
      ordre: Number.isFinite(ordre) ? ordre : 0,
    })
    .eq("code", code);

  if (error) retour("erreur", error.message);

  const version = await incrementerVersionBareme();
  retour("modifie", `${code}|${version ?? ""}`);
}

/**
 * Supprime un code, s'il ne sert à rien.
 *
 * Le garde-fou n'est pas un excès de prudence : un code supprimé alors qu'une
 * mission le porte rendrait cette mission inclassable au recalcul suivant, et
 * elle sortirait du score sans que rien ne l'annonce. Le message dit combien
 * de lignes le portent, pour que la décision se prenne en connaissance de
 * cause — désactiver reste possible, et n'efface rien.
 */
export async function supprimerActivite(formData: FormData) {
  const code = String(formData.get("code") ?? "").trim();
  if (!code) return;

  const usages = await usagesDuCode(code);
  if (usages.missions + usages.corpus > 0) {
    retour("utilise", `${code}|${usages.missions}|${usages.corpus}`);
  }

  const supabase = creerClientServeur();
  const { error } = await supabase.from("activites").delete().eq("code", code);
  if (error) retour("erreur", error.message);

  const version = await incrementerVersionBareme();
  retour("supprime", `${code}|${version ?? ""}`);
}
