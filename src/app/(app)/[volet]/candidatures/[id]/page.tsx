import { TitrePage, Carte } from "@/components/ui";
import BoutonSoumettre from "@/components/BoutonSoumettre";
import BoutonCopier from "@/components/BoutonCopier";
import { STATUTS, voletDepuisSlug } from "@/config/volets";
import {
  CANAL_PAR_DEFAUT,
  CANAUX_RELANCE,
  GROUPES_ORIGINE,
  ORIGINES,
} from "@/config/origines";
import { creerClientServeur } from "@/lib/supabase/server";
import { jour, joursDepuis, relanceDue } from "@/lib/suivi";
import { preparationEnTexte, type Preparation } from "@/lib/entretien/generer";
import {
  changerStatut,
  genererPreparation,
  genererRelance,
  marquerRelancee,
  modifierCanaux,
  planifierRelance,
  revenirEnArriere,
} from "@/app/(app)/offre/[id]/actions";
import { notFound } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

/**
 * La fiche de candidature (D88).
 *
 * La liste allégée de D81 avait raison sur le principe et tort dans les faits :
 * elle renvoyait vers la fiche d'offre pour la moindre action de suivi. Or
 * préparer un entretien, choisir un canal de relance ou déclarer une issue
 * appartiennent au suivi, pas à l'analyse de l'annonce.
 *
 * Cette page porte donc **ce qui vient après l'envoi**, et rien d'autre : pas
 * de score détaillé, pas de compétences, pas d'écart au CV de référence. Ce
 * qui appartient à l'offre reste sur l'offre, à un clic.
 */

interface Document {
  id: string;
  type: string;
  version: number;
  selection: {
    relance?: { objet: string; corps: string };
    rang?: number;
    preparation?: Preparation;
  } | null;
}

function Bloc({
  titre,
  children,
}: {
  titre: string;
  children: React.ReactNode;
}) {
  return (
    <Carte className="mb-4">
      <p className="mb-3 text-sm font-semibold text-ardoise-800">{titre}</p>
      {children}
    </Carte>
  );
}

export default async function FicheCandidature({
  params,
  searchParams,
}: {
  params: { volet: string; id: string };
  searchParams: { suivi?: string; message?: string };
}) {
  const volet = voletDepuisSlug(params.volet);
  if (!volet) notFound();

  const supabase = creerClientServeur();
  const { data: brute } = await supabase
    .from("offres")
    .select(
      `id, volet, intitule, entreprise, statut, date_candidature, relance_prevue_le,
       derniere_relance_le, relances, origine, canal_relance, contact_nom,
       scores ( score_global, created_at ),
       documents ( id, type, version, selection ),
       statuts_historique ( statut, date, commentaire )`
    )
    .eq("id", params.id)
    .maybeSingle();

  if (!brute) notFound();

  const o = brute as {
    id: string;
    volet: string;
    intitule: string | null;
    entreprise: string | null;
    statut: string;
    date_candidature: string | null;
    relance_prevue_le: string | null;
    derniere_relance_le: string | null;
    relances: number | null;
    origine: string | null;
    canal_relance: string | null;
    contact_nom: string | null;
    scores: { score_global: number | null; created_at: string }[] | null;
    documents: Document[] | null;
    statuts_historique: {
      statut: string;
      date: string;
      commentaire: string | null;
    }[] | null;
  };

  const retour = `/${volet.slug}/candidatures/${params.id}`;

  const note =
    [...(o.scores ?? [])].sort((a, b) =>
      b.created_at.localeCompare(a.created_at)
    )[0]?.score_global ?? null;

  const dernier = (type: string) =>
    [...(o.documents ?? [])]
      .filter((d) => d.type === type)
      .sort((a, b) => b.version - a.version)[0] ?? null;

  const cv = dernier("cv");
  const lettre = dernier("lettre");
  const relance = dernier("relance");
  const preparation = dernier("preparation")?.selection?.preparation ?? null;

  const historique = [...(o.statuts_historique ?? [])].sort((a, b) =>
    b.date.localeCompare(a.date)
  );
  const statutPrecedent = historique.find((h) => h.statut !== o.statut)?.statut;

  const s = STATUTS[o.statut] ?? {
    libelle: o.statut,
    classe: "bg-ardoise-100 text-ardoise-700",
  };
  const jours = joursDepuis(o.date_candidature);
  const due = relanceDue(o.statut, o.relance_prevue_le);

  const MESSAGES: Record<string, string> = {
    statut: "Statut mis à jour.",
    relance: "Date de relance mise à jour.",
    relancee: "Relance enregistrée, la suivante est repoussée.",
    "relance-redigee": "Relance rédigée, à relire avant envoi.",
    retour: "Étape annulée : le statut précédent est rétabli.",
    "sans-retour": "Aucune étape antérieure à rétablir.",
    preparation: "Fiche de préparation prête, plus bas.",
    canaux: "Origine et canal enregistrés.",
  };

  return (
    <>
      <TitrePage
        titre={o.intitule ?? "Sans intitulé"}
        sousTitre={[o.entreprise, volet.nom].filter(Boolean).join(" · ")}
        action={
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${s.classe}`}
          >
            {s.libelle}
          </span>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
        <Link
          href={`/${volet.slug}/candidatures`}
          prefetch={false}
          className="text-ardoise-500 underline hover:text-ardoise-800"
        >
          ← Toutes les candidatures
        </Link>
        <Link
          href={`/offre/${o.id}`}
          prefetch={false}
          className="rounded-lg border border-ardoise-300 px-3 py-1.5 text-xs font-medium text-ardoise-700 hover:bg-ardoise-50"
        >
          Ouvrir l&apos;offre — analyse, score, compétences →
        </Link>
        {note !== null && (
          <span className="text-sm text-ardoise-500">
            Compatibilité{" "}
            <strong className="text-ardoise-900 tabular-nums">{note} %</strong>
          </span>
        )}
      </div>

      {searchParams.suivi === "erreur" ? (
        <Carte className="mb-4 border-rose-200 bg-rose-50">
          <p className="text-sm text-rose-900">
            {searchParams.message ?? "La dernière action a échoué."}
          </p>
        </Carte>
      ) : searchParams.suivi && MESSAGES[searchParams.suivi] ? (
        <Carte className="mb-4 border-emerald-200 bg-emerald-50">
          <p className="text-sm text-emerald-900">
            {MESSAGES[searchParams.suivi]}
          </p>
        </Carte>
      ) : null}

      <Bloc titre="L'envoi">
        <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm text-ardoise-600">
          <span>
            Envoyée le{" "}
            <strong className="text-ardoise-900">
              {jour(o.date_candidature)}
            </strong>
            {jours !== null && (
              <span className="text-ardoise-400"> · il y a {jours} j</span>
            )}
          </span>
          <span>
            Origine{" "}
            <strong className="text-ardoise-900">
              {o.origine ? ORIGINES[o.origine] ?? o.origine : "non renseignée"}
            </strong>
          </span>
          <span>
            Relance par{" "}
            <strong className="text-ardoise-900">
              {CANAUX_RELANCE[o.canal_relance ?? CANAL_PAR_DEFAUT]}
            </strong>
          </span>
          {o.contact_nom && (
            <span>
              Interlocuteur{" "}
              <strong className="text-ardoise-900">{o.contact_nom}</strong>
            </span>
          )}
        </div>

        <details className="mt-3 border-t border-ardoise-100 pt-3">
          <summary className="cursor-pointer text-xs text-ardoise-500">
            Corriger l&apos;origine ou le canal
          </summary>
          <form action={modifierCanaux} className="mt-3 flex flex-wrap items-end gap-3">
            <input type="hidden" name="id" value={o.id} />
            <input type="hidden" name="retour" value={retour} />
            <label className="text-xs text-ardoise-500">
              Origine
              <select
                name="origine"
                defaultValue={o.origine ?? ""}
                className="mt-1 block rounded-lg border border-ardoise-200 px-2 py-1.5 text-sm outline-none focus:border-ardoise-500"
              >
                <option value="">Non renseignée</option>
                {GROUPES_ORIGINE.map((g) => (
                  <optgroup key={g.titre} label={g.titre}>
                    {g.codes.map((code) => (
                      <option key={code} value={code}>
                        {ORIGINES[code]}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
            <label className="text-xs text-ardoise-500">
              Relancer par
              <select
                name="canal_relance"
                defaultValue={o.canal_relance ?? CANAL_PAR_DEFAUT}
                className="mt-1 block rounded-lg border border-ardoise-200 px-2 py-1.5 text-sm outline-none focus:border-ardoise-500"
              >
                {Object.entries(CANAUX_RELANCE).map(([code, libelle]) => (
                  <option key={code} value={code}>
                    {libelle}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              className="mb-0.5 rounded-lg border border-ardoise-300 px-3 py-1.5 text-xs font-medium text-ardoise-700 hover:bg-ardoise-50"
            >
              Enregistrer
            </button>
          </form>
        </details>
      </Bloc>

      <Bloc titre={due ? "La relance — elle est due" : "La relance"}>
        <div className="flex flex-wrap items-end gap-3">
          <form action={planifierRelance} className="flex items-end gap-2">
            <input type="hidden" name="id" value={o.id} />
            <input type="hidden" name="retour" value={retour} />
            <label className="text-xs text-ardoise-500">
              Prochaine relance
              <input
                type="date"
                name="date"
                defaultValue={o.relance_prevue_le ?? ""}
                className="mt-1 block rounded-lg border border-ardoise-200 px-2 py-1.5 text-sm outline-none focus:border-ardoise-500"
              />
            </label>
            <button
              type="submit"
              className="rounded-lg border border-ardoise-300 px-3 py-1.5 text-xs font-medium text-ardoise-700 hover:bg-ardoise-50"
            >
              Enregistrer
            </button>
          </form>

          {o.statut === "envoyee" && (
            <>
              <form action={marquerRelancee}>
                <input type="hidden" name="id" value={o.id} />
                <input type="hidden" name="retour" value={retour} />
                <button
                  type="submit"
                  className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100"
                >
                  Relancé aujourd&apos;hui
                </button>
              </form>

              <form action={genererRelance}>
                <input type="hidden" name="id" value={o.id} />
                <input type="hidden" name="retour" value={retour} />
                <BoutonSoumettre
                  libelle={relance ? "Réécrire la relance" : "Rédiger la relance"}
                  libelleEnCours="Rédaction…"
                  className="rounded-lg border border-ardoise-300 px-3 py-1.5 text-xs font-medium text-ardoise-700 hover:bg-ardoise-50"
                />
              </form>
            </>
          )}

          <span className="text-xs text-ardoise-400">
            {(o.relances ?? 0) === 0
              ? "Jamais relancée"
              : `${o.relances} relance${
                  (o.relances ?? 0) > 1 ? "s" : ""
                } · dernière le ${jour(o.derniere_relance_le)}`}
          </span>
        </div>

        {relance?.selection?.relance && (
          <div className="mt-3 rounded-lg border border-ardoise-200 bg-ardoise-50/60 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-medium text-ardoise-600">
                Relance rédigée pour{" "}
                {CANAUX_RELANCE[o.canal_relance ?? CANAL_PAR_DEFAUT]} · version{" "}
                {relance.version}
              </p>
              <BoutonCopier
                quoi="la relance"
                texte={`${relance.selection.relance.objet}\n\n${relance.selection.relance.corps}`}
                className="rounded-lg border border-ardoise-300 bg-white px-3 py-1 text-xs font-medium text-ardoise-700 hover:bg-ardoise-50"
              />
            </div>
            <p className="mt-2 text-sm font-medium text-ardoise-900">
              {relance.selection.relance.objet}
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-ardoise-700">
              {relance.selection.relance.corps}
            </p>
          </div>
        )}
      </Bloc>

      <Bloc titre="L'issue">
        <form action={changerStatut} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="id" value={o.id} />
          <input type="hidden" name="retour" value={retour} />
          <label className="text-xs text-ardoise-500">
            Statut
            <select
              name="statut"
              defaultValue={o.statut}
              className="mt-1 block rounded-lg border border-ardoise-200 px-2 py-1.5 text-sm outline-none focus:border-ardoise-500"
            >
              {Object.entries(STATUTS).map(([code, x]) => (
                <option key={code} value={code}>
                  {x.libelle}
                </option>
              ))}
            </select>
          </label>
          <label className="flex-1 text-xs text-ardoise-500">
            Ce qu&apos;on t&apos;a dit (facultatif)
            <input
              name="commentaire"
              placeholder="Motif du refus, nom de l'interlocuteur, date d'entretien…"
              className="mt-1 block w-full rounded-lg border border-ardoise-200 px-2 py-1.5 text-sm outline-none focus:border-ardoise-500"
            />
          </label>
          <button
            type="submit"
            className="rounded-lg bg-ardoise-900 px-4 py-2 text-sm font-medium text-white hover:bg-ardoise-800"
          >
            Enregistrer
          </button>
        </form>

        {statutPrecedent && (
          <form action={revenirEnArriere} className="mt-3">
            <input type="hidden" name="id" value={o.id} />
            <input type="hidden" name="retour" value={retour} />
            <BoutonSoumettre
              libelle={`← Revenir à « ${
                STATUTS[statutPrecedent]?.libelle ?? statutPrecedent
              } »`}
              libelleEnCours="Retour…"
              className="rounded-lg border border-ardoise-300 px-3 py-1.5 text-xs font-medium text-ardoise-700 hover:bg-ardoise-50"
            />
          </form>
        )}

        {historique.length > 0 && (
          <details className="mt-3 border-t border-ardoise-100 pt-3">
            <summary className="cursor-pointer text-xs text-ardoise-500">
              Historique ({historique.length})
            </summary>
            <ul className="mt-2 space-y-1 text-xs text-ardoise-500">
              {historique.map((h, i) => (
                <li key={`${h.date}-${i}`}>
                  {jour(h.date)} — {STATUTS[h.statut]?.libelle ?? h.statut}
                  {h.commentaire && (
                    <span className="text-ardoise-400"> · {h.commentaire}</span>
                  )}
                </li>
              ))}
            </ul>
          </details>
        )}
      </Bloc>

      <Bloc titre="L'entretien">
        {cv ? (
          <form action={genererPreparation} className="flex flex-wrap items-center gap-3">
            <input type="hidden" name="id" value={o.id} />
            <input type="hidden" name="retour" value={retour} />
            <BoutonSoumettre
              libelle={preparation ? "Refaire la préparation" : "Préparer l'entretien"}
              libelleEnCours="Préparation…"
              className={`rounded-lg px-4 py-2 text-sm font-medium text-white ${
                o.statut === "entretien" ? volet.classeAccent : "bg-ardoise-500"
              }`}
            />
            <span className="text-xs text-ardoise-400">
              Part de l&apos;annonce, du CV réellement envoyé et des écarts
              mesurés. Un appel payant, environ 5 ¢.
            </span>
          </form>
        ) : (
          <p className="text-sm text-ardoise-500">
            Aucun CV composé pour cette offre : la préparation s&apos;appuie sur
            le CV envoyé, elle attend donc qu&apos;il existe.
          </p>
        )}

        {preparation && (
          <div className="mt-3 rounded-lg border border-ardoise-200 bg-ardoise-50/60 p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="text-sm font-medium text-ardoise-900">
                {preparation.attendu || "Fiche de préparation"}
              </p>
              <BoutonCopier
                quoi="la préparation"
                texte={preparationEnTexte(preparation)}
                className="shrink-0 rounded-lg border border-ardoise-300 bg-white px-3 py-1 text-xs font-medium text-ardoise-700 hover:bg-ardoise-50"
              />
            </div>
            <p className="mt-2 text-xs text-ardoise-500">
              Le détail complet reste sur la fiche d&apos;offre, en bas.{" "}
              <Link
                href={`/offre/${o.id}`}
                prefetch={false}
                className="underline hover:text-ardoise-800"
              >
                L&apos;ouvrir
              </Link>
            </p>
          </div>
        )}
      </Bloc>

      <Bloc titre="Ce qui est parti">
        <div className="flex flex-wrap gap-2 text-xs">
          {cv ? (
            <Link
              href={`/document/${cv.id}`}
              prefetch={false}
              className="rounded-lg border border-ardoise-300 px-3 py-1.5 font-medium text-ardoise-700 hover:bg-ardoise-50"
            >
              CV — version {cv.version}
            </Link>
          ) : (
            <span className="rounded-lg border border-dashed border-ardoise-200 px-3 py-1.5 text-ardoise-400">
              Aucun CV
            </span>
          )}
          {lettre ? (
            <Link
              href={`/document/${lettre.id}`}
              prefetch={false}
              className="rounded-lg border border-ardoise-300 px-3 py-1.5 font-medium text-ardoise-700 hover:bg-ardoise-50"
            >
              Lettre — version {lettre.version}
            </Link>
          ) : (
            <span className="rounded-lg border border-dashed border-ardoise-200 px-3 py-1.5 text-ardoise-400">
              Aucune lettre
            </span>
          )}
        </div>
      </Bloc>
    </>
  );
}
