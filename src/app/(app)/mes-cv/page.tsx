import { Carte, TitrePage, EtatVide } from "@/components/ui";
import { VOLETS, type CodeVolet } from "@/config/volets";
import { creerClientServeur } from "@/lib/supabase/server";
import type { ModeleCV } from "@/lib/cv/modele";
import Link from "next/link";

export const dynamic = "force-dynamic";

interface LigneDocument {
  id: string;
  version: number;
  created_at: string;
  volet: CodeVolet;
  offre_id: string | null;
  selection: { modele?: ModeleCV } | null;
  offres: { intitule: string | null; entreprise: string | null } | null;
}

function dateLisible(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function MesCV() {
  const supabase = creerClientServeur();

  const { data } = await supabase
    .from("documents")
    .select(
      "id, version, created_at, volet, offre_id, selection, offres ( intitule, entreprise )"
    )
    .eq("type", "cv")
    .order("created_at", { ascending: false });

  const documents = (data ?? []) as unknown as LigneDocument[];

  // Un CV appartient à une offre ; les versions s'empilent sous elle, la plus
  // récente en tête. Régénérer ajoute une version, ne remplace pas.
  const parOffre = new Map<string, LigneDocument[]>();
  for (const d of documents) {
    const cle = d.offre_id ?? d.id;
    const liste = parOffre.get(cle) ?? [];
    liste.push(d);
    parOffre.set(cle, liste);
  }

  const groupes = [...parOffre.values()].map((liste) =>
    [...liste].sort((a, b) => b.version - a.version)
  );

  return (
    <>
      <TitrePage
        titre="📄 Mes CV"
        sousTitre={
          documents.length === 0
            ? "CV générés pour tes offres"
            : `${documents.length} CV généré${
                documents.length > 1 ? "s" : ""
              } sur ${groupes.length} offre${groupes.length > 1 ? "s" : ""}`
        }
      />

      {groupes.length === 0 ? (
        <EtatVide
          titre="Aucun CV généré"
          description="Ouvre une offre analysée et clique sur « Générer le CV ». La sélection des missions est déterministe et n'appelle pas l'IA : générer et régénérer ne coûte rien."
        />
      ) : (
        <div className="space-y-4">
          {groupes.map((versions) => {
            const dernier = versions[0];
            const volet = VOLETS[dernier.volet];
            const modele = dernier.selection?.modele ?? null;

            return (
              <Carte key={dernier.id}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ardoise-800">
                      {dernier.offres?.intitule ?? "Offre supprimée"}
                    </p>
                    <p className="mt-0.5 truncate text-sm text-ardoise-500">
                      {[dernier.offres?.entreprise, volet?.nom]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    <p className="mt-1 text-xs text-ardoise-400">
                      Version {dernier.version} —{" "}
                      {dateLisible(dernier.created_at)}
                      {modele
                        ? ` · ${modele.meta.nbEmprunts} emprunt${
                            modele.meta.nbEmprunts > 1 ? "s" : ""
                          }`
                        : ""}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2">
                    <a
                      href={`/document/${dernier.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg border border-ardoise-300 px-3 py-1.5 text-xs font-medium text-ardoise-700 transition hover:bg-ardoise-50"
                    >
                      Ouvrir
                    </a>
                    <a
                      href={`/document/${dernier.id}?telecharger=1`}
                      className="rounded-lg border border-ardoise-300 px-3 py-1.5 text-xs font-medium text-ardoise-700 transition hover:bg-ardoise-50"
                    >
                      Télécharger
                    </a>
                    {dernier.offre_id && (
                      <Link
                        href={`/offre/${dernier.offre_id}`}
                        className="rounded-lg border border-ardoise-300 px-3 py-1.5 text-xs font-medium text-ardoise-700 transition hover:bg-ardoise-50"
                      >
                        Voir l&apos;offre
                      </Link>
                    )}
                  </div>
                </div>

                {versions.length > 1 && (
                  <details className="mt-3 border-t border-ardoise-100 pt-3">
                    <summary className="cursor-pointer text-xs font-medium text-ardoise-500">
                      Versions précédentes ({versions.length - 1})
                    </summary>
                    <ul className="mt-2 space-y-1">
                      {versions.slice(1).map((v) => (
                        <li
                          key={v.id}
                          className="flex items-center justify-between gap-3 text-xs text-ardoise-600"
                        >
                          <span>
                            Version {v.version} — {dateLisible(v.created_at)}
                          </span>
                          <a
                            href={`/document/${v.id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="shrink-0 font-medium text-ardoise-500 underline"
                          >
                            Ouvrir
                          </a>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </Carte>
            );
          })}
        </div>
      )}

      <Carte className="mt-6 border-dashed">
        <p className="text-sm text-ardoise-500">
          Chaque CV conserve la sélection qui l&apos;a produit : le PDF reste
          reproductible à l&apos;identique même si la base professionnelle
          évolue ensuite. Les textes de missions sont ceux de tes formulations,
          repris mot pour mot — aucune reformulation par l&apos;IA.
        </p>
      </Carte>
    </>
  );
}
