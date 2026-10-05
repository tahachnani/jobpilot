"use client";

import { useFormStatus } from "react-dom";

/**
 * Bouton de soumission conscient de l'état du formulaire.
 *
 * Sans retour visible, une action serveur longue — l'analyse d'une offre en
 * prend plusieurs — donne l'impression que le clic n'a pas pris, et l'on
 * clique une seconde fois. Le bouton se désactive donc pendant le traitement
 * et dit ce qui se passe.
 */
export default function BoutonSoumettre({
  libelle,
  libelleEnCours,
  className = "",
  confirmation,
}: {
  libelle: string;
  libelleEnCours: string;
  className?: string;
  confirmation?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      onClick={(e) => {
        if (confirmation && !window.confirm(confirmation)) {
          e.preventDefault();
        }
      }}
      className={`${className} disabled:cursor-not-allowed disabled:opacity-60`}
    >
      {pending ? libelleEnCours : libelle}
    </button>
  );
}
