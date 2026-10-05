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
 * après coup transforme la contrainte « une seule page » en garantie.
 *
 * Elle lisait le nombre de pages avec `unpdf`, qui charge tout un moteur de
 * lecture PDF : un outil de contrôle plus lourd que ce qu'il contrôle, chargé
 * à chaque génération. React-PDF écrit la structure du document en clair, le
 * nombre de pages s'y lit directement.
 *
 * En cas d'échec on renvoie 1 : mieux vaut livrer le CV estimé que bloquer la
 * génération sur une vérification.
 */
export function compterPages(pdf: Buffer): number {
  const texte = pdf.toString("latin1");

  const catalogue = texte.match(/\/Type\s*\/Pages[\s\S]{0,400}?\/Count\s+(\d+)/);
  if (catalogue) return Number(catalogue[1]);

  // À défaut, on compte les objets page eux-mêmes — sans confondre /Page
  // et /Pages, qui désigne le catalogue.
  const pages = texte.match(/\/Type\s*\/Page(?![s])/g);
  return pages ? pages.length : 1;
}
