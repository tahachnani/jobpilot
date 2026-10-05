import { creerClientServeur } from "@/lib/supabase/server";
import { Carte, TitrePage } from "@/components/ui";
import { LISTE_VOLETS, VOLETS, type CodeVolet } from "@/config/volets";
import {
  CATEGORIES_COMPETENCE,
  LIBELLES_CONTRAT,
} from "@/config/activites";
import { chargerTaxonomie, codesActifs, libelleDe } from "@/lib/taxonomie";
import { chargerBasePro, dureeMois } from "@/lib/base-pro";
import { chargerCorpus } from "@/lib/cv/corpus";
import {
  basculerVisibilite,
  modifierCompetence,
  retablirCompetence,
  deplacer,
  modifierAccroche,
  modifierFormulation,
  ajouterEntreeCorpus,
  modifierCodesMission,
  modifierEntreeCorpus,
  supprimerEntreeCorpus,
  supprimerCompetences,
} from "./actions";
import { estSavoirFaire } from "@/lib/termes";
import { normaliser } from "@/lib/texte";
import Link from "next/link";

export const dynamic = "force-dynamic";

/** Le niveau porte la note du sous-score compétences. */
const NIVEAUX: Record<number, { libelle: string; classe: string }> = {
  3: { libelle: "maîtrise", classe: "bg-emerald-100 text-emerald-800" },
  2: { libelle: "opérationnel", classe: "bg-sky-100 text-sky-800" },
  1: { libelle: "notions", classe: "bg-ardoise-100 text-ardoise-600" },
};

function periode(debut: string, fin: string | null) {
  const f = (d: string) => {
    const [a, m] = d.split("-");
    return `${m}/${a}`;
  };
  return `${f(debut)} → ${fin ? f(fin) : "en cours"}`;
}

function BoutonOrdre({
  table,
  id,
  sens,
}: {
  table: string;
  id: string;
  sens: "haut" | "bas";
}) {
  return (
    <form action={deplacer}>
      <input type="hidden" name="table" value={table} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="sens" value={sens} />
      <button
        type="submit"
        aria-label={sens === "haut" ? "Monter" : "Descendre"}
        className="rounded border border-ardoise-200 px-2.5 py-1 text-xs text-ardoise-500 hover:bg-ardoise-50"
      >
        {sens === "haut" ? "↑" : "↓"}
      </button>
    </form>
  );
}

function BoutonMasquer({
  table,
  id,
  volet,
}: {
  table: string;
  id: string;
  volet: CodeVolet;
}) {
  return (
    <form action={basculerVisibilite}>
      <input type="hidden" name="table" value={table} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="volet" value={volet} />
      <button
        type="submit"
        className="rounded border border-ardoise-200 px-2.5 py-1 text-xs text-ardoise-500 hover:bg-rose-50 hover:text-rose-700"
      >
        Masquer
      </button>
    </form>
  );
}

export default async function Profil({
  searchParams,
}: {
  searchParams: {
    volet?: string;
    menage?: string;
    refuses?: string;
    codes?: string;
  };
}) {
  const volet: CodeVolet = searchParams.volet === "compta" ? "compta" : "cdg";
  const config = VOLETS[volet];
  const base = await chargerBasePro(volet);

  // La taxonomie vient de la base (D74) : les codes proposés à la saisie sont
  // ceux d'aujourd'hui, pas ceux du dernier déploiement.
  const taxonomie = await chargerTaxonomie();

  // La matière première de la reformulation et des missions proposées. Elle
  // n'apparaît sur aucun CV : sans écran de lecture, une phrase fausse y
  // restait invisible tout en nourrissant le modèle.
  const corpusParExperience = await chargerCorpus();

  const annees = Math.floor(base.ancienneteMois / 12);
  const mois = Math.round(base.ancienneteMois % 12);

  // Les compétences masquées ou écartées dans ce volet : elles n'apparaissent
  // nulle part ailleurs, et un refus depuis une offre devenait irréversible.
  const supabaseProfil = creerClientServeur();
  const champVisible = volet === "cdg" ? "visible_cdg" : "visible_compta";
  const { data: masqueesBrutes } = await supabaseProfil
    .from("competences")
    .select("id, libelle, categorie, niveau, origine, precision")
    .eq(champVisible, false)
    .order("libelle");
  const masquees = (masqueesBrutes ?? []) as {
    id: string;
    libelle: string;
    categorie: string;
    niveau: number;
    origine: string | null;
    precision: string | null;
  }[];

  /**
   * Le ménage des compétences (D67).
   *
   * On travaille sur la table entière, visibles et masquées confondues : une
   * ligne écartée dans un volet continue de compter dans le score, et les
   * doublons se cachent souvent d'un volet à l'autre.
   */
  const { data: toutesBrutes } = await supabaseProfil
    .from("competences")
    .select("id, libelle, categorie, niveau, origine")
    .order("libelle");
  const toutes = (toutesBrutes ?? []) as {
    id: string;
    libelle: string;
    categorie: string;
    niveau: number;
    origine: string | null;
  }[];

  const venuesDOffres = toutes.filter((c) => c.origine === "offre");
  const comportementales = venuesDOffres.filter((c) => !estSavoirFaire(c.libelle));

  // Deux libellés dont les trois premiers mots normalisés coïncident sont
  // presque toujours la même chose dite deux fois.
  const cle = (libelle: string) =>
    normaliser(libelle).split(" ").filter((m) => m.length > 2).slice(0, 3).join(" ");
  const parCle = new Map<string, typeof toutes>();
  for (const c of toutes) {
    const k = cle(c.libelle);
    if (!k) continue;
    parCle.set(k, [...(parCle.get(k) ?? []), c]);
  }
  const doublons = [...parCle.values()].filter((g) => g.length > 1);

  const parCategorie = base.competences.reduce<
    Record<string, typeof base.competences>
  >((acc, c) => {
    (acc[c.categorie] ??= []).push(c);
    return acc;
  }, {});

  return (
    <>
      <TitrePage
        titre="👤 Mon profil"
        sousTitre="Base professionnelle unique — affichage filtré par volet"
      />

      <div className="mb-6 flex gap-2">
        {LISTE_VOLETS.map((v) => (
          <Link
            key={v.code}
            href={`/profil?volet=${v.code}`}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              v.code === volet
                ? "bg-ardoise-900 text-white"
                : "border border-ardoise-200 bg-white text-ardoise-600 hover:border-ardoise-400"
            }`}
          >
            {v.emoji} {v.nom}
          </Link>
        ))}
      </div>

      {searchParams.codes === "ok" && (
        <Carte className="mb-4 border-emerald-200 bg-emerald-50">
          <p className="text-sm text-emerald-900">
            Codes enregistrés. Les scores déjà calculés ne les connaissent pas
            encore :{" "}
            <Link href="/parametres" className="underline" prefetch={false}>
              renote tes offres
            </Link>{" "}
            — aucun appel IA, aucun coût.
          </p>
        </Carte>
      )}

      {/* D75 — un code refusé se dit. Avant, il disparaissait sans un mot, et
          l'entrée de corpus repartait avec zéro code. */}
      {searchParams.refuses && (
        <Carte className="mb-4 border-amber-200 bg-amber-50">
          <p className="text-sm text-amber-900">
            Code
            {searchParams.refuses.includes(",") ? "s" : ""} refusé
            {searchParams.refuses.includes(",") ? "s" : ""}, absent
            {searchParams.refuses.includes(",") ? "s" : ""} de la taxonomie :{" "}
            <strong>{searchParams.refuses.split(",").join(", ")}</strong>. Le
            reste de l&apos;entrée est enregistré.
          </p>
          <p className="mt-2 text-xs leading-relaxed text-amber-800">
            Un code doit exister avant d&apos;être utilisé : ajoute-le depuis
            l&apos;onglet{" "}
            <Link href="/taxonomie" className="underline" prefetch={false}>
              Taxonomie
            </Link>
            , puis reviens l&apos;affecter ici.
          </p>
        </Carte>
      )}

      <Carte className="mb-4">
        <p className="text-lg font-medium text-ardoise-900">
          {base.profil?.prenom} {base.profil?.nom}
        </p>
        <p className="mt-1 text-sm text-ardoise-500">
          {[
            base.profil?.email,
            base.profil?.telephone,
            base.profil?.localisation,
            base.profil?.permis,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <div className="mt-4 flex flex-wrap gap-4 border-t border-ardoise-100 pt-4 text-sm">
          <span className="text-ardoise-500">
            Ancienneté pondérée{" "}
            <strong className="text-ardoise-900">
              {annees} an{annees > 1 ? "s" : ""} {mois} mois
            </strong>
          </span>
          <span className="text-ardoise-500">
            Expériences{" "}
            <strong className="text-ardoise-900">
              {base.experiences.length}
            </strong>
          </span>
          <span className="text-ardoise-500">
            Missions{" "}
            <strong className="text-ardoise-900">
              {base.experiences.reduce((n, e) => n + e.missions.length, 0)}
            </strong>
          </span>
        </div>
      </Carte>

      {base.accroche && (
        <Carte className="mb-4">
          <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-ardoise-500">
            Accroche — {config.nom}
          </p>
          <form action={modifierAccroche} key={`accroche-${volet}`}>
            <input type="hidden" name="id" value={base.accroche.id} />
            <textarea
              name="texte"
              defaultValue={base.accroche.texte}
              rows={5}
              className="w-full rounded-lg border border-ardoise-200 p-3 text-sm leading-relaxed outline-none focus:border-ardoise-500"
            />
            <button
              type="submit"
              className="mt-2 rounded-lg bg-ardoise-900 px-3 py-1.5 text-xs font-medium text-white"
            >
              Enregistrer
            </button>
          </form>
        </Carte>
      )}

      {/* La taxonomie est fermée, mais elle se modifie depuis l'onglet
          « Taxonomie » : un code hors liste est refusé à l'enregistrement, et
          désormais signalé au lieu d'être écarté en silence (D75). */}
      <datalist id="codes-activite">
        {codesActifs(taxonomie).map((code) => (
          <option key={code} value={code}>
            {taxonomie[code].libelle}
          </option>
        ))}
      </datalist>

      <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-ardoise-500">
        Expériences
      </h2>
      <div className="space-y-4">
        {base.experiences.map((e) => (
          <Carte key={e.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium text-ardoise-900">
                  {e.titre ?? "—"} · {e.entreprise}
                </p>
                <p className="mt-0.5 text-sm text-ardoise-500">
                  {periode(e.date_debut, e.date_fin)} ·{" "}
                  {LIBELLES_CONTRAT[e.type_contrat] ?? e.type_contrat} ·{" "}
                  {[e.ville, e.pays].filter(Boolean).join(", ")}
                </p>
                <p className="mt-1 text-xs text-ardoise-400">
                  {dureeMois(e)} mois
                  {e.duree_mois_forcee !== null && " (durée forcée)"}
                  {e.secteur_code && ` · ${e.secteur_code.replace(/_/g, " ")}`}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <BoutonOrdre table="experiences" id={e.id} sens="haut" />
                <BoutonOrdre table="experiences" id={e.id} sens="bas" />
                <BoutonMasquer table="experiences" id={e.id} volet={volet} />
              </div>
            </div>

            <details className="mt-4 border-t border-ardoise-100 pt-4">
              <summary className="cursor-pointer text-xs font-medium text-ardoise-500">
                Missions ({e.missions.length}) — formulations modifiables
              </summary>
              <div className="mt-3 space-y-4">
              {e.missions.map((m) => (
                <div key={m.id}>
                  <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                    {m.activites_codes.map((c) => (
                      <span
                        key={c}
                        className="rounded bg-ardoise-100 px-1.5 py-0.5 text-[10px] font-medium text-ardoise-600"
                      >
                        {libelleDe(taxonomie, c)}
                      </span>
                    ))}
                    {m.contient_chiffre && (
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                        chiffré
                      </span>
                    )}
                    <span className="text-[10px] text-ardoise-400">
                      pertinence {m.pertinence}/3
                    </span>
                    <span className="ml-auto flex gap-1">
                      <BoutonOrdre table="missions" id={m.id} sens="haut" />
                      <BoutonOrdre table="missions" id={m.id} sens="bas" />
                    </span>
                  </div>

                  <form action={modifierFormulation} key={`f-${volet}-${m.id}`}>
                    <input type="hidden" name="id" value={m.formulation!.id} />
                    <textarea
                      name="texte"
                      defaultValue={m.formulation!.texte}
                      rows={3}
                      className="w-full rounded-lg border border-ardoise-200 p-2.5 text-sm leading-relaxed outline-none focus:border-ardoise-500"
                    />
                    <div className="mt-1.5 flex items-center gap-3">
                      <button
                        type="submit"
                        className="rounded-lg border border-ardoise-300 px-3 py-1 text-xs font-medium text-ardoise-700 hover:bg-ardoise-50"
                      >
                        Enregistrer
                      </button>
                      {m.formulation!.texte !== m.texte_source && (
                        <details className="text-xs text-ardoise-400">
                          <summary className="cursor-pointer">
                            Voir le texte d&apos;origine
                          </summary>
                          <p className="mt-1 rounded bg-ardoise-50 p-2 leading-relaxed">
                            {m.texte_source}
                          </p>
                        </details>
                      )}
                    </div>
                  </form>

                  {/* D74 — les codes d'une mission deviennent modifiables.
                      Ils étaient en lecture seule : ajouter un code à la
                      taxonomie ne servait à rien, faute de pouvoir
                      l'affecter. Ce sont eux, et eux seuls, que le score
                      compare aux missions d'une offre. */}
                  <details className="mt-1.5">
                    <summary className="cursor-pointer text-[11px] text-ardoise-400">
                      Codes d&apos;activité — ce que le score compare
                    </summary>
                    <form
                      action={modifierCodesMission}
                      key={`c-${volet}-${m.id}`}
                      className="mt-1.5"
                    >
                      <input type="hidden" name="id" value={m.id} />
                      <input type="hidden" name="volet" value={volet} />
                      <input
                        name="codes"
                        defaultValue={m.activites_codes.join(", ")}
                        placeholder="codes d'activité, séparés par une virgule"
                        list="codes-activite"
                        className="w-full rounded-lg border border-ardoise-200 p-2 text-xs outline-none focus:border-ardoise-500"
                      />
                      <button
                        type="submit"
                        className="mt-1.5 rounded-lg border border-ardoise-300 px-3 py-1 text-xs font-medium text-ardoise-700 hover:bg-ardoise-50"
                      >
                        Enregistrer les codes
                      </button>
                    </form>
                  </details>
                </div>
              ))}
              </div>
            </details>

            <details className="mt-4 border-t border-ardoise-100 pt-3">
              <summary className="cursor-pointer text-xs font-medium text-ardoise-500">
                Corpus — matière première ({
                  (corpusParExperience.get(e.id) ?? []).length
                }{" "}
                {(corpusParExperience.get(e.id) ?? []).length > 1
                  ? "entrées"
                  : "entrée"}
                )
              </summary>

              <p className="mt-2 text-xs leading-relaxed text-ardoise-400">
                Ces lignes n&apos;apparaissent jamais sur un CV. Elles
                autorisent un terme en reformulation et mesurent ce qui est
                récupérable dans une offre — uniquement à l&apos;intérieur de
                cette expérience.
              </p>

              {/* D76 — dit une bonne fois ce que le corpus ne fait pas. Un
                  code ajouté ici et nulle part ailleurs reste à zéro dans le
                  score, et rien ne le disait. */}
              <p className="mt-1.5 rounded-lg bg-ardoise-50 p-2 text-xs leading-relaxed text-ardoise-500">
                <strong className="text-ardoise-700">
                  Le corpus ne compte pas dans le score.
                </strong>{" "}
                Le calcul lit les codes des <em>missions</em> ci-dessus, pas
                ceux du corpus. Un code posé seulement ici reste à zéro dans la
                note d&apos;une offre : pour qu&apos;il compte, il faut aussi
                l&apos;affecter à la mission correspondante.
              </p>

              <div className="mt-3 space-y-3">
                {(corpusParExperience.get(e.id) ?? []).map((l) => (
                  <div
                    key={l.id}
                    className="rounded-lg border border-ardoise-100 bg-ardoise-50/50 p-2.5"
                  >
                    <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                      {l.codes.map((c) => (
                        <span
                          key={c}
                          className="rounded bg-ardoise-100 px-1.5 py-0.5 text-[10px] font-medium text-ardoise-600"
                        >
                          {libelleDe(taxonomie, c)}
                        </span>
                      ))}
                      {l.codes.length === 0 && (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                          aucun code valide
                        </span>
                      )}
                    </div>

                    <form
                      action={modifierEntreeCorpus}
                      key={`corpus-${volet}-${l.id}`}
                    >
                      <input type="hidden" name="id" value={l.id} />
                      <input type="hidden" name="volet" value={volet} />
                      <textarea
                        name="texte"
                        defaultValue={l.texte}
                        rows={3}
                        className="w-full rounded-lg border border-ardoise-200 p-2 text-sm leading-relaxed outline-none focus:border-ardoise-500"
                      />
                      <input
                        name="codes"
                        defaultValue={l.codes.join(", ")}
                        placeholder="codes d'activité, séparés par une virgule"
                        list="codes-activite"
                        className="mt-1.5 w-full rounded-lg border border-ardoise-200 p-2 text-xs outline-none focus:border-ardoise-500"
                      />
                      <div className="mt-1.5 flex items-center gap-2">
                        <button
                          type="submit"
                          className="rounded-lg border border-ardoise-300 px-3 py-1 text-xs font-medium text-ardoise-700 hover:bg-ardoise-50"
                        >
                          Enregistrer
                        </button>
                        <button
                          type="submit"
                          formAction={supprimerEntreeCorpus}
                          className="rounded-lg border border-ardoise-200 px-3 py-1 text-xs text-ardoise-500 hover:bg-rose-50 hover:text-rose-700"
                        >
                          Supprimer
                        </button>
                      </div>
                    </form>
                  </div>
                ))}

                <form
                  action={ajouterEntreeCorpus}
                  key={`corpus-ajout-${volet}-${e.id}`}
                  className="rounded-lg border border-dashed border-ardoise-200 p-2.5"
                >
                  <input type="hidden" name="experienceId" value={e.id} />
                  <input type="hidden" name="volet" value={volet} />
                  <textarea
                    name="texte"
                    rows={2}
                    placeholder="Ajouter une ligne de corpus à cette expérience"
                    className="w-full rounded-lg border border-ardoise-200 p-2 text-sm leading-relaxed outline-none focus:border-ardoise-500"
                  />
                  <input
                    name="codes"
                    placeholder="codes d'activité, séparés par une virgule"
                    list="codes-activite"
                    className="mt-1.5 w-full rounded-lg border border-ardoise-200 p-2 text-xs outline-none focus:border-ardoise-500"
                  />
                  <button
                    type="submit"
                    className="mt-1.5 rounded-lg border border-ardoise-300 px-3 py-1 text-xs font-medium text-ardoise-700 hover:bg-ardoise-50"
                  >
                    Ajouter
                  </button>
                </form>
              </div>
            </details>
          </Carte>
        ))}
      </div>

      <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-ardoise-500">
        Compétences
      </h2>

      {searchParams.menage && (
        <Carte className="mb-4 border-emerald-200 bg-emerald-50">
          <p className="text-sm text-emerald-900">
            {searchParams.menage === "aucune"
              ? "Aucune ligne cochée : rien n'a été supprimé."
              : searchParams.menage === "niveau"
                ? "Niveau mis à jour."
                : `${searchParams.menage} compétence${
                    Number(searchParams.menage) > 1 ? "s" : ""
                  } supprimée${
                    Number(searchParams.menage) > 1 ? "s" : ""
                  }. Recalcule les scores depuis Paramètres pour en voir l'effet.`}
          </p>
        </Carte>
      )}

      {venuesDOffres.length > 0 && (
        <Carte className="mb-4 border-amber-200 bg-amber-50/40">
          <p className="text-sm font-medium text-ardoise-800">
            Ménage — {venuesDOffres.length} compétence
            {venuesDOffres.length > 1 ? "s" : ""} venue
            {venuesDOffres.length > 1 ? "s" : ""} d&apos;annonces
          </p>
          <p className="mt-1 text-xs leading-relaxed text-ardoise-600">
            Chaque compétence acceptée depuis une offre entre dans le calcul du
            sous-score compétences. Accumulées, elles font monter tous les
            scores et finissent par masquer ce qui te manque vraiment : plus
            aucune offre ne signale de manque. Coche ce que tu ne revendiquerais
            pas en entretien.
          </p>

          <form action={supprimerCompetences} className="mt-4">
            <input type="hidden" name="volet" value={volet} />

            {comportementales.length > 0 && (
              <details open className="mb-3">
                <summary className="cursor-pointer text-xs font-medium text-ardoise-600">
                  Qualités plutôt que savoir-faire ({comportementales.length})
                </summary>
                <p className="mt-1 text-xs text-ardoise-400">
                  Elles ne tiennent pas une ligne de CV et comptent déjà pour
                  moitié dans le score.
                </p>
                <ul className="mt-2 space-y-1">
                  {comportementales.map((c) => (
                    <li key={c.id} className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        name="competence"
                        value={c.id}
                        id={`m-${c.id}`}
                        className="h-4 w-4 shrink-0"
                      />
                      <label htmlFor={`m-${c.id}`} className="text-ardoise-700">
                        {c.libelle}
                        <span className="ml-1 text-ardoise-400">
                          — {NIVEAUX[c.niveau]?.libelle ?? "non noté"}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </details>
            )}

            {doublons.length > 0 && (
              <details className="mb-3">
                <summary className="cursor-pointer text-xs font-medium text-ardoise-600">
                  Doublons probables ({doublons.length} groupe
                  {doublons.length > 1 ? "s" : ""})
                </summary>
                <p className="mt-1 text-xs text-ardoise-400">
                  Libellés très proches : garde le plus précis, coche les
                  autres.
                </p>
                <div className="mt-2 space-y-3">
                  {doublons.map((groupe) => (
                    <ul
                      key={groupe[0].id}
                      className="space-y-1 border-l-2 border-amber-200 pl-3"
                    >
                      {groupe.map((c) => (
                        <li key={c.id} className="flex items-center gap-2 text-xs">
                          <input
                            type="checkbox"
                            name="competence"
                            value={c.id}
                            id={`d-${c.id}`}
                            className="h-4 w-4 shrink-0"
                          />
                          <label htmlFor={`d-${c.id}`} className="text-ardoise-700">
                            {c.libelle}
                            <span className="ml-1 text-ardoise-400">
                              — {NIVEAUX[c.niveau]?.libelle ?? "non noté"}
                              {c.origine ? ` · ${c.origine}` : ""}
                            </span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  ))}
                </div>
              </details>
            )}

            <details className="mb-3">
              <summary className="cursor-pointer text-xs font-medium text-ardoise-600">
                Toutes celles venues d&apos;annonces ({venuesDOffres.length})
              </summary>
              <ul className="mt-2 space-y-1">
                {venuesDOffres.map((c) => (
                  <li key={c.id} className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      name="competence"
                      value={c.id}
                      id={`o-${c.id}`}
                      className="h-4 w-4 shrink-0"
                    />
                    <label htmlFor={`o-${c.id}`} className="text-ardoise-700">
                      {c.libelle}
                      <span className="ml-1 text-ardoise-400">
                        — {CATEGORIES_COMPETENCE[c.categorie] ?? c.categorie} ·{" "}
                        {NIVEAUX[c.niveau]?.libelle ?? "non noté"}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </details>

            <button
              type="submit"
              className="rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50"
            >
              Supprimer les lignes cochées
            </button>
            <p className="mt-2 text-xs text-ardoise-400">
              Définitif, mais sans effet sur les CV déjà générés : ils portent
              leur propre modèle figé.
            </p>
          </form>
        </Carte>
      )}
      <div className="space-y-4">
        {Object.entries(parCategorie).map(([cat, liste]) => (
          <Carte key={cat}>
            <p className="mb-3 text-sm font-medium text-ardoise-800">
              {CATEGORIES_COMPETENCE[cat] ?? cat}
            </p>
            <ul className="space-y-2">
              {liste.map((c) => (
                <li
                  key={c.id}
                  className="border-b border-ardoise-50 pb-2 last:border-0"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm text-ardoise-700">
                    {c.libelle}
                    {c.precision && (
                      <span className="text-ardoise-400"> — {c.precision}</span>
                    )}
                  </span>
                  <span className="flex items-center gap-2">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                        NIVEAUX[c.niveau]?.classe ??
                        "bg-ardoise-100 text-ardoise-600"
                      }`}
                    >
                      {NIVEAUX[c.niveau]?.libelle ?? "non noté"}
                    </span>
                    {c.origine && (
                      <span className="text-[10px] text-ardoise-400">
                        {c.origine}
                      </span>
                    )}
                    <BoutonMasquer table="competences" id={c.id} volet={volet} />
                  </span>
                  </div>

                  <details className="mt-1">
                    <summary className="cursor-pointer text-[11px] text-ardoise-400">
                      Corriger
                    </summary>
                    <form action={modifierCompetence} className="mt-2 space-y-2">
                      <input type="hidden" name="id" value={c.id} />
                      <input type="hidden" name="volet" value={volet} />
                      <input
                        name="libelle"
                        defaultValue={c.libelle}
                        className="w-full rounded border border-ardoise-300 px-2 py-1 text-xs"
                      />
                      <input
                        name="precision"
                        defaultValue={c.precision ?? ""}
                        placeholder="Précision (facultatif)"
                        className="w-full rounded border border-ardoise-300 px-2 py-1 text-xs"
                      />
                      <div className="flex flex-wrap gap-2">
                        <select
                          name="categorie"
                          defaultValue={c.categorie}
                          className="rounded border border-ardoise-300 px-2 py-1 text-xs"
                        >
                          <option value="cdg">Contrôle de gestion</option>
                          <option value="compta">Comptabilité</option>
                          <option value="outil">Outil / logiciel</option>
                          <option value="transversale">Transversale</option>
                        </select>
                        <select
                          name="niveau"
                          defaultValue={String(c.niveau)}
                          className="rounded border border-ardoise-300 px-2 py-1 text-xs"
                        >
                          <option value="1">Notions</option>
                          <option value="2">Opérationnel</option>
                          <option value="3">Maîtrisé</option>
                        </select>
                        <button
                          type="submit"
                          className="rounded border border-ardoise-300 px-2 py-1 text-xs font-medium text-ardoise-700"
                        >
                          Enregistrer
                        </button>
                      </div>
                    </form>
                  </details>
                </li>
              ))}
            </ul>
          </Carte>
        ))}
      </div>

      {masquees.length > 0 && (
        <Carte className="mt-6">
          <p className="text-sm font-medium text-ardoise-800">
            Masquées ou écartées dans ce volet ({masquees.length})
          </p>
          <p className="mt-1 text-xs text-ardoise-500">
            Celles que tu as masquées, et celles refusées depuis une offre —
            enregistrées au niveau zéro pour ne plus être reproposées. Un refus
            par erreur se répare ici.
          </p>
          <ul className="mt-3 space-y-2">
            {masquees.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-ardoise-50 pb-2 last:border-0"
              >
                <span className="text-sm text-ardoise-500">
                  {c.libelle}
                  {c.origine && (
                    <span className="ml-2 text-[10px] text-ardoise-400">
                      {c.origine}
                    </span>
                  )}
                </span>
                <form action={retablirCompetence} className="flex gap-2">
                  <input type="hidden" name="id" value={c.id} />
                  <input type="hidden" name="volet" value={volet} />
                  <select
                    name="niveau"
                    defaultValue="2"
                    className="rounded border border-ardoise-300 px-2 py-1 text-xs"
                  >
                    <option value="1">Notions</option>
                    <option value="2">Opérationnel</option>
                    <option value="3">Maîtrisé</option>
                  </select>
                  <button
                    type="submit"
                    className="rounded border border-ardoise-300 px-3 py-1 text-xs font-medium text-ardoise-700"
                  >
                    Rétablir
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </Carte>
      )}

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <Carte>
          <p className="mb-3 text-sm font-medium text-ardoise-800">Formations</p>
          <ul className="space-y-2 text-sm">
            {base.formations.map((f: Record<string, unknown>) => (
              <li key={f.id as string} className="flex justify-between gap-2">
                <span className="text-ardoise-700">
                  {f.diplome as string}
                  <span className="block text-xs text-ardoise-400">
                    {f.etablissement as string}
                  </span>
                </span>
                <BoutonMasquer
                  table="formations"
                  id={f.id as string}
                  volet={volet}
                />
              </li>
            ))}
          </ul>
        </Carte>

        <div className="space-y-4">
          <Carte>
            <p className="mb-3 text-sm font-medium text-ardoise-800">Langues</p>
            <ul className="space-y-1 text-sm text-ardoise-700">
              {base.langues.map((l: Record<string, unknown>) => (
                <li key={l.id as string}>
                  {l.langue as string}
                  <span className="text-ardoise-400">
                    {" "}
                    — {(l.certification as string) ?? (l.niveau as string)}
                  </span>
                </li>
              ))}
            </ul>
          </Carte>

          <Carte>
            <p className="mb-3 text-sm font-medium text-ardoise-800">
              Centres d&apos;intérêt
            </p>
            <p className="text-sm text-ardoise-700">
              {base.interets
                .map((i: Record<string, unknown>) => i.libelle as string)
                .join(" · ")}
            </p>
          </Carte>
        </div>
      </div>

      <p className="mt-8 text-xs text-ardoise-400">
        Masquer une ligne ne la supprime pas : elle disparaît de ce volet et
        reste disponible dans l&apos;autre. Le texte d&apos;origine des missions
        n&apos;est jamais modifié, il sert de référence au contrôle
        d&apos;invention. Le niveau d&apos;une compétence porte sa note dans le
        scoring : notions 60, opérationnel 85, maîtrise 100. Une compétence que
        tes missions démontrent vaut 100 quel que soit le niveau déclaré.
      </p>
    </>
  );
}
