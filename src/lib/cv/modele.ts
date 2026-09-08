import { VOLETS, type CodeVolet } from "@/config/volets";
import { LIBELLES_CONTRAT } from "@/config/activites";
import { periodeExperience, periodeLettres } from "@/lib/cv/dates";
import type { DonneesCV } from "@/lib/cv/donnees";
import type { Selection } from "@/lib/cv/selection";

/**
 * Le modèle plat du CV.
 *
 * Tout est déjà mis en forme : dates en toutes lettres, libellés de contrat,
 * lignes de compétences. Le composant React-PDF ne fait plus que poser du
 * texte. C'est aussi cette structure qui est stockée dans `documents.selection`,
 * ce qui permet de rejouer un rendu identique sans dépendre de l'état de la
 * base au moment où l'on rouvre le CV.
 */

export interface MissionModele {
  texte: string;
  /** Traçabilité interne. Rien ne la distingue à l'écran ni sur le PDF. */
  empruntee: boolean;
  /** Note de sélection, conservée pour pouvoir expliquer le choix. */
  note: number;
}

export interface ExperienceModele {
  poste: string;
  periode: string;
  contrat: string;
  employeur: string;
  missions: MissionModele[];
}

export interface ModeleCV {
  nomComplet: string;
  titre: string;
  contact: string;
  accroche: string | null;
  experiences: ExperienceModele[];
  formations: { diplome: string; periode: string; etablissement: string }[];
  competences: string[];
  langues: string[];
  interets: string | null;
  /** Renseignements de génération, hors rendu. */
  meta: {
    volet: CodeVolet;
    niveau: number;
    niveauLibelle: string;
    nbEmprunts: number;
    genereLe: string;
  };
}

function nettoyer(parties: (string | null | undefined)[], separateur: string) {
  return parties
    .map((p) => (p ?? "").trim())
    .filter((p) => p.length > 0)
    .join(separateur);
}

/**
 * « Français – DALF C1 », « Anglais – Opérationnel (B2), TOEIC 825/990 ».
 * La certification est séparée par une virgule et non mise entre parenthèses :
 * le niveau en contient parfois déjà, et les parenthèses s'imbriquaient.
 */
function ligneLangue(l: {
  langue: string;
  niveau: string | null;
  certification: string | null;
}): string {
  const suite = nettoyer([l.niveau, l.certification], ", ");
  return suite ? `${l.langue} – ${suite}` : l.langue;
}

/** « Excel (niveau avancé) : TCD, RECHERCHEV » si une précision existe. */
function ligneCompetence(c: { libelle: string; precision: string | null }) {
  return c.precision ? `${c.libelle} : ${c.precision}` : c.libelle;
}

export function construireModele(
  donnees: DonneesCV,
  selection: Selection,
  volet: CodeVolet
): ModeleCV {
  const p = donnees.profil;

  return {
    nomComplet: nettoyer([p?.prenom, p?.nom], " ").toUpperCase(),
    // Le titre reste propre au volet : c'est le poste visé, pas l'intitulé
    // recopié de l'offre.
    titre: VOLETS[volet].intitulesCibles[0].toUpperCase(),
    contact: nettoyer(
      [p?.email, p?.telephone, p?.localisation, p?.linkedin, p?.permis],
      "  |  "
    ),
    accroche: donnees.accroche,

    experiences: selection.experiences
      .filter((e) => e.missions.length > 0)
      .map(({ experience, missions }) => ({
        poste: experience.titre ?? "",
        periode: periodeExperience(
          experience.dateDebut,
          experience.dateFin,
          experience.periodes
        ),
        contrat:
          LIBELLES_CONTRAT[experience.typeContrat] ?? experience.typeContrat,
        employeur: nettoyer(
          [experience.entreprise, experience.ville, experience.pays],
          "  |  "
        ),
        missions: missions.map((m) => ({
          texte: m.texte,
          empruntee: m.empruntee,
          note: m.note,
        })),
      })),

    formations: donnees.formations.map((f) => ({
      diplome: f.diplome,
      periode: periodeLettres(f.dateDebut, f.dateFin),
      etablissement: nettoyer([f.etablissement, f.ville], "  |  "),
    })),

    competences: selection.competences.map(ligneCompetence),
    langues: donnees.langues.map(ligneLangue),
    interets: donnees.interets.length
      ? donnees.interets.join("  |  ")
      : null,

    meta: {
      volet,
      niveau: selection.niveau.niveau,
      niveauLibelle: selection.niveau.libelle,
      nbEmprunts: selection.nbEmprunts,
      genereLe: new Date().toISOString(),
    },
  };
}

/**
 * Version texte du CV.
 *
 * Stockée dans `documents.contenu_texte` : elle sert de référence lisible pour
 * le contrôle d'invention, et alimentera la lettre de motivation à l'étape 5
 * sans avoir à rouvrir le PDF.
 */
export function modeleEnTexte(m: ModeleCV): string {
  const lignes: string[] = [m.nomComplet, m.titre, m.contact, ""];

  if (m.accroche) lignes.push("PROFIL", m.accroche, "");

  lignes.push("EXPÉRIENCES PROFESSIONNELLES");
  for (const e of m.experiences) {
    lignes.push(`${e.poste} — ${e.periode} · ${e.contrat}`);
    lignes.push(e.employeur);
    for (const mi of e.missions) lignes.push(`• ${mi.texte}`);
    lignes.push("");
  }

  lignes.push("FORMATIONS");
  for (const f of m.formations) {
    lignes.push(`${f.diplome} — ${f.periode}`);
    if (f.etablissement) lignes.push(f.etablissement);
  }
  lignes.push("");

  lignes.push("COMPÉTENCES");
  for (const c of m.competences) lignes.push(`• ${c}`);
  lignes.push("");

  lignes.push("LANGUES");
  for (const l of m.langues) lignes.push(`• ${l}`);

  if (m.interets) lignes.push("", "CENTRES D'INTÉRÊT", m.interets);

  return lignes.join("\n");
}
