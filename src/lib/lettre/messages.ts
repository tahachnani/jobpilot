/**
 * Les deux messages de motivation courts (D112).
 *
 * Extraits de `lettre/generer.ts` pour une raison purement pratique, déjà
 * rencontrée en D92 : ce fichier importe `lettre/document.tsx`, que le
 * dépouilleur de types de Node ne sait pas charger. Rien de ce qui y vit n'est
 * donc testable, et c'est précisément le nettoyage ci-dessous qu'il faut
 * pouvoir tester — c'est lui qui garantit qu'un message se colle tel quel dans
 * un formulaire.
 *
 * Deux longueurs plutôt qu'une pour qu'aucune limite de site n'oblige à
 * régénérer : le surcoût est de 0,1 ¢ en jetons de sortie, une régénération en
 * coûte trois cents fois plus.
 */

export interface Messages {
  /** 380 à 450 signes : trois phrases pour un champ serré. */
  court: string;
  /** 800 à 900 signes : deux ou trois paragraphes. */
  moyen: string;
}

/**
 * Les deux messages, nettoyés et bornés (D112).
 *
 * Deux garde-fous, et chacun vient d'un défaut déjà vu ailleurs. Le premier
 * retire l'appareil de lettre : un modèle à qui l'on dit « pas de formule
 * d'appel » en place une fois sur cinq, et « Madame, Monsieur, » collé en tête
 * d'un champ de formulaire signale un texte recyclé. Le second coupe au besoin,
 * parce qu'un message qui dépasse sa cible oblige à tailler à la main dans un
 * formulaire, c'est-à-dire au pire moment.
 */
export function normaliserMessages(brut: Messages | undefined): Messages | null {
  if (!brut?.court?.trim() || !brut?.moyen?.trim()) return null;

  const nettoyerMessage = (texte: string, plafond: number): string => {
    let t = texte
      .trim()
      // Formule d'appel en tête. Le groupe est RÉPÉTÉ : l'usage français veut
      // « Madame, Monsieur, », deux civilités séparées par une virgule, et un
      // motif qui n'en retire qu'une laisse « Monsieur, » en tête du message.
      // Le titre est admis entre les deux — « Monsieur le Directeur, ».
      .replace(
        /^\s*(?:(?:madame|monsieur|mesdames|messieurs|bonjour)(?:\s+(?:le|la|les)\s+\S+)?\s*,\s*)+/i,
        ""
      )
      // Formules de politesse finales, et la signature qui les suit.
      .replace(
        /\s*(je vous prie d['’]agr[ée]er|veuillez agr[ée]er|cordialement|bien [àa] vous|salutations?)[\s\S]*$/i,
        ""
      )
      .replace(/^\s*objet\s*:[^\n]*\n+/i, "")
      .trim();

    if (t.length <= plafond) return t;

    // Couper à la dernière phrase entière qui tient : tronquer en plein milieu
    // d'une phrase est pire que de perdre la phrase.
    const coupe = t.slice(0, plafond);
    const fin = Math.max(
      coupe.lastIndexOf(". "),
      coupe.lastIndexOf(".\n"),
      coupe.lastIndexOf("! "),
      coupe.lastIndexOf("? ")
    );
    return fin > plafond * 0.5 ? coupe.slice(0, fin + 1).trim() : coupe.trim();
  };

  return {
    court: nettoyerMessage(brut.court, 500),
    moyen: nettoyerMessage(brut.moyen, 1000),
  };
}

/** Les deux longueurs dans un seul texte lisible, pour `contenu_texte`. */
export function messageEnTexte(m: Messages): string {
  return [
    `— VERSION COURTE (${m.court.length} signes) —`,
    m.court,
    "",
    `— VERSION MOYENNE (${m.moyen.length} signes) —`,
    m.moyen,
  ].join("\n");
}

