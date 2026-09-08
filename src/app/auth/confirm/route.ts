import { creerClientServeur } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

/**
 * Vérification du lien de connexion.
 *
 * Deux formats sont acceptés, car ils dépendent du modèle d'email Supabase :
 *
 * - `token_hash` : vérification directe côté serveur. Ne dépend d'aucun
 *   cookie, fonctionne depuis n'importe quel navigateur. Nécessite un
 *   modèle d'email personnalisé, donc un SMTP configuré.
 * - `code` : flux PKCE du modèle par défaut. Exige que le cookie de
 *   vérification posé lors de la demande soit présent, donc le même
 *   navigateur ET le même domaine.
 *
 * En cas d'échec, la raison exacte renvoyée par Supabase est transmise à la
 * page d'erreur plutôt qu'un message générique.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const code = searchParams.get("code");
  const erreurAmont =
    searchParams.get("error_description") ?? searchParams.get("error");

  const echec = (raison: string) =>
    NextResponse.redirect(
      `${origin}/auth/erreur?raison=${encodeURIComponent(raison)}`
    );

  if (erreurAmont) return echec(erreurAmont);

  const supabase = creerClientServeur();

  if (tokenHash) {
    const type = (searchParams.get("type") ?? "email") as EmailOtpType;
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (!error) return NextResponse.redirect(`${origin}/`);
    return echec(error.message);
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}/`);
    return echec(error.message);
  }

  return echec(
    "Le lien ne contenait ni token_hash ni code. Vérifie la Site URL dans Supabase."
  );
}
