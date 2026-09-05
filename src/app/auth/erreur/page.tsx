import Link from "next/link";

export default function Erreur() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-ardoise-50 p-6">
      <div className="w-full max-w-md rounded-xl border border-ardoise-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-lg font-semibold text-ardoise-900">
          Lien de connexion invalide
        </h1>
        <p className="mt-2 text-sm text-ardoise-500">
          Le lien a peut-être expiré ou déjà été utilisé. Demande un nouveau
          lien pour te connecter.
        </p>
        <Link
          href="/connexion"
          className="mt-6 inline-block rounded-lg bg-ardoise-900 px-4 py-2 text-sm font-medium text-white"
        >
          Retour à la connexion
        </Link>
      </div>
    </main>
  );
}
