"use client";

import { useState } from "react";
import BoutonSoumettre from "@/components/BoutonSoumettre";

/**
 * Choix du fichier de sauvegarde, puis envoi de son contenu.
 *
 * Le fichier est lu dans le navigateur et transmis comme texte : une action
 * serveur ne reçoit pas de fichier autrement, et cela permet de refuser un
 * JSON invalide avant même de partir.
 */
export default function FormulaireImport({
  action,
}: {
  action: (formData: FormData) => void;
}) {
  const [contenu, setContenu] = useState("");
  const [nom, setNom] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [resume, setResume] = useState<string | null>(null);

  async function lire(fichier: File | undefined) {
    setErreur(null);
    setResume(null);
    setContenu("");
    setNom("");
    if (!fichier) return;

    const texte = await fichier.text();
    try {
      const objet = JSON.parse(texte) as {
        genere_le?: string;
        tables?: Record<string, unknown[]>;
      };
      const tables = objet.tables ?? {};
      const lignes = Object.values(tables).reduce(
        (n, t) => n + (Array.isArray(t) ? t.length : 0),
        0
      );
      setResume(
        `${lignes} ligne${lignes > 1 ? "s" : ""} dans ${
          Object.keys(tables).length
        } tables${
          objet.genere_le
            ? `, sauvegarde du ${new Date(objet.genere_le).toLocaleDateString("fr-FR")}`
            : ""
        }.`
      );
      setContenu(texte);
      setNom(fichier.name);
    } catch {
      setErreur("Ce fichier n'est pas un JSON lisible.");
    }
  }

  return (
    <form action={action} className="mt-3">
      <input type="hidden" name="contenu" value={contenu} />
      <input
        type="file"
        accept="application/json,.json"
        onChange={(e) => void lire(e.target.files?.[0])}
        className="block w-full text-xs text-ardoise-600 file:mr-3 file:rounded-lg file:border file:border-ardoise-300 file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-ardoise-700"
      />

      {erreur && <p className="mt-2 text-xs text-rose-700">{erreur}</p>}
      {resume && (
        <p className="mt-2 text-xs text-ardoise-500">
          {nom} — {resume}
        </p>
      )}

      {contenu && (
        <BoutonSoumettre
          libelle="Importer ce qui manque"
          libelleEnCours="Import en cours…"
          confirmation="Ajouter les lignes absentes de la base ? Rien de ce qui existe ne sera modifié."
          className="mt-3 rounded-lg border border-ardoise-300 px-3 py-1.5 text-xs font-medium text-ardoise-700 transition hover:bg-ardoise-50"
        />
      )}
    </form>
  );
}
