import { creerClientServeur } from "@/lib/supabase/server";
import { extraireJson } from "@/lib/extraction-json";

/** Tarifs officiels, en dollars par million de tokens. */
const TARIFS: Record<string, { entree: number; sortie: number }> = {
  "claude-haiku-4-5-20251001": { entree: 1, sortie: 5 },
  "claude-sonnet-5": { entree: 2, sortie: 10 },
};

export const MODELE_EXTRACTION = "claude-haiku-4-5-20251001";
export const MODELE_REDACTION = "claude-sonnet-5";

/**
 * Tarif de la recherche web côté serveur : 10 $ pour 1 000 recherches, soit
 * 1 ¢ l'unité (documentation Anthropic, vérifiée le 2 octobre 2026).
 *
 * Le contenu rapporté par la recherche est facturé **en plus**, comme jetons
 * d'entrée ordinaires — il entre donc dans le calcul par les tarifs
 * ci-dessus, sans traitement particulier. Seul le forfait par recherche doit
 * être ajouté à la main, et c'est précisément ce qui manquerait au compteur
 * du tableau de bord si on l'oubliait.
 */
const TARIF_RECHERCHE_WEB = 10 / 1000;

export class ErreurIA extends Error {}

interface Reponse {
  texte: string;
  tokensEntree: number;
  tokensSortie: number;
  coutUsd: number;
  /** Nombre de recherches web facturées par ce seul appel. */
  recherchesWeb: number;
}

/**
 * Appel à l'API Anthropic, avec journalisation systématique dans `appels_ia`.
 * Chaque appel, réussi ou non, laisse une trace et un coût : le compteur du
 * tableau de bord ne peut pas diverger de la réalité.
 */
export async function appelIA(options: {
  modele: string;
  systeme: string;
  message: string;
  maxTokens?: number;
  tache: string;
  offreId?: string | null;
  /**
   * Nombre maximal de recherches web autorisées pour cet appel (D108).
   *
   * Absent ou nul : aucun outil n'est transmis, l'appel se comporte
   * exactement comme avant. C'est volontaire — tous les appels existants
   * passent par ici, et aucun ne doit changer de prix parce qu'on a ajouté
   * une capacité ailleurs.
   *
   * Le plafond est transmis à l'API (`max_uses`) et non simplement espéré :
   * une recherche coûte 1 ¢ plus le contenu rapporté, et un modèle laissé
   * libre en lance volontiers cinq.
   */
  recherchesWeb?: number;
  /**
   * Niveau d'effort de raisonnement (D118).
   *
   * Constat du 2 octobre : relever `maxTokens` de 8 000 à 20 000 pour corriger
   * un échec a **triplé le prix**. Deux lettres ont coûté 19,6 ¢ et 12 ¢ au
   * lieu de 6, l'une ayant produit 16 195 jetons de sortie. J'avais écrit
   * qu'un plafond ne se paie pas — c'est vrai des jetons non produits, et faux
   * du comportement : à qui on donne de la place, le modèle raisonne
   * davantage, et le raisonnement est facturé en sortie comme le reste.
   *
   * Un plafond haut est donc un budget, pas une sécurité. Les deux se règlent
   * séparément : `maxTokens` borne le total facturé, celui-ci borne la part
   * consommée avant d'écrire.
   *
   * D118 — la première version envoyait `thinking.budget_tokens`, et l'API la
   * refusait : « thinking.adaptive.budget_tokens: Extra inputs are not
   * permitted ». Le repli jouait, donc rien ne cassait et rien ne se voyait —
   * mais le raisonnement est resté libre deux jours, avec les lenteurs et le
   * prix qui vont avec. Une sécurité qui échoue en silence est pire que pas de
   * sécurité : elle rassure.
   *
   * La bonne forme est `output_config.effort`, hors de l'objet `thinking` :
   * « low » réduit le raisonnement, « high » est le défaut de la plupart des
   * modèles. Le budget en jetons, lui, n'existe que dans le mode manuel
   * hérité, incompatible avec le mode adaptatif des modèles récents.
   */
  effort?: "low" | "medium" | "high";
}): Promise<Reponse> {
  const cle = process.env.ANTHROPIC_API_KEY;
  if (!cle) {
    throw new ErreurIA(
      "La clé ANTHROPIC_API_KEY n'est pas configurée sur le serveur. " +
        "Ajoute-la dans Vercel puis redéploie."
    );
  }

  const debut = Date.now();

  const corps = (avecRaisonnement: boolean) =>
    JSON.stringify({
      model: options.modele,
      max_tokens: options.maxTokens ?? 4000,
      system: options.systeme,
      messages: [{ role: "user", content: options.message }],
      ...(avecRaisonnement && options.effort
        ? { output_config: { effort: options.effort } }
        : {}),
      ...(options.recherchesWeb
        ? {
            tools: [
              {
                type: "web_search_20250305",
                name: "web_search",
                max_uses: options.recherchesWeb,
              },
            ],
          }
        : {}),
    });

  const envoyer = (avecRaisonnement: boolean) =>
    fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": cle,
        "anthropic-version": "2023-06-01",
      },
      body: corps(avecRaisonnement),
    });

  let reponse: Response;

  try {
    reponse = await envoyer(true);

    /**
     * Repli si le bridage est refusé (D114).
     *
     * La forme du paramètre `thinking` a changé selon les générations de
     * modèle : `enabled` est déprécié puis refusé, `adaptive` n'existe qu'à
     * partir d'une certaine version. Deviner la bonne forme pour un modèle
     * donné, c'est risquer de casser TOUS les appels de l'application pour
     * économiser quelques centimes.
     *
     * On tente donc le bridage, et un refus explicite de l'API sur ce
     * paramètre fait rejouer l'appel sans lui. Le premier essai refusé n'est
     * pas facturé — une requête invalide ne produit aucun jeton.
     */
    if (reponse.status === 400 && options.effort) {
      const refus = await reponse.clone().text();
      if (/thinking|budget_tokens|output_config|effort/i.test(refus)) {
        // Visible ET bruyant : le refus silencieux de D114 a coûté deux jours
        // de raisonnement non bridé parce que seul un `console.warn` discret
        // en portait la trace.
        console.error(
          `[ia] EFFORT REFUSÉ pour ${options.modele} — le raisonnement n'est PAS bridé sur cet appel. ${refus.slice(0, 300)}`
        );
        reponse = await envoyer(false);
      }
    }
  } catch (e) {
    await journaliser(options, null, false, String(e), Date.now() - debut);
    throw new ErreurIA("Impossible de joindre l'API Anthropic.");
  }

  if (!reponse.ok) {
    const corps = await reponse.text();
    let message = `Erreur ${reponse.status} de l'API Anthropic.`;
    if (reponse.status === 401) {
      message = "Clé API refusée. Vérifie ANTHROPIC_API_KEY dans Vercel.";
    } else if (reponse.status === 400 && corps.includes("credit")) {
      message =
        "Crédit insuffisant sur ton compte Anthropic. Ajoute du crédit sur console.anthropic.com.";
    } else if (reponse.status === 429) {
      message = "Trop d'appels d'un coup. Réessaie dans quelques secondes.";
    }
    await journaliser(
      options,
      null,
      false,
      `${reponse.status} ${corps.slice(0, 300)}`,
      Date.now() - debut
    );
    throw new ErreurIA(message);
  }

  const donnees = (await reponse.json()) as {
    content: { type: string; text?: string }[];
    stop_reason?: string;
    usage: {
      input_tokens: number;
      output_tokens: number;
      server_tool_use?: { web_search_requests?: number };
      // La part des jetons de sortie passée à raisonner. C'est elle qui a
      // triplé la facture le 2 octobre sans qu'on puisse la voir.
      output_tokens_details?: { thinking_tokens?: number };
    };
  };

  let texte = donnees.content
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("\n");

  // Repli : certains modèles renvoient le texte dans un bloc d'un autre type.
  // Plutôt que de rendre une chaîne vide et un message d'erreur muet, on
  // récupère tout ce qui porte du texte.
  if (!texte.trim()) {
    texte = donnees.content
      .map((b) => b.text ?? "")
      .filter(Boolean)
      .join("\n");
  }

  const tarif = TARIFS[options.modele] ?? { entree: 1, sortie: 5 };
  // Le nombre réel de recherches facturées, et non le plafond demandé : le
  // modèle en lance souvent moins, et une recherche en erreur n'est pas
  // facturée. Compter le plafond gonflerait le compteur sans raison.
  const recherchesWeb = donnees.usage.server_tool_use?.web_search_requests ?? 0;
  const coutUsd =
    (donnees.usage.input_tokens / 1_000_000) * tarif.entree +
    (donnees.usage.output_tokens / 1_000_000) * tarif.sortie +
    recherchesWeb * TARIF_RECHERCHE_WEB;

  const raisonnement = donnees.usage.output_tokens_details?.thinking_tokens ?? 0;
  if (raisonnement > 0) {
    console.info(
      `[ia] ${options.tache} : ${donnees.usage.output_tokens} jetons produits, dont ${raisonnement} de raisonnement`
    );
  }

  const resultat: Reponse = {
    texte,
    tokensEntree: donnees.usage.input_tokens,
    tokensSortie: donnees.usage.output_tokens,
    coutUsd,
    recherchesWeb,
  };

  /**
   * Une réponse sans texte est facturée comme les autres (D113).
   *
   * Constat du 2 octobre : deux appels de lettre ont échoué sur
   * « blocs : thinking — réponse coupée par la limite de jetons — 8000 jetons
   * produits ». Ils ont donc produit 8 000 jetons de sortie chacun, qu'Anthropic
   * a facturés — et le journal les a enregistrés à **zéro**, parce que le coût
   * était calculé après ce contrôle et que l'échec passait `null`.
   *
   * Environ 22 ¢ invisibles sur deux appels. Le fichier promet pourtant en
   * en-tête que « le compteur du tableau de bord ne peut pas diverger de la
   * réalité » : il divergeait exactement là où ça compte le plus, sur les
   * appels ratés, qui sont ceux qu'on refait et donc qu'on paie deux fois.
   *
   * Le coût est désormais calculé d'abord, et journalisé dans les deux cas.
   */
  if (!texte.trim()) {
    const types = donnees.content.map((b) => b.type).join(", ") || "aucun bloc";
    const cause =
      donnees.stop_reason === "max_tokens"
        ? "réponse coupée par la limite de jetons"
        : `arrêt : ${donnees.stop_reason ?? "inconnu"}`;
    await journaliser(
      options,
      resultat,
      false,
      `réponse sans texte — blocs : ${types} — ${cause} — ` +
        `${donnees.usage.output_tokens} jetons produits`,
      Date.now() - debut
    );
    throw new ErreurIA(
      `Le modèle n'a renvoyé aucun texte (blocs reçus : ${types} ; ${cause}). ` +
        `${donnees.usage.output_tokens} jetons produits, facturés. ` +
        (donnees.stop_reason === "max_tokens"
          ? "La limite de jetons est trop basse pour cette tâche."
          : "")
    );
  }

  await journaliser(options, resultat, true, null, Date.now() - debut);
  return resultat;
}

/**
 * La durée est journalisée (D128).
 *
 * `const debut = Date.now()` existait depuis le début, suivi vingt lignes plus
 * bas d'un `void debut;` : la mesure était prise et jetée. Deux décisions
 * d'architecture ont pourtant été arbitrées sur des durées estimées — sortir
 * la recherche entreprise de la rédaction le 4 octobre après un `504 Task
 * timed out`, puis l'y remettre le 7. La seule mesure dont on disposait venait
 * de l'écart entre deux lignes du journal, par chance consécutives.
 */
async function journaliser(
  options: { tache: string; modele: string; offreId?: string | null },
  resultat: Reponse | null,
  succes: boolean,
  erreur: string | null,
  dureeMs: number | null = null
) {
  try {
    const supabase = creerClientServeur();
    await supabase.from("appels_ia").insert({
      tache: options.tache,
      modele: options.modele,
      offre_id: options.offreId ?? null,
      tokens_entree: resultat?.tokensEntree ?? null,
      tokens_sortie: resultat?.tokensSortie ?? null,
      cout_usd: resultat?.coutUsd ?? 0,
      duree_ms: dureeMs,
      succes,
      erreur,
    });
  } catch {
    // La journalisation ne doit jamais faire échouer l'appel principal.
  }
}

/**
 * Analyse la réponse JSON d'un modèle.
 *
 * L'isolement du JSON est délégué à `extraction-json`, qui gère aussi les
 * tableaux et se repère sur les délimiteurs plutôt que sur les balises de
 * code. Deux versions ont coexisté un temps, et c'était la plus fragile qui
 * servait à l'extraction d'offre — la porte d'entrée de tout le reste.
 */
export function analyserJson<T>(texte: string): T {
  const isole = extraireJson(texte);
  try {
    return JSON.parse(isole) as T;
  } catch {
    throw new ErreurIA(
      `La réponse de l'IA n'était pas un JSON valide. Début reçu : ${texte
        .trim()
        .slice(0, 200)}`
    );
  }
}
