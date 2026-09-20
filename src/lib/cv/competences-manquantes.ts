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

/**
 * Met un libellé d'annonce en état de figurer sur un CV.
 *
 * Les offres écrivent « logiciels comptabilité », « maîtrise d'Excel »,
 * « connaissance des normes IFRS ». Repris tels quels, ces libellés font
 * négligés entre deux lignes soignées. On retire les tournures d'annonce et on
 * capitalise — sans toucher aux sigles, qui restent en majuscules.
 */
export function nettoyerLibelle(brut: string): string {
  let t = brut.trim().replace(/\s+/g, " ");

  t = t.replace(
    /^(bonne\s+|solide\s+|très\s+bonne\s+|forte\s+|réelle\s+)?(maitrise|maîtrise|connaissance|connaissances|pratique|usage|utilisation|interet|intérêt|appetence|appétence|gout|goût|sens|capacite|capacité|aisance)\s*(pour\s+les\s+|pour\s+la\s+|pour\s+le\s+|pour\s+l'|pour\s+|d'|de\s+la\s+|de\s+l'|des\s+|du\s+|de\s+|en\s+|sur\s+|à\s+|a\s+)?/i,
    ""
  );
  t = t.replace(/\s*\(.*?\)\s*$/, "");
  t = t.replace(/[.,;:]+$/, "");

  if (!t) return brut.trim();

  // Un sigle reste un sigle ; le reste prend une majuscule initiale.
  const premier = t.split(" ")[0];
  const estSigle = premier === premier.toUpperCase() && /\p{Lu}/u.test(premier);
  if (!estSigle) t = t.charAt(0).toUpperCase() + t.slice(1);

  return t;
}

/**
 * Découpe un libellé qui en contient plusieurs.
 *
 * Les annonces écrivent « Élaboration et analyse des tableaux de bord /
 * reporting » : trois compétences en une. Proposées telles quelles, elles
 * entraient dans la base comme une ligne bâtarde qu'aucun CV ne pouvait
 * reprendre.
 */
export function decouperLibelle(brut: string): string[] {
  return brut
    .split(/\s*\/\s*|\s*,\s*|\s+;\s*/)
    .map((p) => nettoyerLibelle(p))
    .filter((p) => p.length >= 3);
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
 * Le détail de la couverture, pour pouvoir l'afficher sans mentir.
 *
 * Un écran qui annonçait « tout est déjà dans ta base » alors que le détail du
 * score affichait « Polyvalence — absente de ta base » se contredisait
 * lui-même. Les deux disaient vrai : la compétence est bien absente, mais elle
 * est écartée ici comme trop générique pour valoir une ligne de CV. Les trois
 * listes sont donc distinguées.
 */
export interface Couverture {
  manquantes: CompetenceManquante[];
  /** Déjà dans la base, sous ce libellé ou un autre. */
  connues: string[];
  /** Écartées comme trop courtes, trop longues ou purement comportementales. */
  ignorees: string[];
}

export async function detailCouverture(
  offre: OffreExtraite,
  volet: string
): Promise<Couverture> {
  const supabase = creerClientServeur();

  const [{ data }, { data: langues }] = await Promise.all([
    supabase.from("competences").select("libelle, code_normalise"),
    supabase.from("langues").select("langue, niveau, certification"),
  ]);

  // Les langues vivent dans leur propre table : sans elles, « anglais
  // opérationnel » était signalé absent d'un profil qui porte un TOEIC B2.
  const connues = [
    ...((data ?? []) as { libelle: string; code_normalise: string }[]).flatMap(
      (c) => [c.libelle, c.code_normalise]
    ),
    ...((langues ?? []) as {
      langue: string;
      niveau: string | null;
      certification: string | null;
    }[]).flatMap((l) => [l.langue, l.niveau ?? "", l.certification ?? ""]),
  ].filter(Boolean);

  const estConnue = (libelle: string) =>
    connues.some((c) => correspond(c, libelle));

  const familleDuVolet = volet === "cdg" ? "cdg" : "compta";
  const candidates: CompetenceManquante[] = [];

  for (const c of offre.competences) {
    for (const libelle of decouperLibelle(c.libelle)) {
      candidates.push({
        libelle,
        origine: c.caractere === "indispensable" ? "indispensable" : "souhaitee",
        categorieSuggeree: familleDuVolet,
      });
    }
  }
  for (const o of offre.outils) {
    candidates.push({
      libelle: nettoyerLibelle(o),
      origine: "outil",
      categorieSuggeree: "outil",
    });
  }

  const vues = new Set<string>();
  const manquantes: CompetenceManquante[] = [];
  const connues: string[] = [];
  const ignorees: string[] = [];

  for (const c of candidates) {
    const cle = c.libelle.toLowerCase().trim();
    if (vues.has(cle)) continue;
    vues.add(cle);

    if (!digneDInteret(c.libelle)) ignorees.push(c.libelle);
    else if (estConnue(c.libelle)) connues.push(c.libelle);
    else manquantes.push(c);
  }

  return { manquantes, connues, ignorees };
}

/**
 * Ce que l'offre réclame et que la base ne connaît pas.
 *
 * Façade conservée telle quelle : elle ne rend que les manquantes, comme
 * avant, et reste le point d'entrée des écrans qui n'ont besoin que de
 * celles-là.
 */
export async function competencesManquantes(
  offre: OffreExtraite,
  volet: string
): Promise<CompetenceManquante[]> {
  return (await detailCouverture(offre, volet)).manquantes;
}
