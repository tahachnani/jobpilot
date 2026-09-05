"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LISTE_VOLETS } from "@/config/volets";

interface Lien {
  href: string;
  libelle: string;
  emoji: string;
  bientot?: boolean;
}

export default function Navigation({ email }: { email: string }) {
  const chemin = usePathname();
  const [ouvert, setOuvert] = useState(false);

  const liensHaut: Lien[] = [{ href: "/", libelle: "Tableau de bord", emoji: "🏠" }];

  const liensBas: Lien[] = [
    { href: "/marche-cache", libelle: "Marché caché", emoji: "🕵️", bientot: true },
    { href: "/mes-cv", libelle: "Mes CV", emoji: "📄" },
    { href: "/profil", libelle: "Mon profil", emoji: "👤" },
    { href: "/parametres", libelle: "Paramètres", emoji: "⚙️" },
  ];

  const estActif = (href: string) =>
    href === "/" ? chemin === "/" : chemin.startsWith(href);

  const classeLien = (href: string) =>
    `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
      estActif(href)
        ? "bg-ardoise-800 font-medium text-white"
        : "text-ardoise-300 hover:bg-ardoise-800/50 hover:text-white"
    }`;

  const contenu = (
    <nav className="flex h-full flex-col gap-1 overflow-y-auto p-4">
      <div className="mb-6 px-3">
        <p className="text-lg font-semibold text-white">JobPilot</p>
        <p className="mt-0.5 truncate text-xs text-ardoise-400">{email}</p>
      </div>

      {liensHaut.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          onClick={() => setOuvert(false)}
          className={classeLien(l.href)}
        >
          <span aria-hidden>{l.emoji}</span>
          {l.libelle}
        </Link>
      ))}

      {LISTE_VOLETS.map((v) => (
        <div key={v.code} className="mt-5">
          <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-ardoise-500">
            {v.emoji} {v.nom}
          </p>
          <Link
            href={`/${v.slug}/offres`}
            onClick={() => setOuvert(false)}
            className={classeLien(`/${v.slug}/offres`)}
          >
            <span className="w-4" aria-hidden />
            Offres
          </Link>
          <Link
            href={`/${v.slug}/candidatures`}
            onClick={() => setOuvert(false)}
            className={classeLien(`/${v.slug}/candidatures`)}
          >
            <span className="w-4" aria-hidden />
            Candidatures
          </Link>
        </div>
      ))}

      <div className="mt-5 border-t border-ardoise-800 pt-4">
        {liensBas.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            onClick={() => setOuvert(false)}
            className={classeLien(l.href)}
          >
            <span aria-hidden>{l.emoji}</span>
            <span className="flex-1">{l.libelle}</span>
            {l.bientot && (
              <span className="rounded bg-ardoise-700 px-1.5 py-0.5 text-[10px] text-ardoise-300">
                V1.1
              </span>
            )}
          </Link>
        ))}
      </div>

      <form action="/deconnexion" method="post" className="mt-auto pt-4">
        <button
          type="submit"
          className="w-full rounded-lg px-3 py-2 text-left text-sm text-ardoise-400 transition hover:bg-ardoise-800/50 hover:text-white"
        >
          Se déconnecter
        </button>
      </form>
    </nav>
  );

  return (
    <>
      {/* Barre mobile */}
      <div className="flex items-center justify-between border-b border-ardoise-200 bg-white px-4 py-3 lg:hidden">
        <span className="font-semibold text-ardoise-900">JobPilot</span>
        <button
          onClick={() => setOuvert(!ouvert)}
          className="rounded-lg border border-ardoise-200 px-3 py-1.5 text-sm text-ardoise-700"
          aria-expanded={ouvert}
        >
          {ouvert ? "Fermer" : "Menu"}
        </button>
      </div>

      {ouvert && (
        <div className="border-b border-ardoise-800 bg-ardoise-900 lg:hidden">
          {contenu}
        </div>
      )}

      {/* Colonne fixe sur grand écran */}
      <aside className="hidden w-64 shrink-0 bg-ardoise-900 lg:block">
        <div className="sticky top-0 h-screen">{contenu}</div>
      </aside>
    </>
  );
}
