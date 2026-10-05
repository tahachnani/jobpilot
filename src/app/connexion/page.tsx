import { creerClientServeur } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Connexion par email + mot de passe.
 *
 * Choix assumé : pas de lien magique. Le lien par email dépendait du service
 * d'envoi de Supabase (limité à quelques messages par heure sur l'offre
 * gratuite) et d'un cookie de vérification lié au navigateur et au domaine.
 * Deux fragilités supprimées d'un coup.
 *
 * L'adresse autorisée est contrôlée ici, côté serveur, avant même l'appel à
 * Supabase : une autre adresse ne déclenche aucune tentative.
 */
async function connecter(formData: FormData) {
  "use server";

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const motDePasse = String(formData.get("motdepasse") ?? "");
  const autorise = (process.env.EMAIL_AUTORISE ?? "").trim().toLowerCase();

  const echec = (message: string) =>
    redirect(`/connexion?erreur=${encodeURIComponent(message)}`);

  if (!autorise) {
    echec("La variable EMAIL_AUTORISE n'est pas configurée sur le serveur.");
  }
  if (email !== autorise) {
    echec("Cette adresse n'est pas autorisée.");
  }
  if (motDePasse.length === 0) {
    echec("Mot de passe requis.");
  }

  const supabase = creerClientServeur();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: motDePasse,
  });

  if (error) {
    echec(
      error.message === "Invalid login credentials"
        ? "Mot de passe incorrect."
        : error.message
    );
  }

  redirect("/");
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
          action={connecter}
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
            autoComplete="username"
            inputMode="email"
            className="mt-2 w-full rounded-lg border border-ardoise-200 px-3 py-2.5 text-sm outline-none focus:border-ardoise-500"
          />

          <label
            htmlFor="motdepasse"
            className="mt-4 block text-sm font-medium text-ardoise-700"
          >
            Mot de passe
          </label>
          <input
            id="motdepasse"
            name="motdepasse"
            type="password"
            required
            autoComplete="current-password"
            className="mt-2 w-full rounded-lg border border-ardoise-200 px-3 py-2.5 text-sm outline-none focus:border-ardoise-500"
          />

          <button
            type="submit"
            className="mt-5 w-full rounded-lg bg-ardoise-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-ardoise-800"
          >
            Se connecter
          </button>

          {searchParams.erreur && (
            <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
              {searchParams.erreur}
            </p>
          )}
        </form>

        <p className="mt-4 text-center text-xs text-ardoise-400">
          Ton navigateur peut enregistrer ces identifiants : la connexion
          devient alors immédiate.
        </p>
      </div>
    </main>
  );
}
