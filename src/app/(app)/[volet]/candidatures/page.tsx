import { TitrePage, EtatVide, Carte } from "@/components/ui";
import { STATUTS, STATUTS_ENVOYES, voletDepuisSlug } from "@/config/volets";
import { creerClientServeur } from "@/lib/supabase/server";
import { jour, joursDepuis, relanceDue } from "@/lib/suivi";
import { libelleOrigine } from "@/config/origines";
import { notFound } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

interface LigneCandidature {
  id: string;
  intitule: string | null;
  entreprise: string | null;
  statut: string;
  date_candidature: string | null;
  relance_prevue_le: string | null;
  derniere_relance_le: string | null;
  relances: number | null;
  origine: string | null;
  scores: { score_global: number | null; created_at: string }[] | null;
  documents: { id: string; type: string; version: number }[] | null;
}

/**
 * Les filtres du suivi (D99).
 *
 * Même principe que sur l'écran Offres, et pour la même raison : ils vivent
 * dans l'URL, donc la page reste rendue côté serveur, le retour arrière
 * fonctionne et un filtre choisi tient dans un signet.
 *
 * Les états ne sont pas ceux d'Offres. Ici tout est déjà parti : la question
 * n'est plus « qu'est-ce que j'envoie » mais « qu'est-ce qui attend une action
 * de ma part ».
 */
const FILTRES: Record<
  string,
  { libelle: string; garde: (c: LigneCandidature) => boolean }
> = {
  toutes: { libelle: "Toutes", garde: () => true },
  a_relancer: {
    libelle: "À relancer",
    garde: (c) => relanceDue(c.statut, c.relance_prevue_le),
  },
  en_attente: {
    libelle: "Sans réponse",
    garde: (c) => c.statut === "envoyee",
  },
  entretien: {
    libelle: "Entretien",
    garde: (c) => c.statut === "entretien",
  },
  closes: {
    libelle: "Closes",
    garde: (c) => ["refusee", "sans_reponse", "cloturee"].includes(c.statut),
  },
};

const TRIS: Record<string, { libelle: string }> = {
  urgence: { libelle: "Par urgence" },
  recentes: { libelle: "Plus récentes" },
  anciennes: { libelle: "Plus anciennes" },
  score: { libelle: "Meilleur score" },
};

export default async function Candidatures({
  params,
  searchParams,
}: {
  params: { volet: string };
  searchParams: { tri?: string; filtre?: string; origine?: string };
}) {
  const volet = voletDepuisSlug(params.volet);
  if (!volet) notFound();

  const filtre = FILTRES[searchParams.filtre ?? ""] ? searchParams.filtre! : "toutes";
  const tri = TRIS[searchParams.tri ?? ""] ? searchParams.tri! : "urgence";
  const origineChoisie = searchParams.origine ?? "";

  const supabase = creerClientServeur();
  const { data } = await supabase
    .from("offres")
    .select(
      `id, intitule, entreprise, statut, date_candidature, relance_prevue_le,
       derniere_relance_le, relances, origine,
       scores ( score_global, created_at ),
       documents ( id, type, version )`
    )
    .eq("volet", volet.code)
    .in("statut", STATUTS_ENVOYES)
    .order("date_candidature", { ascending: false });

  const candidatures = (data ?? []) as unknown as LigneCandidature[];

  /** Le CV réellement parti : la dernière version composée pour cette offre. */
  const cvDe = (c: (typeof candidatures)[number]) =>
    [...(c.documents ?? [])]
      .filter((d) => d.type === "cv")
      .sort((a, b) => b.version - a.version)[0] ?? null;

  /** Le score le plus récent de l'offre, celui qui a été affiché au moment du choix. */
  const scoreDe = (c: (typeof candidatures)[number]) =>
    [...(c.scores ?? [])].sort((a, b) =>
      b.created_at.localeCompare(a.created_at)
    )[0]?.score_global ?? null;

  /**
   * Ce que disent tes réponses (D68).
   *
   * Le barème est une hypothèse tant qu'aucune candidature n'est partie. Dès
   * que des issues sont connues, on peut lui opposer le seul juge qui compte :
   * les offres qui répondent avaient-elles un score plus élevé que les autres ?
   * Aucun calcul savant — une moyenne par issue et le nombre de cas, pour que
   * la faiblesse de l'échantillon reste visible.
   */
  const parIssue = (["entretien", "refusee", "sans_reponse"] as const).map(
    (issue) => {
      const lot = candidatures.filter((c) => c.statut === issue);
      const notes = lot.map(scoreDe).filter((n): n is number => n !== null);
      return {
        issue,
        cas: lot.length,
        moyenne:
          notes.length > 0
            ? Math.round(notes.reduce((t, n) => t + n, 0) / notes.length)
            : null,
      };
    }
  );
  const issuesConnues = parIssue.reduce((t, x) => t + x.cas, 0);

  const aRelancer = candidatures.filter((c) =>
    relanceDue(c.statut, c.relance_prevue_le)
  ).length;

  /**
   * L'ordre par urgence, et non par date (D81).
   *
   * Quarante-deux candidatures rangées par date d'envoi ne se lisent plus
   * comme une liste, mais comme une file d'attente. Cet écran répond à une
   * seule question — qu'est-ce que je dois faire aujourd'hui — et l'ordre doit
   * y répondre avant le contenu des cartes.
   */
  const urgence = (c: (typeof candidatures)[number]): number => {
    if (relanceDue(c.statut, c.relance_prevue_le)) return 0;
    if (c.statut === "entretien") return 1;
    if (c.statut === "envoyee") return 2;
    return 3;
  };

  /**
   * Les origines effectivement présentes, avec leur compte.
   *
   * Construites depuis les données et non depuis la liste fermée : proposer
   * « Monster (0) » n'aiderait personne, et les 33 candidatures sans origine
   * connue méritent leur propre puce — c'est aussi une information.
   */
  const origines = Object.entries(
    candidatures.reduce<Record<string, number>>((acc, c) => {
      const cle = c.origine ?? "_inconnue";
      acc[cle] = (acc[cle] ?? 0) + 1;
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1]);

  const filtrees = candidatures
    .filter(FILTRES[filtre].garde)
    .filter((c) =>
      origineChoisie === ""
        ? true
        : origineChoisie === "_inconnue"
          ? c.origine === null
          : c.origine === origineChoisie
    );

  const rangees = [...filtrees].sort((a, b) => {
    if (tri === "score") return (scoreDe(b) ?? -1) - (scoreDe(a) ?? -1);

    const dates = (a.date_candidature ?? "").localeCompare(
      b.date_candidature ?? ""
    );
    if (tri === "anciennes") return dates;
    if (tri === "recentes") return -dates;

    const u = urgence(a) - urgence(b);
    if (u !== 0) return u;
    // À urgence égale, la plus ancienne d'abord : c'est elle qui attend depuis
    // le plus longtemps, et c'est elle qu'on oublie.
    return dates;
  });

  const lien = (t: string, f: string, o: string) =>
    `/${volet.slug}/candidatures?tri=${t}&filtre=${f}` +
    (o ? `&origine=${encodeURIComponent(o)}` : "");

  const puce = (actif: boolean) =>
    `rounded-full px-3 py-1 text-xs font-medium transition ${
      actif
        ? "bg-ardoise-900 text-white"
        : "border border-ardoise-200 bg-white text-ardoise-600 hover:border-ardoise-400"
    }`;

  return (
    <>
      <TitrePage
        titre={`${volet.emoji} Candidatures — ${volet.nom}`}
        sousTitre="Uniquement les offres que tu as marquées comme envoyées"
        action={
          aRelancer > 0 ? (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-900">
              {aRelancer} à relancer
            </span>
          ) : undefined
        }
      />

      {candidatures.length > 0 && (
        <div className="mb-4 space-y-2">
          <div className="flex flex-wrap gap-2">
            {Object.entries(FILTRES).map(([code, f]) => (
              <Link
                key={code}
                href={lien(tri, code, origineChoisie)}
                prefetch={false}
                className={puce(code === filtre)}
              >
                {f.libelle} ({candidatures.filter(f.garde).length})
              </Link>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            {Object.entries(TRIS).map(([code, t]) => (
              <Link
                key={code}
                href={lien(code, filtre, origineChoisie)}
                prefetch={false}
                className={puce(code === tri)}
              >
                {t.libelle}
              </Link>
            ))}
          </div>

          {/* La provenance ne s'affiche qu'à partir de deux origines : avec une
              seule, la ligne de puces ne filtrerait rien. */}
          {origines.length >= 2 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-ardoise-400">Provenance :</span>
              <Link
                href={lien(tri, filtre, "")}
                prefetch={false}
                className={puce(origineChoisie === "")}
              >
                Toutes
              </Link>
              {origines.map(([code, n]) => (
                <Link
                  key={code}
                  href={lien(tri, filtre, code)}
                  prefetch={false}
                  className={puce(code === origineChoisie)}
                >
                  {code === "_inconnue"
                    ? "Origine non renseignée"
                    : libelleOrigine(code)}{" "}
                  ({n})
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {issuesConnues >= 2 && (
        <Carte className="mb-4">
          <p className="text-sm font-medium text-ardoise-800">
            Ce que disent tes réponses
          </p>
          <p className="mt-1 text-xs leading-relaxed text-ardoise-500">
            Le score de compatibilité est une hypothèse jusqu&apos;à ce que des
            réponses arrivent. Ci-dessous, la note moyenne des offres selon leur
            issue : si les entretiens ne se distinguent pas des refus, c&apos;est
            le barème qu&apos;il faut revoir, pas ta candidature.
          </p>
          <div className="mt-3 flex flex-wrap gap-6">
            {parIssue.map((x) => (
              <div key={x.issue}>
                <p className="text-xs text-ardoise-500">
                  {STATUTS[x.issue]?.libelle ?? x.issue}
                </p>
                <p className="text-xl font-semibold tabular-nums text-ardoise-900">
                  {x.moyenne === null ? "—" : `${x.moyenne} %`}
                </p>
                <p className="text-xs text-ardoise-400">
                  {x.cas} candidature{x.cas > 1 ? "s" : ""}
                </p>
              </div>
            ))}
          </div>
          {issuesConnues < 8 && (
            <p className="mt-3 text-xs text-ardoise-400">
              {issuesConnues} issue{issuesConnues > 1 ? "s" : ""} connue
              {issuesConnues > 1 ? "s" : ""} : trop peu pour conclure. À partir
              d&apos;une dizaine, l&apos;écart entre les moyennes commence à
              vouloir dire quelque chose.
            </p>
          )}
        </Carte>
      )}

      {candidatures.length === 0 ? (
        <EtatVide
          titre="Aucune candidature envoyée"
          description="Une offre n'apparaît ici qu'après un clic sur « Marquer comme envoyée » sur sa fiche. Générer un CV ou une lettre ne fait jamais basculer une offre dans cette liste."
        />
      ) : rangees.length === 0 ? (
        <EtatVide
          titre="Aucune candidature dans ce filtre"
          description="Les candidatures existent, mais aucune ne correspond à la sélection en cours. Reviens à « Toutes » pour les revoir."
        />
      ) : (
        <div className="space-y-3">
          {rangees.map((c) => {
            const s = STATUTS[c.statut] ?? {
              libelle: c.statut,
              classe: "bg-ardoise-100 text-ardoise-700",
            };
            const jours = joursDepuis(c.date_candidature);
            const due = relanceDue(c.statut, c.relance_prevue_le);
            const cv = cvDe(c);
            const note = scoreDe(c);

            return (
              <Carte key={c.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-ardoise-900">
                      {c.intitule ?? "Sans intitulé"}
                    </p>
                    <p className="mt-0.5 text-sm text-ardoise-500">
                      {c.entreprise}
                      {c.origine && ` · ${libelleOrigine(c.origine)}`}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {note !== null && (
                      <span className="text-sm font-semibold tabular-nums text-ardoise-700">
                        {note} %
                      </span>
                    )}
                    {due && (
                      <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-900">
                        À relancer
                      </span>
                    )}
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${s.classe}`}
                    >
                      {s.libelle}
                    </span>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-ardoise-100 pt-3 text-xs text-ardoise-500">
                  <span>
                    Envoyée le {jour(c.date_candidature)}
                    {jours !== null && ` · il y a ${jours} j`}
                  </span>
                  <span>
                    {c.statut === "envoyee" && c.relance_prevue_le
                      ? `Relance prévue le ${jour(c.relance_prevue_le)}`
                      : "Aucune relance prévue"}
                  </span>
                  {(c.relances ?? 0) > 0 && (
                    <span>
                      {c.relances} relance{(c.relances ?? 0) > 1 ? "s" : ""} ·
                      dernière le {jour(c.derniere_relance_le)}
                    </span>
                  )}

                  {/* D81 — deux portes explicites plutôt qu'une carte cliquable.
                      Le suivi n'a pas à redire ce que la fiche d'offre dit
                      déjà ; il doit y conduire. */}
                  <span className="ml-auto flex flex-wrap gap-2">
                    {cv ? (
                      <Link
                        href={`/document/${cv.id}`}
                        prefetch={false}
                        className="rounded-lg border border-ardoise-300 px-3 py-1.5 font-medium text-ardoise-700 transition hover:bg-ardoise-50"
                      >
                        Voir le CV envoyé
                      </Link>
                    ) : (
                      <span className="rounded-lg border border-dashed border-ardoise-200 px-3 py-1.5 text-ardoise-400">
                        Aucun CV composé
                      </span>
                    )}
                    <Link
                      href={`/${volet.slug}/candidatures/${c.id}`}
                      prefetch={false}
                      className="rounded-lg bg-ardoise-900 px-3 py-1.5 font-medium text-white transition hover:bg-ardoise-800"
                    >
                      Ouvrir la candidature →
                    </Link>
                  </span>
                </div>
              </Carte>
            );
          })}
        </div>
      )}
    </>
  );
}
