import { TitrePage, Carte, Indicateur } from "@/components/ui";
import { LISTE_VOLETS, STATUTS_ENVOYES } from "@/config/volets";
import { creerClientServeur } from "@/lib/supabase/server";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function TableauDeBord() {
  const supabase = creerClientServeur();

  const { data: offres } = await supabase
    .from("offres")
    .select("id, volet, statut");

  const liste = offres ?? [];
  const envoyees = liste.filter((o) => STATUTS_ENVOYES.includes(o.statut));
  const entretiens = liste.filter((o) => o.statut === "entretien");
  const refus = liste.filter((o) => o.statut === "refusee");
  const enAttente = envoyees.filter((o) => o.statut === "envoyee");

  const pourcentage = (n: number, total: number) =>
    total === 0 ? "—" : `${Math.round((n / total) * 100)} %`;

  const reponses = entretiens.length + refus.length;

  return (
    <>
      <TitrePage
        titre="🏠 Tableau de bord"
        sousTitre="Vue d'ensemble de la recherche"
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
          valeur="0,00 $"
          precision="plafond 10 $"
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
          Étape 1 terminée : le socle est en ligne
        </p>
        <p className="mt-2 text-sm text-ardoise-500">
          Connexion, base de données, sécurité et navigation fonctionnent.
          L&apos;étape 2 constitue ta base professionnelle à partir de tes deux
          CV, avec validation ligne par ligne.
        </p>
      </Carte>
    </>
  );
}
