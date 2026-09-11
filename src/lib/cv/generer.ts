import { randomUUID } from "crypto";
import { creerClientServeur } from "@/lib/supabase/server";
import type { CodeVolet } from "@/config/volets";
import type { OffreExtraite } from "@/lib/extraction-offre";
import { chargerDonneesCV } from "@/lib/cv/donnees";
import { NIVEAUX, selectionner, type Selection } from "@/lib/cv/selection";
import { choisirNiveau } from "@/lib/cv/compacite";
import { construireModele, modeleEnTexte, type ModeleCV } from "@/lib/cv/modele";
import { estimerHauteur } from "@/lib/cv/encombrement";
import { comparerAuReference, potentielAdaptation } from "@/lib/cv/ecart";
import { compterPages, rendreModele } from "@/lib/cv/rendu";

export class ErreurCV extends Error {}

export interface CVGenere {
  documentId: string;
  version: number;
  modele: ModeleCV;
  pages: number;
  stocke: boolean;
}

/**
 * Génère le CV d'une offre et l'enregistre comme une nouvelle version.
 *
 * Aucun appel IA : la sélection est arithmétique, les textes sont ceux déjà
 * stockés dans `mission_formulations`. Une génération ne coûte donc rien et
 * peut être rejouée autant de fois qu'on veut.
 */
export async function genererCVPourOffre(offreId: string): Promise<CVGenere> {
  const supabase = creerClientServeur();

  const { data: offreBrute } = await supabase
    .from("offres")
    .select("id, volet, intitule, entreprise")
    .eq("id", offreId)
    .maybeSingle();

  if (!offreBrute) throw new ErreurCV("Offre introuvable.");
  const offre = offreBrute as {
    id: string;
    volet: CodeVolet;
    intitule: string | null;
    entreprise: string | null;
  };

  const { data: analyseBrute } = await supabase
    .from("offre_analyses")
    .select("resultat")
    .eq("offre_id", offreId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!analyseBrute) {
    throw new ErreurCV(
      "Cette offre n'a pas d'analyse exploitable. Sans les codes d'activité " +
        "de l'offre, la sélection des missions n'a rien sur quoi s'appuyer."
    );
  }

  const analyse = (analyseBrute as { resultat: OffreExtraite }).resultat;

  // Les formulations validées pour cette offre priment sur les génériques.
  const donnees = await chargerDonneesCV(offre.volet, offreId);
  if (donnees.experiences.length === 0) {
    throw new ErreurCV(
      `Aucune expérience n'est visible dans le volet ${offre.volet}. ` +
        "Vérifie les visibilités depuis Mon profil."
    );
  }

  let { selection, modele } = choisirNiveau(donnees, analyse, offre.volet);
  let pdf = await rendreModele(modele);
  let pages = await compterPages(pdf);

  // L'estimation par comptage de caractères décide du premier essai ; la
  // composition réelle a le dernier mot. Tant qu'elle rend deux pages, on
  // descend d'un cran. Une page est une contrainte stricte : on ne livre pas
  // un CV qui déborde.
  let index = selection.niveau.niveau;
  while (pages > 1 && index < NIVEAUX.length - 1) {
    index += 1;
    selection = selectionner(donnees, analyse, NIVEAUX[index]);
    modele = construireModele(donnees, selection, offre.volet);
    pdf = await rendreModele(modele);
    pages = await compterPages(pdf);
  }

  if (pages > 1) {
    throw new ErreurCV(
      "Le CV déborde sur une seconde page même au niveau le plus compact " +
        `(${NIVEAUX[index].libelle}). Le contenu fixe est trop long : ` +
        "raccourcis l'accroche du volet, ou une ou deux formulations de " +
        "mission, depuis Mon profil. Aucun CV n'a été enregistré."
    );
  }

  const { data: derniere } = await supabase
    .from("documents")
    .select("version")
    .eq("offre_id", offreId)
    .eq("type", "cv")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const version = ((derniere as { version: number } | null)?.version ?? 0) + 1;
  const documentId = randomUUID();
  const chemin = `cv/${offreId}/${documentId}.pdf`;

  // Le PDF part dans le bucket privé. S'il n'y arrive pas, la génération n'est
  // pas perdue : la sélection stockée permet de recomposer un PDF identique à
  // la demande.
  const { error: erreurStockage } = await supabase.storage
    .from("documents")
    .upload(chemin, pdf, { contentType: "application/pdf", upsert: true });

  const stocke = !erreurStockage;

  const { error: erreurInsertion } = await supabase.from("documents").insert({
    id: documentId,
    offre_id: offreId,
    type: "cv",
    volet: offre.volet,
    version,
    storage_path: stocke ? chemin : null,
    contenu_texte: modeleEnTexte(modele),
    selection: {
      modele,
      // Calculés ici parce que la composition est gratuite et déterministe :
      // les écrans les relisent au lieu de recharger toute la base.
      ecart: comparerAuReference(donnees, analyse, selection.niveau, selection),
      potentiel: potentielAdaptation(analyse, selection),
      hauteurEstimee: Math.round(estimerHauteur(modele)),
      pages,
      niveau: modele.meta.niveau,
    },
    // `cout_usd` à zéro et `modele` laissé vide : aucune IA n'intervient.
    cout_usd: 0,
  });

  if (erreurInsertion) {
    throw new ErreurCV(
      `Le CV a été composé mais n'a pas pu être enregistré : ${erreurInsertion.message}`
    );
  }

  return { documentId, version, modele, pages, stocke };
}

/**
 * Recompose un PDF à partir du modèle stocké, sans retoucher à la base.
 * Sert de repli quand le fichier n'est pas dans le bucket.
 */
export async function rendreDepuisSelection(
  selection: unknown
): Promise<Buffer | null> {
  const s = selection as { modele?: ModeleCV } | null;
  if (!s?.modele) return null;
  return rendreModele(s.modele);
}
