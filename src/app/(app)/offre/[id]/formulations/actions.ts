"use server";

import { creerClientServeur } from "@/lib/supabase/server";
import { ErreurCV } from "@/lib/cv/generer";
import { ErreurIA } from "@/lib/anthropic";
import { reformulerPourOffre } from "@/lib/cv/reformulation";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function retour(offreId: string, cle: string, message?: string) {
  const suffixe = message ? `&message=${encodeURIComponent(message.slice(0, 300))}` : "";
  redirect(`/offre/${offreId}/formulations?etat=${cle}${suffixe}`);
}

/** Demande au modèle d'adapter les missions retenues au vocabulaire de l'offre. */
export async function lancerReformulation(formData: FormData) {
  const offreId = String(formData.get("offreId") ?? "");
  if (!offreId) return;

  let resume = "";
  try {
    const r = await reformulerPourOffre(offreId);
    resume =
      `${r.proposees} proposition${r.proposees > 1 ? "s" : ""} à relire, ` +
      `${r.rejetees} écartée${r.rejetees > 1 ? "s" : ""} par le contrôle, ` +
      `${r.ignorees} déjà validée${r.ignorees > 1 ? "s" : ""}. ` +
      `Coût : ${r.coutUsd.toFixed(4)} $.`;
  } catch (e) {
    const message =
      e instanceof ErreurCV || e instanceof ErreurIA
        ? e.message
        : `La reformulation a échoué : ${e instanceof Error ? e.message : String(e)}`;
    retour(offreId, "erreur", message);
  }

  revalidatePath(`/offre/${offreId}/formulations`);
  retour(offreId, "ok", resume);
}

/**
 * Accepte, refuse ou corrige une proposition.
 *
 * Refuser supprime la ligne : la formulation d'origine reprend sa place, et
 * rien ne traîne en base. Corriger vaut acceptation du texte corrigé.
 */
export async function deciderFormulation(formData: FormData) {
  const offreId = String(formData.get("offreId") ?? "");
  const id = String(formData.get("id") ?? "");
  const action = String(formData.get("action") ?? "");
  if (!offreId || !id) return;

  const supabase = creerClientServeur();

  if (action === "refuser") {
    await supabase.from("mission_formulations").delete().eq("id", id);
  } else if (action === "accepter") {
    await supabase
      .from("mission_formulations")
      .update({ validee: true })
      .eq("id", id);
  } else if (action === "corriger") {
    const texte = String(formData.get("texte") ?? "").trim();
    if (texte) {
      await supabase
        .from("mission_formulations")
        .update({ texte, validee: true })
        .eq("id", id);
    }
  }

  revalidatePath(`/offre/${offreId}/formulations`);
  revalidatePath(`/offre/${offreId}`);
  redirect(`/offre/${offreId}/formulations`);
}

/**
 * Adopte une formulation adaptée comme référence du volet (D24).
 *
 * L'ancienne générique n'est pas supprimée : son drapeau `validee` retombe à
 * faux. Elle reste consultable et réactivable — rien n'est jamais perdu.
 */
export async function adopterCommeReference(formData: FormData) {
  const offreId = String(formData.get("offreId") ?? "");
  const id = String(formData.get("id") ?? "");
  if (!offreId || !id) return;

  const supabase = creerClientServeur();

  const { data } = await supabase
    .from("mission_formulations")
    .select("mission_id, volet, texte, validee")
    .eq("id", id)
    .maybeSingle();

  const source = data as {
    mission_id: string;
    volet: string;
    texte: string;
    validee: boolean;
  } | null;

  if (!source || !source.validee) {
    // On n'adopte que ce qui a déjà été validé pour l'offre.
    redirect(`/offre/${offreId}/formulations`);
  }

  await supabase
    .from("mission_formulations")
    .update({ validee: false })
    .eq("mission_id", source!.mission_id)
    .eq("volet", source!.volet)
    .is("offre_id", null);

  await supabase.from("mission_formulations").insert({
    mission_id: source!.mission_id,
    volet: source!.volet,
    offre_id: null,
    texte: source!.texte,
    origine: "ia_reformulee",
    validee: true,
  });

  revalidatePath(`/offre/${offreId}/formulations`);
  revalidatePath("/profil");
  redirect(`/offre/${offreId}/formulations?etat=adoptee`);
}

/**
 * Réponse à une compétence réclamée par l'offre et absente de la base.
 *
 * « Je la maîtrise » l'ajoute au profil avec le niveau choisi : elle servira
 * dès lors à toutes les offres, pas seulement à celle-ci. « Je ne la maîtrise
 * pas » l'enregistre au niveau zéro et invisible — elle ne paraîtra sur aucun
 * CV et ne sera plus reproposée.
 *
 * Dans les deux cas c'est Taha qui répond. L'offre ne décide jamais de ce
 * qu'il sait faire.
 */
export async function repondreCompetence(formData: FormData) {
  const offreId = String(formData.get("offreId") ?? "");
  const libelle = String(formData.get("libelle") ?? "").trim();
  const action = String(formData.get("action") ?? "");
  const categorie = String(formData.get("categorie") ?? "transversale");
  const niveau = Number(formData.get("niveau") ?? 2);
  if (!offreId || !libelle) return;

  const supabase = creerClientServeur();

  const { data: offre } = await supabase
    .from("offres")
    .select("volet")
    .eq("id", offreId)
    .maybeSingle();
  const volet = (offre as { volet: string } | null)?.volet ?? "cdg";

  const maitrisee = action === "maitrisee";

  const codeNormalise = libelle
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);

  await supabase.from("competences").insert({
    libelle,
    code_normalise: codeNormalise,
    categorie,
    niveau: maitrisee ? Math.min(3, Math.max(1, niveau)) : 0,
    // Une compétence non maîtrisée reste en base uniquement pour ne plus être
    // reproposée. Invisible dans les deux volets, elle n'atteint aucun CV.
    visible_cdg: maitrisee && volet === "cdg",
    visible_compta: maitrisee && volet === "compta",
    ordre: 900,
    origine: "offre",
  });

  revalidatePath(`/offre/${offreId}/formulations`);
  revalidatePath("/profil");
  redirect(`/offre/${offreId}/formulations?etat=competence`);
}
