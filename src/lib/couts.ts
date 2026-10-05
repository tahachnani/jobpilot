import { creerClientServeur } from "@/lib/supabase/server";

/**
 * Ce que l'application a réellement dépensé ce mois-ci.
 *
 * Chaque appel au modèle est journalisé dans `appels_ia` avec son coût depuis
 * l'étape 1 — mais le tableau de bord affichait « 0,00 $ » écrit en dur sous
 * la mention « plafond 10 $ ». Un compteur faux est pire qu'absent : il
 * rassure.
 *
 * Le plafond avertit, il n'interdit pas (décision prise après l'étape 6) :
 * être bloqué devant une offre qui ferme le lendemain coûterait plus cher que
 * quelques dollars.
 */

export interface Budget {
  depense: number;
  plafond: number;
  /** Part du plafond consommée, de 0 à 1 et au-delà. */
  part: number;
  depasse: boolean;
  proche: boolean;
  appels: number;
  echecs: number;
}

const PLAFOND_PAR_DEFAUT = 10;
const SEUIL_ALERTE = 0.8;

function debutDuMois(): string {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
}

export async function budgetDuMois(): Promise<Budget> {
  const supabase = creerClientServeur();

  const [{ data: appels }, { data: parametre }] = await Promise.all([
    supabase
      .from("appels_ia")
      .select("cout_usd, succes")
      .gte("created_at", debutDuMois()),
    supabase
      .from("parametres")
      .select("valeur")
      .eq("cle", "budget_ia")
      .maybeSingle(),
  ]);

  const lignes = (appels ?? []) as { cout_usd: number | null; succes: boolean }[];
  const depense = lignes.reduce((t, l) => t + Number(l.cout_usd ?? 0), 0);

  const brut = (parametre as { valeur?: Record<string, unknown> } | null)?.valeur;
  const lu = Number(brut?.plafond_mensuel_usd);
  const plafond = Number.isFinite(lu) && lu > 0 ? lu : PLAFOND_PAR_DEFAUT;

  const part = plafond > 0 ? depense / plafond : 0;

  return {
    depense,
    plafond,
    part,
    depasse: depense >= plafond,
    proche: part >= SEUIL_ALERTE && depense < plafond,
    appels: lignes.length,
    echecs: lignes.filter((l) => !l.succes).length,
  };
}

/** Un montant en dollars, écrit comme sur le tableau de bord. */
export function montant(usd: number): string {
  return `${usd.toFixed(2).replace(".", ",")} $`;
}
