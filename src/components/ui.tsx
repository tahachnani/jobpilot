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
