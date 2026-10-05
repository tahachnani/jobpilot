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
  quoi = "l'email",
}: {
  texte: string;
  className?: string;
  /**
   * Ce qui est copié, au génitif : « la lettre », « la préparation ».
   *
   * Le composant a été écrit pour l'email puis réutilisé partout sans que le
   * libellé suive : la lettre de motivation et la fiche d'entretien
   * proposaient toutes deux « Copier l'email » (D86). Un bouton qui nomme
   * autre chose que ce qu'il fait finit par être cru.
   */
  quoi?: string;
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
      {copie ? "Copié" : `Copier ${quoi}`}
    </button>
  );
}
