"use server";

import { ErreurCV } from "@/lib/cv/generer";
import { ErreurIA } from "@/lib/anthropic";
import {
  enregistrerLettreCorrigee,
  genererLettrePourOffre,
  regenererEmailPourOffre,
} from "@/lib/lettre/generer";
import { creerClientServeur } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

/** Rédige la lettre et l'email en un seul appel. */
export async function genererLettre(formData: FormData) {
  const offreId = String(formData.get("offreId") ?? "");
  if (!offreId) return;

  let resume = "";
  try {
    const r = await genererLettrePourOffre(offreId);
    const orphelins =
      r.ancrage.nombresOrphelins.length + r.ancrage.nomsOrphelins.length;
    resume =
      `Version ${r.version} rédigée. ` +
      (orphelins > 0
        ? `${orphelins} élément${orphelins > 1 ? "s" : ""} sans appui dans ta base, à vérifier ci-dessous. `
        : "Chaque fait avancé est adossé à ta base ou à l'annonce. ") +
      `Coût : ${r.coutUsd.toFixed(4)} $.`;
  } catch (e) {
    const message =
      e instanceof ErreurCV || e instanceof ErreurIA
        ? e.message
        : `La rédaction a échoué : ${e instanceof Error ? e.message : String(e)}`;
    redirect(
      `/offre/${offreId}/lettre?etat=erreur&message=${encodeURIComponent(
        message.slice(0, 300)
      )}`
    );
  }

  revalidatePath(`/offre/${offreId}/lettre`);
  redirect(
    `/offre/${offreId}/lettre?etat=ok&message=${encodeURIComponent(resume)}`
  );
}

/** Enregistre la lettre corrigée à la main et recompose le PDF. */
export async function corrigerLettre(formData: FormData) {
  const offreId = String(formData.get("offreId") ?? "");
  const documentId = String(formData.get("documentId") ?? "");
  const corps = String(formData.get("corps") ?? "");
  if (!offreId || !documentId) return;

  // Un paragraphe par bloc de texte séparé par un retour à la ligne.
  const paragraphes = corps
    .split(/\n\s*\n|\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  await enregistrerLettreCorrigee(documentId, paragraphes);

  revalidatePath(`/offre/${offreId}/lettre`);
  redirect(`/offre/${offreId}/lettre?etat=corrigee`);
}

/** Enregistre le destinataire et l'adresse, quand ils sont connus. */
export async function enregistrerContact(formData: FormData) {
  const offreId = String(formData.get("offreId") ?? "");
  if (!offreId) return;

  const supabase = creerClientServeur();
  await supabase
    .from("offres")
    .update({
      contact_nom: String(formData.get("contactNom") ?? "").trim() || null,
      contact_adresse: String(formData.get("contactAdresse") ?? "").trim() || null,
      entreprise: String(formData.get("entreprise") ?? "").trim() || null,
    })
    .eq("id", offreId);

  revalidatePath(`/offre/${offreId}/lettre`);
  redirect(`/offre/${offreId}/lettre?etat=contact`);
}

/** Réécrit le seul email, la lettre restant en l'état. */
export async function regenererEmail(formData: FormData) {
  const offreId = String(formData.get("offreId") ?? "");
  if (!offreId) return;

  try {
    await regenererEmailPourOffre(offreId);
  } catch (e) {
    const message =
      e instanceof ErreurCV || e instanceof ErreurIA
        ? e.message
        : `La rédaction de l'email a échoué : ${e instanceof Error ? e.message : String(e)}`;
    redirect(
      `/offre/${offreId}/lettre?etat=erreur&message=${encodeURIComponent(
        message.slice(0, 300)
      )}`
    );
  }

  revalidatePath(`/offre/${offreId}/lettre`);
  redirect(`/offre/${offreId}/lettre?etat=email`);
}
