"use server";

import { proposerMissionsPourOffre } from "@/lib/cv/propositions";
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

  // « retirer » vaut pour une formulation déjà validée : elle sort du CV et la
  // formulation d'origine reprend sa place. Sans ce bouton, une reformulation
  // acceptée à tort ne pouvait plus être défaite depuis l'application.
  if (action === "refuser" || action === "retirer") {
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
  // Niveau 1 par défaut (D67) : une compétence lue dans une annonce entre
  // comme des notions, à toi de la monter si tu la tiens vraiment. À 2 par
  // défaut, le profil se notait lui-même au fil des offres analysées.
  const niveau = Number(formData.get("niveau") ?? 1);
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
  revalidatePath(`/offre/${offreId}`);
  revalidatePath("/profil");

  // On revient là où le clic a eu lieu. Ce bloc vit sur deux écrans depuis
  // qu'il a quitté la page de reformulation : répondre depuis la fiche d'offre
  // et se retrouver ailleurs donne l'impression d'avoir déclenché autre chose.
  const retour = String(formData.get("retour") ?? "");
  redirect(
    retour === "offre"
      ? `/offre/${offreId}?competence=ok`
      : `/offre/${offreId}/formulations?etat=competence`
  );
}

/** Demande au modèle des missions nouvelles tirées du corpus. */
export async function proposerMissions(formData: FormData) {
  const offreId = String(formData.get("offreId") ?? "");
  if (!offreId) return;

  let resume = "";
  try {
    const r = await proposerMissionsPourOffre(offreId);
    resume =
      r.proposees === 0
        ? `Aucune mission nouvelle à proposer : le corpus ne dit rien que tes missions actuelles ne disent déjà. ${r.rejetees} écartée${r.rejetees > 1 ? "s" : ""} par le contrôle. Coût : ${r.coutUsd.toFixed(4)} $.`
        : `${r.proposees} mission${r.proposees > 1 ? "s" : ""} proposée${r.proposees > 1 ? "s" : ""}, ${r.rejetees} écartée${r.rejetees > 1 ? "s" : ""} par le contrôle. Coût : ${r.coutUsd.toFixed(4)} $.`;
  } catch (e) {
    const message =
      e instanceof ErreurCV || e instanceof ErreurIA
        ? e.message
        : `La proposition a échoué : ${e instanceof Error ? e.message : String(e)}`;
    redirect(
      `/offre/${offreId}/formulations?etat=erreur&message=${encodeURIComponent(
        message.slice(0, 300)
      )}`
    );
  }

  revalidatePath(`/offre/${offreId}/formulations`);
  redirect(
    `/offre/${offreId}/formulations?etat=ok&message=${encodeURIComponent(resume)}`
  );
}

/**
 * Accepte ou refuse une mission proposée.
 *
 * Acceptée, elle devient active et sa formulation devient générique : elle
 * servira à toutes les offres du volet, pas seulement à celle-ci. Refusée,
 * elle est supprimée — la formulation part avec elle par cascade.
 */
export async function deciderMission(formData: FormData) {
  const offreId = String(formData.get("offreId") ?? "");
  const missionId = String(formData.get("missionId") ?? "");
  const formulationId = String(formData.get("formulationId") ?? "");
  const action = String(formData.get("action") ?? "");
  if (!offreId || !missionId) return;

  const supabase = creerClientServeur();

  if (action === "accepter") {
    // Le texte corrigé à la main fait foi : c'est Taha qui signe la ligne.
    const texte = String(formData.get("texte") ?? "").trim();

    await supabase
      .from("missions")
      .update({ actif: true, ...(texte ? { texte_source: texte } : {}) })
      .eq("id", missionId);

    await supabase
      .from("mission_formulations")
      .update({
        validee: true,
        offre_id: null,
        ...(texte ? { texte } : {}),
      })
      .eq("id", formulationId);
  } else {
    await supabase.from("missions").delete().eq("id", missionId);
  }

  revalidatePath(`/offre/${offreId}/formulations`);
  revalidatePath(`/offre/${offreId}`);
  revalidatePath("/profil");
  redirect(`/offre/${offreId}/formulations?etat=mission`);
}
