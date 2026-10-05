/**
 * Isole l'objet ou le tableau JSON d'une réponse de modèle.
 *
 * On prend de la première accolade ou du premier crochet jusqu'au dernier,
 * plutôt que de retirer des balises de code : le modèle peut préfixer une
 * phrase, changer de balisage, ou n'en mettre aucun. Chercher les délimiteurs
 * survit à ces variations.
 */
export function extraireJson(texte: string): string {
  const t = texte.trim();
  const debutObjet = t.indexOf("{");
  const debutTableau = t.indexOf("[");

  const debut =
    debutTableau !== -1 && (debutObjet === -1 || debutTableau < debutObjet)
      ? debutTableau
      : debutObjet;
  if (debut === -1) return t;

  const fin = t.lastIndexOf(t[debut] === "[" ? "]" : "}");
  if (fin <= debut) return t;
  return t.slice(debut, fin + 1);
}
