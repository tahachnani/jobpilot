/**
 * Dates en toutes lettres.
 *
 * Décision de la spécification : `Septembre 2024 – Août 2025` plutôt que
 * `2024-09`. Les analyseurs de CV français reconnaissent mal le format ISO
 * dans un corps de texte, et le lecteur humain le lit encore plus mal.
 */

const MOIS = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];

/** « Septembre 2024 » à partir d'une date ISO. Chaîne vide si illisible. */
export function moisAnnee(iso: string | null): string {
  if (!iso) return "";
  const [a, m] = iso.split("-");
  const index = Number(m) - 1;
  if (!a || index < 0 || index > 11) return a ?? "";
  return `${MOIS[index]} ${a}`;
}

/**
 * « Septembre 2024 – Août 2025 », ou « Janvier 2026 – Aujourd'hui » si le
 * poste est en cours.
 */
export function periodeLettres(
  debut: string | null,
  fin: string | null
): string {
  const d = moisAnnee(debut);
  const f = fin ? moisAnnee(fin) : "Aujourd'hui";
  if (!d) return f;
  return `${d} – ${f}`;
}

/** Mois et année d'une date ISO, sous forme de couple. */
function partie(iso: string): { mois: number; annee: string } {
  const [a, m] = iso.split("-");
  return { mois: Number(m), annee: a ?? "" };
}

/**
 * Forme resserrée d'une période, pour les expériences qui en comptent
 * plusieurs : « Juin 2019 » quand elle tient dans un mois, « Juin – Août 2022 »
 * quand elle tient dans une année. Répéter l'année trois fois de suite sur une
 * même ligne la rendrait illisible.
 */
function periodeResserree(debut: string, fin: string | null): string {
  if (!fin) return `${moisAnnee(debut)} – Aujourd'hui`;
  const d = partie(debut);
  const f = partie(fin);
  if (d.annee !== f.annee) return periodeLettres(debut, fin);
  if (d.mois === f.mois) return moisAnnee(debut);
  return `${moisAnnee(debut).split(" ")[0]} – ${moisAnnee(fin)}`;
}

/**
 * Période affichée d'une expérience.
 *
 * Quand l'expérience regroupe plusieurs séjours qui ne se suivent pas — les
 * cabinets d'expertise comptable, juin 2019 puis juin-août 2022 — chacun est
 * affiché tel quel plutôt que fondu en un intervalle de trois ans qui n'a
 * jamais existé.
 */
export function periodeExperience(
  dateDebut: string,
  dateFin: string | null,
  periodes: { dateDebut: string; dateFin: string | null }[] | null | undefined
): string {
  const liste = periodes ?? [];
  if (liste.length === 0) return periodeLettres(dateDebut, dateFin);
  if (liste.length === 1)
    return periodeLettres(liste[0].dateDebut, liste[0].dateFin);
  return liste
    .map((p) => periodeResserree(p.dateDebut, p.dateFin))
    .join("  &  ");
}
