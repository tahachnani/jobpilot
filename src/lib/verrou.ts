import { creerClientServeur } from "@/lib/supabase/server";

/**
 * Un verrou pour empêcher qu'une génération soit payée deux fois (D115).
 *
 * Constat du 2 octobre, offre OPCO SANTE. Deux recherches entreprise à vingt
 * secondes d'intervalle, deux lettres à six secondes d'intervalle, pour un
 * seul clic annoncé. Facture : **43 ¢ pour une lettre.**
 *
 * La séquence reconstituée est la suivante. La première génération a démarré à
 * 18 h 36 min 14 s et s'est terminée à 18 h 37 min 18 s — **soixante-quatre
 * secondes**, au-delà de la durée maximale d'une fonction Vercel. Le navigateur
 * a lâché, l'écran n'a rien montré, et un second clic est parti pendant que le
 * premier appel continuait de tourner côté serveur. Les deux ont abouti, les
 * deux ont été facturés.
 *
 * Le bouton se désactive pourtant pendant la soumission — mais `useFormStatus`
 * ne connaît que son propre formulaire et ne survit ni à un rechargement ni à
 * une expiration de requête. Une protection d'interface ne protège pas une
 * dépense : il en faut une côté serveur, partagée, qui ne dépend d'aucun
 * navigateur.
 *
 * Le verrou est volontairement rustique. Il vit en base, il expire tout seul,
 * et un échec de pose ne bloque jamais le travail : si la table manque ou si
 * l'écriture rate, on laisse passer. Mieux vaut payer deux fois une fois de
 * plus que de ne plus pouvoir rédiger du tout.
 */

/** Durée de vie d'un verrou. Au-delà, on considère la génération abandonnée. */
const DUREE_SECONDES = 180;

export class VerrouOccupe extends Error {}

/**
 * Tente de poser le verrou. Lève `VerrouOccupe` si un autre le détient.
 *
 * L'insertion conditionnelle fait tout le travail : `on conflict do update`
 * assorti d'un `where` sur l'expiration ne rend une ligne que si le verrou
 * était libre ou périmé. Deux appels simultanés ne peuvent donc pas réussir
 * tous les deux — c'est PostgreSQL qui arbitre, pas l'application.
 */
export async function poserVerrou(cle: string): Promise<void> {
  const supabase = creerClientServeur();

  const { data, error } = await supabase.rpc("poser_verrou", {
    p_cle: cle,
    p_secondes: DUREE_SECONDES,
  });

  // Fonction absente ou erreur d'écriture : on laisse passer. Le verrou est une
  // économie, pas une condition de fonctionnement.
  if (error) {
    console.warn(`[verrou] pose impossible pour ${cle} : ${error.message}`);
    return;
  }

  if (data === false) {
    throw new VerrouOccupe(
      "Une génération est déjà en cours pour cette offre, lancée il y a moins de trois minutes. " +
        "Attends qu'elle finisse : elle continue côté serveur même si la page a l'air figée. " +
        "Relancer maintenant paierait une deuxième fois le même travail."
    );
  }
}

/** Relâche le verrou. À appeler dans un `finally`, jamais conditionnellement. */
export async function leverVerrou(cle: string): Promise<void> {
  try {
    const supabase = creerClientServeur();
    await supabase.from("verrous").delete().eq("cle", cle);
  } catch {
    // Sans importance : le verrou expire de lui-même.
  }
}

/**
 * Exécute un travail sous verrou.
 *
 * Le `finally` est la seule partie qui n'admet pas d'exception : un verrou
 * laissé derrière une erreur bloquerait l'offre pendant trois minutes, et
 * c'est exactement au moment où l'on veut réessayer.
 */
export async function sousVerrou<T>(cle: string, travail: () => Promise<T>): Promise<T> {
  await poserVerrou(cle);
  try {
    return await travail();
  } finally {
    await leverVerrou(cle);
  }
}
