import type { CodeVolet } from "@/config/volets";
import type { OffreExtraite } from "@/lib/extraction-offre";
import type { DonneesCV } from "@/lib/cv/donnees";
import {
  NIVEAUX,
  nombreDeMissions,
  prochaineAGarnir,
  selectionner,
  type Selection,
} from "@/lib/cv/selection";
import { construireModele, type ModeleCV } from "@/lib/cv/modele";
import { titreCV } from "@/lib/cv/titre";
import { ligneLieu } from "@/lib/cv/lieu";
import { tientSurUnePage } from "@/lib/cv/encombrement";

/**
 * Choisit le cran de compacité, puis rend la place qui reste.
 *
 * On descend d'un cran tant que l'estimation annonce un débordement. Le
 * dernier cran est retenu par défaut : la contrainte d'une page l'emporte sur
 * la complétude du contenu.
 *
 * Isolé du générateur pour que la reformulation puisse savoir quelles missions
 * paraîtront, sans avoir à charger le moteur de composition PDF.
 */

/** Plafond d'ajouts, comme dans le générateur. Voir D120. */
const MAX_AJOUTS = 6;

export function choisirNiveau(
  donnees: DonneesCV,
  offre: OffreExtraite,
  volet: CodeVolet,
  /**
   * Ce que tu as saisi à la main pour cette offre : le titre (D121) et la
   * mention de lieu (D122). Les deux comptent ici et pas seulement à la
   * génération : ils occupent des lignes de la page, et ils entrent dans le
   * texte sur lequel l'indice d'adaptation est mesuré.
   */
  saisie: { titre?: string | null; lieu?: string | null } = {}
): { selection: Selection; modele: ModeleCV } {
  const entete = {
    titre: titreCV(volet, offre, saisie.titre),
    lieu: ligneLieu(donnees.profil?.localisation, offre, saisie.lieu),
  };
  let dernier: { selection: Selection; modele: ModeleCV } | null = null;

  for (const niveau of NIVEAUX) {
    const selection = selectionner(donnees, offre, niveau);
    const modele = construireModele(donnees, selection, volet, entete);
    dernier = { selection, modele };
    if (tientSurUnePage(modele)) {
      return garnir(donnees, offre, dernier, volet, entete);
    }
  }

  return garnir(donnees, offre, dernier!, volet, entete);
}

/**
 * Garnissage à l'estimation (D120).
 *
 * Le générateur fait la même passe, mais arbitrée par la composition réelle :
 * c'est elle qui fait foi sur le PDF livré. Ici l'estimation suffit, et il
 * faut qu'elle soit faite — sans elle, la reformulation et l'écran d'offre
 * annonceraient trois missions de moins que le CV n'en portera, et
 * proposeraient de retravailler des lignes qui paraîtront pendant qu'elles
 * tairaient celles qui paraissent.
 *
 * L'estimation étant plus prudente que la composition (quatorze points de
 * marge, six pour cent sur la coupure des mots), elle rend un peu moins de
 * place que le PDF final. L'écart joue dans le bon sens : ce qui est annoncé
 * paraît toujours.
 */
function garnir(
  donnees: DonneesCV,
  offre: OffreExtraite,
  depart: { selection: Selection; modele: ModeleCV },
  volet: CodeVolet,
  entete: { titre: string; lieu: string }
): { selection: Selection; modele: ModeleCV } {
  // Un CV qui déborde déjà n'a pas de place à rendre.
  if (!tientSurUnePage(depart.modele)) return depart;

  let courant = depart;
  const supplements = donnees.experiences.map(() => 0);

  for (let ajouts = 0; ajouts < MAX_AJOUTS; ajouts += 1) {
    const cible = prochaineAGarnir(courant.selection);
    if (cible === null) break;

    supplements[cible] += 1;
    const selection = selectionner(
      donnees,
      offre,
      courant.selection.niveau,
      [...supplements]
    );

    // Le plafond d'emprunts peut refuser la place accordée ; sans ce garde-fou
    // la boucle redemanderait indéfiniment la même expérience.
    if (nombreDeMissions(selection) <= nombreDeMissions(courant.selection)) break;

    const modele = construireModele(donnees, selection, volet, entete);
    if (!tientSurUnePage(modele)) {
      supplements[cible] -= 1;
      break;
    }

    courant = { selection, modele };
  }

  return courant;
}
