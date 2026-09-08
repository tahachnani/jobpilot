"use server";

import { creerClientServeur } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

const TABLES_VISIBILITE = ["experiences", "competences", "formations"] as const;
const TABLES_ORDRE = [
  "experiences",
  "competences",
  "formations",
  "missions",
] as const;

type TableVisibilite = (typeof TABLES_VISIBILITE)[number];
type TableOrdre = (typeof TABLES_ORDRE)[number];

function rafraichir() {
  revalidatePath("/profil");
}

/**
 * Modifie le texte d'une formulation.
 * `texte_source` n'est jamais touché : il reste la référence de vérité du
 * vérificateur d'invention.
 */
export async function modifierFormulation(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const texte = String(formData.get("texte") ?? "").trim();
  if (!id || texte.length === 0) return;

  const supabase = creerClientServeur();
  await supabase
    .from("mission_formulations")
    .update({ texte, origine: "cv_original", validee: true })
    .eq("id", id);

  rafraichir();
}

/** Modifie le texte d'une accroche de volet. */
export async function modifierAccroche(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const texte = String(formData.get("texte") ?? "").trim();
  if (!id || texte.length === 0) return;

  const supabase = creerClientServeur();
  await supabase.from("accroches").update({ texte, validee: true }).eq("id", id);

  rafraichir();
}

/** Bascule la visibilité d'une ligne pour un volet donné. */
export async function basculerVisibilite(formData: FormData) {
  const table = String(formData.get("table") ?? "") as TableVisibilite;
  const id = String(formData.get("id") ?? "");
  const volet = String(formData.get("volet") ?? "");

  if (!TABLES_VISIBILITE.includes(table)) return;
  if (volet !== "cdg" && volet !== "compta") return;
  if (!id) return;

  const champ = volet === "cdg" ? "visible_cdg" : "visible_compta";
  const supabase = creerClientServeur();

  const { data } = await supabase
    .from(table)
    .select(`id, ${champ}`)
    .eq("id", id)
    .maybeSingle();
  if (!data) return;

  await supabase
    .from(table)
    .update({ [champ]: !(data as Record<string, unknown>)[champ] })
    .eq("id", id);

  rafraichir();
}

/**
 * Déplace une ligne d'un cran, en échangeant son `ordre` avec son voisin.
 * Les missions sont ordonnées à l'intérieur de leur expérience.
 */
export async function deplacer(formData: FormData) {
  const table = String(formData.get("table") ?? "") as TableOrdre;
  const id = String(formData.get("id") ?? "");
  const sens = String(formData.get("sens") ?? "");

  if (!TABLES_ORDRE.includes(table)) return;
  if (sens !== "haut" && sens !== "bas") return;
  if (!id) return;

  const supabase = creerClientServeur();
  const colonnes = table === "missions" ? "id, ordre, experience_id" : "id, ordre";

  const { data: courant } = await supabase
    .from(table)
    .select(colonnes)
    .eq("id", id)
    .maybeSingle();
  if (!courant) return;

  const c = courant as unknown as {
    id: string;
    ordre: number;
    experience_id?: string;
  };

  const requeteBase = supabase.from(table).select(colonnes);
  const requeteFiltree =
    table === "missions" && c.experience_id
      ? requeteBase.eq("experience_id", c.experience_id)
      : requeteBase;

  const { data: voisins } =
    sens === "haut"
      ? await requeteFiltree
          .lt("ordre", c.ordre)
          .order("ordre", { ascending: false })
          .limit(1)
      : await requeteFiltree
          .gt("ordre", c.ordre)
          .order("ordre", { ascending: true })
          .limit(1);
  const voisin = (voisins ?? [])[0] as unknown as
    | { id: string; ordre: number }
    | undefined;
  if (!voisin) return;

  await supabase.from(table).update({ ordre: voisin.ordre }).eq("id", c.id);
  await supabase.from(table).update({ ordre: c.ordre }).eq("id", voisin.id);

  rafraichir();
}
