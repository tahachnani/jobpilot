import { creerClientServeur } from "@/lib/supabase/server";
import type { CodeVolet } from "@/config/volets";

export interface Profil {
  id: string;
  nom: string | null;
  prenom: string | null;
  email: string | null;
  telephone: string | null;
  localisation: string | null;
  linkedin: string | null;
  permis: string | null;
}

export interface Formulation {
  id: string;
  texte: string;
  origine: string;
  validee: boolean;
}

export interface Mission {
  id: string;
  texte_source: string;
  activites_codes: string[];
  contient_chiffre: boolean;
  pertinence: number;
  ordre: number;
  formulation: Formulation | null;
}

export interface Experience {
  id: string;
  entreprise: string;
  ville: string | null;
  pays: string | null;
  date_debut: string;
  date_fin: string | null;
  type_contrat: string;
  secteur_code: string | null;
  titre: string | null;
  visible: boolean;
  duree_mois_forcee: number | null;
  ordre: number;
  missions: Mission[];
}

export interface Competence {
  id: string;
  libelle: string;
  categorie: string;
  precision: string | null;
  visible: boolean;
  ordre: number;
  nb_liens: number;
  niveau: number;
  origine: string | null;
}

/** Durée en mois d'une expérience, forcée ou calculée depuis les dates. */
export function dureeMois(e: {
  date_debut: string;
  date_fin: string | null;
  duree_mois_forcee: number | null;
}): number {
  if (e.duree_mois_forcee !== null) return e.duree_mois_forcee;
  const debut = new Date(e.date_debut);
  const fin = e.date_fin ? new Date(e.date_fin) : new Date();
  return Math.max(
    1,
    (fin.getFullYear() - debut.getFullYear()) * 12 +
      (fin.getMonth() - debut.getMonth()) +
      1
  );
}

/**
 * Charge la base professionnelle telle qu'elle doit apparaître dans un volet.
 * Les expériences masquées et les missions sans formulation pour ce volet
 * sont écartées : ce que renvoie cette fonction est exactement ce qui pourra
 * figurer sur un CV du volet.
 */
export async function chargerBasePro(volet: CodeVolet) {
  const supabase = creerClientServeur();
  const champVisible = volet === "cdg" ? "visible_cdg" : "visible_compta";
  const champTitre = volet === "cdg" ? "titre_cdg" : "titre_compta";
  const champPertinence = volet === "cdg" ? "pertinence_cdg" : "pertinence_compta";

  const [profil, exps, comps, forms, langues, interets, accroche] =
    await Promise.all([
      supabase.from("profil").select("*").maybeSingle(),
      supabase
        .from("experiences")
        .select(
          `id, entreprise, ville, pays, date_debut, date_fin, type_contrat,
           secteur_code, ordre, duree_mois_forcee,
           visible_cdg, visible_compta, titre_cdg, titre_compta,
           missions ( id, texte_source, activites_codes, contient_chiffre,
                      ordre, actif, pertinence_cdg, pertinence_compta,
                      mission_formulations ( id, texte, origine, validee, volet ) )`
        )
        .order("ordre"),
      supabase
        .from("competences")
        .select(
          `id, libelle, categorie, precision, ordre, niveau, origine,
           visible_cdg, visible_compta,
           competence_liens ( experience_id )`
        )
        .order("ordre"),
      supabase.from("formations").select("*").order("ordre"),
      supabase.from("langues").select("*").order("ordre"),
      supabase.from("interets").select("*").order("ordre"),
      supabase
        .from("accroches")
        .select("*")
        .eq("volet", volet)
        .eq("validee", true)
        .is("offre_id", null)
        .maybeSingle(),
    ]);

  const experiences: Experience[] = (exps.data ?? [])
    .filter((e: Record<string, unknown>) => e[champVisible] === true)
    .map((e: Record<string, unknown>) => {
      const missionsBrutes = (e.missions as Record<string, unknown>[]) ?? [];
      const missions: Mission[] = missionsBrutes
        .filter((m) => m.actif !== false)
        .map((m) => {
          const fs =
            (m.mission_formulations as Record<string, unknown>[] | null) ?? [];
          const f = fs.find((x) => x.volet === volet);
          return {
            id: m.id as string,
            texte_source: m.texte_source as string,
            activites_codes: (m.activites_codes as string[]) ?? [],
            contient_chiffre: m.contient_chiffre as boolean,
            pertinence: (m[champPertinence] as number) ?? 0,
            ordre: (m.ordre as number) ?? 0,
            formulation: f
              ? {
                  id: f.id as string,
                  texte: f.texte as string,
                  origine: f.origine as string,
                  validee: f.validee as boolean,
                }
              : null,
          };
        })
        .filter((m) => m.formulation !== null)
        .sort((a, b) => a.ordre - b.ordre);

      return {
        id: e.id as string,
        entreprise: e.entreprise as string,
        ville: e.ville as string | null,
        pays: e.pays as string | null,
        date_debut: e.date_debut as string,
        date_fin: e.date_fin as string | null,
        type_contrat: e.type_contrat as string,
        secteur_code: e.secteur_code as string | null,
        titre: e[champTitre] as string | null,
        visible: true,
        duree_mois_forcee: e.duree_mois_forcee as number | null,
        ordre: (e.ordre as number) ?? 0,
        missions,
      };
    });

  const competences: Competence[] = (comps.data ?? [])
    .filter((c: Record<string, unknown>) => c[champVisible] === true)
    .map((c: Record<string, unknown>) => ({
      id: c.id as string,
      libelle: c.libelle as string,
      categorie: c.categorie as string,
      precision: c.precision as string | null,
      visible: true,
      ordre: (c.ordre as number) ?? 0,
      nb_liens: ((c.competence_liens as unknown[]) ?? []).length,
      niveau: (c.niveau as number) ?? 0,
      origine: (c.origine as string | null) ?? null,
    }));

  return {
    profil: (profil.data as Profil | null) ?? null,
    experiences,
    competences,
    formations: (forms.data ?? []).filter(
      (f: Record<string, unknown>) => f[champVisible] === true
    ),
    langues: langues.data ?? [],
    interets: interets.data ?? [],
    accroche: (accroche.data as { id: string; texte: string } | null) ?? null,
    ancienneteMois: experiences.reduce((total, e) => {
      const coef = e.type_contrat === "stage" ? 0.5 : 1;
      return total + dureeMois(e) * coef;
    }, 0),
  };
}
