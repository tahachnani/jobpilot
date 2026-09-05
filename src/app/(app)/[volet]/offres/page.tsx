import { TitrePage, EtatVide, Carte } from "@/components/ui";
import { STATUTS, voletDepuisSlug } from "@/config/volets";
import { creerClientServeur } from "@/lib/supabase/server";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

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
    .select("id, intitule, entreprise, localisation, statut, date_ajout")
    .eq("volet", volet.code)
    .order("date_ajout", { ascending: false });

  const offres = data ?? [];

  return (
    <>
      <TitrePage
        titre={`${volet.emoji} Offres — ${volet.nom}`}
        sousTitre={volet.intitulesCibles.join(" · ")}
        action={
          <span className="rounded-lg bg-ardoise-200 px-4 py-2 text-sm text-ardoise-500">
            Ajouter une offre — étape 3
          </span>
        }
      />

      {offres.length === 0 ? (
        <EtatVide
          titre="Aucune offre enregistrée"
          description="L'ajout d'offres par copier-coller, PDF ou URL, puis l'analyse et le score de compatibilité, arrivent à l'étape 3."
          etape="étape 3"
        />
      ) : (
        <div className="space-y-3">
          {offres.map((o) => {
            const s = STATUTS[o.statut] ?? {
              libelle: o.statut,
              classe: "bg-ardoise-100 text-ardoise-700",
            };
            return (
              <Carte key={o.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-ardoise-900">
                      {o.intitule ?? "Sans intitulé"}
                    </p>
                    <p className="mt-0.5 text-sm text-ardoise-500">
                      {[o.entreprise, o.localisation]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${s.classe}`}
                  >
                    {s.libelle}
                  </span>
                </div>
              </Carte>
            );
          })}
        </div>
      )}
    </>
  );
}
