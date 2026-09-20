import { TitrePage, Carte } from "@/components/ui";
import BoutonSoumettre from "@/components/BoutonSoumettre";
import { creerClientServeur } from "@/lib/supabase/server";
import { budgetDuMois, montant } from "@/lib/couts";
import FormulaireImport from "@/components/FormulaireImport";
import Link from "next/link";
import {
  importerSauvegarde,
  modifierParametre,
  recalculerTousLesScores,
} from "./actions";

export const dynamic = "force-dynamic";

const EXPLICATIONS: Record<string, string> = {
  bareme:
    "Poids des quatre sous-scores, par volet. Toute modification incrémente la version : recalcule ensuite pour que toutes les offres soient notées sur le même barème.",
  coefficients_anciennete:
    "Ce que compte une année de chaque type de contrat dans l'ancienneté pondérée. Un stage vaut une demi-année.",
  budget_ia:
    "Plafond mensuel de dépense. Il avertit sur le tableau de bord, il ne bloque aucune génération.",
  mode_generation_defaut: "Réservé. Sans effet aujourd'hui.",
};

function message(etat: string | undefined, budgetDepense: string) {
  if (!etat) return null;
  if (etat === "json")
    return {
      ton: "rose",
      texte:
        "Le texte saisi n'est pas un JSON valide : rien n'a été enregistré. Vérifie les virgules et les guillemets.",
    };
  if (etat === "erreur")
    return { ton: "rose", texte: "L'enregistrement a échoué côté base." };
  if (etat === "enregistre")
    return { ton: "emerald", texte: "Paramètre enregistré." };
  if (etat === "import-json")
    return {
      ton: "rose",
      texte: "Le fichier choisi n'est pas un JSON lisible : rien n'a été importé.",
    };
  if (etat === "import-erreur")
    return { ton: "rose", texte: "L'import a échoué : rien n'a été modifié." };
  if (etat.startsWith("import-")) {
    const n = etat.slice("import-".length);
    return {
      ton: "emerald",
      texte:
        Number(n) === 0
          ? "Import terminé : tout ce que contenait la sauvegarde était déjà là."
          : `${n} ligne${Number(n) > 1 ? "s" : ""} ajoutée${
              Number(n) > 1 ? "s" : ""
            }. Rien de ce qui existait n'a été modifié.`,
    };
  }
  if (etat.startsWith("recalcul-")) {
    const n = etat.slice("recalcul-".length);
    return {
      ton: "emerald",
      texte: `${n} offre${Number(n) > 1 ? "s" : ""} renotée${
        Number(n) > 1 ? "s" : ""
      } sur le barème courant. Aucun appel IA, dépense du mois inchangée (${budgetDepense}).`,
    };
  }
  return null;
}

export default async function Parametres({
  searchParams,
}: {
  searchParams: { etat?: string };
}) {
  const supabase = creerClientServeur();
  const [{ data }, budget] = await Promise.all([
    supabase.from("parametres").select("cle, valeur").order("cle"),
    budgetDuMois(),
  ]);

  const m = message(searchParams.etat, montant(budget.depense));

  return (
    <>
      <TitrePage
        titre="⚙️ Paramètres"
        sousTitre="Valeurs modifiables sans redéploiement"
      />

      {m && (
        <Carte
          className={`mb-4 ${
            m.ton === "rose"
              ? "border-rose-200 bg-rose-50"
              : "border-emerald-200 bg-emerald-50"
          }`}
        >
          <p
            className={`text-sm ${
              m.ton === "rose" ? "text-rose-900" : "text-emerald-900"
            }`}
          >
            {m.texte}
          </p>
        </Carte>
      )}

      <Carte className="mb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-ardoise-800">
              Dépense IA du mois
            </p>
            <p className="mt-0.5 text-sm text-ardoise-500">
              {montant(budget.depense)} sur un plafond de{" "}
              {montant(budget.plafond)} · {budget.appels} appel
              {budget.appels > 1 ? "s" : ""}
              {budget.echecs > 0 && `, dont ${budget.echecs} en échec`}
            </p>
          </div>
          <form action={recalculerTousLesScores}>
            <BoutonSoumettre
              libelle="Recalculer tous les scores"
              libelleEnCours="Recalcul en cours…"
              confirmation="Renoter toutes les offres sur le barème actuel ? Aucun appel IA, donc aucun coût."
              className="rounded-lg border border-ardoise-300 px-4 py-2 text-sm font-medium text-ardoise-700 transition hover:bg-ardoise-50"
            />
          </form>
        </div>
      </Carte>

      {!data || data.length === 0 ? (
        <Carte className="border-dashed">
          <p className="text-sm text-ardoise-500">
            Aucun paramètre lu. Si la migration a bien été appliquée, cela
            signifie que les lignes appartiennent à un autre compte :
            reconnecte-toi puis rejoue la section 9 de la migration.
          </p>
        </Carte>
      ) : (
        <div className="space-y-4">
          {data.map((p) => (
            <Carte key={p.cle}>
              <p className="text-sm font-medium text-ardoise-800">{p.cle}</p>
              {EXPLICATIONS[p.cle] && (
                <p className="mt-1 text-xs leading-relaxed text-ardoise-500">
                  {EXPLICATIONS[p.cle]}
                </p>
              )}
              <form action={modifierParametre} className="mt-3">
                <input type="hidden" name="cle" value={p.cle} />
                <textarea
                  name="valeur"
                  defaultValue={JSON.stringify(p.valeur, null, 2)}
                  rows={Math.min(
                    18,
                    JSON.stringify(p.valeur, null, 2).split("\n").length + 1
                  )}
                  spellCheck={false}
                  className="w-full rounded-lg border border-ardoise-200 bg-ardoise-50 p-3 font-mono text-xs leading-relaxed text-ardoise-700 outline-none focus:border-ardoise-500 focus:bg-white"
                />
                <BoutonSoumettre
                  libelle="Enregistrer"
                  libelleEnCours="Enregistrement…"
                  className="mt-2 rounded-lg border border-ardoise-300 px-3 py-1.5 text-xs font-medium text-ardoise-700 transition hover:bg-ardoise-50"
                />
              </form>
            </Carte>
          ))}
        </div>
      )}

      <Carte className="mt-6">
        <p className="text-sm font-medium text-ardoise-800">
          Sauvegarde de la base
        </p>
        <p className="mt-1 text-xs leading-relaxed text-ardoise-500">
          Tout ce que tu as construit — profil, missions, formulations
          validées, corpus, offres analysées et scores — tient dans un seul
          fichier JSON. Les PDF n&apos;y sont pas : ils se régénèrent à partir
          de ce que contient ce fichier.
        </p>

        <Link
          href="/sauvegarde"
          prefetch={false}
          className="mt-3 inline-block rounded-lg bg-ardoise-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-ardoise-800"
        >
          Télécharger la sauvegarde
        </Link>

        <div className="mt-4 border-t border-ardoise-100 pt-3">
          <p className="text-xs font-medium text-ardoise-600">
            Réimporter une sauvegarde
          </p>
          <p className="mt-1 text-xs leading-relaxed text-ardoise-500">
            L&apos;import n&apos;écrase rien : il ajoute les lignes absentes et
            laisse les autres en place. Il restaure donc entièrement une base
            vide, et ne peut pas abîmer une base pleine.
          </p>
          <FormulaireImport action={importerSauvegarde} />
        </div>
      </Carte>

      <p className="mt-6 text-xs leading-relaxed text-ardoise-400">
        Une valeur mal écrite est refusée avant d&apos;atteindre la base : en
        cas de doute, modifie un nombre à la fois. Le barème incrémente sa
        version tout seul dès que son contenu change.
      </p>
    </>
  );
}
