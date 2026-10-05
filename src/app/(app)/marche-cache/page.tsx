import { TitrePage, Carte, EtatVide } from "@/components/ui";
import BoutonSoumettre from "@/components/BoutonSoumettre";
import { LISTE_VOLETS, VOLETS, type CodeVolet } from "@/config/volets";
import { SECTEURS } from "@/config/secteurs";
import { creerClientServeur } from "@/lib/supabase/server";
import { jour, joursDepuis } from "@/lib/suivi";
import {
  ajouterCible,
  changerDemarche,
  modifierCible,
  supprimerCible,
} from "./actions";
import Link from "next/link";

export const dynamic = "force-dynamic";

/**
 * Le marché caché : les entreprises visées sans annonce publiée.
 *
 * Rien n'est collecté automatiquement. La liste est tenue à la main, et ce
 * qu'elle contient — nom, contact obtenu, état de la démarche — n'a de valeur
 * que parce que c'est toi qui l'as jugé pertinent.
 */

const DEMARCHES: Record<string, { libelle: string; classe: string }> = {
  a_qualifier: { libelle: "À qualifier", classe: "bg-ardoise-100 text-ardoise-700" },
  a_contacter: { libelle: "À contacter", classe: "bg-sky-100 text-sky-800" },
  contactee: { libelle: "Contactée", classe: "bg-amber-100 text-amber-900" },
  relancee: { libelle: "Relancée", classe: "bg-amber-100 text-amber-900" },
  en_discussion: { libelle: "En discussion", classe: "bg-emerald-100 text-emerald-800" },
  sans_suite: { libelle: "Sans suite", classe: "bg-ardoise-100 text-ardoise-600" },
  ecartee: { libelle: "Écartée", classe: "bg-ardoise-200 text-ardoise-700" },
};

const ACTIVES = ["a_qualifier", "a_contacter", "contactee", "relancee", "en_discussion"];

interface Cible {
  id: string;
  nom: string;
  secteur_code: string | null;
  taille: string | null;
  localisation: string | null;
  site_web: string | null;
  contact_nom: string | null;
  contact_role: string | null;
  contact_email: string | null;
  pourquoi: string | null;
  demarche: string;
  date_contact: string | null;
  notes: string | null;
}

const MESSAGES: Record<string, string> = {
  ajoutee: "Entreprise ajoutée à ta liste.",
  modifiee: "Fiche mise à jour.",
  demarche: "État de la démarche mis à jour.",
  supprimee: "Entreprise retirée de la liste.",
  nom: "Il manque le nom de l'entreprise : rien n'a été enregistré.",
  etat: "État de démarche inconnu : rien n'a été enregistré.",
};

function Champ({
  nom,
  libelle,
  valeur,
  large = false,
  type = "text",
}: {
  nom: string;
  libelle: string;
  valeur?: string | null;
  large?: boolean;
  type?: string;
}) {
  return (
    <label className={`text-xs text-ardoise-500 ${large ? "sm:col-span-2" : ""}`}>
      {libelle}
      <input
        type={type}
        name={nom}
        defaultValue={valeur ?? ""}
        className="mt-1 block w-full rounded-lg border border-ardoise-200 px-2 py-1.5 text-sm outline-none focus:border-ardoise-500"
      />
    </label>
  );
}

function Formulaire({
  action,
  volet,
  cible,
}: {
  action: (formData: FormData) => void;
  volet: CodeVolet;
  cible?: Cible;
}) {
  return (
    <form action={action} className="mt-3">
      <input type="hidden" name="volet" value={volet} />
      {cible && <input type="hidden" name="id" value={cible.id} />}

      <div className="grid gap-3 sm:grid-cols-2">
        <Champ nom="nom" libelle="Entreprise" valeur={cible?.nom} />
        <label className="text-xs text-ardoise-500">
          Secteur
          <select
            name="secteur_code"
            defaultValue={cible?.secteur_code ?? ""}
            className="mt-1 block w-full rounded-lg border border-ardoise-200 px-2 py-1.5 text-sm outline-none focus:border-ardoise-500"
          >
            <option value="">—</option>
            {Object.entries(SECTEURS).map(([code, libelle]) => (
              <option key={code} value={code}>
                {libelle}
              </option>
            ))}
          </select>
        </label>
        <Champ nom="taille" libelle="Taille" valeur={cible?.taille} />
        <Champ nom="localisation" libelle="Localisation" valeur={cible?.localisation} />
        <Champ nom="site_web" libelle="Site" valeur={cible?.site_web} />
        <Champ nom="contact_nom" libelle="Contact" valeur={cible?.contact_nom} />
        <Champ nom="contact_role" libelle="Fonction du contact" valeur={cible?.contact_role} />
        <Champ nom="contact_email" libelle="Email du contact" valeur={cible?.contact_email} type="email" />
        <label className="text-xs text-ardoise-500 sm:col-span-2">
          Pourquoi elle
          <textarea
            name="pourquoi"
            defaultValue={cible?.pourquoi ?? ""}
            rows={2}
            placeholder="Ce qui la rend pertinente : secteur proche de ton parcours, croissance, outil que tu maîtrises…"
            className="mt-1 block w-full rounded-lg border border-ardoise-200 p-2 text-sm leading-relaxed outline-none focus:border-ardoise-500"
          />
        </label>
        <label className="text-xs text-ardoise-500 sm:col-span-2">
          Notes
          <textarea
            name="notes"
            defaultValue={cible?.notes ?? ""}
            rows={2}
            className="mt-1 block w-full rounded-lg border border-ardoise-200 p-2 text-sm leading-relaxed outline-none focus:border-ardoise-500"
          />
        </label>
      </div>

      <BoutonSoumettre
        libelle={cible ? "Enregistrer" : "Ajouter à ma liste"}
        libelleEnCours="Enregistrement…"
        className="mt-3 rounded-lg bg-ardoise-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-ardoise-800"
      />
    </form>
  );
}

export default async function MarcheCache({
  searchParams,
}: {
  searchParams: { volet?: string; etat?: string; toutes?: string };
}) {
  const volet: CodeVolet = searchParams.volet === "compta" ? "compta" : "cdg";
  const config = VOLETS[volet];

  const supabase = creerClientServeur();
  const { data } = await supabase
    .from("entreprises_cibles")
    .select("*")
    .eq("volet", volet)
    .order("created_at", { ascending: false });

  const toutes = (data ?? []) as Cible[];
  const montrerTout = searchParams.toutes === "1";
  const cibles = montrerTout
    ? toutes
    : toutes.filter((c) => ACTIVES.includes(c.demarche));

  return (
    <>
      <TitrePage
        titre="🕵️ Marché caché"
        sousTitre="Les entreprises que tu vises sans qu'elles publient d'annonce"
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {LISTE_VOLETS.map((v) => (
          <Link
            key={v.code}
            href={`/marche-cache?volet=${v.code}`}
            prefetch={false}
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

      {searchParams.etat && MESSAGES[searchParams.etat] && (
        <Carte
          className={`mb-4 ${
            ["nom", "etat"].includes(searchParams.etat)
              ? "border-rose-200 bg-rose-50"
              : "border-emerald-200 bg-emerald-50"
          }`}
        >
          <p
            className={`text-sm ${
              ["nom", "etat"].includes(searchParams.etat)
                ? "text-rose-900"
                : "text-emerald-900"
            }`}
          >
            {MESSAGES[searchParams.etat]}
          </p>
        </Carte>
      )}

      <Carte className="mb-4">
        <details>
          <summary className="cursor-pointer text-sm font-medium text-ardoise-800">
            Ajouter une entreprise — {config.nom}
          </summary>
          <p className="mt-2 text-xs leading-relaxed text-ardoise-500">
            Rien n&apos;est collecté automatiquement ici : ni annuaire, ni
            moissonnage. Tu notes les entreprises que tu vises et l&apos;état de
            ta démarche, comme tu suis tes candidatures sur annonce.
          </p>
          <Formulaire action={ajouterCible} volet={volet} />
        </details>
      </Carte>

      {toutes.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2 text-xs">
          <Link
            href={`/marche-cache?volet=${volet}`}
            prefetch={false}
            className={`rounded-full px-3 py-1 font-medium ${
              montrerTout
                ? "border border-ardoise-200 bg-white text-ardoise-600"
                : "bg-ardoise-900 text-white"
            }`}
          >
            En cours ({toutes.filter((c) => ACTIVES.includes(c.demarche)).length})
          </Link>
          <Link
            href={`/marche-cache?volet=${volet}&toutes=1`}
            prefetch={false}
            className={`rounded-full px-3 py-1 font-medium ${
              montrerTout
                ? "bg-ardoise-900 text-white"
                : "border border-ardoise-200 bg-white text-ardoise-600"
            }`}
          >
            Toutes ({toutes.length})
          </Link>
        </div>
      )}

      {cibles.length === 0 ? (
        <EtatVide
          titre={
            toutes.length === 0
              ? "Aucune entreprise dans ta liste"
              : "Aucune démarche en cours"
          }
          description={
            toutes.length === 0
              ? "Le marché caché, ce sont les entreprises qui recrutent sans publier. Ajoute celles dont le secteur, la taille ou les outils correspondent à ton parcours, et suis tes prises de contact ici."
              : "Toutes tes entreprises sont classées sans suite ou écartées. Affiche « Toutes » pour les revoir."
          }
        />
      ) : (
        <div className="space-y-3">
          {cibles.map((c) => {
            const d = DEMARCHES[c.demarche] ?? {
              libelle: c.demarche,
              classe: "bg-ardoise-100 text-ardoise-700",
            };
            const depuis = joursDepuis(c.date_contact);

            return (
              <Carte key={c.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-ardoise-900">{c.nom}</p>
                    <p className="mt-0.5 text-sm text-ardoise-500">
                      {[
                        c.secteur_code ? SECTEURS[c.secteur_code] : null,
                        c.taille,
                        c.localisation,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "Aucun détail renseigné"}
                    </p>
                    {c.contact_nom && (
                      <p className="mt-1 text-xs text-ardoise-500">
                        {c.contact_nom}
                        {c.contact_role && ` — ${c.contact_role}`}
                        {c.contact_email && ` · ${c.contact_email}`}
                      </p>
                    )}
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${d.classe}`}
                  >
                    {d.libelle}
                  </span>
                </div>

                {c.pourquoi && (
                  <p className="mt-2 text-sm leading-relaxed text-ardoise-700">
                    {c.pourquoi}
                  </p>
                )}

                <div className="mt-3 flex flex-wrap items-end gap-3 border-t border-ardoise-100 pt-3">
                  <form action={changerDemarche} className="flex items-end gap-2">
                    <input type="hidden" name="id" value={c.id} />
                    <input type="hidden" name="volet" value={volet} />
                    <select
                      name="demarche"
                      defaultValue={c.demarche}
                      className="rounded-lg border border-ardoise-200 px-2 py-1.5 text-xs outline-none focus:border-ardoise-500"
                    >
                      {Object.entries(DEMARCHES).map(([code, x]) => (
                        <option key={code} value={code}>
                          {x.libelle}
                        </option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      className="rounded-lg border border-ardoise-300 px-3 py-1.5 text-xs font-medium text-ardoise-700 hover:bg-ardoise-50"
                    >
                      Mettre à jour
                    </button>
                  </form>

                  {c.date_contact && (
                    <span className="text-xs text-ardoise-400">
                      Contactée le {jour(c.date_contact)}
                      {depuis !== null && ` · il y a ${depuis} j`}
                    </span>
                  )}

                  {c.site_web && (
                    <a
                      href={
                        c.site_web.startsWith("http")
                          ? c.site_web
                          : `https://${c.site_web}`
                      }
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-ardoise-500 underline hover:text-ardoise-800"
                    >
                      Site
                    </a>
                  )}
                </div>

                {c.notes && (
                  <p className="mt-3 whitespace-pre-wrap text-xs leading-relaxed text-ardoise-500">
                    {c.notes}
                  </p>
                )}

                <details className="mt-3">
                  <summary className="cursor-pointer text-xs text-ardoise-400">
                    Modifier la fiche
                  </summary>
                  <Formulaire action={modifierCible} volet={volet} cible={c} />
                  <form action={supprimerCible} className="mt-2">
                    <input type="hidden" name="id" value={c.id} />
                    <input type="hidden" name="volet" value={volet} />
                    <BoutonSoumettre
                      libelle="Supprimer cette entreprise"
                      libelleEnCours="Suppression…"
                      confirmation={`Retirer définitivement ${c.nom} de ta liste ?`}
                      className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs text-rose-700 hover:bg-rose-50"
                    />
                  </form>
                </details>
              </Carte>
            );
          })}
        </div>
      )}
    </>
  );
}
