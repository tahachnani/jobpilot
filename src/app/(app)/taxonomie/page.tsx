import { TitrePage, Carte } from "@/components/ui";
import BoutonSoumettre from "@/components/BoutonSoumettre";
import { creerClientServeur } from "@/lib/supabase/server";
import { FAMILLES_ACTIVITE, lireActivites, type Activite } from "@/lib/taxonomie";
import { ACTIVITES } from "@/config/activites";
import {
  ajouterActivite,
  modifierActivite,
  supprimerActivite,
} from "./actions";
import Link from "next/link";

export const dynamic = "force-dynamic";

/**
 * La taxonomie des activités, vue et modifiée (D74).
 *
 * C'est le pivot de tout le calcul : l'IA ne compare pas des phrases, elle
 * classe dans cette liste, et le score compte ensuite des codes communs. Une
 * liste figée dans le code signifiait qu'un sujet absent — « amélioration
 * continue » — restait invisible au moteur quoi qu'on écrive ailleurs.
 *
 * La liste reste fermée. Ce qui change, c'est que c'est toi qui la fermes.
 */

const MESSAGES: Record<string, { texte: string; erreur: boolean }> = {
  ajoute: { texte: "Code ajouté à la taxonomie.", erreur: false },
  modifie: { texte: "Code mis à jour.", erreur: false },
  supprime: { texte: "Code supprimé.", erreur: false },
  libelle: { texte: "Il manque le libellé : rien n'a été enregistré.", erreur: true },
  famille: { texte: "Famille inconnue : rien n'a été enregistré.", erreur: true },
  code: {
    texte:
      "Ce code n'est pas utilisable : trois caractères au minimum, une lettre en tête, ni accent ni espace.",
    erreur: true,
  },
  existe: { texte: "Ce code existe déjà dans la taxonomie.", erreur: true },
  utilise: { texte: "Ce code est encore porté par des lignes de ta base.", erreur: true },
  erreur: { texte: "L'écriture a échoué.", erreur: true },
};

function Ligne({
  a,
  usages,
}: {
  a: Activite;
  usages: { missions: number; corpus: number };
}) {
  const porte = usages.missions + usages.corpus;

  return (
    <div className="rounded-lg border border-ardoise-100 bg-white p-3">
      <form action={modifierActivite} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="code" value={a.code} />

        <label className="text-xs text-ardoise-500">
          Libellé
          <input
            name="libelle"
            defaultValue={a.libelle}
            className="mt-1 block w-52 rounded-lg border border-ardoise-200 px-2 py-1.5 text-sm outline-none focus:border-ardoise-500"
          />
        </label>

        <label className="text-xs text-ardoise-500">
          Famille
          <select
            name="famille"
            defaultValue={a.famille}
            className="mt-1 block rounded-lg border border-ardoise-200 px-2 py-1.5 text-sm outline-none focus:border-ardoise-500"
          >
            {Object.entries(FAMILLES_ACTIVITE).map(([code, nom]) => (
              <option key={code} value={code}>
                {nom}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs text-ardoise-500">
          Ordre
          <input
            name="ordre"
            type="number"
            defaultValue={a.ordre}
            className="mt-1 block w-16 rounded-lg border border-ardoise-200 px-2 py-1.5 text-sm outline-none focus:border-ardoise-500"
          />
        </label>

        <label
          className="flex items-center gap-1.5 pb-2 text-xs text-ardoise-600"
          title="Un code hors service reste compris par le moteur, mais n'est plus proposé au modèle ni à la saisie."
        >
          <input
            type="checkbox"
            name="actif"
            value="1"
            defaultChecked={a.actif}
            className="h-3.5 w-3.5"
          />
          En service
        </label>

        <button
          type="submit"
          className="mb-1 rounded-lg border border-ardoise-300 px-3 py-1.5 text-xs font-medium text-ardoise-700 hover:bg-ardoise-50"
        >
          Enregistrer
        </button>
      </form>

      <div className="mt-2 flex flex-wrap items-center gap-3 border-t border-ardoise-100 pt-2">
        <code className="rounded bg-ardoise-50 px-1.5 py-0.5 text-[11px] text-ardoise-600">
          {a.code}
        </code>
        {a.socle && (
          <span className="text-[11px] text-ardoise-400">socle d&apos;origine</span>
        )}
        <span className="text-[11px] text-ardoise-500">
          {porte === 0
            ? "porté par aucune ligne"
            : `${usages.missions} mission${usages.missions > 1 ? "s" : ""} · ${
                usages.corpus
              } entrée${usages.corpus > 1 ? "s" : ""} de corpus`}
        </span>

        {porte === 0 && (
          <form action={supprimerActivite} className="ml-auto">
            <input type="hidden" name="code" value={a.code} />
            <BoutonSoumettre
              libelle="Supprimer"
              libelleEnCours="Suppression…"
              confirmation={`Supprimer définitivement le code ${a.code} ?`}
              className="rounded-lg border border-rose-200 px-2.5 py-1 text-[11px] text-rose-700 hover:bg-rose-50"
            />
          </form>
        )}
      </div>
    </div>
  );
}

export default async function Taxonomie({
  searchParams,
}: {
  searchParams: { etat?: string; detail?: string };
}) {
  const { lignes, disponible } = await lireActivites();

  /**
   * Les usages, comptés en deux requêtes plutôt qu'en deux par code.
   *
   * Ils décident de ce qui est supprimable, et ils disent surtout une chose
   * utile : un code que rien ne porte ne pèse rien dans aucun score.
   */
  const supabase = creerClientServeur();
  const [m, c] = await Promise.all([
    supabase.from("missions").select("activites_codes"),
    supabase.from("corpus_experience").select("activites_codes"),
  ]);

  const usages = new Map<string, { missions: number; corpus: number }>();
  const compter = (
    rangs: { activites_codes: string[] | null }[] | null,
    champ: "missions" | "corpus"
  ) => {
    for (const r of rangs ?? []) {
      for (const code of [...new Set(r.activites_codes ?? [])]) {
        const u = usages.get(code) ?? { missions: 0, corpus: 0 };
        u[champ] += 1;
        usages.set(code, u);
      }
    }
  };
  compter(m.data as { activites_codes: string[] | null }[] | null, "missions");
  compter(c.data as { activites_codes: string[] | null }[] | null, "corpus");

  // Un code porté par une mission mais absent de la liste : l'inverse du
  // problème habituel, et tout aussi muet. Il se voit ici plutôt que nulle part.
  const connus = new Set(lignes.map((a) => a.code));
  const orphelins = [...usages.keys()].filter((c) => !connus.has(c));

  const parFamille = Object.keys(FAMILLES_ACTIVITE).map((f) => ({
    famille: f,
    codes: lignes.filter((a) => a.famille === f),
  }));

  const message = searchParams.etat ? MESSAGES[searchParams.etat] : undefined;
  const horsService = lignes.filter((a) => !a.actif).length;

  return (
    <>
      <TitrePage
        titre="🧭 Taxonomie"
        sousTitre="La liste fermée des activités — le pivot de tout le calcul"
      />

      {!disponible && (
        <Carte className="mb-4 border-rose-200 bg-rose-50">
          <p className="text-sm font-medium text-rose-900">
            La table n&apos;existe pas encore.
          </p>
          <p className="mt-1 text-xs leading-relaxed text-rose-800">
            Lance la migration{" "}
            <code className="rounded bg-white px-1">0011_taxonomie.sql</code>{" "}
            dans Supabase. En attendant, l&apos;application continue de tourner
            sur les trente codes du fichier versionné — rien n&apos;est cassé,
            mais rien n&apos;est modifiable non plus.
          </p>
        </Carte>
      )}

      {message && (
        <Carte
          className={`mb-4 ${
            message.erreur
              ? "border-rose-200 bg-rose-50"
              : "border-emerald-200 bg-emerald-50"
          }`}
        >
          <p
            className={`text-sm ${
              message.erreur ? "text-rose-900" : "text-emerald-900"
            }`}
          >
            {message.texte}
            {searchParams.detail && searchParams.etat === "utilise" && (
              <>
                {" "}
                {searchParams.detail.split("|")[1]} mission(s) et{" "}
                {searchParams.detail.split("|")[2]} entrée(s) de corpus le
                portent. Retire-le d&apos;abord de ces lignes, ou mets-le
                simplement hors service : rien ne sera effacé.
              </>
            )}
            {searchParams.detail && searchParams.etat === "erreur" && (
              <> {searchParams.detail}</>
            )}
          </p>
          {!message.erreur && (
            <p className="mt-1 text-xs text-emerald-800">
              La version du barème a changé : les scores déjà calculés ne
              connaissent pas cette liste.{" "}
              <Link href="/parametres" className="underline" prefetch={false}>
                Renote tes offres
              </Link>{" "}
              — aucun appel IA, aucun coût.
            </p>
          )}
        </Carte>
      )}

      <Carte className="mb-4">
        <p className="text-sm leading-relaxed text-ardoise-600">
          L&apos;IA ne compare pas des phrases : elle classe chaque mission
          d&apos;une offre dans cette liste, et le score compte ensuite les
          codes communs avec tes missions. Un sujet absent d&apos;ici est
          invisible au moteur, quoi que tu écrives ailleurs.
        </p>
        <p className="mt-2 text-xs leading-relaxed text-ardoise-500">
          Le <strong>code</strong> est un identifiant : il ne se renomme pas,
          parce qu&apos;il est recopié tel quel dans tes missions, ton corpus et
          les analyses déjà payées. Le <strong>libellé</strong>, lui, se corrige
          librement — c&apos;est ce que tu lis à l&apos;écran. Un code{" "}
          <strong>hors service</strong> n&apos;est plus proposé au modèle ni à
          la saisie, mais le moteur continue de le comprendre : c&apos;est une
          retraite, pas un effacement.
        </p>
      </Carte>

      <Carte className="mb-4">
        <details>
          <summary className="cursor-pointer text-sm font-medium text-ardoise-800">
            Ajouter un code
          </summary>
          <form action={ajouterActivite} className="mt-3 flex flex-wrap items-end gap-2">
            <label className="text-xs text-ardoise-500">
              Libellé
              <input
                name="libelle"
                placeholder="Amélioration continue"
                className="mt-1 block w-60 rounded-lg border border-ardoise-200 px-2 py-1.5 text-sm outline-none focus:border-ardoise-500"
              />
            </label>
            <label className="text-xs text-ardoise-500">
              Famille
              <select
                name="famille"
                defaultValue="transverse"
                className="mt-1 block rounded-lg border border-ardoise-200 px-2 py-1.5 text-sm outline-none focus:border-ardoise-500"
              >
                {Object.entries(FAMILLES_ACTIVITE).map(([code, nom]) => (
                  <option key={code} value={code}>
                    {nom}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-ardoise-500">
              Code (facultatif)
              <input
                name="code"
                placeholder="déduit du libellé"
                className="mt-1 block w-52 rounded-lg border border-ardoise-200 px-2 py-1.5 text-sm outline-none focus:border-ardoise-500"
              />
            </label>
            <BoutonSoumettre
              libelle="Ajouter"
              libelleEnCours="Ajout…"
              className="mb-1 rounded-lg bg-ardoise-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-ardoise-800"
            />
          </form>
          <p className="mt-2 text-xs leading-relaxed text-ardoise-400">
            Ajouter un code ne classe rien tout seul : il faut ensuite
            l&apos;affecter aux missions concernées dans{" "}
            <Link href="/profil" className="underline" prefetch={false}>
              Mon profil
            </Link>
            , puis renoter. Les offres analysées après coup, elles, le
            connaîtront dès leur première analyse.
          </p>
        </details>
      </Carte>

      {orphelins.length > 0 && (
        <Carte className="mb-4 border-amber-200 bg-amber-50">
          <p className="text-sm text-amber-900">
            {orphelins.length} code{orphelins.length > 1 ? "s" : ""} porté
            {orphelins.length > 1 ? "s" : ""} par ta base mais absent
            {orphelins.length > 1 ? "s" : ""} de la taxonomie :{" "}
            <strong>{orphelins.join(", ")}</strong>.
          </p>
          <p className="mt-1 text-xs text-amber-800">
            Ces lignes ne comptent dans aucun score. Crée le code avec
            exactement ce libellé d&apos;identifiant pour les rattraper, ou
            corrige les lignes concernées.
          </p>
        </Carte>
      )}

      <p className="mb-3 text-xs text-ardoise-400">
        {lignes.length > 0
          ? `${lignes.length} codes, dont ${
              lignes.filter((a) => a.socle).length
            } du socle d'origine${
              horsService > 0 ? ` · ${horsService} hors service` : ""
            }.`
          : `Aucun code en base — l'application tourne sur les ${
              Object.keys(ACTIVITES).length
            } codes du fichier versionné.`}
      </p>

      <div className="space-y-6">
        {parFamille.map(({ famille, codes }) => (
          <div key={famille}>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ardoise-500">
              {FAMILLES_ACTIVITE[famille]} ({codes.length})
            </h2>
            <div className="space-y-2">
              {codes.map((a) => (
                <Ligne
                  key={a.code}
                  a={a}
                  usages={usages.get(a.code) ?? { missions: 0, corpus: 0 }}
                />
              ))}
              {codes.length === 0 && (
                <p className="text-xs text-ardoise-400">Aucun code.</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
