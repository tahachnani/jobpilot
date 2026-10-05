import { creerClientServeur } from "@/lib/supabase/server";

/**
 * Export et import de la base.
 *
 * Tout le travail — le profil, les missions, les formulations validées, les
 * 33 entrées de corpus, les offres analysées — vit dans un seul projet
 * Supabase gratuit, qui se met en pause tout seul après inactivité. Il n'en
 * existait aucune copie.
 *
 * L'import est volontairement **additif** : il ajoute ce qui manque et ignore
 * ce qui existe déjà. Il restaure donc parfaitement une base vide, et ne peut
 * pas détruire une base pleine par un clic malheureux. Pour réparer des
 * lignes abîmées, il faut les supprimer d'abord — c'est délibéré.
 */

/** L'ordre compte : une ligne fille ne s'insère pas avant sa mère. */
export const TABLES = [
  "profil",
  "experiences",
  "experience_periodes",
  "missions",
  "mission_formulations",
  "accroches",
  "competences",
  "formations",
  "langues",
  "corpus_experience",
  "offres",
  "offre_analyses",
  "scores",
  "statuts_historique",
  "parametres",
] as const;

export type Table = (typeof TABLES)[number];

export interface Sauvegarde {
  format: number;
  genere_le: string;
  tables: Partial<Record<Table, Record<string, unknown>[]>>;
}

export const FORMAT_SAUVEGARDE = 1;

export async function exporterTout(): Promise<Sauvegarde> {
  const supabase = creerClientServeur();
  const tables: Sauvegarde["tables"] = {};

  for (const t of TABLES) {
    const { data } = await supabase.from(t).select("*");
    tables[t] = (data ?? []) as Record<string, unknown>[];
  }

  return {
    format: FORMAT_SAUVEGARDE,
    genere_le: new Date().toISOString(),
    tables,
  };
}

export interface ResultatImport {
  ajoutes: Record<string, number>;
  ignores: string[];
  total: number;
}

/**
 * Réinjecte une sauvegarde sans rien écraser.
 *
 * `owner_id` est retiré de chaque ligne : la base le repose depuis la session
 * en cours. Une sauvegarde reste donc réimportable dans un autre compte, ce
 * qui est exactement ce qu'on veut le jour où le projet Supabase est refait.
 */
export async function importerAdditif(
  brut: unknown
): Promise<ResultatImport> {
  const sauvegarde = brut as Partial<Sauvegarde>;
  if (!sauvegarde || typeof sauvegarde !== "object" || !sauvegarde.tables) {
    throw new Error("Ce fichier n'est pas une sauvegarde JobPilot.");
  }

  const supabase = creerClientServeur();
  const ajoutes: Record<string, number> = {};
  const ignores: string[] = [];
  let total = 0;

  for (const t of TABLES) {
    const lignes = sauvegarde.tables[t];
    if (!Array.isArray(lignes) || lignes.length === 0) continue;

    const nettoyees = lignes.map((l) => {
      const copie: Record<string, unknown> = { ...l };
      delete copie.owner_id;
      return copie;
    });

    // `parametres` a pour clé primaire `cle`, toutes les autres tables `id`.
    const conflit = t === "parametres" ? "cle" : "id";

    const { data, error } = await supabase
      .from(t)
      .upsert(nettoyees, { onConflict: conflit, ignoreDuplicates: true })
      .select(conflit);

    if (error) {
      ignores.push(`${t} : ${error.message}`);
      continue;
    }

    const n = (data ?? []).length;
    ajoutes[t] = n;
    total += n;
  }

  return { ajoutes, ignores, total };
}
