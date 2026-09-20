import type { ReactNode } from "react";

export function Carte({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-ardoise-200 bg-white p-5 shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

export function Indicateur({
  libelle,
  valeur,
  precision,
}: {
  libelle: string;
  valeur: string | number;
  precision?: string;
}) {
  return (
    <Carte>
      <p className="text-sm font-medium text-ardoise-500">{libelle}</p>
      <p className="mt-2 text-3xl font-semibold tabular-nums text-ardoise-900">
        {valeur}
      </p>
      {precision && (
        <p className="mt-1 text-xs text-ardoise-400">{precision}</p>
      )}
    </Carte>
  );
}

export function TitrePage({
  titre,
  sousTitre,
  action,
}: {
  titre: string;
  sousTitre?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-ardoise-900">{titre}</h1>
        {sousTitre && (
          <p className="mt-1 text-sm text-ardoise-500">{sousTitre}</p>
        )}
      </div>
      {action}
    </div>
  );
}

export function EtatVide({
  titre,
  description,
  etape,
}: {
  titre: string;
  description: string;
  etape?: string;
}) {
  return (
    <Carte className="border-dashed text-center">
      <p className="text-base font-medium text-ardoise-700">{titre}</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-ardoise-500">
        {description}
      </p>
      {etape && (
        <p className="mt-4 inline-block rounded-full bg-ardoise-100 px-3 py-1 text-xs font-medium text-ardoise-600">
          Disponible à l&apos;{etape}
        </p>
      )}
    </Carte>
  );
}

/**
 * Bandeau d'alerte de budget IA.
 *
 * Il avertit sans jamais empêcher : le plafond est une limite que tu t'es
 * fixée, pas une règle de l'application. Rien ne s'affiche tant que la
 * dépense reste loin du plafond.
 */
export function AlerteBudget({
  depense,
  plafond,
  depasse,
  proche,
}: {
  depense: string;
  plafond: string;
  depasse: boolean;
  proche: boolean;
}) {
  if (!depasse && !proche) return null;

  return (
    <Carte
      className={`mb-4 ${
        depasse ? "border-rose-200 bg-rose-50" : "border-amber-200 bg-amber-50"
      }`}
    >
      <p
        className={`text-sm ${depasse ? "text-rose-900" : "text-amber-900"}`}
      >
        {depasse
          ? `Plafond mensuel dépassé : ${depense} dépensés sur ${plafond}. Rien n'est bloqué — les générations continuent de coûter.`
          : `Budget IA du mois : ${depense} sur ${plafond}.`}
      </p>
    </Carte>
  );
}
