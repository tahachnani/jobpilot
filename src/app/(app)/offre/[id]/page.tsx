import { AlerteBudget, Carte, TitrePage } from "@/components/ui";
import {
  STATUTS,
  STATUTS_ENVOYES,
  STATUTS_SUIVI,
  VOLETS,
  type CodeVolet,
} from "@/config/volets";
import { SECTEURS } from "@/config/secteurs";
import {
  CANAL_PAR_DEFAUT,
  CANAUX_RELANCE,
  GROUPES_ORIGINE,
  ORIGINES,
} from "@/config/origines";
import { creerClientServeur } from "@/lib/supabase/server";
import type { Resultat, SousScore } from "@/lib/scoring";
import type { OffreExtraite } from "@/lib/extraction-offre";
import { notFound } from "next/navigation";
import Link from "next/link";
import BoutonSoumettre from "@/components/BoutonSoumettre";
import BoutonCopier from "@/components/BoutonCopier";
import type { ModeleCV } from "@/lib/cv/modele";
import {
  ACTIONS_PAR_SOURCE,
  LIBELLES_POTENTIEL,
  LIBELLES_SOURCE,
  lirePotentiel,
  type Ecart,
  type Potentiel,
} from "@/lib/cv/ecart";
import { estimerPotentiel } from "@/lib/cv/estimation";
import { titreCV } from "@/lib/cv/titre";
import { ligneLieu } from "@/lib/cv/lieu";
import {
  LARGEUR_UTILE,
  MESURES,
  nombreDeLignes,
} from "@/lib/cv/mise-en-page";
import { lireFiche } from "@/lib/entreprise/fiche";
import { documentationEntreprise } from "@/lib/entreprise/documentee";
import { referenceAnnonce } from "@/lib/offre/reference";
import {
  supprimerOffre,
  recalculerScore,
  reanalyserOffre,
  genererCV,
  marquerEnvoyee,
  modifierCanaux,
  changerStatut,
  planifierRelance,
  marquerRelancee,
  genererRelance,
  revenirEnArriere,
  genererPreparation,
  modifierIntituleCV,
  modifierMentionLieu,
} from "./actions";
import { jour, joursDepuis, relanceDue } from "@/lib/suivi";
import { schemaDe } from "@/lib/documents";
import { contactPrincipal } from "@/lib/offre/contact";
import { budgetDuMois, montant } from "@/lib/couts";
import { repondreCompetence } from "./formulations/actions";
import { detailCouverture } from "@/lib/cv/competences-manquantes";
import { preparationEnTexte, type Preparation } from "@/lib/entretien/generer";

export const dynamic = "force-dynamic";

/**
 * Durée maximale de la fonction, déclarée explicitement (D115).
 *
 * La génération du 2 octobre a duré soixante-quatre secondes — fiche
 * entreprise puis lettre dans la même requête — et a dépassé la limite par
 * défaut sans que rien ne le dise. Le navigateur a lâché, l'écran est resté
 * muet, un second clic est parti, et la facture a doublé.
 *
 * Soixante secondes est le maximum du plan Hobby : le déclarer ne l'augmente
 * pas, mais rend la contrainte visible dans le code plutôt que subie. La vraie
 * correction est ailleurs — la recherche est passée au modèle d'extraction
 * avec une seule requête, ce qui ramène l'étape de vingt secondes à moins de
 * dix — et le verrou empêche le second appel de dépenser.
 */
export const maxDuration = 60;

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
                  {l.mesuree === false ? (
                    <span
                      className="shrink-0 rounded bg-ardoise-100 px-1.5 py-0.5 text-[10px] font-medium text-ardoise-500"
                      title="Hors du calcul : ni en bien ni en mal"
                    >
                      hors calcul
                    </span>
                  ) : (
                    <span
                      className={`shrink-0 text-xs font-semibold tabular-nums ${couleurNote(
                        l.note
                      )}`}
                    >
                      {l.note}
                    </span>
                  )}
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
    competence?: string;
    analyse?: string;
    avant?: string;
    apres?: string;
    titre?: string;
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
    schema: schemaDe(d.selection),
  }));

  const dernierCV = cvs[0] ?? null;

  /**
   * L'indice d'adaptation, lu une fois pour toutes (D89).
   *
   * Il est figé dans le document le jour de sa composition : celui d'avant
   * l'étape 4ter n'a pas de listes, celui d'avant D78 pas de ventilation. La
   * lecture passe par `lirePotentiel` plutôt que de deviner la forme ici.
   */
  const {
    potentiel: potentielDuCV,
    sansSource: potentielSansSource,
    perime: potentielPerime,
  } = lirePotentiel(dernierCV?.potentiel, dernierCV?.schema);

  // L'adresse de candidature écrite dans l'annonce (D94) : trouvée par motif
  // dans le texte déjà stocké, sans appel ni réanalyse.
  const contactAnnonce = contactPrincipal(offre.contenu_brut as string | null);

  /**
   * Ce que l'on sait de l'employeur, et par quel chemin (D108, D109).
   *
   * Lecture seule : ouvrir une fiche d'offre ne doit jamais déclencher une
   * recherche facturée. La fiche apparaît si la lettre en a fait établir une ;
   * sinon l'écran dit honnêtement pourquoi il n'y en a pas — soit l'annonce
   * suffisait, soit personne n'a encore rédigé de lettre.
   */
  const { fiche: ficheEntreprise, ageJours: ficheAge } = await lireFiche(
    offre.entreprise as string | null
  );
  const docEntreprise = documentationEntreprise(offre.contenu_brut as string | null);
  const reference = referenceAnnonce(offre.contenu_brut as string | null);

  const lettres = tousDocuments.filter((d) => d.type === "lettre");
  const derniereLettre = lettres[0] ?? null;

  const score = (scoreBrut as { detail: Resultat } | null)?.detail ?? null;
  const analyse =
    (analyseBrute as { resultat: OffreExtraite } | null)?.resultat ?? null;

  /**
   * L'indice avant toute génération (D98).
   *
   * Il n'y avait aucune raison d'attendre le CV : la décision qu'il éclaire —
   * payer une reformulation ou non — se prend juste après l'analyse. Tant
   * qu'aucun CV n'existe, on l'estime, et l'écran dit que c'est une estimation.
   */
  const potentielEstime =
    !potentielDuCV && analyse
      ? await estimerPotentiel(
          offre.volet as CodeVolet,
          params.id,
          analyse,
          {
            titre: offre.intitule_cv as string | null,
            lieu: offre.mention_lieu as string | null,
          }
        )
      : null;

  /**
   * La localisation du profil, pour montrer la ligne telle qu'elle sera
   * imprimée (D122). Un aperçu vaut mieux qu'une explication : la mention
   * s'accole à la localisation, et c'est l'ensemble qu'un recruteur lit.
   */
  const { data: profilBrut } = await supabase
    .from("profil")
    .select("localisation")
    .maybeSingle();
  const localisationProfil =
    (profilBrut as { localisation: string | null } | null)?.localisation ?? null;

  /**
   * La ligne de contact telle qu'elle sera composée, et si elle tient.
   *
   * Les mentions déduites tiennent toutes sur une ligne, « Aix-en-Provence »
   * compris — mesuré. Une saisie longue, elle, peut faire passer la ligne sur
   * deux : ce n'est pas un défaut, l'estimateur le voit et le garnissage le
   * compense, mais autant que ce soit dit avant plutôt que découvert sur le
   * PDF.
   */
  const lieuImprime = ligneLieu(
    localisationProfil,
    analyse,
    offre.mention_lieu as string | null
  );
  const contactImprime = [
    "tahachnani@gmail.com",
    "+33 7 53 83 72 50",
    lieuImprime,
    "linkedin.com/in/tahachnani",
    "Permis B",
  ]
    .filter(Boolean)
    .join("  |  ");
  const contactSurDeuxLignes =
    nombreDeLignes(contactImprime, MESURES.tailleContact, LARGEUR_UTILE) > 1;

  const potentiel = potentielDuCV ?? potentielEstime;
  const potentielProvisoire = !potentielDuCV && potentielEstime !== null;

  const termesCorpus = potentiel?.parSource?.corpus ?? [];

  /** Les sources qui ne permettent aucune action, repliées derrière un détail. */
  const autresSources = (["activite", "mission", "competence", "formation"] as const)
    .map((source) => [source, potentiel?.parSource?.[source] ?? []] as const)
    .filter(([, termes]) => termes.length > 0);

  // Ce que l'offre réclame et que la base ne connaît pas : c'est une question
  // de profil, pas d'adaptation de CV. Sa place est ici, sur la fiche d'offre,
  // et non dans l'écran de reformulation où elle obligeait à entrer pour
  // répondre à chaque fois.
  const couverture = analyse
    ? await detailCouverture(analyse, offre.volet as CodeVolet)
    : { manquantes: [], connues: [], ignorees: [], contextes: [] };
  const manquantes = couverture.manquantes;

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

  // Le statut d'avant, pour nommer le bouton de retour : « Revenir à
  // Candidature envoyée » se comprend sans explication, « Annuler » non.
  const statutPrecedent = historique.find((h) => h.statut !== statutCode)
    ?.statut;

  // Les boutons de cette page dépensent : l'alerte a sa place ici.
  const budget = await budgetDuMois();

  const { data: preparationBrute } = await supabase
    .from("documents")
    .select("selection, version")
    .eq("offre_id", params.id)
    .eq("type", "preparation")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const preparation =
    (preparationBrute as { selection: { preparation?: Preparation } | null } | null)
      ?.selection?.preparation ?? null;

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

      {searchParams.competence && (
        <Carte className="mb-4 border-emerald-200 bg-emerald-50">
          <p className="text-sm text-emerald-900">
            Compétence enregistrée. Le score se met à jour au prochain recalcul,
            depuis le bouton « Recalculer le score » ci-dessous.
          </p>
        </Carte>
      )}

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
            {/* D122 — le lieu n'existe pas sur les scores calculés avant le
                5 octobre. Un recalcul, qui est gratuit, le fait apparaître. */}
            {score.lieu ? <BlocSousScore titre="Lieu" s={score.lieu} /> : null}
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

        {/* D77 — le seul bouton de ce bloc qui dépense, d'où la
            confirmation. Il existe parce que le recalcul ne reclasse rien :
            une offre analysée avant l'ajout d'un code gardait ses lignes
            « hors calcul » pour toujours. */}
        <form action={reanalyserOffre}>
          <input type="hidden" name="id" value={params.id} />
          <BoutonSoumettre
            libelle="Réanalyser l'offre"
            libelleEnCours="Réanalyse… (30 s)"
            confirmation={
              "Rappeler le modèle sur le texte de l'annonce pour reclasser ses missions ?\n\n" +
              "Coût : environ 0,01 $. L'analyse actuelle est conservée, et ni le statut, ni les CV, ni les lettres ne changent."
            }
            className="rounded-lg border border-amber-300 px-4 py-2 text-sm font-medium text-amber-800 transition hover:bg-amber-50"
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

      {searchParams.analyse === "erreur" && (
        <Carte className="mt-3 border-rose-200 bg-rose-50">
          <p className="text-sm text-rose-900">
            {searchParams.message ?? "La réanalyse a échoué."}
          </p>
          <p className="mt-1 text-xs text-rose-800">
            L&apos;analyse précédente est intacte : rien n&apos;a été perdu.
          </p>
        </Carte>
      )}

      {searchParams.analyse === "ok" && (
        <Carte className="mt-3 border-emerald-200 bg-emerald-50">
          <p className="text-sm text-emerald-900">
            Offre réanalysée et renotée.{" "}
            {searchParams.avant === searchParams.apres
              ? `Le classement n'a pas bougé : ${
                  searchParams.apres ?? "0"
                } ligne(s) restent hors calcul.`
              : `Lignes hors calcul : ${searchParams.avant ?? "?"} avant, ${
                  searchParams.apres ?? "?"
                } après.`}
          </p>
          <p className="mt-1 text-xs text-emerald-800">
            L&apos;analyse précédente est conservée : une réanalyse peut être
            moins bonne que celle qu&apos;elle remplace.
          </p>
        </Carte>
      )}

      <p className="mt-3 text-xs text-ardoise-400">
        Le recalcul rejoue le barème sur l&apos;analyse déjà stockée : il ne
        rappelle pas l&apos;IA et ne coûte rien. La réanalyse, elle, redemande
        au modèle de classer les missions de l&apos;annonce — c&apos;est le
        seul moyen de rattraper une ligne « hors calcul » après avoir ajouté un
        code à la taxonomie.
      </p>

      {analyse && manquantes.length === 0 && couverture.contextes.length === 0 && (
        <>
          <h2 className="mb-3 mt-10 text-sm font-semibold uppercase tracking-wide text-ardoise-500">
            Réclamé par l&apos;offre, absent de ton profil
          </h2>
          <Carte className="border-dashed">
            <p className="text-sm text-ardoise-600">
              Rien à ajouter : {couverture.connues.length} libellé
              {couverture.connues.length > 1 ? "s" : ""} cité
              {couverture.connues.length > 1 ? "s" : ""} par l&apos;annonce
              {couverture.connues.length > 1 ? " sont" : " est"} déjà dans ta
              base.
            </p>

            {couverture.ignorees.length > 0 && (
              <>
                <p className="mt-3 text-sm text-ardoise-600">
                  {couverture.ignorees.length} autre
                  {couverture.ignorees.length > 1 ? "s" : ""} ne{" "}
                  {couverture.ignorees.length > 1 ? "sont" : "est"} pas
                  proposé{couverture.ignorees.length > 1 ? "s" : ""} à
                  l&apos;ajout, jugé
                  {couverture.ignorees.length > 1 ? "s" : ""} trop générique
                  {couverture.ignorees.length > 1 ? "s" : ""} pour valoir une
                  ligne de CV :
                </p>
                <p className="mt-1 text-xs text-ardoise-500">
                  {couverture.ignorees.join(" · ")}
                </p>
                <p className="mt-2 text-xs text-ardoise-400">
                  Attention : le score, lui, les compte. Si l&apos;une
                  d&apos;elles apparaît à 0 dans le détail des compétences,
                  c&apos;est qu&apos;elle te coûte des points sans que
                  l&apos;application te propose de l&apos;ajouter.
                </p>
              </>
            )}
          </Carte>
        </>
      )}

      {couverture.contextes.length > 0 && (
        <>
          <h2 className="mb-3 mt-10 text-sm font-semibold uppercase tracking-wide text-ardoise-500">
            Exigences de contexte ({couverture.contextes.length})
          </h2>
          <Carte className="border-dashed">
            <p className="text-sm text-ardoise-600">
              L&apos;annonce pose des conditions sur le parcours ou le type
              d&apos;entreprise, pas sur un savoir-faire :
            </p>
            <ul className="mt-2 list-disc space-y-0.5 pl-4 text-sm text-ardoise-700">
              {couverture.contextes.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
            <p className="mt-3 text-xs leading-relaxed text-ardoise-400">
              Ce ne sont pas des compétences et elles ne s&apos;ajoutent pas à
              ton profil : une expérience sectorielle se lit dans tes
              employeurs, pas dans une ligne de compétence. Si le secteur te
              correspond, le sous-score « secteur » le mesure déjà.
            </p>
          </Carte>
        </>
      )}

      {manquantes.length > 0 && (
        <>
          <h2 className="mb-3 mt-10 text-sm font-semibold uppercase tracking-wide text-ardoise-500">
            Réclamé par l&apos;offre, absent de ton profil ({manquantes.length})
          </h2>
          <Carte>
            <p className="mb-4 text-sm leading-relaxed text-ardoise-600">
              Si tu les maîtrises, ajoute-les : elles serviront à toutes tes
              offres. Sinon, écarte-les et elles ne reviendront plus — un refus
              se répare depuis Mon profil.{" "}
              <strong className="font-medium text-ardoise-800">
                Corrige le libellé avant d&apos;enregistrer
              </strong>{" "}
              : c&apos;est lui qui entrera dans ta base et qui pourra paraître
              sur un CV. Une annonce écrit « Appétence pour les systèmes
              d&apos;information » ; un CV écrit autre chose.
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
                  <input type="hidden" name="retour" value="offre" />

                  <p className="text-xs text-ardoise-400">
                    L&apos;annonce écrit «&nbsp;{c.libelle}&nbsp;» —{" "}
                    {c.origine === "indispensable"
                      ? "exigée"
                      : c.origine === "outil"
                        ? "outil cité"
                        : "souhaitée"}
                  </p>

                  {/* Le libellé qui entrera en base, corrigeable avant d'être
                      enregistré (D72) : une formulation d'annonce n'est pas une
                      formulation de CV. */}
                  <input
                    name="libelleRetenu"
                    defaultValue={c.libelle}
                    className="mt-1 w-full rounded-lg border border-ardoise-200 px-2 py-1.5 text-sm font-medium text-ardoise-800 outline-none focus:border-ardoise-500"
                  />

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
                      defaultValue="1"
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

        {/* D121 — le titre imprimé en tête du CV.
            Il était figé par volet, donc « COMPTABLE » sur une candidature
            d'auditeur. Le changer ici évite d'ouvrir un volet entier pour une
            ligne de texte : le reste du CV s'adapte déjà offre par offre. */}
        <form
          action={modifierIntituleCV}
          className="mt-4 border-t border-ardoise-100 pt-4"
        >
          <input type="hidden" name="id" value={params.id} />
          <label
            htmlFor="intituleCV"
            className="block text-xs font-medium uppercase tracking-wide text-ardoise-500"
          >
            Titre imprimé en haut du CV
          </label>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <input
              id="intituleCV"
              name="intituleCV"
              type="text"
              maxLength={120}
              defaultValue={(offre.intitule_cv as string | null) ?? ""}
              placeholder={titreCV(offre.volet as CodeVolet, analyse)}
              className="min-w-0 flex-1 rounded-lg border border-ardoise-300 px-3 py-2 text-sm text-ardoise-900 placeholder:text-ardoise-400"
            />
            <BoutonSoumettre
              libelle="Enregistrer"
              libelleEnCours="Enregistrement…"
              className="rounded-lg border border-ardoise-300 px-4 py-2 text-sm font-medium text-ardoise-700 transition hover:bg-ardoise-50"
            />
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-ardoise-500">
            {offre.intitule_cv
              ? "Ta saisie l'emporte sur l'annonce. Vide ce champ pour revenir à l'intitulé de l'annonce."
              : `Déduit de l'annonce : « ${titreCV(offre.volet as CodeVolet, analyse)} ». Écris ici pour l'imposer — « Auditeur junior », par exemple.`}{" "}
            Le titre vaut pour la prochaine génération, qui ne coûte rien.
          </p>
        </form>

        {/* D122 — la mention de mobilité, à côté de la localisation.
            Le tri géographique se joue sur la fiche candidat de la plateforme,
            pas sur le PDF : nommer la mobilité répond à la question du
            recruteur, inventer une ville ne franchit aucun filtre. */}
        <form
          action={modifierMentionLieu}
          className="mt-4 border-t border-ardoise-100 pt-4"
        >
          <input type="hidden" name="id" value={params.id} />
          <label
            htmlFor="mentionLieu"
            className="block text-xs font-medium uppercase tracking-wide text-ardoise-500"
          >
            Mention de mobilité
          </label>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <input
              id="mentionLieu"
              name="mentionLieu"
              type="text"
              maxLength={80}
              defaultValue={(offre.mention_lieu as string | null) ?? ""}
              placeholder="déduite du périmètre"
              className="min-w-0 flex-1 rounded-lg border border-ardoise-300 px-3 py-2 text-sm text-ardoise-900 placeholder:text-ardoise-400"
            />
            <BoutonSoumettre
              libelle="Enregistrer"
              libelleEnCours="Enregistrement…"
              className="rounded-lg border border-ardoise-300 px-4 py-2 text-sm font-medium text-ardoise-700 transition hover:bg-ardoise-50"
            />
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-ardoise-500">
            Ligne imprimée :{" "}
            <span className="font-medium text-ardoise-700">
              {lieuImprime || "—"}
            </span>
            . Rien n&apos;est ajouté en Île-de-France : tu y es déjà.
            {contactSurDeuxLignes
              ? " Attention : cette ligne de contact passera sur deux lignes."
              : ""}
          </p>
        </form>

        {/* D89 — l'indice à l'endroit où se prend la décision.
            Il vivait sur l'écran Formulations, c'est-à-dire derrière le clic
            qu'il était censé éclairer. Et la couleur mentait depuis D78 :
            « fort » s'affichait en rouge, comme une alerte, alors qu'il
            signale de la matière exploitable. */}
        {potentiel ? (
          <div
            className={`mt-4 rounded-lg border p-3 ${
              potentiel.niveau === "fort"
                ? "border-sky-200 bg-sky-50"
                : potentiel.niveau === "moyen"
                  ? "border-amber-200 bg-amber-50"
                  : "border-ardoise-200 bg-ardoise-50"
            }`}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-medium text-ardoise-900">
                {LIBELLES_POTENTIEL[potentiel.niveau]}
              </p>
              <p className="text-xs text-ardoise-500">
                {potentiel.couverture} % du vocabulaire de l&apos;annonce est
                déjà sur ton CV
              </p>
            </div>

            {potentielProvisoire && (
              <p className="mt-1.5 text-xs leading-relaxed text-ardoise-500">
                Estimation, mesurée sur le CV que cette offre produirait — même
                sélection, même texte que la génération. Si le CV composé
                déborde d&apos;une page, la version finale retirera des missions
                et l&apos;indice montera un peu ; il ne descendra jamais.
              </p>
            )}

            {potentielSansSource || potentielPerime ? (
              <p className="mt-2 text-xs leading-relaxed text-ardoise-500">
                {potentielSansSource
                  ? "Ce CV a été composé avant que l'origine des termes soit distinguée : impossible de dire lesquels viennent du corpus."
                  : "Cet indice a été mesuré contre les seules missions du CV, sans son titre ni son accroche : il surestime ce qui reste à récupérer."}{" "}
                Régénère le CV — c&apos;est gratuit et sans appel IA — pour
                avoir le verdict juste.
              </p>
            ) : (
              <>
                <p className="mt-2 text-sm leading-relaxed text-ardoise-700">
                  {termesCorpus.length === 0 ? (
                    <>
                      <strong>Ne lance pas d&apos;adaptation.</strong> Aucun
                      terme de l&apos;annonce ne dort dans ton corpus : la
                      reformulation n&apos;aurait rien de neuf à faire entrer,
                      et l&apos;appel serait facturé quand même.
                    </>
                  ) : (
                    <>
                      <strong>
                        {termesCorpus.length} terme
                        {termesCorpus.length > 1 ? "s" : ""} à aller chercher
                        dans ton corpus :
                      </strong>{" "}
                      {termesCorpus.join(" · ")}.
                    </>
                  )}
                </p>

                {autresSources.length > 0 && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-ardoise-400">
                      Le reste de ce que l&apos;annonce réclame et que ton CV
                      ne dit pas
                    </summary>
                    <div className="mt-1.5 space-y-1.5">
                      {autresSources.map(([source, termes]) => (
                        <div key={source} className="text-xs">
                          <span className="font-medium text-ardoise-600">
                            {LIBELLES_SOURCE[source]} :
                          </span>{" "}
                          <span className="text-ardoise-500">
                            {termes.join(" · ")}
                          </span>
                          <p className="mt-0.5 leading-relaxed text-ardoise-400">
                            {ACTIONS_PAR_SOURCE[source]}
                          </p>
                        </div>
                      ))}
                      {potentiel.horsPortee.length > 0 && (
                        <p className="text-xs text-ardoise-400">
                          Hors de portée, absent de tout ton parcours :{" "}
                          {potentiel.horsPortee.join(" · ")}
                        </p>
                      )}
                    </div>
                  </details>
                )}
              </>
            )}
          </div>
        ) : (
          <p className="mt-4 rounded-lg bg-ardoise-50 p-3 text-xs leading-relaxed text-ardoise-500">
            {analyse
              ? "L'indice d'adaptation se mesure entre l'annonce et les missions du volet. Aucune expérience n'y est visible : vérifie les visibilités depuis Mon profil."
              : "L'indice d'adaptation se mesure entre l'annonce et le CV que cette offre produirait. Analyse l'offre, et il apparaîtra ici — sans attendre la génération du CV."}
          </p>
        )}

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

        {/* D94 — cette offre se candidate par mail, et l'annonce le disait.
            L'adresse était dans le texte brut depuis le premier jour : il
            fallait rouvrir l'annonce pour la retrouver. */}
        {analyse && (
          <div className="mt-3 rounded-lg border border-ardoise-200 bg-white p-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-medium text-ardoise-900">
                Ce que l&apos;on sait de l&apos;employeur
              </p>
              {reference && (
                <p className="text-xs text-ardoise-500">
                  Référence de l&apos;annonce :{" "}
                  <span className="font-medium text-ardoise-700">{reference}</span>
                </p>
              )}
            </div>

            {ficheEntreprise ? (
              <div className="mt-2 space-y-1 text-xs leading-relaxed text-ardoise-600">
                {ficheEntreprise.activite && <p>{ficheEntreprise.activite}</p>}
                {(ficheEntreprise.taille || ficheEntreprise.implantation) && (
                  <p className="text-ardoise-500">
                    {[ficheEntreprise.taille, ficheEntreprise.implantation]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                )}
                {ficheEntreprise.faits.length > 0 && (
                  <ul className="mt-1.5 space-y-1">
                    {ficheEntreprise.faits.map((f, i) => (
                      <li key={i}>
                        {f.texte}
                        {f.date && (
                          <span className="text-ardoise-400"> ({f.date})</span>
                        )}
                        {f.source && (
                          <>
                            {" "}
                            <a
                              href={f.source}
                              target="_blank"
                              rel="noreferrer"
                              className="text-sky-700 underline"
                            >
                              source
                            </a>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                {ficheEntreprise.lacunes.length > 0 && (
                  <p className="text-ardoise-400">
                    Non établi par la recherche :{" "}
                    {ficheEntreprise.lacunes.join(" · ")}
                  </p>
                )}
                <p className="pt-1 text-ardoise-400">
                  Recherche web sourcée, faite une fois pour cet employeur
                  {ficheAge !== null &&
                    ` il y a ${ficheAge} jour${ficheAge > 1 ? "s" : ""}`}
                  . Elle sert aussi la préparation d&apos;entretien, et toute
                  offre future chez eux, sans être repayée.
                </p>
              </div>
            ) : docEntreprise.suffisante ? (
              <div className="mt-2 text-xs leading-relaxed text-ardoise-600">
                <p>
                  <strong>Aucune recherche lancée</strong> : l&apos;annonce
                  décrit déjà l&apos;entreprise, c&apos;est donc elle qui sert
                  de source et ça ne coûte rien.
                </p>
                <p className="mt-1 text-ardoise-500">
                  {docEntreprise.faits.join(" · ")}
                </p>
              </div>
            ) : (
              /* D126 — ce message annonçait une recherche « à la rédaction de
                 la lettre » qui n'avait plus lieu nulle part depuis D118, et le
                 panneau entier disparaissait quand il n'y avait rien à montrer.
                 L'absence de fiche se découvrait donc dans la lettre. */
              <p className="mt-2 text-xs leading-relaxed text-ardoise-500">
                L&apos;annonce ne dit presque rien de l&apos;entreprise
                {docEntreprise.faits.length > 0 &&
                  ` — seulement « ${docEntreprise.faits.join(" », « ")} »`}
                , et <strong>aucune fiche n&apos;est encore en base</strong>. Ce
                n&apos;est pas bloquant : la rédaction de la lettre lancera la
                recherche elle-même, dans le même clic, pour environ 2,7 ¢ — et
                une seule fois pour cet employeur. Tu n&apos;as rien à faire
                ici.
              </p>
            )}
          </div>
        )}

        {contactAnnonce && (
          <div className="mt-3 rounded-lg border border-sky-200 bg-sky-50 p-3">
            <p className="text-sm font-medium text-sky-900">
              Candidature par email
              {contactAnnonce.nom && ` — ${contactAnnonce.nom}`}
            </p>
            <p className="mt-0.5 font-mono text-sm text-sky-900">
              {contactAnnonce.email}
            </p>
            <p className="mt-1.5 text-xs italic leading-relaxed text-sky-700">
              « {contactAnnonce.phrase} »
            </p>
            <p className="mt-1.5 text-xs text-sky-700">
              Les coordonnées et les boutons de copie sont sur l&apos;écran
              Lettre, sous l&apos;email.
            </p>
          </div>
        )}

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
            {searchParams.suivi === "preparation"
              ? "Fiche de préparation prête, en bas de page."
              : searchParams.suivi === "retour"
              ? "Étape annulée : le statut précédent est rétabli."
              : searchParams.suivi === "sans-retour"
                ? "Aucune étape antérieure à rétablir."
                : searchParams.suivi === "relance-redigee"
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

        {statutPrecedent && (
          <form action={revenirEnArriere} className="mt-3">
            <input type="hidden" name="id" value={params.id} />
            <BoutonSoumettre
              libelle={`← Revenir à « ${
                STATUTS[statutPrecedent]?.libelle ?? statutPrecedent
              } »`}
              libelleEnCours="Retour…"
              className="rounded-lg border border-ardoise-300 px-3 py-1.5 text-xs font-medium text-ardoise-700 transition hover:bg-ardoise-50"
            />
          </form>
        )}

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
              {/* D84 — l'origine remplace le commentaire libre, qui restait
                  vide sur quarante-deux candidatures. Croisée avec les issues,
                  elle dit quel canal donne des entretiens. */}
              <label className="flex-1 text-xs text-ardoise-500">
                D&apos;où as-tu postulé ?
                <select
                  name="origine"
                  defaultValue={(offre.origine as string | null) ?? ""}
                  className="mt-1 block w-full rounded-lg border border-ardoise-200 px-2 py-1.5 text-sm outline-none focus:border-ardoise-500"
                >
                  <option value="">Non renseigné</option>
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

            {/* D83/D84 — l'origine et le canal se corrigent après coup : les
                candidatures d'avant cette version n'en portent aucun, et le
                canal décide de ce que la relance écrira. */}
            <form
              action={modifierCanaux}
              className="mt-4 flex flex-wrap items-end gap-3 border-t border-ardoise-100 pt-4"
            >
              <input type="hidden" name="id" value={params.id} />
              <label className="text-xs text-ardoise-500">
                Origine
                <select
                  name="origine"
                  defaultValue={(offre.origine as string | null) ?? ""}
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
                  defaultValue={
                    (offre.canal_relance as string | null) ?? CANAL_PAR_DEFAUT
                  }
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
              <p className="w-full text-xs text-ardoise-400">
                La plupart des plateformes ne donnent aucune adresse : la
                relance passe par leur messagerie ou par LinkedIn. Le canal
                choisi décide de ce que le modèle écrira — quatre lignes ou
                quinze.
              </p>
            </form>

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
                    quoi="la relance"
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
                  {["envoyee", ...STATUTS_SUIVI].map((s) => (
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

        <div className="mt-4 border-t border-ardoise-100 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-ardoise-800">
                Préparation d&apos;entretien
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-ardoise-500">
                Construite sur l&apos;annonce, le CV exactement tel qu&apos;il
                est parti, et les écarts que l&apos;application a mesurés — donc
                sur ce que le recruteur va chercher.
              </p>
            </div>
            {dernierCV && (
              <form action={genererPreparation}>
                <input type="hidden" name="id" value={params.id} />
                <BoutonSoumettre
                  libelle={preparation ? "Refaire la fiche" : "Préparer l'entretien"}
                  libelleEnCours="Préparation…"
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                    statutCode === "entretien"
                      ? "bg-ardoise-900 text-white hover:bg-ardoise-800"
                      : "border border-ardoise-300 text-ardoise-700 hover:bg-ardoise-50"
                  }`}
                />
              </form>
            )}
          </div>

          {!dernierCV && (
            <p className="mt-2 text-xs text-ardoise-400">
              Génère d&apos;abord le CV : la préparation s&apos;appuie sur celui
              qui est parti, pas sur ton profil en général.
            </p>
          )}

          {preparation && (
            <div className="mt-4 rounded-lg border border-ardoise-200 bg-ardoise-50/60 p-3">
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

              {preparation.questions.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-ardoise-500">
                    Questions probables
                  </p>
                  <ul className="mt-2 space-y-2">
                    {preparation.questions.map((q, i) => (
                      <li key={i} className="border-b border-ardoise-100 pb-2 last:border-0">
                        <p className="text-sm text-ardoise-800">{q.question}</p>
                        {q.appui && (
                          <p className="mt-0.5 text-xs text-ardoise-500">
                            S&apos;appuyer sur : {q.appui}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {preparation.fragilites.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-ardoise-500">
                    Ce qui va être cherché
                  </p>
                  <ul className="mt-2 space-y-2">
                    {preparation.fragilites.map((f, i) => (
                      <li key={i}>
                        <p className="text-sm text-ardoise-800">{f.point}</p>
                        {f.posture && (
                          <p className="mt-0.5 text-xs text-ardoise-500">{f.posture}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {preparation.aRetenir.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-ardoise-500">
                    À avoir en tête
                  </p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-4 text-sm text-ardoise-700">
                    {preparation.aRetenir.map((x, i) => (
                      <li key={i}>{x}</li>
                    ))}
                  </ul>
                </div>
              )}

              {preparation.aPoser.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-ardoise-500">
                    À poser au recruteur
                  </p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-4 text-sm text-ardoise-700">
                    {preparation.aPoser.map((x, i) => (
                      <li key={i}>{x}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

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
