import { TitrePage, EtatVide, Carte } from "@/components/ui";
import { STATUTS, STATUTS_ENVOYES, voletDepuisSlug } from "@/config/volets";
import { creerClientServeur } from "@/lib/supabase/server";
import { jour, relanceDue } from "@/lib/suivi";
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
  date_ajout: string;
  relance_prevue_le: string | null;
  scores: { score_global: number | null }[] | null;
}

function couleurNote(n: number) {
  if (n >= 80) return "text-emerald-700";
  if (n >= 60) return "text-amber-700";
  return "text-rose-700";
}

/**
 * Les filtres de la liste.
 *
 * Ils vivent dans l'URL plutôt que dans un état de composant : la liste reste
 * une page serveur, le retour arrière fonctionne, et un tri choisi se
 * retrouve dans un signet.
 */
const TRIS: Record<string, { libelle: string; colonne: string; croissant: boolean }> = {
  recentes: { libelle: "Plus récentes", colonne: "date_ajout", croissant: false },
  score: { libelle: "Meilleur score", colonne: "date_ajout", croissant: false },
  anciennes: { libelle: "Plus anciennes", colonne: "date_ajout", croissant: true },
};

const FILTRES: Record<string, { libelle: string; garde: (o: LigneOffre) => boolean }> = {
  actives: {
    libelle: "En cours",
    garde: (o) => !["refusee", "sans_reponse", "cloturee"].includes(o.statut),
  },
  toutes: { libelle: "Toutes", garde: () => true },
  a_envoyer: {
    libelle: "À envoyer",
    garde: (o) => !STATUTS_ENVOYES.includes(o.statut),
  },
  envoyees: {
    libelle: "Envoyées",
    garde: (o) => STATUTS_ENVOYES.includes(o.statut),
  },
  a_relancer: {
    libelle: "À relancer",
    garde: (o) => relanceDue(o.statut, o.relance_prevue_le),
  },
};

export default async function Offres({
  params,
  searchParams,
}: {
  params: { volet: string };
  searchParams: { tri?: string; filtre?: string };
}) {
  const volet = voletDepuisSlug(params.volet);
  if (!volet) notFound();

  const tri = TRIS[searchParams.tri ?? ""] ? searchParams.tri! : "recentes";
  const filtre = FILTRES[searchParams.filtre ?? ""] ? searchParams.filtre! : "actives";

  const supabase = creerClientServeur();
  const { data } = await supabase
    .from("offres")
    .select(
      "id, intitule, entreprise, localisation, statut, extraction_statut, date_ajout, relance_prevue_le, scores ( score_global )"
    )
    .eq("volet", volet.code)
    .order(TRIS[tri].colonne, { ascending: TRIS[tri].croissant });

  const toutes = (data ?? []) as unknown as LigneOffre[];
  const note = (o: LigneOffre) => o.scores?.[0]?.score_global ?? null;

  let offres = toutes.filter(FILTRES[filtre].garde);

  // Le tri par score se fait ici : la note vit dans une table liée, et
  // PostgREST ne sait pas ordonner dessus sans vue dédiée.
  if (tri === "score") {
    offres = [...offres].sort((a, b) => (note(b) ?? -1) - (note(a) ?? -1));
  }

  const lien = (t: string, f: string) =>
    `/${volet.slug}/offres?tri=${t}&filtre=${f}`;

  const puce = (actif: boolean) =>
    `rounded-full px-3 py-1 text-xs font-medium transition ${
      actif
        ? "bg-ardoise-900 text-white"
        : "border border-ardoise-200 bg-white text-ardoise-600 hover:border-ardoise-400"
    }`;

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

      {toutes.length > 0 && (
        <div className="mb-4 space-y-2">
          <div className="flex flex-wrap gap-2">
            {Object.entries(FILTRES).map(([code, f]) => {
              const n = toutes.filter(f.garde).length;
              return (
                <Link
                  key={code}
                  href={lien(tri, code)}
                  prefetch={false}
                  className={puce(code === filtre)}
                >
                  {f.libelle} ({n})
                </Link>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(TRIS).map(([code, t]) => (
              <Link
                key={code}
                href={lien(code, filtre)}
                prefetch={false}
                className={puce(code === tri)}
              >
                {t.libelle}
              </Link>
            ))}
          </div>
        </div>
      )}

      {toutes.length === 0 ? (
        <EtatVide
          titre="Aucune offre enregistrée"
          description="Colle le texte d'une offre, importe un PDF ou tente une URL. L'analyse et le score de compatibilité sont produits dans la foulée."
        />
      ) : offres.length === 0 ? (
        <EtatVide
          titre="Aucune offre dans ce filtre"
          description="Les offres existent, mais aucune ne correspond à la sélection en cours. Reviens à « Toutes » pour les revoir."
        />
      ) : (
        <div className="space-y-3">
          {offres.map((o) => {
            const s = STATUTS[o.statut] ?? {
              libelle: o.statut,
              classe: "bg-ardoise-100 text-ardoise-700",
            };
            const n = note(o);
            const due = relanceDue(o.statut, o.relance_prevue_le);

            return (
              <Link key={o.id} href={`/offre/${o.id}`} prefetch={false}>
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
                      <p className="mt-1 text-xs text-ardoise-400">
                        Ajoutée le {jour(o.date_ajout)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {n !== null && (
                        <span
                          className={`text-lg font-semibold tabular-nums ${couleurNote(
                            n
                          )}`}
                        >
                          {n} %
                        </span>
                      )}
                      {due && (
                        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-900">
                          À relancer
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
