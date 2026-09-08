import Link from "next/link";

export default function Erreur({
  searchParams,
}: {
  searchParams: { raison?: string };
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-ardoise-50 p-6">
      <div className="w-full max-w-md rounded-xl border border-ardoise-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-lg font-semibold text-ardoise-900">
          Connexion impossible
        </h1>
        <p className="mt-2 text-sm text-ardoise-500">
          Le lien n&apos;a pas pu être vérifié.
        </p>

        {searchParams.raison && (
          <p className="mt-4 rounded-lg bg-rose-50 p-3 text-left text-xs leading-relaxed text-rose-800">
            <strong className="block">Raison exacte :</strong>
            {searchParams.raison}
          </p>
        )}

        <Link
          href="/connexion"
          className="mt-6 inline-block rounded-lg bg-ardoise-900 px-4 py-2 text-sm font-medium text-white"
        >
          Demander un nouveau lien
        </Link>
      </div>
    </main>
  );
}
