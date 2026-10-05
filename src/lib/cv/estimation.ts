import type { CodeVolet } from "@/config/volets";
import type { OffreExtraite } from "@/lib/extraction-offre";
import { chargerDonneesCV } from "@/lib/cv/donnees";
import { chargerCorpus } from "@/lib/cv/corpus";
import { choisirNiveau } from "@/lib/cv/compacite";
import { modeleEnTexte } from "@/lib/cv/modele";
import { potentielAdaptation, type Potentiel } from "@/lib/cv/ecart";
import { chargerTaxonomie } from "@/lib/taxonomie";

/**
 * L'indice d'adaptation, calculé dès l'analyse (D98).
 *
 * Constat du 1er octobre : « est-ce que le message d'adapter ou pas peut
 * s'afficher dès l'analyse de l'offre, pas suite à la génération du premier
 * CV ? ». La demande est juste, et le fait qu'elle n'ait pas été satisfaite
 * plus tôt vient d'un accident d'implémentation : l'indice était calculé au
 * moment où l'on composait le document, simplement parce que c'est là qu'on
 * avait la sélection sous la main. Rien ne l'obligeait à attendre.
 *
 * Ce calcul est **gratuit et sans appel IA** : la sélection est arithmétique,
 * `choisirNiveau` estime la hauteur par comptage de caractères et ne compose
 * aucun PDF. C'est exactement le premier essai que ferait la génération, donc
 * la même sélection et le même texte — pas une approximation d'un autre
 * algorithme.
 *
 * Une seule réserve, et elle est honnête : si le CV composé déborde sur deux
 * pages, la génération descendra d'un cran et retirera des missions. L'indice
 * réel sera alors un peu plus élevé que l'estimation, jamais plus bas. Se
 * tromper dans ce sens est le bon sens : l'indice sert à décider s'il faut
 * **payer** une reformulation, et une estimation prudente ne pousse jamais à
 * la dépense.
 */
export async function estimerPotentiel(
  volet: CodeVolet,
  offreId: string,
  analyse: OffreExtraite
): Promise<Potentiel | null> {
  const donnees = await chargerDonneesCV(volet, offreId);
  if (donnees.experiences.length === 0) return null;

  const corpusParExperience = await chargerCorpus();
  const parcours = {
    corpus: donnees.experiences.flatMap((e) =>
      (corpusParExperience.get(e.id) ?? []).map((l) => l.texte)
    ),
    missions: donnees.experiences.flatMap((e) => e.missions.map((m) => m.texte)),
    competences: donnees.competences.map(
      (c) => `${c.libelle} ${c.precision ?? ""}`
    ),
    formations: donnees.formations.map((f) => f.diplome),
  };

  const taxonomie = await chargerTaxonomie();
  const metiers = Object.values(taxonomie).map((a) => a.libelle);

  const { selection, modele } = choisirNiveau(donnees, analyse, volet);

  return potentielAdaptation(
    analyse,
    selection,
    parcours,
    modeleEnTexte(modele),
    metiers
  );
}
