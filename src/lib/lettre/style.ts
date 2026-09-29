import { normaliser } from "@/lib/texte";

/**
 * Le contrôle de style de la lettre (D93).
 *
 * L'ancrage vérifie que la lettre ne ment pas. Il ne dit rien de la façon dont
 * elle est écrite — et c'est là que trois lettres sur quatre déçoivent.
 *
 * Constat du 29 septembre, sur une lettre réelle : aucune phrase principale
 * n'avait de sujet humain. « le pilotage s'est accompagné de », « la
 * construction a nécessité de », « le parcours traverse », « ce passage a
 * construit une capacité ». Des travaux qui se font tout seuls, une prose de
 * note de service. S'y ajoutaient trois énumérations annoncées — quatre
 * expériences, deux expériences, trois secteurs — et une phrase qui recopiait
 * les besoins de l'annonce en les annonçant comme tels.
 *
 * Comme le contrôle de reformulation, celui-ci ne bloque rien : il nomme. Une
 * lettre se relit et se corrige à la main, et la signaler coûte zéro appel.
 */

export interface DefautStyle {
  /** Le nom du défaut, tel qu'il s'affiche. */
  tournure: string;
  /** Le passage fautif, tronqué. */
  extrait: string;
  /** Pourquoi c'est un défaut, en une phrase. */
  pourquoi: string;
}

/**
 * Noms d'action qui, pris comme sujet, effacent celui qui a fait le travail.
 *
 * La liste est volontairement courte et tirée de lettres réelles : un
 * dictionnaire complet attraperait des phrases légitimes.
 */
const NOMS_ABSTRAITS = [
  "pilotage",
  "construction",
  "calcul",
  "parcours",
  "passage",
  "suivi",
  "elaboration",
  "automatisation",
  "parametrage",
  "mise en place",
  "montee en competence",
  "contribution",
  "demarche",
  "approche",
  "experience",
  "experiences",
  "mission",
  "missions",
  "realisation",
  "production",
];

/** Découpe en phrases, sans casser sur les nombres ni les sigles. */
function phrases(texte: string): string[] {
  return texte
    .split(/(?<=[.!?])\s+(?=[A-ZÀ-Þ])/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

/** Les marques de première personne : la preuve qu'une personne parle. */
function parleALaPremierePersonne(phrase: string): boolean {
  return /\b(je|j['’]|mon|ma|mes|m['’])/i.test(phrase);
}

function extrait(texte: string, taille = 90): string {
  const t = texte.trim();
  return t.length > taille ? `${t.slice(0, taille)}…` : t;
}

/**
 * Tournures à bannir, repérées sur le texte normalisé.
 *
 * Chacune vient d'une lettre produite par l'application, pas d'un manuel.
 */
const TOURNURES: { motif: RegExp; tournure: string; pourquoi: string }[] = [
  {
    motif: /\b(deux|trois|quatre|cinq|six)\s+(experiences?|secteurs?|missions?|axes?|points?|elements?)\b/,
    tournure: "Énumération annoncée",
    pourquoi:
      "Compter ses expériences structure un rapport, pas une lettre. Le lecteur n'a pas besoin du sommaire.",
  },
  {
    motif: /\b(illustrent|illustre)\s+(cette|ce|cet|ma|mon)\b/,
    tournure: "Annonce de plan",
    pourquoi:
      "Annoncer ce qu'on va démontrer renvoie souvent à une idée qui n'a pas encore été posée. Démontre, n'annonce pas.",
  },
  {
    motif: /(besoins?|attentes?|missions?)\s+(identifie|decrit|mentionne)[a-z]*\s+dans\s+l['’]?annonce|recouvrent les besoins|correspondent? aux attentes/,
    tournure: "Recopie de l'annonce",
    pourquoi:
      "Le recruteur sait ce qu'il a écrit. Conclure à sa place que tu corresponds affaiblit la démonstration.",
  },
  {
    motif: /\bvs\b/,
    tournure: "Abréviation anglaise",
    pourquoi: "« vs » n'a pas sa place dans une lettre française : écris « par rapport au ».",
  },
  {
    motif: /disponible immediatement[\s\S]{0,80}(sans delai|des a present|immediatement)/,
    tournure: "Disponibilité dite deux fois",
    pourquoi: "« Disponible immédiatement » et « sans délai » disent la même chose.",
  },
  {
    motif: /a (votre |entiere )?disposition pour (echanger|convenir)|modalites d['’]un entretien/,
    tournure: "Clôture administrative",
    pourquoi:
      "On demande un entretien, on ne négocie pas ses modalités. Cette formule s'excuse d'exister.",
  },
  {
    motif: /s['’]inscrit dans cette continuite|dans cette continuite|n['’]hesitez pas/,
    tournure: "Formule creuse",
    pourquoi: "La phrase n'ajoute aucune information : elle occupe une ligne.",
  },
];

/**
 * @param paragraphes Le corps de la lettre, formules d'appel et de politesse
 * exclues : elles ont leurs propres conventions.
 */
export function verifierStyle(paragraphes: string[]): DefautStyle[] {
  const defauts: DefautStyle[] = [];
  const texte = paragraphes.join("\n");
  const n = normaliser(texte);

  for (const t of TOURNURES) {
    const trouve = n.match(t.motif);
    if (!trouve) continue;
    defauts.push({
      tournure: t.tournure,
      extrait: extrait(trouve[0], 60),
      pourquoi: t.pourquoi,
    });
  }

  /**
   * Les phrases dont le sujet est un nom d'action et non une personne.
   *
   * Le complément de lieu initial — « Chez TECHNICAPS, le pilotage… » — est
   * sauté : c'est précisément la forme que prend le défaut.
   */
  const nominales: string[] = [];
  for (const p of phrases(texte)) {
    if (parleALaPremierePersonne(p)) continue;
    const debut = normaliser(p).replace(/^[^,]{0,60},\s*/, "");
    const sujet = debut.match(/^(?:le|la|les|l|ce|cet|cette|ces)\s+([a-z ]{3,30})/);
    if (!sujet) continue;
    if (NOMS_ABSTRAITS.some((mot) => sujet[1].startsWith(mot))) {
      nominales.push(p);
    }
  }

  if (nominales.length > 0) {
    defauts.push({
      tournure: `Phrase sans sujet humain (${nominales.length})`,
      extrait: extrait(nominales[0]),
      pourquoi:
        "Le travail s'y fait tout seul : c'est le pilotage, la construction ou le parcours qui agissent. Reprends la phrase avec « j'ai ».",
    });
  }

  return defauts;
}
