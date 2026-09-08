import { creerClientServeur } from "@/lib/supabase/server";
import type { CodeVolet } from "@/config/volets";
import {
  calculerScore,
  type Bareme,
  type ProfilPourScoring,
} from "@/lib/scoring";
import type { OffreExtraite } from "@/lib/extraction-offre";

/**
 * Charge le barème depuis `parametres`, avec des valeurs de repli si la ligne
 * a disparu : un score doit toujours pouvoir être calculé.
 */
export async function chargerBareme(volet: CodeVolet): Promise<Bareme> {
  const supabase = creerClientServeur();
  const { data } = await supabase
    .from("parametres")
    .select("cle, valeur")
    .in("cle", ["bareme", "coefficients_anciennete"]);

  const lignes = (data ?? []) as { cle: string; valeur: Record<string, unknown> }[];
  const b = lignes.find((l) => l.cle === "bareme")?.valeur ?? {};
  const c = lignes.find((l) => l.cle === "coefficients_anciennete")?.valeur ?? {};

  const poidsVolet = (b[volet] as Record<string, number>) ?? {
    missions: 35,
    competences: 30,
    experience: 20,
    secteur: 15,
  };

  return {
    version: String(b.version ?? "1"),
    poids: {
      missions: poidsVolet.missions ?? 35,
      competences: poidsVolet.competences ?? 30,
      experience: poidsVolet.experience ?? 20,
      secteur: poidsVolet.secteur ?? 15,
    },
    plafondEcartBloquant: Number(b.plafond_ecart_bloquant ?? 79),
    coefficients: (c as Record<string, number>) ?? {},
  };
}

/**
 * Charge le parcours entier pour le scoring, sans filtrer sur la visibilité.
 *
 * Décision : le volet définit le poste visé, pas le périmètre de ce que le
 * candidat sait faire. Une offre de contrôle de gestion qui réclame des
 * clôtures doit pouvoir s'appuyer sur l'expérience comptable.
 *
 * La pertinence, elle, reste fidèle à la notation : on lit celle du volet
 * analysé quand l'expérience y est visible, sinon celle du volet où elle
 * l'est. Une mission jugée marginale en CDG le reste, même si elle est
 * notée haute en comptabilité.
 *
 * Les drapeaux `visible_*` gardent leur rôle d'origine : ils pilotent
 * l'affichage du profil et le contenu des CV, pas le calcul.
 */
export async function chargerProfil(
  volet: CodeVolet
): Promise<ProfilPourScoring> {
  const supabase = creerClientServeur();
  const champVisible = volet === "cdg" ? "visible_cdg" : "visible_compta";
  const champPertinence =
    volet === "cdg" ? "pertinence_cdg" : "pertinence_compta";
  const champPertinenceAutre =
    volet === "cdg" ? "pertinence_compta" : "pertinence_cdg";

  const [exps, comps] = await Promise.all([
    supabase
      .from("experiences")
      .select(
        `id, date_debut, date_fin, duree_mois_forcee, type_contrat, secteur_code,
         visible_cdg, visible_compta,
         missions ( activites_codes, texte_source, actif, pertinence_cdg, pertinence_compta )`
      ),
    supabase
      .from("competences")
      .select("libelle, code_normalise, niveau, categorie"),
  ]);

  const experiences = (exps.data ?? []) as Record<string, unknown>[];

  const missions: ProfilPourScoring["missions"] = [];
  for (const e of experiences) {
    const visibleIci = e[champVisible] === true;
    for (const m of ((e.missions as Record<string, unknown>[]) ?? []).filter(
      (m) => m.actif !== false
    )) {
      const brute = visibleIci
        ? m[champPertinence]
        : m[champPertinenceAutre];
      missions.push({
        codes: (m.activites_codes as string[]) ?? [],
        pertinence: (brute as number) ?? 0,
        texte: (m.texte_source as string) ?? "",
      });
    }
  }

  const competences = ((comps.data ?? []) as Record<string, unknown>[]).map(
    (c) => ({
      libelle: c.libelle as string,
      codeNormalise: c.code_normalise as string,
      niveau: (c.niveau as number) ?? 0,
      categorie: (c.categorie as string) ?? "transversale",
    })
  );

  return {
    missions,
    competences,
    experiences: experiences.map((e) => ({
      date_debut: e.date_debut as string,
      date_fin: e.date_fin as string | null,
      duree_mois_forcee: (e.duree_mois_forcee as number | null) ?? null,
      type_contrat: e.type_contrat as string,
      secteur_code: (e.secteur_code as string | null) ?? null,
    })),
  };
}

/**
 * Calcule le score d'une offre à partir d'une analyse déjà stockée et
 * l'enregistre. Aucun appel IA : c'est ce qui rend le recalcul gratuit.
 */
export async function enregistrerScore(options: {
  offreId: string;
  analyseId: string | null;
  volet: CodeVolet;
  donnees: OffreExtraite;
}) {
  const supabase = creerClientServeur();

  const [profil, bareme] = await Promise.all([
    chargerProfil(options.volet),
    chargerBareme(options.volet),
  ]);

  const score = calculerScore(options.donnees, profil, options.volet, bareme);

  // Un seul score courant par offre : on remplace au lieu d'empiler.
  await supabase.from("scores").delete().eq("offre_id", options.offreId);

  await supabase.from("scores").insert({
    offre_id: options.offreId,
    analyse_id: options.analyseId,
    score_global: score.global,
    score_missions: score.missions.note,
    score_competences: score.competences.note,
    score_experience: score.experience.note,
    score_secteur: score.secteur.note,
    plafonne: score.plafonne,
    detail: score as unknown as Record<string, unknown>,
    version_bareme: score.versionBareme,
  });

  return score;
}
