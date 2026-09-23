"use server";

import { chargerTaxonomie } from "@/lib/taxonomie";
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
 * Les codes d'activité saisis à la main, triés sur la taxonomie vivante.
 *
 * Le scoring et la sélection comparent des codes, pas des libellés : un code
 * hors liste rend l'entrée muette pour le moteur. Les missions proposées ont
 * déjà payé cette leçon — trois d'entre elles portaient « analyse financière »
 * au lieu de `analyse_financiere` et n'atteignaient aucun CV.
 *
 * Ce qui change ici (D75) : un code refusé est **rendu à l'appelant**, qui le
 * dit. L'ancienne version le laissait tomber en silence. Le 23 septembre, une
 * entrée de corpus portant « amélioration continue » a donc été enregistrée
 * avec zéro code, sans un mot — et le sujet est resté à zéro dans les missions
 * pendant qu'on cherchait la panne ailleurs. Un filtre muet transforme une
 * saisie en perte de données.
 *
 * Un code retiré du service reste recevable : il décrit un travail réel, et le
 * champ est prérempli avec l'existant — un simple réenregistrement ne doit pas
 * l'effacer.
 */
async function trierCodes(
  brut: string
): Promise<{ codes: string[]; refuses: string[] }> {
  const taxonomie = await chargerTaxonomie();

  const saisis = [
    ...new Set(
      brut
        .split(/[,\s]+/)
        .map((c) => c.trim().toLowerCase())
        .filter(Boolean)
    ),
  ];

  return {
    codes: saisis.filter((c) => c in taxonomie),
    refuses: saisis.filter((c) => !(c in taxonomie)),
  };
}

/** Le retour d'écran après une écriture de corpus : muet si tout est passé. */
function retourCorpus(volet: string, refuses: string[]): never {
  revalidatePath("/profil");
  redirect(
    refuses.length > 0
      ? `/profil?volet=${volet}&refuses=${encodeURIComponent(
          refuses.join(",")
        )}`
      : `/profil?volet=${volet}`
  );
}

/**
 * Change les codes d'activité d'une mission du parcours (D74).
 *
 * Ce sont les seuls codes que le score compare à ceux d'une offre. Ils étaient
 * en lecture seule depuis l'étape 1 : la taxonomie avait beau s'enrichir, un
 * nouveau code ne pouvait être affecté à rien, et le sujet restait à zéro.
 *
 * Le texte de la mission n'est pas touché ici : on classe, on ne réécrit pas.
 * Après modification, les scores existants ne reflètent plus le parcours —
 * l'écran invite donc à renoter depuis Paramètres, ce qui ne coûte rien.
 */
export async function modifierCodesMission(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const volet = String(formData.get("volet") ?? "cdg");
  if (!id) return;

  const { codes, refuses } = await trierCodes(
    String(formData.get("codes") ?? "")
  );

  const supabase = creerClientServeur();
  await supabase.from("missions").update({ activites_codes: codes }).eq("id", id);

  revalidatePath("/profil");
  redirect(
    refuses.length > 0
      ? `/profil?volet=${volet}&refuses=${encodeURIComponent(refuses.join(","))}`
      : `/profil?volet=${volet}&codes=ok`
  );
}

/** Corrige une entrée de corpus : son texte et ses codes d'activité. */
export async function modifierEntreeCorpus(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const volet = String(formData.get("volet") ?? "cdg");
  const texte = String(formData.get("texte") ?? "").trim();
  if (!id || !texte) return;

  const { codes, refuses } = await trierCodes(
    String(formData.get("codes") ?? "")
  );

  const supabase = creerClientServeur();
  await supabase
    .from("corpus_experience")
    .update({ texte, activites_codes: codes })
    .eq("id", id);

  retourCorpus(volet, refuses);
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

  const { codes, refuses } = await trierCodes(
    String(formData.get("codes") ?? "")
  );

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
    activites_codes: codes,
    source: "saisie_manuelle",
    ordre: ((derniere as { ordre: number } | null)?.ordre ?? 0) + 1,
  });

  retourCorpus(volet, refuses);
}

/**
 * Supprime définitivement des compétences, par lot.
 *
 * Constat du 21 septembre : 93 des 146 lignes venaient d'annonces, acceptées
 * au niveau 2 par défaut, dont trente-neuf purement comportementales et une
 * dizaine de doublons — ERP, ERP Sage, Progiciels de gestion, Outils
 * informatiques, Pack Office. Le sous-score compétences se nourrissait de
 * lignes jamais revendiquées, et plus aucune offre ne signalait de manque.
 *
 * La suppression est irréversible, mais sans conséquence sur les CV déjà
 * générés : ils portent leur propre modèle figé.
 */
export async function supprimerCompetences(formData: FormData) {
  const ids = formData
    .getAll("competence")
    .map((v) => String(v))
    .filter(Boolean);
  const volet = String(formData.get("volet") ?? "cdg");
  if (ids.length === 0) redirect(`/profil?volet=${volet}&menage=aucune`);

  const supabase = creerClientServeur();
  await supabase.from("competences").delete().in("id", ids);

  revalidatePath("/profil");
  redirect(`/profil?volet=${volet}&menage=${ids.length}`);
}

/** Change le niveau d'une compétence sans passer par le formulaire complet. */
export async function reniveler(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const volet = String(formData.get("volet") ?? "cdg");
  const niveau = Number(formData.get("niveau") ?? 1);
  if (!id) return;

  const supabase = creerClientServeur();
  await supabase
    .from("competences")
    .update({ niveau: Math.min(3, Math.max(0, niveau)) })
    .eq("id", id);

  revalidatePath("/profil");
  redirect(`/profil?volet=${volet}&menage=niveau`);
}
