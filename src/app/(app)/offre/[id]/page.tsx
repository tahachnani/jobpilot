import { AlerteBudget, Carte, TitrePage } from "@/components/ui";
import {
  STATUTS,
  STATUTS_ENVOYES,
  STATUTS_SUIVI,
  VOLETS,
  type CodeVolet,
} from "@/config/volets";
import { SECTEURS } from "@/config/secteurs";
import { creerClientServeur } from "@/lib/supabase/server";
import type { Resultat, SousScore } from "@/lib/scoring";
import type { OffreExtraite } from "@/lib/extraction-offre";
import { notFound } from "next/navigation";
import Link from "next/link";
import BoutonSoumettre from "@/components/BoutonSoumettre";
import BoutonCopier from "@/components/BoutonCopier";
import type { ModeleCV } from "@/lib/cv/modele";
import {
  LIBELLES_POTENTIEL,
  type Ecart,
  type Potentiel,
} from "@/lib/cv/ecart";
import {
  supprimerOffre,
  recalculerScore,
  genererCV,
  marquerEnvoyee,
  changerStatut,
  planifierRelance,
  marquerRelancee,
  genererRelance,
} from "./actions";
import { jour, joursDepuis, relanceDue } from "@/lib/suivi";
import { budgetDuMois, montant } from "@/lib/couts";
import { repondreCompetence } from "./formulations/actions";
import { competencesManquantes } from "@/lib/cv/competences-manquantes";

export const dynamic = "force-dynamic";

function couleurNote(n: number) {
  if (n >= 80) return "text-emerald-700";
  if (n >= 60) return "text-amber-700";
  return "text-rose-700";
}

function fondNote(n: number) {
  if (n >= 80) return "bg-emerald-500";
  if (n >= 60) return "bg-amber-500";
  return "bg-rose-500";
}

function BlocSousScore({ titre, s }: { titre: string; s: SousScore }) {
  return (
    <Carte>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium text-ardoise-800">
          {titre}
          <span className="ml-2 text-xs font-normal text-ardoise-400">
            poids {s.poids} %
          </span>
        </p>
        <p className={`text-xl font-semibold tabular-nums ${couleurNote(s.note)}`}>
          {s.note}
        </p>
      </div>

      <p className="mt-1 text-sm text-ardoise-500">{s.resume}</p>

      {s.lignes.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-medium text-ardoise-500">
            Voir le détail du calcul
          </summary>
          <ul className="mt-2 space-y-2">
            {s.lignes.map((l, i) => (
              <li key={i} className="border-b border-ardoise-50 pb-2 last:border-0">
                <div className="flex items-start justify-between gap-3">
                  <span className="text-xs text-ardoise-700">{l.libelle}</span>
                  <span
                    className={`shrink-0 text-xs font-semibold tabular-nums ${couleurNote(
                      l.note
                    )}`}
                  >
                    {l.note}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-ardoise-400">{l.explication}</p>
              </li>
            ))}
          </ul>
        </details>
      )}
    </Carte>
  );
}

export default async function DetailOffre({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: {
    doublon?: string;
    cv?: string;
    message?: string;
    suivi?: string;
  };
}) {
  const supabase = creerClientServeur();

  const { data: offreBrute } = await supabase
    .from("offres")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  if (!offreBrute) notFound();
  const offre = offreBrute as Record<string, unknown>;
  const volet = VOLETS[offre.volet as CodeVolet];

  const [{ data: scoreBrut }, { data: analyseBrute }, { data: cvBruts }] =
    await Promise.all([
      supabase
        .from("scores")
        .select("detail, created_at")
        .eq("offre_id", params.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("offre_analyses")
        .select("resultat")
        .eq("offre_id", params.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("documents")
        .select("id, version, created_at, selection, type")
        .eq("offre_id", params.id)
        .in("type", ["cv", "lettre"])
        .order("version", { ascending: false }),
    ]);

  const tousDocuments = (cvBruts ?? []) as {
    id: string;
    version: number;
    created_at: string;
    type: string;
    selection: {
      modele?: ModeleCV;
      pages?: number;
      ecart?: Ecart;
      potentiel?: Potentiel;
    } | null;
  }[];

  const cvs = tousDocuments.filter((d) => d.type === "cv").map((d) => ({
    id: d.id,
    version: d.version,
    date: new Date(d.created_at).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
    modele: d.selection?.modele ?? null,
    pages: d.selection?.pages ?? null,
    ecart: d.selection?.ecart ?? null,
    potentiel: d.selection?.potentiel ?? null,
  }));

  const dernierCV = cvs[0] ?? null;


  const lettres = tousDocuments.filter((d) => d.type === "lettre");
  const derniereLettre = lettres[0] ?? null;

  const score = (scoreBrut as { detail: Resultat } | null)?.detail ?? null;
  const analyse =
    (analyseBrute as { resultat: OffreExtraite } | null)?.resultat ?? null;

  // Ce que l'offre réclame et que la base ne connaît pas : c'est une question
  // de profil, pas d'adaptation de CV. Sa place est ici, sur la fiche d'offre,
  // et non dans l'écran de reformulation où elle obligeait à entrer pour
  // répondre à chaque fois.
  const manquantes = analyse
    ? await competencesManquantes(analyse, offre.volet as CodeVolet)
    : [];

  const statut = STATUTS[offre.statut as string] ?? {
    libelle: String(offre.statut),
    classe: "bg-ardoise-100 text-ardoise-700",
  };

  const echec = offre.extraction_statut !== "complet";

  // Le suivi de la candidature (étape 6). L'historique est écrit par le
  // déclencheur `trg_journaliser_statut` depuis l'étape 1 : il n'y a qu'à le
  // lire.
  const { data: historiqueBrut } = await supabase
    .from("statuts_historique")
    .select("id, statut, date, commentaire")
    .eq("offre_id", params.id)
    .order("date", { ascending: false });
  const historique = (historiqueBrut ?? []) as {
    id: string;
    statut: string;
    date: string;
    commentaire: string | null;
  }[];

  const statutCode = offre.statut as string;
  // Le formulaire d'envoi disparaît dès que la candidature est partie, y
  // compris si le statut a été posé à la main sans date.
  const envoyee =
    !!offre.date_candidature || STATUTS_ENVOYES.includes(statutCode);
  const relancePrevue = (offre.relance_prevue_le as string | null) ?? null;
  const aRelancer = relanceDue(statutCode, relancePrevue);
  const joursEcoules = joursDepuis(offre.date_candidature as string | null);
  const aujourdhui = new Date().toISOString().slice(0, 10);

  // Les boutons de cette page dépensent : l'alerte a sa place ici.
  const budget = await budgetDuMois();

  const { data: relanceBrute } = await supabase
    .from("documents")
    .select("contenu_texte, selection, version, created_at")
    .eq("offre_id", params.id)
    .eq("type", "relance")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const relanceRedigee = relanceBrute as {
    contenu_texte: string | null;
    selection: { relance?: { objet: string; corps: string }; rang?: number } | null;
    version: number;
  } | null;

  return (
    <>
      <Link
        href={`/${volet.slug}/offres`}
        className="mb-4 inline-block text-sm text-ardoise-500 hover:text-ardoise-800"
      >
        ← Retour aux offres {volet.nom}
      </Link>

      <AlerteBudget
        depense={montant(budget.depense)}
        plafond={montant(budget.plafond)}
        depasse={budget.depasse}
        proche={budget.proche}
      />

      {searchParams.doublon && (
        <Carte className="mb-4 border-amber-200 bg-amber-50">
          <p className="text-sm text-amber-900">
            Cette offre était déjà enregistrée dans ce volet : te voici sur la
            fiche existante. Aucune seconde analyse n&apos;a été lancée, donc
            aucun coût supplémentaire.
          </p>
        </Carte>
      )}

      <TitrePage
        titre={(offre.intitule as string) ?? "Offre sans intitulé"}
        sousTitre={[
          offre.entreprise as string,
          offre.localisation as string,
          offre.contrat as string,
        ]
          .filter(Boolean)
          .join(" · ")}
        action={
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${statut.classe}`}
          >
            {statut.libelle}
          </span>
        }
      />

      {echec && (
        <Carte className="mb-4 border-rose-200 bg-rose-50">
          <p className="text-sm font-medium text-rose-900">
            L&apos;analyse n&apos;a pas abouti
          </p>
          <p className="mt-1 text-sm text-rose-800">
            {(offre.extraction_message as string) ??
              "Raison non précisée."}
          </p>
          <p className="mt-3 text-xs text-rose-700">
            Le contenu brut est conservé ci-dessous. Tu peux supprimer cette
            offre et la recréer en collant le texte complet.
          </p>
        </Carte>
      )}

      {score && (
        <>
          <Carte className="mb-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-ardoise-500">
                  Compatibilité
                </p>
                <p
                  className={`mt-1 text-4xl font-semibold tabular-nums ${couleurNote(
                    score.global
                  )}`}
                >
                  {score.global} %
                </p>
              </div>
              <div className="hidden flex-1 sm:block">
                <div className="h-2 w-full overflow-hidden rounded-full bg-ardoise-100">
                  <div
                    className={`h-full ${fondNote(score.global)}`}
                    style={{ width: `${score.global}%` }}
                  />
                </div>
              </div>
            </div>

            {score.plafonne && score.raisonPlafond && (
              <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                {score.raisonPlafond}
              </p>
            )}

            <p className="mt-4 text-xs text-ardoise-400">
              Calcul déterministe, barème version {score.versionBareme}. L&apos;IA
              a classé les missions dans une liste fermée ; le score lui-même est
              calculé par le code et sera identique à chaque exécution.
            </p>
          </Carte>

          <div className="grid gap-4 lg:grid-cols-2">
            <BlocSousScore titre="Missions" s={score.missions} />
            <BlocSousScore titre="Compétences" s={score.competences} />
            <BlocSousScore titre="Expérience" s={score.experience} />
            <BlocSousScore titre="Secteur" s={score.secteur} />
          </div>
        </>
      )}

      {analyse && (
        <>
          <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-ardoise-500">
            Ce que demande l&apos;offre
          </h2>
          <div className="grid gap-4 lg:grid-cols-2">
            <Carte>
              <p className="mb-2 text-sm font-medium text-ardoise-800">
                Informations
              </p>
              <ul className="space-y-1 text-sm text-ardoise-600">
                <li>
                  Secteur :{" "}
                  {analyse.secteur_code
                    ? SECTEURS[analyse.secteur_code]
                    : "non précisé"}
                </li>
                <li>
                  Expérience demandée :{" "}
                  {analyse.annees_experience ?? "non précisée"}
                </li>
                <li>Formation : {analyse.formation ?? "non précisée"}</li>
                <li>
                  Télétravail : {(offre.teletravail as string) ?? "non précisé"}
                </li>
                <li>
                  Salaire :{" "}
                  {offre.salaire_min
                    ? `${offre.salaire_min}${
                        offre.salaire_max ? ` – ${offre.salaire_max}` : ""
                      } € / ${offre.salaire_periode ?? "an"}`
                    : "non précisé"}
                </li>
              </ul>
            </Carte>

            <Carte>
              <p className="mb-2 text-sm font-medium text-ardoise-800">
                Mots-clés ATS
              </p>
              <div className="flex flex-wrap gap-1.5">
                {analyse.mots_cles_ats.length === 0 ? (
                  <span className="text-sm text-ardoise-400">Aucun repéré.</span>
                ) : (
                  analyse.mots_cles_ats.map((m) => (
                    <span
                      key={m}
                      className="rounded bg-ardoise-100 px-2 py-0.5 text-xs text-ardoise-700"
                    >
                      {m}
                    </span>
                  ))
                )}
              </div>
            </Carte>
          </div>
        </>
      )}

      <details className="mt-8">
        <summary className="cursor-pointer text-sm font-medium text-ardoise-500">
          Voir l&apos;offre originale ({String(offre.contenu_longueur ?? 0)}{" "}
          caractères)
        </summary>
        <Carte className="mt-3">
          <pre className="whitespace-pre-wrap text-xs leading-relaxed text-ardoise-600">
            {offre.contenu_brut as string}
          </pre>
        </Carte>
      </details>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <form action={recalculerScore}>
          <input type="hidden" name="id" value={params.id} />
          <BoutonSoumettre
            libelle="Recalculer le score"
            libelleEnCours="Recalcul…"
            className="rounded-lg border border-ardoise-300 px-4 py-2 text-sm font-medium text-ardoise-700 transition hover:bg-ardoise-50"
          />
        </form>

        <form action={supprimerOffre}>
          <input type="hidden" name="id" value={params.id} />
          <input type="hidden" name="volet" value={String(offre.volet)} />
          <BoutonSoumettre
            libelle="Supprimer cette offre"
            libelleEnCours="Suppression…"
            confirmation="Supprimer définitivement cette offre, son analyse et son score ?"
            className="rounded-lg border border-rose-200 px-4 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-50"
          />
        </form>
      </div>

      <p className="mt-3 text-xs text-ardoise-400">
        Le recalcul rejoue le barème sur l&apos;analyse déjà stockée : il ne
        rappelle pas l&apos;IA et ne coûte rien.
      </p>

      {manquantes.length > 0 && (
        <>
          <h2 className="mb-3 mt-10 text-sm font-semibold uppercase tracking-wide text-ardoise-500">
            Réclamé par l&apos;offre, absent de ton profil ({manquantes.length})
          </h2>
          <Carte>
            <p className="mb-4 text-sm text-ardoise-600">
              Si tu les maîtrises, ajoute-les : elles serviront à toutes tes
              offres. Sinon, écarte-les et elles ne reviendront plus — un refus
              se répare depuis Mon profil.
            </p>

            <div className="space-y-4">
              {manquantes.map((c) => (
                <form
                  key={c.libelle}
                  action={repondreCompetence}
                  className="border-t border-ardoise-100 pt-3"
                >
                  <input type="hidden" name="offreId" value={params.id} />
                  <input type="hidden" name="libelle" value={c.libelle} />

                  <p className="text-sm font-medium text-ardoise-800">
                    {c.libelle}
                    <span className="ml-2 text-xs font-normal text-ardoise-400">
                      {c.origine === "indispensable"
                        ? "exigée par l'offre"
                        : c.origine === "outil"
                        ? "outil cité"
                        : "souhaitée"}
                    </span>
                  </p>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <select
                      name="categorie"
                      defaultValue={c.categorieSuggeree}
                      className="rounded-lg border border-ardoise-300 px-2 py-1.5 text-xs"
                    >
                      <option value="cdg">Contrôle de gestion</option>
                      <option value="compta">Comptabilité</option>
                      <option value="outil">Outil / logiciel</option>
                      <option value="transversale">Transversale</option>
                    </select>
                    <select
                      name="niveau"
                      defaultValue="2"
                      className="rounded-lg border border-ardoise-300 px-2 py-1.5 text-xs"
                    >
                      <option value="1">Notions</option>
                      <option value="2">Opérationnel</option>
                      <option value="3">Maîtrisé</option>
                    </select>
                    <button
                      type="submit"
                      name="action"
                      value="maitrisee"
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium text-white ${volet.classeAccent}`}
                    >
                      Je la maîtrise
                    </button>
                    <button
                      type="submit"
                      name="action"
                      value="ecartee"
                      className="rounded-lg border border-ardoise-300 px-3 py-1.5 text-xs font-medium text-ardoise-700"
                    >
                      Non, écarter
                    </button>
                  </div>
                </form>
              ))}
            </div>
          </Carte>
        </>
      )}

      <h2 className="mb-3 mt-10 text-sm font-semibold uppercase tracking-wide text-ardoise-500">
        CV personnalisé
      </h2>

      {searchParams.cv === "erreur" && (
        <Carte className="mb-4 border-rose-200 bg-rose-50">
          <p className="text-sm font-medium text-rose-900">
            Le CV n&apos;a pas été généré
          </p>
          <p className="mt-1 text-sm text-rose-800">
            {searchParams.message ?? "Raison non précisée."}
          </p>
        </Carte>
      )}

      <Carte>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-ardoise-800">
              {dernierCV
                ? `Version ${dernierCV.version} générée le ${dernierCV.date}`
                : "Aucun CV généré pour cette offre"}
            </p>
            <p className="mt-1 text-sm text-ardoise-500">
              {dernierCV?.modele
                ? dernierCV.modele.meta.niveauLibelle
                : "La sélection des missions est déterministe et n'appelle pas l'IA : générer ne coûte rien."}
            </p>

            {dernierCV?.potentiel && (
              <p
                className={`mt-2 inline-block rounded px-2 py-1 text-xs font-medium ${
                  dernierCV.potentiel.niveau === "faible"
                    ? "bg-emerald-100 text-emerald-900"
                    : dernierCV.potentiel.niveau === "moyen"
                    ? "bg-amber-100 text-amber-900"
                    : "bg-rose-100 text-rose-900"
                }`}
              >
                Potentiel d&apos;adaptation{" "}
                {dernierCV.potentiel.niveau} —{" "}
                {dernierCV.potentiel.couverture} % du vocabulaire de
                l&apos;annonce déjà présent
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href={`/offre/${params.id}/formulations`}
              className="rounded-lg border border-ardoise-300 px-4 py-2 text-sm font-medium text-ardoise-700 transition hover:bg-ardoise-50"
            >
              Adapter les formulations
            </Link>
            <form action={genererCV}>
            <input type="hidden" name="id" value={params.id} />
            <BoutonSoumettre
              libelle={dernierCV ? "Régénérer le CV" : "Générer le CV"}
              libelleEnCours="Composition…"
              className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition ${volet.classeAccent} hover:opacity-90`}
              />
            </form>
          </div>
        </div>

        {dernierCV && (
          <>
            <div className="mt-4 flex flex-wrap gap-3">
              <a
                href={`/document/${dernierCV.id}`}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-ardoise-300 px-4 py-2 text-sm font-medium text-ardoise-700 transition hover:bg-ardoise-50"
              >
                Ouvrir le PDF
              </a>
              <a
                href={`/document/${dernierCV.id}?telecharger=1`}
                className="rounded-lg border border-ardoise-300 px-4 py-2 text-sm font-medium text-ardoise-700 transition hover:bg-ardoise-50"
              >
                Télécharger
              </a>
            </div>

            {dernierCV.modele && (
              <details className="mt-4">
                <summary className="cursor-pointer text-xs font-medium text-ardoise-500">
                  Voir ce qui a été retenu
                </summary>

                <div className="mt-3 space-y-4">
                  {dernierCV.modele.experiences.map((e, i) => (
                    <div key={i}>
                      <p className="text-xs font-medium text-ardoise-700">
                        {e.poste} — {e.periode} · {e.contrat}
                      </p>
                      <ul className="mt-1 space-y-1">
                        {e.missions.map((m, j) => (
                          <li key={j} className="text-xs text-ardoise-600">
                            • {m.texte}
                            <span className="ml-2 text-ardoise-400">
                              note {m.note}
                            </span>
                            {m.empruntee && (
                              <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-900">
                                empruntée à l&apos;autre volet
                              </span>
                            )}
                            {m.adaptee && (
                              <span className="ml-2 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-900">
                                reformulée pour cette offre
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}

                  <div>
                    <p className="text-xs font-medium text-ardoise-700">
                      Compétences, dans l&apos;ordre du CV
                    </p>
                    <p className="mt-1 text-xs text-ardoise-600">
                      {dernierCV.modele.competences.join(" · ")}
                    </p>
                  </div>

                  {dernierCV.ecart && (
                    <div className="rounded-lg bg-ardoise-50 p-3">
                      <p className="text-xs font-medium text-ardoise-700">
                        Écart avec ton CV de référence :{" "}
                        {dernierCV.ecart.partModifiee} % des lignes
                      </p>
                      <p className="mt-1 text-xs text-ardoise-500">
                        Le CV de référence est celui que ce volet produirait
                        sans tenir compte de l&apos;offre. Il n&apos;existe pas
                        comme document, il sert d&apos;étalon.
                      </p>

                      {dernierCV.ecart.missionsMisesEnAvant.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs font-medium text-emerald-800">
                            Remontées par cette offre
                          </p>
                          <ul className="mt-1 space-y-0.5">
                            {dernierCV.ecart.missionsMisesEnAvant.map((t, i) => (
                              <li key={i} className="text-xs text-ardoise-600">
                                • {t}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {dernierCV.ecart.missionsEcartees.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs font-medium text-ardoise-500">
                            Écartées au profit des précédentes
                          </p>
                          <ul className="mt-1 space-y-0.5">
                            {dernierCV.ecart.missionsEcartees.map((t, i) => (
                              <li key={i} className="text-xs text-ardoise-400">
                                • {t}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {dernierCV.ecart.competencesAjoutees.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs font-medium text-emerald-800">
                            Compétences remontées par cette offre
                          </p>
                          <ul className="mt-1 space-y-0.5">
                            {dernierCV.ecart.competencesAjoutees.map((c, i) => (
                              <li key={i} className="text-xs text-ardoise-600">
                                • {c}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {dernierCV.ecart.competencesRetirees.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs font-medium text-ardoise-500">
                            Compétences écartées au profit des précédentes
                          </p>
                          <ul className="mt-1 space-y-0.5">
                            {dernierCV.ecart.competencesRetirees.map((c, i) => (
                              <li key={i} className="text-xs text-ardoise-400">
                                • {c}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {dernierCV.modele && (
                        <p className="mt-3 border-t border-ardoise-200 pt-2 text-xs text-ardoise-600">
                          Total :{" "}
                          {dernierCV.ecart.missionsMisesEnAvant.length +
                            dernierCV.ecart.missionsEcartees.length +
                            dernierCV.ecart.competencesAjoutees.length +
                            dernierCV.ecart.competencesRetirees.length +
                            dernierCV.ecart.nbReformulees}{" "}
                          changement
                          {dernierCV.ecart.missionsMisesEnAvant.length +
                            dernierCV.ecart.missionsEcartees.length +
                            dernierCV.ecart.competencesAjoutees.length +
                            dernierCV.ecart.competencesRetirees.length +
                            dernierCV.ecart.nbReformulees >
                          1
                            ? "s"
                            : ""}{" "}
                          par rapport au CV de référence, dont{" "}
                          {dernierCV.ecart.nbReformulees} reformulation
                          {dernierCV.ecart.nbReformulees > 1 ? "s" : ""} et{" "}
                          {dernierCV.ecart.nbEmpruntees} emprunt
                          {dernierCV.ecart.nbEmpruntees > 1 ? "s" : ""} à
                          l&apos;autre volet.
                        </p>
                      )}
                    </div>
                  )}

                  <p className="text-xs text-ardoise-400">
                    {dernierCV.modele.meta.nbEmprunts} emprunt
                    {dernierCV.modele.meta.nbEmprunts > 1 ? "s" : ""} sur 2
                    autorisés. {dernierCV.pages ?? 1} page
                    {(dernierCV.pages ?? 1) > 1 ? "s" : ""} composée
                    {(dernierCV.pages ?? 1) > 1 ? "s" : ""}. Les textes sont
                    ceux de ta base, repris mot pour mot : aucune reformulation.
                  </p>
                </div>
              </details>
            )}
          </>
        )}

        {cvs.length > 1 && (
          <details className="mt-4">
            <summary className="cursor-pointer text-xs font-medium text-ardoise-500">
              Versions précédentes ({cvs.length - 1})
            </summary>
            <ul className="mt-2 space-y-1">
              {cvs.slice(1).map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between gap-3 text-xs text-ardoise-600"
                >
                  <span>
                    Version {c.version} — {c.date}
                  </span>
                  <a
                    href={`/document/${c.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 font-medium text-ardoise-500 underline"
                  >
                    Ouvrir
                  </a>
                </li>
              ))}
            </ul>
          </details>
        )}
      </Carte>

      <h2 className="mb-3 mt-10 text-sm font-semibold uppercase tracking-wide text-ardoise-500">
        Lettre et email
      </h2>

      <Carte>
        <p className="text-sm font-medium text-ardoise-800">
          {derniereLettre
            ? `Version ${derniereLettre.version} rédigée le ${new Date(
                derniereLettre.created_at
              ).toLocaleDateString("fr-FR", {
                day: "2-digit",
                month: "long",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}`
            : "Aucune lettre rédigée pour cette offre"}
        </p>
        <p className="mt-1 text-sm text-ardoise-500">
          La lettre s&apos;appuie sur tout ton parcours, pas seulement sur ce
          que le CV a pu contenir. L&apos;email de candidature est rédigé dans
          la foulée.
        </p>

        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href={`/offre/${params.id}/lettre`}
            className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition ${volet.classeAccent} hover:opacity-90`}
          >
            {derniereLettre ? "Relire et corriger" : "Rédiger la lettre"}
          </Link>

          {derniereLettre && (
            <>
              <a
                href={`/document/${derniereLettre.id}`}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-ardoise-300 px-4 py-2 text-sm font-medium text-ardoise-700 transition hover:bg-ardoise-50"
              >
                Ouvrir le PDF
              </a>
              <a
                href={`/document/${derniereLettre.id}?telecharger=1`}
                className="rounded-lg border border-ardoise-300 px-4 py-2 text-sm font-medium text-ardoise-700 transition hover:bg-ardoise-50"
              >
                Télécharger
              </a>
            </>
          )}
        </div>
      </Carte>

      <Carte className="mt-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold uppercase tracking-wide text-ardoise-500">
            Suivi de la candidature
          </p>
          {aRelancer && (
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-900">
              À relancer
            </span>
          )}
        </div>

        {searchParams.suivi === "erreur" ? (
          <p className="mt-3 rounded-lg bg-rose-50 p-2.5 text-sm text-rose-900">
            {searchParams.message ?? "La dernière action a échoué."}
          </p>
        ) : searchParams.suivi ? (
          <p className="mt-3 rounded-lg bg-emerald-50 p-2.5 text-sm text-emerald-900">
            {searchParams.suivi === "relance-redigee"
              ? "Relance rédigée, à relire ci-dessous avant envoi."
              : searchParams.suivi === "envoyee"
              ? "Candidature marquée comme envoyée."
              : searchParams.suivi === "relancee"
                ? "Relance enregistrée, la suivante est repoussée."
                : searchParams.suivi === "relance"
                  ? "Date de relance mise à jour."
                  : "Statut mis à jour."}
          </p>
        ) : null}

        {!envoyee ? (
          <form action={marquerEnvoyee} className="mt-4">
            <input type="hidden" name="id" value={params.id} />
            <p className="text-sm text-ardoise-600">
              Rien ne bascule ici tout seul : l&apos;application n&apos;envoie
              aucun email et ne peut pas savoir qu&apos;une candidature est
              partie.
            </p>
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <label className="text-xs text-ardoise-500">
                Date d&apos;envoi
                <input
                  type="date"
                  name="date"
                  defaultValue={aujourdhui}
                  className="mt-1 block rounded-lg border border-ardoise-200 px-2 py-1.5 text-sm outline-none focus:border-ardoise-500"
                />
              </label>
              <label className="flex-1 text-xs text-ardoise-500">
                Commentaire (facultatif)
                <input
                  name="commentaire"
                  placeholder="Candidature déposée sur le site, référence…"
                  className="mt-1 block w-full rounded-lg border border-ardoise-200 px-2 py-1.5 text-sm outline-none focus:border-ardoise-500"
                />
              </label>
              <BoutonSoumettre
                libelle="Marquer comme envoyée"
                libelleEnCours="Enregistrement…"
                className="rounded-lg bg-ardoise-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-ardoise-800"
              />
            </div>
          </form>
        ) : (
          <>
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-ardoise-600">
              <span>
                Envoyée le{" "}
                <strong className="text-ardoise-900">
                  {jour(offre.date_candidature as string)}
                </strong>
                {joursEcoules !== null && (
                  <span className="text-ardoise-400">
                    {" "}
                    · il y a {joursEcoules} jour{joursEcoules > 1 ? "s" : ""}
                  </span>
                )}
              </span>
              <span>
                Relances{" "}
                <strong className="text-ardoise-900">
                  {(offre.relances as number) ?? 0}
                </strong>
                {!!offre.derniere_relance_le && (
                  <span className="text-ardoise-400">
                    {" "}
                    · dernière le {jour(offre.derniere_relance_le as string)}
                  </span>
                )}
              </span>
            </div>

            <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-ardoise-100 pt-4">
              <form action={planifierRelance} className="flex items-end gap-2">
                <input type="hidden" name="id" value={params.id} />
                <label className="text-xs text-ardoise-500">
                  Prochaine relance
                  <input
                    type="date"
                    name="date"
                    defaultValue={relancePrevue ?? ""}
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

              {statutCode === "envoyee" && (
                <form action={marquerRelancee}>
                  <input type="hidden" name="id" value={params.id} />
                  <button
                    type="submit"
                    className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100"
                  >
                    Relancé aujourd&apos;hui
                  </button>
                </form>
              )}

              {statutCode === "envoyee" && (
                <form action={genererRelance}>
                  <input type="hidden" name="id" value={params.id} />
                  <BoutonSoumettre
                    libelle={
                      relanceRedigee ? "Réécrire la relance" : "Rédiger la relance"
                    }
                    libelleEnCours="Rédaction…"
                    className="rounded-lg border border-ardoise-300 px-3 py-1.5 text-xs font-medium text-ardoise-700 hover:bg-ardoise-50"
                  />
                </form>
              )}
            </div>

            {relanceRedigee?.selection?.relance && (
              <div className="mt-4 rounded-lg border border-ardoise-200 bg-ardoise-50/60 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-medium text-ardoise-600">
                    Relance rédigée
                    {relanceRedigee.selection.rang
                      ? ` — ${relanceRedigee.selection.rang}ᵉ`
                      : ""}{" "}
                    · version {relanceRedigee.version}
                  </p>
                  <BoutonCopier
                    texte={`${relanceRedigee.selection.relance.objet}\n\n${relanceRedigee.selection.relance.corps}`}
                    className="rounded-lg border border-ardoise-300 bg-white px-3 py-1 text-xs font-medium text-ardoise-700 hover:bg-ardoise-50"
                  />
                </div>
                <p className="mt-2 text-sm font-medium text-ardoise-900">
                  {relanceRedigee.selection.relance.objet}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-ardoise-700">
                  {relanceRedigee.selection.relance.corps}
                </p>
                <p className="mt-2 text-xs text-ardoise-400">
                  Rien n'est envoyé d'ici : copie le message, puis clique
                  « Relancé aujourd&apos;hui » une fois parti.
                </p>
              </div>
            )}

            <form
              action={changerStatut}
              className="mt-4 border-t border-ardoise-100 pt-4"
            >
              <input type="hidden" name="id" value={params.id} />
              <p className="text-xs text-ardoise-500">Déclarer une issue</p>
              <div className="mt-2 flex flex-wrap items-end gap-3">
                <select
                  name="statut"
                  defaultValue={
                    STATUTS_SUIVI.includes(
                      statutCode as (typeof STATUTS_SUIVI)[number]
                    )
                      ? statutCode
                      : "entretien"
                  }
                  className="rounded-lg border border-ardoise-200 px-2 py-1.5 text-sm outline-none focus:border-ardoise-500"
                >
                  {STATUTS_SUIVI.map((s) => (
                    <option key={s} value={s}>
                      {STATUTS[s].libelle}
                    </option>
                  ))}
                </select>
                <input
                  name="commentaire"
                  placeholder="Commentaire (facultatif)"
                  className="flex-1 rounded-lg border border-ardoise-200 px-2 py-1.5 text-sm outline-none focus:border-ardoise-500"
                />
                <BoutonSoumettre
                  libelle="Enregistrer"
                  libelleEnCours="Enregistrement…"
                  className="rounded-lg border border-ardoise-300 px-4 py-2 text-sm font-medium text-ardoise-700 transition hover:bg-ardoise-50"
                />
              </div>
            </form>
          </>
        )}

        {historique.length > 0 && (
          <details className="mt-4 border-t border-ardoise-100 pt-3">
            <summary className="cursor-pointer text-xs font-medium text-ardoise-500">
              Historique ({historique.length})
            </summary>
            <ul className="mt-2 space-y-1.5">
              {historique.map((h) => (
                <li key={h.id} className="flex flex-wrap gap-2 text-xs">
                  <span className="text-ardoise-400">{jour(h.date)}</span>
                  <span className="font-medium text-ardoise-700">
                    {STATUTS[h.statut]?.libelle ?? h.statut}
                  </span>
                  {h.commentaire && (
                    <span className="text-ardoise-500">— {h.commentaire}</span>
                  )}
                </li>
              ))}
            </ul>
          </details>
        )}

        <details className="mt-3">
          <summary className="cursor-pointer text-xs text-ardoise-400">
            Corriger le statut
          </summary>
          <form action={changerStatut} className="mt-2 flex flex-wrap gap-2">
            <input type="hidden" name="id" value={params.id} />
            <select
              name="statut"
              defaultValue={statutCode}
              className="rounded-lg border border-ardoise-200 px-2 py-1.5 text-sm outline-none focus:border-ardoise-500"
            >
              {Object.entries(STATUTS).map(([code, s]) => (
                <option key={code} value={code}>
                  {s.libelle}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded-lg border border-ardoise-200 px-3 py-1.5 text-xs text-ardoise-600 hover:bg-ardoise-50"
            >
              Poser ce statut
            </button>
          </form>
          <p className="mt-2 text-xs text-ardoise-400">
            Sans garde-fou, y compris en arrière : une erreur de clic ne doit
            pas être définitive.
          </p>
        </details>
      </Carte>
    </>
  );
}
