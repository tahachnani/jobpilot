import { creerClientServeur } from "@/lib/supabase/server";

/**
 * Purge des anciennes versions d'un document.
 *
 * Régénérer un CV est gratuit et sans conséquence : c'est dit partout dans
 * l'application, et c'est vrai. La contrepartie invisible, c'est qu'à chaque
 * clic une version de plus s'ajoute en base et un PDF de plus dans le bucket,
 * et que rien n'effaçait jamais rien.
 *
 * On garde les trois dernières versions de chaque type pour chaque offre. La
 * version courante en fait toujours partie, donc un CV déjà envoyé reste
 * téléchargeable tel qu'il est parti.
 */

export const VERSIONS_CONSERVEES = 3;

/**
 * Forme du contenu de `documents.selection`.
 *
 * Ce qui est écrit là est figé pour toujours : le document en garde la forme
 * qu'il avait le jour de sa génération, et l'écran Formulations a déjà planté
 * sur un `potentiel` d'avant l'étape 4ter. Les lecteurs devinaient la forme en
 * testant la présence de chaque clé ; ils peuvent désormais la lire.
 *
 * 1 : modèle seul — 2 : + écart — 3 : + potentiel avec `recuperables` et
 * `horsPortee`.
 */
export const SCHEMA_SELECTION = 3;

/** La forme d'une sélection stockée, 1 si elle ne le dit pas. */
export function schemaDe(selection: unknown): number {
  const s = selection as { schema?: unknown } | null;
  const n = Number(s?.schema);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export async function purgerAnciennesVersions(
  offreId: string,
  type: "cv" | "lettre" | "email" | "relance" | "preparation"
): Promise<number> {
  const supabase = creerClientServeur();

  const { data } = await supabase
    .from("documents")
    .select("id, storage_path")
    .eq("offre_id", offreId)
    .eq("type", type)
    .order("version", { ascending: false });

  const versions = (data ?? []) as { id: string; storage_path: string | null }[];
  const aEffacer = versions.slice(VERSIONS_CONSERVEES);
  if (aEffacer.length === 0) return 0;

  // Les fichiers d'abord : une ligne supprimée sans son PDF laisserait un
  // fichier que plus personne ne sait retrouver.
  const chemins = aEffacer
    .map((d) => d.storage_path)
    .filter((c): c is string => Boolean(c));
  if (chemins.length > 0) {
    await supabase.storage.from("documents").remove(chemins);
  }

  await supabase
    .from("documents")
    .delete()
    .in(
      "id",
      aEffacer.map((d) => d.id)
    );

  return aEffacer.length;
}
