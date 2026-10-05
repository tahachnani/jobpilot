import { mentionMobilite, zoneDeLOffre } from "@/config/mobilite";
import type { OffreExtraite } from "@/lib/extraction-offre";

/**
 * La localisation imprimée sur la ligne de contact du CV (D122).
 *
 * Le profil portait « Île-de-France, France ». Une région est floue là où les
 * analyseurs de CV cherchent une commune et un département : sur les quarante
 * offres franciliennes, c'était un handicap gratuit. Il porte désormais
 * « Saint-Denis (93) », qui se lit « il est sur place » sans rien inventer.
 *
 * Pour les offres lointaines, la tentation était d'écrire la ville de
 * l'annonce. Trois raisons de ne pas le faire, et aucune n'est morale.
 * Le tri géographique se joue en amont, sur la fiche candidat de la
 * plateforme : quand le recruteur ouvre le PDF, le filtre est déjà passé, donc
 * la ville sur le document ne fait franchir aucune barrière. Dans le 93, la
 * vérité est déjà la meilleure réponse — écrire la commune de l'offre
 * n'ajoute rien à « il peut venir tous les jours », qui est déjà acquis.
 * Et hors Île-de-France, le CV se contredirait tout seul : sept lignes au Mans
 * et à Fès, plus un lien LinkedIn francilien sur cette même ligne de contact.
 *
 * Ce qui marche à la place, c'est de nommer la mobilité. « Saint-Denis (93) —
 * mobile Lyon » répond à la seule question que le recruteur lyonnais se pose,
 * et il peut la croire.
 */
export function ligneLieu(
  localisationProfil: string | null | undefined,
  offre: Pick<OffreExtraite, "localisation" | "departement"> | null,
  mentionManuelle?: string | null
): string {
  const base = (localisationProfil ?? "").trim();

  const saisie = (mentionManuelle ?? "").trim();
  if (saisie) return base ? `${base} — ${saisie}` : saisie;

  if (!offre) return base;

  const mention = mentionMobilite(
    zoneDeLOffre(offre.localisation, offre.departement)
  );
  if (!mention) return base;

  return base ? `${base} — ${mention}` : mention;
}
