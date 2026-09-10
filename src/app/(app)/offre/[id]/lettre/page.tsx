import { Carte, TitrePage, EtatVide } from "@/components/ui";
import BoutonSoumettre from "@/components/BoutonSoumettre";
import { VOLETS, type CodeVolet } from "@/config/volets";
import { creerClientServeur } from "@/lib/supabase/server";
import type { ModeleLettre } from "@/lib/lettre/document";
import type { Ancrage } from "@/lib/lettre/ancrage";
import {
  corrigerLettre,
  enregistrerContact,
  genererLettre,
  regenererEmail,
} from "./actions";
import BoutonCopier from "@/components/BoutonCopier";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Lettre({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { etat?: string; message?: string };
}) {
  const supabase = creerClientServeur();

  const { data: offreBrute } = await supabase
    .from("offres")
    .select("id, volet, intitule, entreprise, contact_nom, contact_adresse")
    .eq("id", params.id)
    .maybeSingle();
  if (!offreBrute) notFound();

  const offre = offreBrute as {
    volet: CodeVolet;
    intitule: string | null;
    entreprise: string | null;
    contact_nom: string | null;
    contact_adresse: string | null;
  };
  const volet = VOLETS[offre.volet];

  const { data: lettresBrutes } = await supabase
    .from("documents")
    .select("id, version, created_at, selection")
    .eq("offre_id", params.id)
    .eq("type", "lettre")
    .order("version", { ascending: false });

  const lettres = (lettresBrutes ?? []) as {
    id: string;
    version: number;
    created_at: string;
    selection: { modele?: ModeleLettre; ancrage?: Ancrage } | null;
  }[];
  const derniere = lettres[0] ?? null;
  const modele = derniere?.selection?.modele ?? null;
  const ancrage = derniere?.selection?.ancrage ?? null;

  const { data: emailBrut } = await supabase
    .from("documents")
    .select("contenu_texte, selection")
    .eq("offre_id", params.id)
    .eq("type", "email")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const email = (emailBrut as {
    selection: { email?: { objet: string; corps: string } } | null;
  } | null)?.selection?.email;

  const orphelins = ancrage
    ? [...ancrage.nombresOrphelins, ...ancrage.nomsOrphelins]
    : [];

  return (
    <>
      <TitrePage
        titre="✉️ Lettre de motivation"
        sousTitre={`${offre.intitule ?? "Offre"} — ${offre.entreprise ?? volet.nom}`}
      />

      <Link
        href={`/offre/${params.id}`}
        className="mb-4 inline-block text-sm text-ardoise-500 underline"
      >
        ← Retour à l&apos;offre
      </Link>

      {searchParams.etat === "erreur" && (
        <Carte className="mb-4 border-rose-200 bg-rose-50">
          <p className="text-sm text-rose-900">{searchParams.message}</p>
        </Carte>
      )}
      {searchParams.etat === "ok" && searchParams.message && (
        <Carte className="mb-4 border-emerald-200 bg-emerald-50">
          <p className="text-sm text-emerald-900">{searchParams.message}</p>
        </Carte>
      )}
      {searchParams.etat === "contact" && (
        <Carte className="mb-4 border-emerald-200 bg-emerald-50">
          <p className="text-sm text-emerald-900">
            Destinataire enregistré. Rédige une nouvelle version pour qu&apos;il
            apparaisse.
          </p>
        </Carte>
      )}
      {searchParams.etat === "email" && (
        <Carte className="mb-4 border-emerald-200 bg-emerald-50">
          <p className="text-sm text-emerald-900">Email réécrit.</p>
        </Carte>
      )}
      {searchParams.etat === "corrigee" && (
        <Carte className="mb-4 border-emerald-200 bg-emerald-50">
          <p className="text-sm text-emerald-900">
            Lettre enregistrée, PDF recomposé.
          </p>
        </Carte>
      )}

      <Carte className="mb-4">
        <details open={!offre.entreprise}>
          <summary className="cursor-pointer text-sm font-medium text-ardoise-700">
            Destinataire de la lettre
          </summary>
          <p className="mt-2 text-xs text-ardoise-500">
            Facultatif, mais une lettre nommément adressée se remarque. Sans
            nom d&apos;entreprise, l&apos;en-tête indique « Service recrutement »
            et la formule d&apos;appel reste générique.
          </p>
          <form action={enregistrerContact} className="mt-3 space-y-2">
            <input type="hidden" name="offreId" value={params.id} />
            <input
              name="entreprise"
              defaultValue={offre.entreprise ?? ""}
              placeholder="Nom de l'entreprise"
              className="w-full rounded-lg border border-ardoise-300 px-3 py-2 text-sm"
            />
            <input
              name="contactNom"
              defaultValue={offre.contact_nom ?? ""}
              placeholder="Destinataire — Madame Dupont, Responsable RH"
              className="w-full rounded-lg border border-ardoise-300 px-3 py-2 text-sm"
            />
            <textarea
              name="contactAdresse"
              defaultValue={offre.contact_adresse ?? ""}
              placeholder="Adresse postale"
              rows={2}
              className="w-full rounded-lg border border-ardoise-300 px-3 py-2 text-sm"
            />
            <BoutonSoumettre
              libelle="Enregistrer le destinataire"
              libelleEnCours="Enregistrement…"
              className="rounded-lg border border-ardoise-300 px-3 py-1.5 text-xs font-medium text-ardoise-700"
            />
          </form>
        </details>
      </Carte>

      <Carte className="mb-6">
        <p className="text-sm text-ardoise-600">
          Le modèle rédige la motivation — l&apos;intérêt pour le poste et
          l&apos;entreprise, qu&apos;aucune donnée ne porte. Il ne peut avancer
          aucun chiffre, employeur, diplôme ou outil absent de ta base, ni rien
          affirmer sur l&apos;entreprise que l&apos;annonce ne dise. Ce qui
          n&apos;est adossé à rien t&apos;est signalé.
        </p>
        {!offre.contact_nom && (
          <p className="mt-2 text-xs text-ardoise-400">
            Aucun destinataire renseigné pour cette offre : la formule
            d&apos;appel reste « Madame, Monsieur ».
          </p>
        )}
        <form action={genererLettre} className="mt-4">
          <input type="hidden" name="offreId" value={params.id} />
          <BoutonSoumettre
            libelle={derniere ? "Rédiger une nouvelle version" : "Rédiger la lettre"}
            libelleEnCours="Rédaction…"
            className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition ${volet.classeAccent} hover:opacity-90`}
          />
        </form>
      </Carte>

      {!derniere || !modele ? (
        <EtatVide
          titre="Aucune lettre rédigée"
          description="La lettre s'appuie sur tout ton parcours, pas seulement sur ce que le CV a pu contenir. L'offre doit avoir été analysée."
        />
      ) : (
        <div className="space-y-6">
          {orphelins.length > 0 && (
            <Carte className="border-amber-200 bg-amber-50">
              <p className="text-sm font-medium text-amber-900">
                Sans appui dans ta base ni dans l&apos;annonce
              </p>
              <p className="mt-1 text-sm text-amber-800">
                {orphelins.join(" · ")}
              </p>
              <p className="mt-2 text-xs text-amber-700">
                Ce sont peut-être des mots reconnus à tort. Vérifie-les dans le
                texte avant d&apos;envoyer : ce sont les seuls endroits où la
                lettre pourrait affirmer quelque chose d&apos;invérifiable.
              </p>
            </Carte>
          )}

          <Carte>
            <p className="text-xs font-medium text-ardoise-400">
              {modele.objet}
            </p>
            <p className="mt-2 text-sm text-ardoise-700">
              {modele.formuleAppel}
            </p>

            <form action={corrigerLettre} className="mt-4">
              <input type="hidden" name="offreId" value={params.id} />
              <input type="hidden" name="documentId" value={derniere.id} />
              <textarea
                name="corps"
                defaultValue={modele.paragraphes.join("\n\n")}
                rows={18}
                className="w-full rounded-lg border border-ardoise-300 p-3 text-sm leading-relaxed"
              />
              <p className="mt-1 text-xs text-ardoise-400">
                Un paragraphe par bloc séparé d&apos;une ligne vide. Enregistrer
                recompose le PDF.
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                <BoutonSoumettre
                  libelle="Enregistrer et recomposer"
                  libelleEnCours="Enregistrement…"
                  className={`rounded-lg px-4 py-2 text-sm font-medium text-white ${volet.classeAccent}`}
                />
                <a
                  href={`/document/${derniere.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border border-ardoise-300 px-4 py-2 text-sm font-medium text-ardoise-700"
                >
                  Ouvrir le PDF
                </a>
                <a
                  href={`/document/${derniere.id}?telecharger=1`}
                  className="rounded-lg border border-ardoise-300 px-4 py-2 text-sm font-medium text-ardoise-700"
                >
                  Télécharger
                </a>
              </div>
            </form>

            <p className="mt-4 text-sm text-ardoise-600">
              {modele.formulePolitesse}
            </p>
            <p className="mt-2 text-sm text-ardoise-500">{modele.signature}</p>
          </Carte>

          {email && (
            <Carte>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ardoise-500">
                Email de candidature
              </h2>
              <p className="text-sm font-medium text-ardoise-800">
                Objet : {email.objet}
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-ardoise-700">
                {email.corps}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <BoutonCopier
                  texte={`${email.objet}\n\n${email.corps}`}
                  className={`rounded-lg px-4 py-2 text-sm font-medium text-white ${volet.classeAccent}`}
                />
                <form action={regenererEmail}>
                  <input type="hidden" name="offreId" value={params.id} />
                  <BoutonSoumettre
                    libelle="Réécrire l'email"
                    libelleEnCours="Rédaction…"
                    className="rounded-lg border border-ardoise-300 px-4 py-2 text-sm font-medium text-ardoise-700"
                  />
                </form>
              </div>
              <p className="mt-2 text-xs text-ardoise-400">
                Réécrire l&apos;email ne touche pas à la lettre.
              </p>
            </Carte>
          )}

          {lettres.length > 1 && (
            <Carte>
              <details>
                <summary className="cursor-pointer text-xs font-medium text-ardoise-500">
                  Versions précédentes ({lettres.length - 1})
                </summary>
                <ul className="mt-2 space-y-1">
                  {lettres.slice(1).map((l) => (
                    <li
                      key={l.id}
                      className="flex items-center justify-between gap-3 text-xs text-ardoise-600"
                    >
                      <span>
                        Version {l.version} —{" "}
                        {new Date(l.created_at).toLocaleDateString("fr-FR", {
                          day: "2-digit",
                          month: "long",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      <a
                        href={`/document/${l.id}`}
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
            </Carte>
          )}
        </div>
      )}
    </>
  );
}
