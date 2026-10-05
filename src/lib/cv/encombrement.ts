import {
  HAUTEUR_UTILE,
  LARGEUR_UTILE,
  MESURES,
  hauteurTexte,
} from "@/lib/cv/mise-en-page";
import type { ModeleCV } from "@/lib/cv/modele";

/**
 * Estimation de la hauteur du CV avant composition.
 *
 * React-PDF ne signale pas un débordement : il ajoute une seconde page sans
 * rien dire. Il faut donc décider avant, et cette fonction décide en comptant
 * des caractères. C'est une heuristique assumée — le générateur vérifie
 * ensuite le nombre de pages réellement produit et redescend d'un cran si
 * l'estimation s'est trompée.
 *
 * La fonction suit pas à pas la structure de `document.tsx` : toute
 * modification de la mise en page doit se répercuter ici.
 */

/** Largeur du texte d'une puce, retrait du marqueur déduit. */
const LARGEUR_PUCE = LARGEUR_UTILE - MESURES.largeurPuce;

/** Hauteur d'un titre de section, filet et marges compris. */
const HAUTEUR_TITRE_SECTION =
  MESURES.tailleSection * MESURES.interligne +
  MESURES.paddingTitreSection +
  0.5 +
  MESURES.margeApresTitreSection;

function hauteurSection(hauteurContenu: number): number {
  return MESURES.margeAvantSection + HAUTEUR_TITRE_SECTION + hauteurContenu;
}

function hauteurPuce(texte: string): number {
  return (
    hauteurTexte(texte, MESURES.tailleCorps, LARGEUR_PUCE) +
    MESURES.margeApresPuce
  );
}

/**
 * Hauteur d'une ligne d'en-tête à deux colonnes (intitulé à gauche, dates à
 * droite). La colonne de droite est réputée tenir sur une ligne ; on mesure la
 * gauche sur la largeur qui lui reste.
 */
function hauteurEnteteDeuxColonnes(gauche: string, droite: string): number {
  const largeurDroite =
    droite.length * MESURES.tailleCorps * MESURES.largeurCaractere;
  const largeurGauche = Math.max(
    60,
    LARGEUR_UTILE - largeurDroite - 8
  );
  return Math.max(
    hauteurTexte(gauche, MESURES.tailleCorps, largeurGauche),
    MESURES.tailleCorps * MESURES.interligne
  );
}

export function estimerHauteur(modele: ModeleCV): number {
  let total = 0;

  // En-tête
  total += MESURES.tailleNom * MESURES.interligne + MESURES.margeApresNom;
  total += MESURES.tailleTitre * MESURES.interligne + MESURES.margeApresTitre;
  total +=
    hauteurTexte(modele.contact, MESURES.tailleContact, LARGEUR_UTILE) +
    MESURES.margeApresEntete;

  // Profil
  if (modele.accroche) {
    total += hauteurSection(
      hauteurTexte(
        modele.accroche,
        MESURES.tailleCorps,
        LARGEUR_UTILE,
        MESURES.interligneAccroche
      )
    );
  }

  // Expériences
  let hauteurExperiences = 0;
  for (const e of modele.experiences) {
    hauteurExperiences += MESURES.margeAvantExperience;
    hauteurExperiences += hauteurEnteteDeuxColonnes(
      e.poste,
      `${e.periode} · ${e.contrat}`
    );
    hauteurExperiences +=
      hauteurTexte(e.employeur, MESURES.tailleEmployeur, LARGEUR_UTILE) +
      MESURES.margeApresEnteteExperience;
    for (const m of e.missions) hauteurExperiences += hauteurPuce(m.texte);
  }
  total += hauteurSection(hauteurExperiences);

  // Formations
  let hauteurFormations = 0;
  for (const f of modele.formations) {
    hauteurFormations += MESURES.margeAvantFormation;
    hauteurFormations += hauteurEnteteDeuxColonnes(f.diplome, f.periode);
    if (f.etablissement) {
      hauteurFormations +=
        hauteurTexte(f.etablissement, MESURES.tailleEmployeur, LARGEUR_UTILE) +
        MESURES.margeApresEnteteExperience;
    }
  }
  total += hauteurSection(hauteurFormations);

  // Compétences, langues, centres d'intérêt
  total += hauteurSection(
    modele.competences.reduce((s, c) => s + hauteurPuce(c), 0)
  );
  total += hauteurSection(
    hauteurTexte(
      modele.langues.join("   |   "),
      MESURES.tailleCorps,
      LARGEUR_UTILE
    ) + MESURES.margeApresLigne
  );
  if (modele.interets) {
    total += hauteurSection(
      hauteurTexte(modele.interets, MESURES.tailleCorps, LARGEUR_UTILE) +
        MESURES.margeApresLigne
    );
  }

  return total;
}

/** Le CV tient-il sur une page, selon l'estimation ? */
export function tientSurUnePage(modele: ModeleCV): boolean {
  return estimerHauteur(modele) <= HAUTEUR_UTILE;
}

export { HAUTEUR_UTILE };
