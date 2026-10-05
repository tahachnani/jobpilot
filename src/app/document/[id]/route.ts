import { creerClientServeur } from "@/lib/supabase/server";
import { rendreDepuisSelection } from "@/lib/cv/generer";
import { rendreLettre, type ModeleLettre } from "@/lib/lettre/document";
import { VOLETS, type CodeVolet } from "@/config/volets";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Extrait les octets d'un Buffer Node vers un ArrayBuffer autonome.
 *
 * Node alloue les Buffer dans un tampon mutualisé : `buffer.buffer` contient
 * bien plus que les octets voulus. La découpe est donc nécessaire, et pas
 * seulement pour satisfaire le typage.
 */
function enTamponSimple(donnees: Buffer): ArrayBuffer {
  return donnees.buffer.slice(
    donnees.byteOffset,
    donnees.byteOffset + donnees.byteLength
  ) as ArrayBuffer;
}

/** Retire accents et ponctuation pour composer un nom de fichier sobre. */
function pourNomDeFichier(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

/**
 * Sert un CV généré.
 *
 * Par défaut le PDF s'ouvre dans le navigateur ; `?telecharger=1` force
 * l'enregistrement. L'accès est déjà filtré par le middleware, et la ligne
 * `documents` elle-même n'est lisible que par son propriétaire (RLS).
 */
export async function GET(
  requete: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = creerClientServeur();

  const { data } = await supabase
    .from("documents")
    .select("id, type, volet, version, storage_path, selection, offre_id, offres ( intitule, entreprise )")
    .eq("id", params.id)
    .maybeSingle();

  if (!data) {
    return new Response("Document introuvable.", { status: 404 });
  }

  const doc = data as unknown as {
    type: string;
    volet: CodeVolet;
    version: number;
    storage_path: string | null;
    selection: unknown;
    offres: { intitule: string | null; entreprise: string | null } | null;
  };

  // Un ArrayBuffer plutôt qu'un Uint8Array : `Response` refuse
  // `Uint8Array<ArrayBufferLike>`, dont le tampon pourrait en théorie être
  // partagé. L'ArrayBuffer lève l'ambiguïté à la source.
  let octets: ArrayBuffer | null = null;

  if (doc.storage_path) {
    const { data: fichier } = await supabase.storage
      .from("documents")
      .download(doc.storage_path);
    if (fichier) octets = await fichier.arrayBuffer();
  }

  // Repli : le fichier n'est pas dans le bucket, on recompose à partir du
  // modèle stocké. Le résultat est le même, la sélection étant figée.
  if (!octets) {
    const stocke = doc.selection as { modele?: unknown } | null;
    const recompose =
      doc.type === "lettre" && stocke?.modele
        ? await rendreLettre(stocke.modele as ModeleLettre)
        : await rendreDepuisSelection(doc.selection);
    if (!recompose) {
      return new Response(
        "Le fichier est introuvable et ne peut pas être recomposé.",
        { status: 410 }
      );
    }
    octets = enTamponSimple(recompose);
  }

  const nom = pourNomDeFichier(
    [
      doc.type === "lettre" ? "Lettre_Taha_Chnani" : "CV_Taha_Chnani",
      VOLETS[doc.volet]?.nomCourt ?? doc.volet,
      doc.offres?.entreprise ?? doc.offres?.intitule ?? "",
      `v${doc.version}`,
    ]
      .filter(Boolean)
      .join("_")
  );

  const enPieceJointe = requete.nextUrl.searchParams.get("telecharger") === "1";

  return new Response(octets, {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `${
        enPieceJointe ? "attachment" : "inline"
      }; filename="${nom}.pdf"`,
      "cache-control": "private, no-store",
    },
  });
}
