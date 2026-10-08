/**
 * La portée d'une expérience : sur quels CV elle figure (D131).
 *
 * Deux colonnes booléennes d'un côté, un choix unique dans un menu de l'autre.
 * La conversion se fait dans les deux sens — le menu affiche l'état courant, le
 * formulaire réécrit les colonnes — et c'est exactement le genre d'aller-retour
 * où une inversion passe inaperçue : on voit « CV comptable seulement », on
 * valide sans rien changer, et l'expérience bascule en contrôle de gestion.
 *
 * Les deux sens vivent donc ici, côte à côte, et un test les parcourt en rond.
 */

export type Portee = "les_deux" | "cdg" | "compta" | "aucun";

export interface Visibilite {
  visible_cdg: boolean;
  visible_compta: boolean;
}

export const VISIBILITES: Record<Portee, Visibilite> = {
  les_deux: { visible_cdg: true, visible_compta: true },
  cdg: { visible_cdg: true, visible_compta: false },
  compta: { visible_cdg: false, visible_compta: true },
  aucun: { visible_cdg: false, visible_compta: false },
};

export const LIBELLES_PORTEE: Record<Portee, string> = {
  les_deux: "Sur les deux CV",
  cdg: "CV contrôle de gestion seulement",
  compta: "CV comptable seulement",
  aucun: "Sur aucun CV",
};

/**
 * `valeur in VISIBILITES` ne suffit pas : `in` remonte la chaîne de
 * prototypes, et « toString » y répondait vrai. La garde laissait alors passer
 * une fonction là où le code attend deux booléens.
 */
export function estPortee(valeur: string): valeur is Portee {
  return Object.prototype.hasOwnProperty.call(VISIBILITES, valeur);
}

/** L'état des deux colonnes, ramené au choix qui lui correspond. */
export function porteeDe(v: {
  visible_cdg: boolean;
  visible_compta: boolean;
}): Portee {
  if (v.visible_cdg && v.visible_compta) return "les_deux";
  if (v.visible_cdg) return "cdg";
  if (v.visible_compta) return "compta";
  return "aucun";
}
