import { creerClientServeur } from "@/lib/supabase/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Envoi du lien magique.
 * Le contrôle de l'adresse autorisée est fait ici, côté serveur :
 * il n'est donc pas contournable depuis le navigateur.
 */
async function envoyerLien(formData: FormData) {
  "use server";

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const autorise = (process.env.EMAIL_AUTORISE ?? "").trim().toLowerCase();

  const echec = (message: string) =>
    redirect(`/connexion?erreur=${encodeURIComponent(message)}`);

  if (!autorise) {
    echec("La variable EMAIL_AUTORISE n'est pas configurée sur le serveur.");
  }
  if (email !== autorise) {
    echec("Cette adresse n'est pas autorisée.");
  }

  const origine =
    process.env.NEXT_PUBLIC_SITE_URL ??
    `https://${headers().get("host") ?? "localhost:3000"}`;

  const supabase = creerClientServeur();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: `${origine}/auth/callback`,
    },
  });

  if (error) echec(error.message);

  redirect("/connexion?envoye=1");
}

export default function Connexion({
  searchParams,
}: {
  searchParams: { [k: string]: string | undefined };
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-ardoise-50 p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold text-ardoise-900">JobPilot</h1>
          <p className="mt-1 text-sm text-ardoise-500">
            Application privée. Accès réservé.
          </p>
        </div>

        <form
          action={envoyerLien}
          className="rounded-xl border border-ardoise-200 bg-white p-6 shadow-sm"
        >
          <label
            htmlFor="email"
            className="block text-sm font-medium text-ardoise-700"
          >
            Adresse email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            placeholder="ton@email.fr"
            className="mt-2 w-full rounded-lg border border-ardoise-200 px-3 py-2.5 text-sm outline-none focus:border-ardoise-500"
          />

          <button
            type="submit"
            className="mt-4 w-full rounded-lg bg-ardoise-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-ardoise-800"
          >
            Recevoir un lien de connexion
          </button>

          {searchParams.envoye && (
            <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              Lien envoyé. Ouvre ta boîte mail et clique sur le lien reçu.
            </p>
          )}
          {searchParams.erreur && (
            <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
              {searchParams.erreur}
            </p>
          )}
        </form>

        <p className="mt-4 text-center text-xs text-ardoise-400">
          Pas de mot de passe à retenir : la connexion se fait par un lien
          envoyé à ton adresse.
        </p>
      </div>
    </main>
  );
}
