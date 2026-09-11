import { creerClientServeur } from "@/lib/supabase/server";

/**
 * Le corpus d'une expérience : ce qui y a été fait, avec son vocabulaire.
 *
 * Aucune ligne n'est jamais sélectionnée pour un CV. Le corpus sert à deux
 * choses : autoriser un terme en reformulation, et mesurer ce qui est
 * récupérable dans une offre.
 *
 * Il est cloisonné par expérience. Ce qui a été fait chez un employeur
 * n'autorise rien dans la mission d'un autre.
 */

export interface LigneCorpus {
  id: string;
  experienceId: string;
  texte: string;
  codes: string[];
}

export async function chargerCorpus(): Promise<Map<string, LigneCorpus[]>> {
  const supabase = creerClientServeur();
  const { data } = await supabase
    .from("corpus_experience")
    .select("id, experience_id, texte, activites_codes")
    .order("ordre");

  const parExperience = new Map<string, LigneCorpus[]>();
  for (const l of (data ?? []) as Record<string, unknown>[]) {
    const ligne: LigneCorpus = {
      id: l.id as string,
      experienceId: l.experience_id as string,
      texte: l.texte as string,
      codes: (l.activites_codes as string[]) ?? [],
    };
    const liste = parExperience.get(ligne.experienceId) ?? [];
    liste.push(ligne);
    parExperience.set(ligne.experienceId, liste);
  }
  return parExperience;
}

/** Tout le corpus d'une expérience, mis bout à bout. */
export function corpusEnTexte(lignes: LigneCorpus[] | undefined): string {
  return (lignes ?? []).map((l) => l.texte).join("\n");
}
