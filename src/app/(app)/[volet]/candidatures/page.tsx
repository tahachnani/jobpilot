import { TitrePage, EtatVide, Carte } from "@/components/ui";
import { STATUTS, STATUTS_ENVOYES, voletDepuisSlug } from "@/config/volets";
import { creerClientServeur } from "@/lib/supabase/server";
import { jour, joursDepuis, relanceDue } from "@/lib/suivi";
import { notFound } from "next/navigation";
import Link from "next/link";

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
    .select(
      "id, intitule, entreprise, statut, date_candidature, relance_prevue_le, derniere_relance_le, relances"
    )
    .eq("volet", volet.code)
    .in("statut", STATUTS_ENVOYES)
    .order("date_candidature", { ascending: false });

  const candidatures = (data ?? []) as {
    id: string;
    intitule: string | null;
    entreprise: string | null;
    statut: string;
    date_candidature: string | null;
    relance_prevue_le: string | null;
    derniere_relance_le: string | null;
    relances: number | null;
  }[];

  const aRelancer = candidatures.filter((c) =>
    relanceDue(c.statut, c.relance_prevue_le)
  ).length;

  return (
    <>
      <TitrePage
        titre={`${volet.emoji} Candidatures — ${volet.nom}`}
        sousTitre="Uniquement les offres que tu as marquées comme envoyées"
        action={
          aRelancer > 0 ? (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-900">
              {aRelancer} à relancer
            </span>
          ) : undefined
        }
      />

      {candidatures.length === 0 ? (
        <EtatVide
          titre="Aucune candidature envoyée"
          description="Une offre n'apparaît ici qu'après un clic sur « Marquer comme envoyée » sur sa fiche. Générer un CV ou une lettre ne fait jamais basculer une offre dans cette liste."
        />
      ) : (
        <div className="space-y-3">
          {candidatures.map((c) => {
            const s = STATUTS[c.statut] ?? {
              libelle: c.statut,
              classe: "bg-ardoise-100 text-ardoise-700",
            };
            const jours = joursDepuis(c.date_candidature);
            const due = relanceDue(c.statut, c.relance_prevue_le);

            return (
              <Link key={c.id} href={`/offre/${c.id}`}>
                <Carte className="transition hover:border-ardoise-400">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-ardoise-900">
                        {c.intitule ?? "Sans intitulé"}
                      </p>
                      <p className="mt-0.5 text-sm text-ardoise-500">
                        {c.entreprise}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {due && (
                        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-900">
                          À relancer
                        </span>
                      )}
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${s.classe}`}
                      >
                        {s.libelle}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 border-t border-ardoise-100 pt-3 text-xs text-ardoise-500">
                    <span>
                      Envoyée le {jour(c.date_candidature)}
                      {jours !== null && ` · il y a ${jours} j`}
                    </span>
                    <span>
                      {c.statut === "envoyee" && c.relance_prevue_le
                        ? `Relance prévue le ${jour(c.relance_prevue_le)}`
                        : "Aucune relance prévue"}
                    </span>
                    <span>
                      {(c.relances ?? 0) === 0
                        ? "Jamais relancée"
                        : `${c.relances} relance${
                            (c.relances ?? 0) > 1 ? "s" : ""
                          } · dernière le ${jour(c.derniere_relance_le)}`}
                    </span>
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
