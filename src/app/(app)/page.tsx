import { TitrePage, Carte, Indicateur, AlerteBudget } from "@/components/ui";
import { LISTE_VOLETS, STATUTS_ENVOYES, VOLETS } from "@/config/volets";
import { creerClientServeur } from "@/lib/supabase/server";
import { jour, joursDepuis, relanceDue } from "@/lib/suivi";
import { budgetDuMois, montant } from "@/lib/couts";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function TableauDeBord() {
  const supabase = creerClientServeur();
  const budget = await budgetDuMois();

  const { data: offres } = await supabase
    .from("offres")
    .select(
      "id, volet, statut, intitule, entreprise, date_candidature, relance_prevue_le, relances"
    );

  const liste = (offres ?? []) as {
    id: string;
    volet: string;
    statut: string;
    intitule: string | null;
    entreprise: string | null;
    date_candidature: string | null;
    relance_prevue_le: string | null;
    relances: number | null;
  }[];
  const envoyees = liste.filter((o) => STATUTS_ENVOYES.includes(o.statut));
  const entretiens = liste.filter((o) => o.statut === "entretien");
  const refus = liste.filter((o) => o.statut === "refusee");
  const enAttente = envoyees.filter((o) => o.statut === "envoyee");

  const pourcentage = (n: number, total: number) =>
    total === 0 ? "—" : `${Math.round((n / total) * 100)} %`;

  const reponses = entretiens.length + refus.length;

  // Les relances dues (D50). La liste disparaît quand elle est vide : un
  // tableau de bord qui affiche en permanence une section sans contenu finit
  // par ne plus être lu.
  const relances = liste
    .filter((o) => relanceDue(o.statut, o.relance_prevue_le))
    .sort((a, b) =>
      (a.relance_prevue_le ?? "").localeCompare(b.relance_prevue_le ?? "")
    );

  return (
    <>
      <TitrePage
        titre="🏠 Tableau de bord"
        sousTitre="Vue d'ensemble de la recherche"
      />

      <AlerteBudget
        depense={montant(budget.depense)}
        plafond={montant(budget.plafond)}
        depasse={budget.depasse}
        proche={budget.proche}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Indicateur libelle="Offres enregistrées" valeur={liste.length} />
        <Indicateur libelle="Candidatures envoyées" valeur={envoyees.length} />
        <Indicateur
          libelle="En attente de réponse"
          valeur={enAttente.length}
        />
        <Indicateur libelle="Entretiens" valeur={entretiens.length} />
      </div>

      {relances.length > 0 && (
        <>
          <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-ardoise-500">
            À relancer ({relances.length})
          </h2>
          <div className="space-y-2">
            {relances.map((o) => {
              const jours = joursDepuis(o.date_candidature);
              return (
                <Link key={o.id} href={`/offre/${o.id}`}>
                  <Carte className="border-amber-200 bg-amber-50/60 transition hover:border-amber-400">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-ardoise-900">
                          {o.intitule ?? "Sans intitulé"}
                        </p>
                        <p className="mt-0.5 text-sm text-ardoise-500">
                          {[
                            o.entreprise,
                            VOLETS[o.volet as "cdg" | "compta"]?.nomCourt,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                      <p className="text-xs text-ardoise-500">
                        Envoyée le {jour(o.date_candidature)}
                        {jours !== null && ` · il y a ${jours} j`}
                        {(o.relances ?? 0) > 0 &&
                          ` · déjà relancée ${o.relances} fois`}
                      </p>
                    </div>
                  </Carte>
                </Link>
              );
            })}
          </div>
        </>
      )}

      <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Indicateur libelle="Refus" valeur={refus.length} />
        <Indicateur
          libelle="Taux de réponse"
          valeur={pourcentage(reponses, envoyees.length)}
          precision="sur candidatures envoyées"
        />
        <Indicateur
          libelle="Taux d'entretien"
          valeur={pourcentage(entretiens.length, envoyees.length)}
          precision="sur candidatures envoyées"
        />
        <Indicateur
          libelle="Coût IA du mois"
          valeur={montant(budget.depense)}
          precision={`plafond ${montant(budget.plafond)} · ${budget.appels} appel${
            budget.appels > 1 ? "s" : ""
          }`}
        />
      </div>

      <h2 className="mb-4 mt-10 text-sm font-semibold uppercase tracking-wide text-ardoise-500">
        Les deux espaces
      </h2>
      <div className="grid gap-4 lg:grid-cols-2">
        {LISTE_VOLETS.map((v) => {
          const n = liste.filter((o) => o.volet === v.code).length;
          return (
            <Link key={v.code} href={`/${v.slug}/offres`}>
              <Carte className="transition hover:border-ardoise-400">
                <p className="text-lg font-medium text-ardoise-900">
                  {v.emoji} {v.nom}
                </p>
                <p className="mt-1 text-sm text-ardoise-500">
                  {n} offre{n > 1 ? "s" : ""} enregistrée{n > 1 ? "s" : ""}
                </p>
                <p className="mt-3 text-xs text-ardoise-400">
                  {v.intitulesCibles.slice(0, 3).join(" · ")}
                </p>
              </Carte>
            </Link>
          );
        })}
      </div>

      <Carte className="mt-8 border-dashed">
        <p className="text-sm font-medium text-ardoise-700">
          Toutes les étapes sont en ligne
        </p>
        <p className="mt-2 text-sm text-ardoise-500">
          Analyse et score, CV personnalisé en PDF, reformulation des missions
          sur le vocabulaire de l&apos;annonce, lettre et email, puis suivi de
          la candidature. Le statut avance tout seul pendant la préparation ;
          l&apos;envoi, lui, se déclare toujours à la main.
        </p>
      </Carte>
    </>
  );
}
