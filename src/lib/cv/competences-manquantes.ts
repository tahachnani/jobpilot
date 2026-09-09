import { creerClientServeur } from "@/lib/supabase/server";
import { correspond } from "@/lib/texte";
import type { OffreExtraite } from "@/lib/extraction-offre";

/**
 * Compétences réclamées par une offre et absentes de la base.
 *
 * Un CV ne peut pas tout contenir, et la base ne contient que ce qui a été
 * saisi un jour : une offre peut réclamer quelque chose que Taha maîtrise sans
 * l'avoir écrit. Ce module le lui signale.
 *
 * Il ne l'ajoute jamais de lui-même. Une compétence entre dans la base parce
 * que Taha a confirmé la posséder et a choisi son niveau — l'offre sert de
 * révélateur de ce qui manque au profil, jamais de source de vérité sur ce
 * qu'il sait faire. Un CV qui affirmerait une compétence au seul motif que
 * l'annonce la demande serait un faux.
 */

export interface CompetenceManquante {
  libelle: string;
  /** 'indispensable', 'souhaitee', 'outil' ou 'mot_cle'. */
  origine: string;
  /** Suggestion de catégorie, modifiable par Taha. */
  categorieSuggeree: string;
}

/** Trop court ou trop générique pour valoir une ligne de CV. */
function digneDInteret(libelle: string): boolean {
  const t = libelle.trim();
  if (t.length < 4 || t.length > 70) return false;
  const banals = [
    "rigueur",
    "autonomie",
    "esprit d equipe",
    "motivation",
    "dynamisme",
    "polyvalence",
    "bac",
    "master",
    "anglais",
    "francais",
  ];
  const n = t.toLowerCase();
  return !banals.some((b) => n.includes(b));
}

/**
 * Compare ce que l'offre réclame à tout ce que la base contient — y compris
 * les compétences invisibles. Une compétence déjà écartée une fois n'est pas
 * reproposée à chaque offre.
 */
export async function competencesManquantes(
  offre: OffreExtraite,
  volet: string
): Promise<CompetenceManquante[]> {
  const supabase = creerClientServeur();

  const { data } = await supabase
    .from("competences")
    .select("libelle, code_normalise");

  const connues = ((data ?? []) as { libelle: string; code_normalise: string }[])
    .flatMap((c) => [c.libelle, c.code_normalise])
    .filter(Boolean);

  const estConnue = (libelle: string) =>
    connues.some((c) => correspond(c, libelle));

  const familleDuVolet = volet === "cdg" ? "cdg" : "compta";
  const candidates: CompetenceManquante[] = [];

  for (const c of offre.competences) {
    candidates.push({
      libelle: c.libelle,
      origine: c.caractere === "indispensable" ? "indispensable" : "souhaitee",
      categorieSuggeree: familleDuVolet,
    });
  }
  for (const o of offre.outils) {
    candidates.push({
      libelle: o,
      origine: "outil",
      categorieSuggeree: "outil",
    });
  }

  const vues = new Set<string>();
  return candidates
    .filter((c) => digneDInteret(c.libelle))
    .filter((c) => !estConnue(c.libelle))
    .filter((c) => {
      const cle = c.libelle.toLowerCase().trim();
      if (vues.has(cle)) return false;
      vues.add(cle);
      return true;
    });
}
