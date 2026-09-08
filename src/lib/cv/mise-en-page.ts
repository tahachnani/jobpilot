  /**
   * Géométrie du CV, en points PostScript (1 pt = 1/72 pouce).
   *
   * Ce fichier est la source unique : la feuille de styles React-PDF et
   * l'estimateur d'encombrement lisent les mêmes nombres. Sans cela les deux
   * dérivent, et l'estimation cesse de vouloir dire quelque chose.
   *
   * Toute valeur marquée « à ajuster » est un réglage empirique : la
   * spécification prévoit qu'il bouge après les premiers CV réels.
   */

  export const MESURES = {
    // Page A4
    pageHauteur: 841.89,
    pageLargeur: 595.28,
    margeHorizontale: 34,
    margeVerticale: 26,

    // Tailles de police
    tailleNom: 15,
    tailleTitre: 10.5,
    tailleContact: 8,
    tailleSection: 9,
    tailleCorps: 8.5,
    tailleEmployeur: 8.5,

    // Interlignes
    interligne: 1.26,
    interligneAccroche: 1.3,

    // Espacements verticaux
    margeApresNom: 1,
    margeApresTitre: 3,
    margeApresEntete: 9,
    margeAvantSection: 6,
    margeApresTitreSection: 3,
    paddingTitreSection: 2.5,
    margeAvantExperience: 4.5,
    margeApresEnteteExperience: 2,
    margeApresPuce: 1.2,
    margeAvantFormation: 3,
    margeApresLigne: 1.6,

    // Retrait des puces
    largeurPuce: 8,

    /**
     * Largeur moyenne d'un caractère en Helvetica, en fraction de la taille de
     * police. Mesuré sur du français courant : 0,50 pour du texte mixte.
     * À ajuster.
     */
    largeurCaractere: 0.505,

    /**
     * La coupure se fait aux mots, jamais au caractère près : une ligne perd en
     * moyenne quelques pour cent de sa capacité théorique. À ajuster.
     */
    facteurCoupureMots: 1.06,

    /**
     * Marge de sécurité retranchée à la hauteur utile avant comparaison.
     * À ajuster.
     */
    margeSecurite: 14,
  } as const;

  /** Hauteur réellement disponible pour le contenu d'une page. */
  export const HAUTEUR_UTILE =
    MESURES.pageHauteur - 2 * MESURES.margeVerticale - MESURES.margeSecurite;

  /** Largeur réellement disponible pour le contenu d'une page. */
  export const LARGEUR_UTILE = MESURES.pageLargeur - 2 * MESURES.margeHorizontale;

  /**
   * Nombre de lignes qu'occupera un texte donné, à une taille et une largeur
   * données. C'est l'estimation par comptage de caractères prévue par la
   * spécification : elle ne compose pas le document, elle le devine.
   */
  export function nombreDeLignes(
    texte: string,
    taille: number,
    largeurDisponible: number
  ): number {
    if (!texte) return 0;
    const largeurCar = taille * MESURES.largeurCaractere;
    const parLigne = Math.max(1, Math.floor(largeurDisponible / largeurCar));
    const longueur = texte.length * MESURES.facteurCoupureMots;
    return Math.max(1, Math.ceil(longueur / parLigne));
  }

  /** Hauteur d'un bloc de texte, interligne compris. */
  export function hauteurTexte(
    texte: string,
    taille: number,
    largeurDisponible: number,
    interligne: number = MESURES.interligne
  ): number {
    return nombreDeLignes(texte, taille, largeurDisponible) * taille * interligne;
  }
