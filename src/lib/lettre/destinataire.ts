/**
 * La formule d'appel, déduite du destinataire saisi (D92).
 *
 * Le nom du contact était bien stocké et affiché dans l'en-tête, mais **jamais
 * transmis au modèle** : celui-ci rendait donc la formule générique de
 * l'exemple, et le code la reprenait telle quelle en croyant qu'elle avait été
 * personnalisée. Saisir « Monsieur Dupont » ne changeait rien à la lettre.
 *
 * L'usage français veut que la formule d'appel ne porte pas le patronyme :
 * « Monsieur, » et non « Monsieur Dupont, ». Le nom, lui, figure dans le bloc
 * destinataire, à sa place.
 *
 * Aucune déduction de civilité à partir d'un prénom : c'est faux une fois sur
 * dix et vexant à tous les coups. Sans civilité écrite, la formule reste
 * neutre — et l'écran dit comment l'obtenir.
 */
export function formuleAppel(contact: string | null): string {
  const c = (contact ?? "").trim().toLowerCase();
  if (/^(m\.|mr\b|monsieur\b)/.test(c)) return "Monsieur,";
  if (/^(mme\b|mme\.|madame\b)/.test(c)) return "Madame,";
  return "Madame, Monsieur,";
}
