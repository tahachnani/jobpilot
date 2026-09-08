import { creerClientServeur } from "@/lib/supabase/server";

/** Tarifs officiels, en dollars par million de tokens. */
const TARIFS: Record<string, { entree: number; sortie: number }> = {
  "claude-haiku-4-5-20251001": { entree: 1, sortie: 5 },
  "claude-sonnet-5": { entree: 2, sortie: 10 },
};

export const MODELE_EXTRACTION = "claude-haiku-4-5-20251001";
export const MODELE_REDACTION = "claude-sonnet-5";

export class ErreurIA extends Error {}

interface Reponse {
  texte: string;
  tokensEntree: number;
  tokensSortie: number;
  coutUsd: number;
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
}): Promise<Reponse> {
  const cle = process.env.ANTHROPIC_API_KEY;
  if (!cle) {
    throw new ErreurIA(
      "La clé ANTHROPIC_API_KEY n'est pas configurée sur le serveur. " +
        "Ajoute-la dans Vercel puis redéploie."
    );
  }

  const debut = Date.now();
  let reponse: Response;

  try {
    reponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": cle,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: options.modele,
        max_tokens: options.maxTokens ?? 4000,
        system: options.systeme,
        messages: [{ role: "user", content: options.message }],
      }),
    });
  } catch (e) {
    await journaliser(options, null, false, String(e));
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
    await journaliser(options, null, false, `${reponse.status} ${corps.slice(0, 300)}`);
    throw new ErreurIA(message);
  }

  const donnees = (await reponse.json()) as {
    content: { type: string; text?: string }[];
    usage: { input_tokens: number; output_tokens: number };
  };

  const texte = donnees.content
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("\n");

  const tarif = TARIFS[options.modele] ?? { entree: 1, sortie: 5 };
  const coutUsd =
    (donnees.usage.input_tokens / 1_000_000) * tarif.entree +
    (donnees.usage.output_tokens / 1_000_000) * tarif.sortie;

  const resultat: Reponse = {
    texte,
    tokensEntree: donnees.usage.input_tokens,
    tokensSortie: donnees.usage.output_tokens,
    coutUsd,
  };

  await journaliser(options, resultat, true, null);
  void debut;
  return resultat;
}

async function journaliser(
  options: { tache: string; modele: string; offreId?: string | null },
  resultat: Reponse | null,
  succes: boolean,
  erreur: string | null
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
      succes,
      erreur,
    });
  } catch {
    // La journalisation ne doit jamais faire échouer l'appel principal.
  }
}

/** Extrait le premier objet JSON d'une réponse, même entourée de texte. */
export function extraireJson<T>(texte: string): T {
  const nettoye = texte
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();
  const debut = nettoye.indexOf("{");
  const fin = nettoye.lastIndexOf("}");
  if (debut === -1 || fin === -1) {
    throw new ErreurIA("La réponse de l'IA n'était pas au format attendu.");
  }
  try {
    return JSON.parse(nettoye.slice(debut, fin + 1)) as T;
  } catch {
    throw new ErreurIA("La réponse de l'IA n'était pas un JSON valide.");
  }
}
