import { TitrePage, EtatVide, Carte } from "@/components/ui";
import { STATUTS, STATUTS_ENVOYES, voletDepuisSlug } from "@/config/volets";
import { creerClientServeur } from "@/lib/supabase/server";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Candidatures({
  params,
}: {
  params: { volet: string };
}) {
  const volet = voletDepuisSlug(params.volet);
  if (!volet) notFound();

  const supabase = creerClientServeur();
  const { data } = await supabase
    .from("offres")
    .select("id, intitule, entreprise, statut, date_candidature")
    .eq("volet", volet.code)
    .in("statut", STATUTS_ENVOYES)
    .order("date_candidature", { ascending: false });

  const candidatures = data ?? [];

  return (
    <>
      <TitrePage
        titre={`${volet.emoji} Candidatures — ${volet.nom}`}
        sousTitre="Uniquement les offres que tu as marquées comme envoyées"
      />

      {candidatures.length === 0 ? (
        <EtatVide
          titre="Aucune candidature envoyée"
          description="Une offre n'apparaît ici qu'après un clic sur « Marquer comme envoyée ». Générer un CV ou une lettre ne fait jamais basculer une offre dans cette liste."
          etape="étape 6"
        />
      ) : (
        <div className="space-y-3">
          {candidatures.map((c) => {
            const s = STATUTS[c.statut] ?? {
              libelle: c.statut,
              classe: "bg-ardoise-100 text-ardoise-700",
            };
            return (
              <Carte key={c.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-ardoise-900">
                      {c.intitule ?? "Sans intitulé"}
                    </p>
                    <p className="mt-0.5 text-sm text-ardoise-500">
                      {c.entreprise}
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
