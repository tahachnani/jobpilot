"use server";

import { ACTIVITES } from "@/config/activites";
import { creerClientServeur } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

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

/**
 * Corrige une compétence : libellé, catégorie, niveau, précision.
 *
 * L'application en ajoute désormais depuis les offres, avec des libellés
 * repris d'annonces et une catégorie devinée. Sans moyen de les corriger, une
 * erreur de saisie devenait définitive et remontait sur tous les CV.
 */
export async function modifierCompetence(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const volet = String(formData.get("volet") ?? "cdg");
  if (!id) return;

  const libelle = String(formData.get("libelle") ?? "").trim();
  const precision = String(formData.get("precision") ?? "").trim();
  const categorie = String(formData.get("categorie") ?? "").trim();
  const niveau = Number(formData.get("niveau") ?? 0);

  const supabase = creerClientServeur();
  await supabase
    .from("competences")
    .update({
      ...(libelle ? { libelle } : {}),
      precision: precision || null,
      ...(categorie ? { categorie } : {}),
      niveau: Math.min(3, Math.max(0, niveau)),
    })
    .eq("id", id);

  revalidatePath("/profil");
  redirect(`/profil?volet=${volet}`);
}

/**
 * Remet une compétence écartée dans le volet.
 *
 * Une compétence refusée depuis une offre était enregistrée au niveau zéro et
 * invisible : elle n'apparaissait plus nulle part, et un refus par erreur ne
 * pouvait plus être défait.
 */
export async function retablirCompetence(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const volet = String(formData.get("volet") ?? "cdg");
  const niveau = Number(formData.get("niveau") ?? 2);
  if (!id) return;

  const champ = volet === "cdg" ? "visible_cdg" : "visible_compta";
  const supabase = creerClientServeur();
  await supabase
    .from("competences")
    .update({ [champ]: true, niveau: Math.min(3, Math.max(1, niveau)) })
    .eq("id", id);

  revalidatePath("/profil");
  redirect(`/profil?volet=${volet}`);
}

/**
 * Les codes d'activité saisis à la main, filtrés sur la taxonomie fermée.
 *
 * Le scoring et la sélection comparent des codes, pas des libellés : un code
 * hors liste rend l'entrée muette pour le moteur. Les missions proposées ont
 * déjà payé cette leçon — trois d'entre elles portaient « analyse financière »
 * au lieu de `analyse_financiere` et n'atteignaient aucun CV.
 */
function codesValides(brut: string): string[] {
  return [
    ...new Set(
      brut
        .split(/[,\s]+/)
        .map((c) => c.trim().toLowerCase())
        .filter((c) => c in ACTIVITES)
    ),
  ];
}

/** Corrige une entrée de corpus : son texte et ses codes d'activité. */
export async function modifierEntreeCorpus(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const volet = String(formData.get("volet") ?? "cdg");
  const texte = String(formData.get("texte") ?? "").trim();
  if (!id || !texte) return;

  const supabase = creerClientServeur();
  await supabase
    .from("corpus_experience")
    .update({
      texte,
      activites_codes: codesValides(String(formData.get("codes") ?? "")),
    })
    .eq("id", id);

  revalidatePath("/profil");
  redirect(`/profil?volet=${volet}`);
}

/**
 * Supprime une entrée de corpus.
 *
 * Sans conséquence sur les CV déjà générés : ils stockent leur propre modèle.
 * Le corpus ne sert qu'à autoriser un terme en reformulation et à mesurer ce
 * qui est récupérable.
 */
export async function supprimerEntreeCorpus(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const volet = String(formData.get("volet") ?? "cdg");
  if (!id) return;

  const supabase = creerClientServeur();
  await supabase.from("corpus_experience").delete().eq("id", id);

  revalidatePath("/profil");
  redirect(`/profil?volet=${volet}`);
}

/** Ajoute une entrée de corpus à une expérience. */
export async function ajouterEntreeCorpus(formData: FormData) {
  const experienceId = String(formData.get("experienceId") ?? "");
  const volet = String(formData.get("volet") ?? "cdg");
  const texte = String(formData.get("texte") ?? "").trim();
  if (!experienceId || !texte) return;

  const supabase = creerClientServeur();

  const { data: derniere } = await supabase
    .from("corpus_experience")
    .select("ordre")
    .eq("experience_id", experienceId)
    .order("ordre", { ascending: false })
    .limit(1)
    .maybeSingle();

  await supabase.from("corpus_experience").insert({
    experience_id: experienceId,
    texte,
    activites_codes: codesValides(String(formData.get("codes") ?? "")),
    source: "saisie_manuelle",
    ordre: ((derniere as { ordre: number } | null)?.ordre ?? 0) + 1,
  });

  revalidatePath("/profil");
  redirect(`/profil?volet=${volet}`);
}
