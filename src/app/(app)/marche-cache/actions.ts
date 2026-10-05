"use server";

import { creerClientServeur } from "@/lib/supabase/server";
import { SECTEURS } from "@/config/secteurs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

/**
 * Les entreprises visées sans qu'elles publient d'annonce (D69).
 *
 * Aucune donnée n'est collectée automatiquement : pas de moissonnage, pas
 * d'annuaire acheté. La liste est celle que tu constitues, et les contacts
 * que tu y notes sont ceux que tu as obtenus toi-même.
 */

const DEMARCHES = [
  "a_qualifier",
  "a_contacter",
  "contactee",
  "relancee",
  "en_discussion",
  "sans_suite",
  "ecartee",
];

function retour(volet: string, etat: string): never {
  revalidatePath("/marche-cache");
  redirect(`/marche-cache?volet=${volet}&etat=${etat}`);
}

function champs(formData: FormData) {
  const texte = (cle: string, max = 200) => {
    const v = String(formData.get(cle) ?? "").trim();
    return v ? v.slice(0, max) : null;
  };
  const secteur = texte("secteur_code");

  return {
    nom: String(formData.get("nom") ?? "").trim().slice(0, 200),
    secteur_code: secteur && secteur in SECTEURS ? secteur : null,
    taille: texte("taille", 60),
    localisation: texte("localisation", 120),
    site_web: texte("site_web", 300),
    contact_nom: texte("contact_nom", 120),
    contact_role: texte("contact_role", 120),
    contact_email: texte("contact_email", 200),
    pourquoi: texte("pourquoi", 600),
    notes: texte("notes", 2000),
  };
}

export async function ajouterCible(formData: FormData) {
  const volet = String(formData.get("volet") ?? "cdg");
  const c = champs(formData);
  if (!c.nom) retour(volet, "nom");

  const supabase = creerClientServeur();
  await supabase.from("entreprises_cibles").insert({ ...c, volet });

  retour(volet, "ajoutee");
}

export async function modifierCible(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const volet = String(formData.get("volet") ?? "cdg");
  const c = champs(formData);
  if (!id || !c.nom) retour(volet, "nom");

  const supabase = creerClientServeur();
  await supabase.from("entreprises_cibles").update(c).eq("id", id);

  retour(volet, "modifiee");
}

/**
 * Change l'état de la démarche, et date le premier contact.
 *
 * La date de contact n'est posée qu'une fois : c'est elle qui sert à calculer
 * depuis combien de temps l'entreprise n'a pas répondu.
 */
export async function changerDemarche(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const volet = String(formData.get("volet") ?? "cdg");
  const demarche = String(formData.get("demarche") ?? "");
  if (!id || !DEMARCHES.includes(demarche)) retour(volet, "etat");

  const supabase = creerClientServeur();
  const { data } = await supabase
    .from("entreprises_cibles")
    .select("date_contact")
    .eq("id", id)
    .maybeSingle();

  const dejaContactee = (data as { date_contact: string | null } | null)
    ?.date_contact;
  const contactMaintenant =
    !dejaContactee && ["contactee", "relancee", "en_discussion"].includes(demarche);

  await supabase
    .from("entreprises_cibles")
    .update({
      demarche,
      ...(contactMaintenant
        ? { date_contact: new Date().toISOString().slice(0, 10) }
        : {}),
    })
    .eq("id", id);

  retour(volet, "demarche");
}

export async function supprimerCible(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const volet = String(formData.get("volet") ?? "cdg");
  if (!id) return;

  const supabase = creerClientServeur();
  await supabase.from("entreprises_cibles").delete().eq("id", id);

  retour(volet, "supprimee");
}
