import { randomUUID } from "crypto";
import { creerClientServeur } from "@/lib/supabase/server";
import type { CodeVolet } from "@/config/volets";
import type { OffreExtraite } from "@/lib/extraction-offre";
import { chargerDonneesCV } from "@/lib/cv/donnees";
import {
  NIVEAUX,
  nombreDeMissions,
  prochaineAGarnir,
  selectionner,
  type Selection,
} from "@/lib/cv/selection";
import { choisirNiveau } from "@/lib/cv/compacite";
import { construireModele, modeleEnTexte, type ModeleCV } from "@/lib/cv/modele";
import { estimerHauteur } from "@/lib/cv/encombrement";
import { comparerAuReference, potentielAdaptation } from "@/lib/cv/ecart";
import { chargerCorpus } from "@/lib/cv/corpus";
import { compterPages, rendreModele } from "@/lib/cv/rendu";
import { purgerAnciennesVersions, SCHEMA_SELECTION } from "@/lib/documents";
import { chargerTaxonomie } from "@/lib/taxonomie";
import { titreCV } from "@/lib/cv/titre";
import { ligneLieu } from "@/lib/cv/lieu";

export class ErreurCV extends Error {}

/**
 * Plafond d'ajouts du garnissage (D120).
 *
 * Chaque ajout coûte une composition PDF. Six suffisent à remplir la page
 * depuis n'importe quel cran, et bornent le temps de génération.
 */
const MAX_AJOUTS_GARNISSAGE = 6;

export interface CVGenere {
  documentId: string;
  version: number;
  modele: ModeleCV;
  pages: number;
  stocke: boolean;
}

/**
 * Génère le CV d'une offre et l'enregistre comme une nouvelle version.
 *
 * Aucun appel IA : la sélection est arithmétique, les textes sont ceux déjà
 * stockés dans `mission_formulations`. Une génération ne coûte donc rien et
 * peut être rejouée autant de fois qu'on veut.
 */
export async function genererCVPourOffre(offreId: string): Promise<CVGenere> {
  const supabase = creerClientServeur();

  const { data: offreBrute } = await supabase
    .from("offres")
    .select("id, volet, intitule, entreprise, intitule_cv, mention_lieu")
    .eq("id", offreId)
    .maybeSingle();

  if (!offreBrute) throw new ErreurCV("Offre introuvable.");
  const offre = offreBrute as {
    id: string;
    volet: CodeVolet;
    intitule: string | null;
    entreprise: string | null;
    intitule_cv: string | null;
    mention_lieu: string | null;
  };

  const { data: analyseBrute } = await supabase
    .from("offre_analyses")
    .select("resultat")
    .eq("offre_id", offreId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!analyseBrute) {
    throw new ErreurCV(
      "Cette offre n'a pas d'analyse exploitable. Sans les codes d'activité " +
        "de l'offre, la sélection des missions n'a rien sur quoi s'appuyer."
    );
  }

  const analyse = (analyseBrute as { resultat: OffreExtraite }).resultat;

  // Les formulations validées pour cette offre priment sur les génériques.
  const donnees = await chargerDonneesCV(offre.volet, offreId);

  // Le parcours au sens large : corpus, formations, compétences. C'est lui qui
  // distingue un terme récupérable d'un terme hors de portée.
  const corpusParExperience = await chargerCorpus();
  // Ligne à ligne, et non en un seul bloc : un terme n'est récupérable que si
  // tous ses mots se trouvent dans la même ligne. Éparpillés sur deux entrées
  // sans rapport, ils ne prouvent rien.
  // Les quatre sources restent séparées (D78) : elles n'autorisent pas le même
  // geste, et les fondre en une seule liste faisait annoncer « potentiel fort »
  // pour un terme qu'aucun bouton ne pouvait exploiter.
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

  /**
   * Les métiers du barème (D97).
   *
   * Un terme de l'annonce qui est le libellé d'un code d'activité n'est pas une
   * tâche qu'on ajoute à une ligne : c'est un métier, et le score le mesure
   * déjà. « Comptabilité générale » proposée comme adaptation, alors que
   * plusieurs missions portent `compta_generale`, était le symptôme exact.
   *
   * Toute la taxonomie est passée, y compris les codes inactifs : un code
   * retiré du service reste un métier, et le proposer en reformulation serait
   * aussi absurde qu'avant son retrait.
   */
  const taxonomie = await chargerTaxonomie();
  const metiers = Object.values(taxonomie).map((a) => a.libelle);

  if (donnees.experiences.length === 0) {
    throw new ErreurCV(
      `Aucune expérience n'est visible dans le volet ${offre.volet}. ` +
        "Vérifie les visibilités depuis Mon profil."
    );
  }

  /**
   * L'en-tête adapté à l'offre : le titre (D121) et la localisation (D122).
   *
   * Calculé une fois et passé à chaque recomposition — sinon la descente de
   * cran et le garnissage changeraient d'en-tête en cours de route, et la
   * hauteur estimée ne porterait pas sur le document livré.
   */
  const saisie = { titre: offre.intitule_cv, lieu: offre.mention_lieu };
  const entete = {
    titre: titreCV(offre.volet, analyse, offre.intitule_cv),
    lieu: ligneLieu(donnees.profil?.localisation, analyse, offre.mention_lieu),
  };

  let { selection, modele } = choisirNiveau(
    donnees,
    analyse,
    offre.volet,
    saisie
  );
  let pdf = await rendreModele(modele);
  let pages = compterPages(pdf);

  // L'estimation par comptage de caractères décide du premier essai ; la
  // composition réelle a le dernier mot. Tant qu'elle rend deux pages, on
  // descend d'un cran. Une page est une contrainte stricte : on ne livre pas
  // un CV qui déborde.
  let index = selection.niveau.niveau;
  while (pages > 1 && index < NIVEAUX.length - 1) {
    index += 1;
    selection = selectionner(donnees, analyse, NIVEAUX[index]);
    modele = construireModele(donnees, selection, offre.volet, entete);
    pdf = await rendreModele(modele);
    pages = compterPages(pdf);
  }

  /**
   * Garnissage : on rend la place qui reste (D120).
   *
   * Constat du 4 octobre, CV compta pour un cabinet. Le CV est sorti au cran 4
   * — 3/3/2/2 missions, huit compétences — avec **trente-sept points de blanc
   * en bas de page**, soit trois puces. Le cran au-dessus en ajoute trois
   * d'un coup *et* une compétence, environ quarante-huit points : il ne passe
   * pas. Le code redescendait donc, et le blanc restait.
   *
   * L'échelle n'était pas trop pessimiste, elle était trop grossière : chaque
   * cran déplace quatre choses à la fois. Plutôt que d'inventer des crans
   * intermédiaires — il en faudrait un par combinaison — on part du cran qui
   * tient et on rend les places une par une.
   *
   * C'est la composition réelle qui arbitre, jamais l'estimation : elle a
   * quatorze points de marge de sécurité et six pour cent de perte sur la
   * coupure des mots, et c'est précisément cette prudence qui créait le blanc.
   * Un débordement arrête la passe — la page est pleine, insister coûterait
   * une composition par refus.
   *
   * On repart des suppléments déjà accordés à l'estimation par
   * `choisirNiveau`, et non de zéro : les remettre à plat annulerait le
   * garnissage que l'écran d'offre et la reformulation annoncent déjà. La
   * descente de cran, elle, les a remis à vide — et c'est voulu, puisque la
   * page débordait.
   */
  const supplements = donnees.experiences.map(
    (_, i) => selection.supplements[i] ?? 0
  );
  let ajouts = 0;

  while (pages === 1 && ajouts < MAX_AJOUTS_GARNISSAGE) {
    const cible = prochaineAGarnir(selection);
    if (cible === null) break;

    supplements[cible] += 1;
    // Une copie, pas la référence : `Selection` conserve le tableau, et le
    // muter au tour suivant ferait mentir la trace stockée et la référence de
    // l'écart.
    const essai = selectionner(donnees, analyse, selection.niveau, [
      ...supplements,
    ]);

    // Le plafond d'emprunts peut refuser la place accordée. Sans ce garde-fou,
    // la boucle redemanderait indéfiniment la même expérience.
    if (nombreDeMissions(essai) <= nombreDeMissions(selection)) break;

    const modeleEssai = construireModele(
      donnees,
      essai,
      offre.volet,
      entete
    );
    const pdfEssai = await rendreModele(modeleEssai);
    if (compterPages(pdfEssai) > 1) {
      supplements[cible] -= 1;
      break;
    }

    selection = essai;
    modele = modeleEssai;
    pdf = pdfEssai;
    ajouts += 1;
  }

  if (pages > 1) {
    throw new ErreurCV(
      "Le CV déborde sur une seconde page même au niveau le plus compact " +
        `(${NIVEAUX[index].libelle}). Le contenu fixe est trop long : ` +
        "raccourcis l'accroche du volet, ou une ou deux formulations de " +
        "mission, depuis Mon profil. Aucun CV n'a été enregistré."
    );
  }

  const { data: derniere } = await supabase
    .from("documents")
    .select("version")
    .eq("offre_id", offreId)
    .eq("type", "cv")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const version = ((derniere as { version: number } | null)?.version ?? 0) + 1;
  const documentId = randomUUID();
  const chemin = `cv/${offreId}/${documentId}.pdf`;

  // Le PDF part dans le bucket privé. S'il n'y arrive pas, la génération n'est
  // pas perdue : la sélection stockée permet de recomposer un PDF identique à
  // la demande.
  const { error: erreurStockage } = await supabase.storage
    .from("documents")
    .upload(chemin, pdf, { contentType: "application/pdf", upsert: true });

  // Un échec d'envoi dans le bucket était jusqu'ici avalé en silence : le CV
  // se recomposait à la demande, donc rien ne se voyait — et 54 CV sur 54 se
  // sont retrouvés sans fichier, faute d'une règle d'écriture sur le bucket.
  // Le PDF n'est pas perdu pour autant, mais l'anomalie doit être visible.
  const stocke = !erreurStockage;
  if (erreurStockage) {
    console.error(
      `[cv] envoi du PDF refusé par le stockage (${chemin}) : ${erreurStockage.message}`
    );
  }

  const { error: erreurInsertion } = await supabase.from("documents").insert({
    id: documentId,
    offre_id: offreId,
    type: "cv",
    volet: offre.volet,
    version,
    storage_path: stocke ? chemin : null,
    contenu_texte: modeleEnTexte(modele),
    selection: {
      schema: SCHEMA_SELECTION,
      modele,
      // Calculés ici parce que la composition est gratuite et déterministe :
      // les écrans les relisent au lieu de recharger toute la base.
      ecart: comparerAuReference(donnees, analyse, selection.niveau, selection),
      // Le CV composé fait foi pour « ce qui est déjà dit » (D90) : c'est le
      // texte même qui sera imprimé, titre et accroche compris.
      potentiel: potentielAdaptation(
        analyse,
        selection,
        parcours,
        modeleEnTexte(modele),
        metiers
      ),
      hauteurEstimee: Math.round(estimerHauteur(modele)),
      pages,
      niveau: modele.meta.niveau,
    },
    // `cout_usd` à zéro et `modele` laissé vide : aucune IA n'intervient.
    cout_usd: 0,
  });

  if (erreurInsertion) {
    throw new ErreurCV(
      `Le CV a été composé mais n'a pas pu être enregistré : ${erreurInsertion.message}`
    );
  }

  // Les versions au-delà des trois dernières partent, PDF compris : sans
  // cela, un CV retravaillé dix fois laisse dix fichiers dans le bucket.
  await purgerAnciennesVersions(offreId, "cv");

  return { documentId, version, modele, pages, stocke };
}

/**
 * Recompose un PDF à partir du modèle stocké, sans retoucher à la base.
 * Sert de repli quand le fichier n'est pas dans le bucket.
 */
export async function rendreDepuisSelection(
  selection: unknown
): Promise<Buffer | null> {
  const s = selection as { modele?: ModeleCV } | null;
  if (!s?.modele) return null;
  return rendreModele(s.modele);
}
