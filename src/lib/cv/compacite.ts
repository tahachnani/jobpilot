import type { CodeVolet } from "@/config/volets";
import type { OffreExtraite } from "@/lib/extraction-offre";
import type { DonneesCV } from "@/lib/cv/donnees";
import { NIVEAUX, selectionner, type Selection } from "@/lib/cv/selection";
import { construireModele, type ModeleCV } from "@/lib/cv/modele";
import { tientSurUnePage } from "@/lib/cv/encombrement";

/**
 * Choisit le cran de compacité.
 *
 * On descend d'un cran tant que l'estimation annonce un débordement. Le
 * dernier cran est retenu par défaut : la contrainte d'une page l'emporte sur
 * la complétude du contenu.
 *
 * Isolé du générateur pour que la reformulation puisse savoir quelles missions
 * paraîtront, sans avoir à charger le moteur de composition PDF.
 */
export function choisirNiveau(
  donnees: DonneesCV,
  offre: OffreExtraite,
  volet: CodeVolet
): { selection: Selection; modele: ModeleCV } {
  let dernier: { selection: Selection; modele: ModeleCV } | null = null;

  for (const niveau of NIVEAUX) {
    const selection = selectionner(donnees, offre, niveau);
    const modele = construireModele(donnees, selection, volet);
    dernier = { selection, modele };
    if (tientSurUnePage(modele)) return dernier;
  }

  return dernier!;
}
