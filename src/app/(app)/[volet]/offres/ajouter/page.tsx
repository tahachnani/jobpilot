import { Carte, TitrePage } from "@/components/ui";
import { voletDepuisSlug } from "@/config/volets";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ajouterEtAnalyser } from "./actions";
import BoutonSoumettre from "@/components/BoutonSoumettre";

export const dynamic = "force-dynamic";

const ONGLETS = [
  { cle: "texte", libelle: "Coller le texte" },
  { cle: "pdf", libelle: "Importer un PDF" },
  { cle: "url", libelle: "Depuis une URL" },
];

export default function Ajouter({
  params,
  searchParams,
}: {
  params: { volet: string };
  searchParams: { onglet?: string; erreur?: string };
}) {
  const volet = voletDepuisSlug(params.volet);
  if (!volet) notFound();

  const onglet = ONGLETS.some((o) => o.cle === searchParams.onglet)
    ? searchParams.onglet!
    : "texte";

  return (
    <>
      <TitrePage
        titre={`${volet.emoji} Ajouter une offre`}
        sousTitre={`Volet ${volet.nom}`}
      />

      <div className="mb-5 flex flex-wrap gap-2">
        {ONGLETS.map((o) => (
          <Link
            key={o.cle}
            href={`/${volet.slug}/offres/ajouter?onglet=${o.cle}`}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              o.cle === onglet
                ? "bg-ardoise-900 text-white"
                : "border border-ardoise-200 bg-white text-ardoise-600 hover:border-ardoise-400"
            }`}
          >
            {o.libelle}
          </Link>
        ))}
      </div>

      {searchParams.erreur && (
        <div className="mb-4 rounded-lg bg-rose-50 p-4 text-sm leading-relaxed text-rose-800">
          {searchParams.erreur}
        </div>
      )}

      <Carte>
        <form action={ajouterEtAnalyser}>
          <input type="hidden" name="volet_slug" value={volet.slug} />
          <input type="hidden" name="source" value={onglet} />

          {onglet === "texte" && (
            <>
              <label
                htmlFor="contenu"
                className="block text-sm font-medium text-ardoise-700"
              >
                Contenu complet de l&apos;offre
              </label>
              <p className="mt-1 text-xs text-ardoise-400">
                Sélectionne toute la page de l&apos;offre et colle-la ici.
                Plus le contenu est complet, plus l&apos;analyse est juste.
              </p>
              <textarea
                id="contenu"
                name="contenu"
                rows={14}
                required
                className="mt-3 w-full rounded-lg border border-ardoise-200 p-3 text-sm leading-relaxed outline-none focus:border-ardoise-500"
              />
            </>
          )}

          {onglet === "pdf" && (
            <>
              <label
                htmlFor="fichier"
                className="block text-sm font-medium text-ardoise-700"
              >
                Fichier PDF de l&apos;offre
              </label>
              <p className="mt-1 text-xs text-ardoise-400">
                Un PDF scanné, contenant une image plutôt que du texte,
                ne pourra pas être lu. L&apos;application te le dira.
              </p>
              <input
                id="fichier"
                name="fichier"
                type="file"
                accept="application/pdf"
                required
                className="mt-3 w-full rounded-lg border border-ardoise-200 p-2.5 text-sm"
              />
            </>
          )}

          {onglet === "url" && (
            <>
              <label
                htmlFor="url"
                className="block text-sm font-medium text-ardoise-700"
              >
                Adresse de l&apos;offre
              </label>
              <p className="mt-1 text-xs text-ardoise-400">
                Fonctionne sur les pages carrière d&apos;entreprise et
                France Travail. LinkedIn, Indeed et Apec bloquent la lecture
                automatique : pour eux, utilise le copier-coller.
              </p>
              <input
                id="url"
                name="url"
                type="url"
                required
                placeholder="https://..."
                className="mt-3 w-full rounded-lg border border-ardoise-200 px-3 py-2.5 text-sm outline-none focus:border-ardoise-500"
              />
            </>
          )}

          <div className="mt-5">
            <BoutonSoumettre
              libelle="Analyser l'offre"
              libelleEnCours="Analyse en cours…"
              className="w-full rounded-lg bg-ardoise-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-ardoise-800 sm:w-auto"
            />
          </div>
          <p className="mt-3 text-xs text-ardoise-400">
            L&apos;analyse prend quelques secondes et coûte environ 0,012 $.
            Une offre déjà enregistrée dans ce volet ne sera pas réanalysée.
          </p>
        </form>
      </Carte>
    </>
  );
}
