/**
 * Doublure du client Supabase pour les tests.
 *
 * Les fonctions testées ne touchent pas la base. Celles qui vivent dans un
 * module qui l'importe ne doivent pas, pour autant, réclamer des clés : la
 * doublure échoue bruyamment si un test finit par l'appeler pour de bon.
 */
export function creerClientServeur(): never {
  throw new Error(
    "Un test a tenté d'atteindre Supabase. Les tests ne lisent aucune donnée."
  );
}
