import { creerClientServeur } from "@/lib/supabase/server";
import type { CodeVolet } from "@/config/volets";

/**
 * Chargement de la base professionnelle en vue d'un CV.
 *
 * Différence avec `chargerBasePro` : on ne jette pas les missions dépourvues
 * de formulation dans le volet. Une mission qui n'existe que dans l'autre
 * volet devient une **candidate à l'emprunt**, que le sélectionneur retiendra
 * ou non selon ce que l'offre réclame. Les expériences, elles, restent filtrées
 * par la visibilité du volet : l'emprunt porte sur des missions, pas sur des
 * postes entiers.
 */

export interface MissionCV {
  id: string;
  experienceId: string;
  /** Formulation retenue, telle que stockée. Jamais `texte_source`. */
  texte: string;
  /** Volet d'où provient la formulation. */
  voletFormulation: CodeVolet;
  /** Vraie si la formulation vient de l'autre volet. */
  empruntee: boolean;
  codes: string[];
  contientChiffre: boolean;
  pertinence: number;
  ordre: number;
}

/** Une période travaillée. Une expérience en compte une, parfois plusieurs. */
export interface PeriodeCV {
  dateDebut: string;
  dateFin: string | null;
}

export interface ExperienceCV {
  id: string;
  entreprise: string;
  ville: string | null;
  pays: string | null;
  dateDebut: string;
  dateFin: string | null;
  /**
   * Périodes réelles, quand l'expérience en regroupe plusieurs qui ne se
   * suivent pas. Vide dans le cas courant : la période est alors
   * `dateDebut → dateFin`.
   */
  periodes: PeriodeCV[];
  typeContrat: string;
  titre: string | null;
  ordre: number;
  /** Toutes les candidates : natives et empruntables mêlées. */
  missions: MissionCV[];
}

export interface CompetenceCV {
  id: string;
  libelle: string;
  codeNormalise: string;
  /** 'outil' | 'cdg' | 'compta' | 'transversale' | 'langue'. */
  categorie: string;
  precision: string | null;
  niveau: number;
  ordre: number;
}

export interface FormationCV {
  diplome: string;
  etablissement: string | null;
  ville: string | null;
  dateDebut: string | null;
  dateFin: string | null;
}

export interface LangueCV {
  langue: string;
  niveau: string | null;
  certification: string | null;
}

export interface DonneesCV {
  profil: {
    nom: string | null;
    prenom: string | null;
    email: string | null;
    telephone: string | null;
    localisation: string | null;
    linkedin: string | null;
    permis: string | null;
  } | null;
  experiences: ExperienceCV[];
  competences: CompetenceCV[];
  formations: FormationCV[];
  langues: LangueCV[];
  interets: string[];
  accroche: string | null;
}

type Ligne = Record<string, unknown>;

/**
 * Choisit la formulation d'un volet parmi celles stockées.
 *
 * On écarte les formulations rattachées à une offre : ce sont des variantes
 * ponctuelles, pas la formulation de référence du volet. Une formulation
 * validée l'emporte sur une non validée.
 */
function formulationDuVolet(
  formulations: Ligne[],
  volet: CodeVolet
): { texte: string } | null {
  const candidates = formulations
    .filter((f) => f.volet === volet && !f.offre_id)
    .sort((a, b) => Number(b.validee === true) - Number(a.validee === true));
  const retenue = candidates[0];
  if (!retenue) return null;
  const texte = String(retenue.texte ?? "").trim();
  return texte ? { texte } : null;
}

export async function chargerDonneesCV(volet: CodeVolet): Promise<DonneesCV> {
  const supabase = creerClientServeur();
  const autre: CodeVolet = volet === "cdg" ? "compta" : "cdg";
  const champVisible = volet === "cdg" ? "visible_cdg" : "visible_compta";
  const champTitre = volet === "cdg" ? "titre_cdg" : "titre_compta";
  const champPertinence =
    volet === "cdg" ? "pertinence_cdg" : "pertinence_compta";
  const champPertinenceAutre =
    volet === "cdg" ? "pertinence_compta" : "pertinence_cdg";

  const [profil, exps, comps, forms, langues, interets, accroche] =
    await Promise.all([
      supabase.from("profil").select("*").maybeSingle(),
      supabase
        .from("experiences")
        .select(
          `id, entreprise, ville, pays, date_debut, date_fin, type_contrat,
           ordre, visible_cdg, visible_compta, titre_cdg, titre_compta,
           experience_periodes ( date_debut, date_fin, ordre ),
           missions ( id, activites_codes, contient_chiffre, ordre, actif,
                      pertinence_cdg, pertinence_compta,
                      mission_formulations ( id, texte, volet, validee, offre_id ) )`
        )
        .order("ordre"),
      supabase
        .from("competences")
        .select(
          `id, libelle, code_normalise, categorie, precision, niveau, ordre,
           visible_cdg, visible_compta`
        )
        .order("ordre"),
      supabase.from("formations").select("*").order("ordre"),
      supabase.from("langues").select("*").order("ordre"),
      supabase.from("interets").select("*").order("ordre"),
      supabase
        .from("accroches")
        .select("texte")
        .eq("volet", volet)
        .eq("validee", true)
        .is("offre_id", null)
        .maybeSingle(),
    ]);

  const experiences: ExperienceCV[] = ((exps.data ?? []) as Ligne[])
    .filter((e) => e[champVisible] === true)
    .map((e) => {
      const missions: MissionCV[] = ((e.missions as Ligne[]) ?? [])
        .filter((m) => m.actif !== false)
        .map((m) => {
          const fs = (m.mission_formulations as Ligne[]) ?? [];
          const native = formulationDuVolet(fs, volet);
          const empruntable = native ? null : formulationDuVolet(fs, autre);
          const retenue = native ?? empruntable;
          if (!retenue) return null;

          const empruntee = native === null;
          return {
            id: m.id as string,
            experienceId: e.id as string,
            texte: retenue.texte,
            voletFormulation: empruntee ? autre : volet,
            empruntee,
            codes: (m.activites_codes as string[]) ?? [],
            contientChiffre: m.contient_chiffre === true,
            // La pertinence suit la formulation retenue : une mission
            // empruntée est jugée avec la note du volet d'où elle vient.
            pertinence:
              ((empruntee
                ? m[champPertinenceAutre]
                : m[champPertinence]) as number) ?? 0,
            ordre: (m.ordre as number) ?? 0,
          } satisfies MissionCV;
        })
        .filter((m): m is MissionCV => m !== null)
        .sort((a, b) => a.ordre - b.ordre);

      return {
        id: e.id as string,
        entreprise: e.entreprise as string,
        ville: (e.ville as string | null) ?? null,
        pays: (e.pays as string | null) ?? null,
        dateDebut: e.date_debut as string,
        dateFin: (e.date_fin as string | null) ?? null,
        periodes: (((e.experience_periodes as Ligne[]) ?? [])
          .slice()
          .sort((a, b) => ((a.ordre as number) ?? 0) - ((b.ordre as number) ?? 0))
          .map((p) => ({
            dateDebut: p.date_debut as string,
            dateFin: (p.date_fin as string | null) ?? null,
          }))) as PeriodeCV[],
        typeContrat: e.type_contrat as string,
        titre: (e[champTitre] as string | null) ?? null,
        ordre: (e.ordre as number) ?? 0,
        missions,
      } satisfies ExperienceCV;
    })
    .sort((a, b) => a.ordre - b.ordre);

  const competences: CompetenceCV[] = ((comps.data ?? []) as Ligne[])
    .filter((c) => c[champVisible] === true)
    .map((c) => ({
      id: c.id as string,
      libelle: c.libelle as string,
      codeNormalise: (c.code_normalise as string) ?? "",
      categorie: (c.categorie as string) ?? "transversale",
      precision: (c.precision as string | null) ?? null,
      niveau: (c.niveau as number) ?? 0,
      ordre: (c.ordre as number) ?? 0,
    }));

  const formations: FormationCV[] = ((forms.data ?? []) as Ligne[])
    .filter((f) => f[champVisible] === true)
    .map((f) => ({
      diplome: f.diplome as string,
      etablissement: (f.etablissement as string | null) ?? null,
      ville: (f.ville as string | null) ?? null,
      dateDebut: (f.date_debut as string | null) ?? null,
      dateFin: (f.date_fin as string | null) ?? null,
    }));

  return {
    profil: (profil.data as DonneesCV["profil"]) ?? null,
    experiences,
    competences,
    formations,
    // Aucun drapeau de visibilité sur `langues` : le CV rend la table telle
    // qu'elle est. Décision de la spécification, migration annulée.
    langues: ((langues.data ?? []) as Ligne[]).map((l) => ({
      langue: l.langue as string,
      niveau: (l.niveau as string | null) ?? null,
      certification: (l.certification as string | null) ?? null,
    })),
    interets: ((interets.data ?? []) as Ligne[]).map((i) => i.libelle as string),
    accroche: (accroche.data as { texte: string } | null)?.texte ?? null,
  };
}
