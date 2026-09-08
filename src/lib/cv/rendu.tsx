import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { DocumentCV } from "@/lib/cv/document";
import type { ModeleCV } from "@/lib/cv/modele";

/** Compose le PDF et renvoie ses octets. */
export async function rendreModele(modele: ModeleCV): Promise<Buffer> {
  return renderToBuffer(<DocumentCV modele={modele} />);
}

/**
 * Nombre de pages réellement composées.
 *
 * L'estimation par comptage de caractères peut se tromper ; cette vérification
 * après coup transforme la contrainte « une seule page » en garantie. On
 * réutilise `unpdf`, déjà présent pour la lecture des offres en PDF. En cas
 * d'échec de lecture on renvoie 1 : mieux vaut livrer le CV estimé que de
 * bloquer la génération sur un outil de contrôle.
 */
export async function compterPages(pdf: Buffer): Promise<number> {
  try {
    const { getDocumentProxy } = await import("unpdf");
    const doc = await getDocumentProxy(new Uint8Array(pdf));
    return doc.numPages;
  } catch {
    return 1;
  }
}
