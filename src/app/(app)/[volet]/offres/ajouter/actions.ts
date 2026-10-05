"use server";

import { createHash } from "crypto";
import { creerClientServeur } from "@/lib/supabase/server";
import { voletDepuisSlug } from "@/config/volets";
import { extraireOffre, extractionSuffisante } from "@/lib/extraction-offre";
import { enregistrerScore } from "@/lib/analyse";
import { ErreurIA } from "@/lib/anthropic";
import { redirect } from "next/navigation";

/** Retire les balises d'une page web pour n'en garder que le texte. */
function texteDepuisHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim();
}

async function contenuDepuisUrl(url: string): Promise<string> {
  let reponse: Response;
  try {
    reponse = await fetch(url, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (compatible; JobPilot/1.0; usage personnel)",
        "accept-language": "fr-FR,fr;q=0.9",
      },
      redirect: "follow",
    });
  } catch {
    throw new Error(
      "Impossible d'atteindre cette adresse. Colle plutôt le texte de l'offre."
    );
  }

  if (!reponse.ok) {
    throw new Error(
      `Le site a refusé la lecture (erreur ${reponse.status}). ` +
        "LinkedIn, Indeed et Apec bloquent ce type d'accès : colle le texte."
    );
  }

  return texteDepuisHtml(await reponse.text());
}

async function contenuDepuisPdf(fichier: File): Promise<string> {
  try {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const buffer = new Uint8Array(await fichier.arrayBuffer());
    const doc = await getDocumentProxy(buffer);
    const { text } = await extractText(doc, { mergePages: true });
    return String(text).trim();
  } catch {
    throw new Error(
      "Lecture du PDF impossible. S'il s'agit d'un scan ou d'une image, " +
        "aucun texte n'est extractible : colle le contenu à la main."
    );
  }
}

/**
 * Empreinte du contenu, insensible aux espaces et à la casse.
 * Deux copier-coller de la même annonce donnent la même empreinte, ce qui
 * permet de refuser un doublon avant tout appel IA — donc avant tout coût.
 */
function empreinte(contenu: string): string {
  const normalise = contenu.toLowerCase().replace(/\s+/g, " ").trim();
  return createHash("sha256").update(normalise).digest("hex");
}

/** Ajoute une offre puis l'analyse immédiatement. */
export async function ajouterEtAnalyser(formData: FormData) {
  const slug = String(formData.get("volet_slug") ?? "");
  const config = voletDepuisSlug(slug);
  const sourceBrute = String(formData.get("source") ?? "texte");
  // La colonne `source` porte une contrainte CHECK en base.
  const source = ["texte", "pdf", "url"].includes(sourceBrute)
    ? sourceBrute
    : "texte";
  const url = String(formData.get("url") ?? "").trim();
  const fichier = formData.get("fichier");

  const echec = (message: string) =>
    redirect(
      `/${slug}/offres/ajouter?onglet=${source}&erreur=${encodeURIComponent(message)}`
    );

  if (!config) echec("Volet inconnu.");
  const volet = config!.code;

  let contenu = String(formData.get("contenu") ?? "").trim();

  // Les validations restent hors du try : redirect() lève une exception
  // interne à Next, qui serait sinon capturée par le catch et affichée
  // comme une erreur d'extraction.
  if (source === "url" && !url.startsWith("http")) {
    echec("Adresse invalide : elle doit commencer par http.");
  }
  if (source === "pdf" && !(fichier instanceof File && fichier.size > 0)) {
    echec("Aucun fichier reçu.");
  }

  let erreurExtraction: string | null = null;
  try {
    if (source === "url") {
      contenu = await contenuDepuisUrl(url);
    } else if (source === "pdf") {
      contenu = await contenuDepuisPdf(fichier as File);
    }
  } catch (e) {
    erreurExtraction =
      e instanceof Error ? e.message : "Extraction impossible.";
  }
  if (erreurExtraction) echec(erreurExtraction);

  if (contenu.length < 200) {
    echec(
      `Contenu insuffisant : ${contenu.length} caractères récupérés. ` +
        "Utilise l'onglet « Coller le texte » avec l'offre complète."
    );
  }

  const supabase = creerClientServeur();
  const hash = empreinte(contenu);

  // Anti-doublon : même contenu, même volet. Contrôlé avant l'appel IA.
  const { data: existante } = await supabase
    .from("offres")
    .select("id")
    .eq("hash_contenu", hash)
    .eq("volet", volet)
    .limit(1)
    .maybeSingle();

  if (existante) {
    redirect(`/offre/${(existante as { id: string }).id}?doublon=1`);
  }

  const { data: creee, error: erreurInsert } = await supabase
    .from("offres")
    .insert({
      volet,
      source,
      source_url: url || null,
      contenu_brut: contenu,
      contenu_longueur: contenu.length,
      hash_contenu: hash,
      extraction_statut: "complet",
      statut: "enregistree",
    })
    .select("id")
    .single();

  if (erreurInsert || !creee) {
    echec(
      "Enregistrement impossible : " +
        (erreurInsert?.message ?? "erreur inconnue")
    );
  }

  const offreId = (creee as { id: string }).id;

  try {
    const { donnees, modele } = await extraireOffre(contenu, offreId);

    if (!extractionSuffisante(donnees)) {
      await supabase
        .from("offres")
        .update({
          extraction_statut: "partiel",
          extraction_message:
            "Ni mission ni compétence identifiée. Le contenu était probablement incomplet.",
        })
        .eq("id", offreId);
      redirect(`/offre/${offreId}`);
    }

    await supabase
      .from("offres")
      .update({
        intitule: donnees.intitule,
        entreprise: donnees.entreprise,
        localisation: donnees.localisation,
        departement: donnees.departement,
        contrat: donnees.contrat,
        salaire_min: donnees.salaire_min,
        salaire_max: donnees.salaire_max,
        salaire_periode: donnees.salaire_periode,
        teletravail: donnees.teletravail,
        date_publication: donnees.date_publication,
        statut: "analysee",
      })
      .eq("id", offreId);

    const { data: analyse } = await supabase
      .from("offre_analyses")
      .insert({
        offre_id: offreId,
        resultat: donnees as unknown as Record<string, unknown>,
        modele,
        prompt_version: "1",
      })
      .select("id")
      .single();

    await enregistrerScore({
      offreId,
      analyseId: (analyse as { id: string } | null)?.id ?? null,
      volet,
      donnees,
    });
  } catch (e) {
    if (e instanceof ErreurIA) {
      await supabase
        .from("offres")
        .update({ extraction_statut: "echec", extraction_message: e.message })
        .eq("id", offreId);
      redirect(`/offre/${offreId}`);
    }
    throw e;
  }

  redirect(`/offre/${offreId}`);
}
