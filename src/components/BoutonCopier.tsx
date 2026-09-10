"use client";

import { useState } from "react";

/**
 * Copie un texte dans le presse-papiers.
 *
 * Sélectionner un email à la main sur mobile est pénible, et on y oublie
 * facilement la dernière ligne.
 */
export default function BoutonCopier({
  texte,
  className = "",
}: {
  texte: string;
  className?: string;
}) {
  const [copie, setCopie] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(texte);
          setCopie(true);
          setTimeout(() => setCopie(false), 2000);
        } catch {
          setCopie(false);
        }
      }}
      className={className}
    >
      {copie ? "Copié" : "Copier l'email"}
    </button>
  );
}
