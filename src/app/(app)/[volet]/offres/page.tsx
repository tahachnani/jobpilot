import { TitrePage, EtatVide, Carte } from "@/components/ui";
import { STATUTS, voletDepuisSlug } from "@/config/volets";
import { creerClientServeur } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

interface LigneOffre {
  id: string;
  intitule: string | null;
  entreprise: string | null;
  localisation: string | null;
  statut: string;
  extraction_statut: string;
  scores: { score_global: number | null }[] | null;
}

function couleurNote(n: number) {
  if (n >= 80) return "text-emerald-700";
  if (n >= 60) return "text-amber-700";
  return "text-rose-700";
}

export default async function Offres({
  params,
}: {
  params: { volet: string };
}) {
  const volet = voletDepuisSlug(params.volet);
  if (!volet) notFound();

  const supabase = creerClientServeur();
  const { data } = await supabase
    .from("offres")
    .select(
      "id, intitule, entreprise, localisation, statut, extraction_statut, date_ajout, scores ( score_global )"
    )
    .eq("volet", volet.code)
    .order("date_ajout", { ascending: false });

  const offres = (data ?? []) as unknown as LigneOffre[];

  return (
    <>
      <TitrePage
        titre={`${volet.emoji} Offres — ${volet.nom}`}
        sousTitre={volet.intitulesCibles.join(" · ")}
        action={
          <Link
            href={`/${volet.slug}/offres/ajouter`}
            className="rounded-lg bg-ardoise-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-ardoise-800"
          >
            Ajouter une offre
          </Link>
        }
      />

      {offres.length === 0 ? (
        <EtatVide
          titre="Aucune offre enregistrée"
          description="Colle le texte d'une offre, importe un PDF ou tente une URL. L'analyse et le score de compatibilité sont produits dans la foulée."
        />
      ) : (
        <div className="space-y-3">
          {offres.map((o) => {
            const s = STATUTS[o.statut] ?? {
              libelle: o.statut,
              classe: "bg-ardoise-100 text-ardoise-700",
            };
            const note = o.scores?.[0]?.score_global ?? null;
            return (
              <Link key={o.id} href={`/offre/${o.id}`}>
                <Carte className="transition hover:border-ardoise-400">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-ardoise-900">
                        {o.intitule ?? "Offre sans intitulé"}
                      </p>
                      <p className="mt-0.5 text-sm text-ardoise-500">
                        {[o.entreprise, o.localisation]
                          .filter(Boolean)
                          .join(" · ") || "Détails non extraits"}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {note !== null && (
                        <span
                          className={`text-lg font-semibold tabular-nums ${couleurNote(
                            note
                          )}`}
                        >
                          {note} %
                        </span>
                      )}
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${s.classe}`}
                      >
                        {o.extraction_statut === "echec"
                          ? "Analyse échouée"
                          : s.libelle}
                      </span>
                    </div>
                  </div>
                </Carte>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
