import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

/** Cookies à écrire, tels que les fournit @supabase/ssr. */
type CookiesAEcrire = { name: string; value: string; options: CookieOptions }[];

/** Client Supabase côté serveur, adossé à la session de l'utilisateur. */
export function creerClientServeur() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookiesAEcrire) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              // Les types de cookie de Next et de Supabase divergent
              // légèrement (sameSite) : cast contenu à cet endroit précis.
              (cookieStore.set as (n: string, v: string, o?: unknown) => void)(
                name,
                value,
                options
              );
            });
          } catch {
            // Appelé depuis un Server Component : le rafraîchissement de
            // session est assuré par le middleware, on peut ignorer.
          }
        },
      },
    }
  );
}
