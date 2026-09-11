import { Carte, TitrePage, EtatVide } from "@/components/ui";
import BoutonSoumettre from "@/components/BoutonSoumettre";
import { VOLETS, type CodeVolet } from "@/config/volets";
import { creerClientServeur } from "@/lib/supabase/server";
import {
  adopterCommeReference,
  deciderFormulation,
  lancerReformulation,
  repondreCompetence,
} from "./actions";
import { competencesManquantes } from "@/lib/cv/competences-manquantes";
import { LIBELLES_POTENTIEL, type Potentiel } from "@/lib/cv/ecart";
import type { OffreExtraite } from "@/lib/extraction-offre";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

interface LigneFormulation {
  id: string;
  mission_id: string;
  texte: string;
  validee: boolean;
  motif_rejet: string | null;
}

export default async function Formulations({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { etat?: string; message?: string };
}) {
  const supabase = creerClientServeur();

  const { data: offreBrute } = await supabase
    .from("offres")
    .select("id, volet, intitule, entreprise")
    .eq("id", params.id)
    .maybeSingle();
  if (!offreBrute) notFound();

  const offre = offreBrute as {
    id: string;
    volet: CodeVolet;
    intitule: string | null;
    entreprise: string | null;
  };
  const volet = VOLETS[offre.volet];

  // Ce que l'offre réclame et que la base ne connaît pas encore.
  const { data: analyseBrute } = await supabase
    .from("offre_analyses")
    .select("resultat")
    .eq("offre_id", params.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const analyse = (analyseBrute as { resultat: OffreExtraite } | null)?.resultat;
  const manquantes = analyse
    ? await competencesManquantes(analyse, offre.volet)
    : [];

  // Le potentiel calculé au dernier CV : il dit si payer une reformulation
  // vaut la peine, avant de cliquer.
  const { data: cvBrut } = await supabase
    .from("documents")
    .select("selection")
    .eq("offre_id", params.id)
    .eq("type", "cv")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const potentiel = (cvBrut as { selection: { potentiel?: Potentiel } } | null)
    ?.selection?.potentiel;

  const { data: adapteesBrutes } = await supabase
    .from("mission_formulations")
    .select("id, mission_id, texte, validee, motif_rejet")
    .eq("offre_id", params.id)
    .eq("volet", offre.volet);

  const adaptees = (adapteesBrutes ?? []) as LigneFormulation[];

  // L'original, c'est la formulation générique du volet : celle que le CV
  // emploierait sans adaptation.
  // Sans restriction de volet : une mission empruntée à l'autre volet n'a pas
  // de formulation générique dans celui-ci, et l'écran affichait « Remplace :
  // — » au lieu du texte que la reformulation remplace réellement.
  const { data: originauxBruts } = await supabase
    .from("mission_formulations")
    .select("mission_id, volet, texte, validee, missions ( experiences ( entreprise ) )")
    .is("offre_id", null)
    .in("mission_id", adaptees.map((a) => a.mission_id).concat("00000000-0000-0000-0000-000000000000"));

  const originaux = new Map<
    string,
    { texte: string; entreprise: string; empruntee: boolean }
  >();
  for (const o of (originauxBruts ?? []) as unknown as {
    mission_id: string;
    volet: CodeVolet;
    texte: string;
    validee: boolean;
    missions: { experiences: { entreprise: string } | null } | null;
  }[]) {
    if (!o.validee) continue;
    // La formulation du volet courant l'emporte ; celle de l'autre volet ne
    // sert que si la mission est empruntée.
    const dejaVue = originaux.get(o.mission_id);
    if (dejaVue && !dejaVue.empruntee) continue;
    originaux.set(o.mission_id, {
      texte: o.texte,
      entreprise: o.missions?.experiences?.entreprise ?? "",
      empruntee: o.volet !== offre.volet,
    });
  }

  const enAttente = adaptees.filter((a) => !a.validee && !a.motif_rejet);
  const ecartees = adaptees.filter((a) => !a.validee && a.motif_rejet);
  const validees = adaptees.filter((a) => a.validee);

  return (
    <>
      <TitrePage
        titre="✍️ Formulations adaptées"
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

      <Carte className="mb-6">
        <p className="text-sm text-ardoise-600">
          Le modèle redit chaque mission avec le vocabulaire de l&apos;annonce.
          Il n&apos;a pas le droit d&apos;ajouter un chiffre, un outil ou une
          responsabilité : un contrôle automatique écarte les propositions qui
          le font, avant même de te les montrer. Rien n&apos;entre dans un CV
          sans ton accord.
        </p>
        {potentiel && (
          <div
            className={`mt-4 rounded-lg p-3 ${
              potentiel.niveau === "faible"
                ? "bg-emerald-50"
                : potentiel.niveau === "moyen"
                ? "bg-amber-50"
                : "bg-rose-50"
            }`}
          >
            <p className="text-sm font-medium text-ardoise-800">
              {LIBELLES_POTENTIEL[potentiel.niveau]} — {potentiel.couverture} %
              du vocabulaire de l&apos;annonce est déjà présent
            </p>
            {potentiel.recuperables.length > 0 && (
              <p className="mt-1 text-xs text-ardoise-700">
                Récupérable de ton parcours :{" "}
                {potentiel.recuperables.join(" · ")}
              </p>
            )}
            {potentiel.horsPortee.length > 0 && (
              <p className="mt-1 text-xs text-ardoise-400">
                Hors de portée, absent de tout ton parcours :{" "}
                {potentiel.horsPortee.join(" · ")}
              </p>
            )}
            {potentiel.niveau === "faible" && (
              <p className="mt-1 text-xs text-ardoise-500">
                Tu peux postuler tel quel : la reformulation n&apos;a rien à
                aller chercher.
              </p>
            )}
          </div>
        )}

        <form action={lancerReformulation} className="mt-4">
          <input type="hidden" name="offreId" value={params.id} />
          <BoutonSoumettre
            libelle={
              adaptees.length > 0
                ? "Relancer la reformulation"
                : "Adapter les formulations à l'offre"
            }
            libelleEnCours="Reformulation…"
            className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition ${volet.classeAccent} hover:opacity-90`}
          />
        </form>
        <p className="mt-2 text-xs text-ardoise-400">
          Seule action payante du CV : un appel à Claude Sonnet pour toutes les
          missions retenues — de la rédaction, pas de l&apos;extraction. Les
          propositions déjà validées ne sont pas retouchées.
        </p>
      </Carte>

      {manquantes.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ardoise-500">
            Réclamé par l&apos;offre, absent de ton profil ({manquantes.length})
          </h2>
          <Carte>
            <p className="mb-4 text-sm text-ardoise-600">
              Ces compétences apparaissent dans l&apos;annonce mais nulle part
              dans ta base. Si tu les maîtrises, ajoute-les : elles serviront à
              toutes tes offres, pas seulement à celle-ci. Sinon, écarte-les et
              elles ne reviendront plus. L&apos;application n&apos;en ajoute
              jamais d&apos;elle-même.
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
        </section>
      )}

      {adaptees.length === 0 && searchParams.etat === "ok" ? (
        <EtatVide
          titre="Aucune proposition n'apportait de terme nouveau"
          description="Le modèle n'a trouvé aucun terme de l'annonce à faire entrer dans tes missions. Ton CV répond déjà, ou ce que l'annonce réclame n'est pas dans ton parcours."
        />
      ) : adaptees.length === 0 ? (
        <EtatVide
          titre="Aucune formulation adaptée"
          description="Lance la reformulation pour comparer, mission par mission, ce que dit ta base et ce que dirait l'annonce."
        />
      ) : (
        <div className="space-y-6">
          {enAttente.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ardoise-500">
                À relire ({enAttente.length})
              </h2>
              <div className="space-y-4">
                {enAttente.map((f) => {
                  const original = originaux.get(f.mission_id);
                  return (
                    <Carte key={f.id}>
                      {original?.entreprise && (
                        <p className="mb-2 text-xs font-medium text-ardoise-400">
                          {original.entreprise}
                        </p>
                      )}

                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <p className="mb-1 text-xs font-medium text-ardoise-500">
                            Ta formulation
                          </p>
                          <p className="text-sm text-ardoise-700">
                            {original?.texte ?? "(introuvable)"}
                          </p>
                        </div>
                        <div>
                          <p className="mb-1 text-xs font-medium text-ardoise-500">
                            Adaptée à l&apos;offre
                          </p>
                          <p className="text-sm text-ardoise-900">{f.texte}</p>
                        </div>
                      </div>

                      <form
                        action={deciderFormulation}
                        className="mt-4 space-y-3"
                      >
                        <input type="hidden" name="offreId" value={params.id} />
                        <input type="hidden" name="id" value={f.id} />

                        <details>
                          <summary className="cursor-pointer text-xs font-medium text-ardoise-500">
                            Corriger le texte à la main
                          </summary>
                          <textarea
                            name="texte"
                            defaultValue={f.texte}
                            rows={3}
                            className="mt-2 w-full rounded-lg border border-ardoise-300 p-2 text-sm"
                          />
                          <button
                            type="submit"
                            name="action"
                            value="corriger"
                            className="mt-2 rounded-lg border border-ardoise-300 px-3 py-1.5 text-xs font-medium text-ardoise-700"
                          >
                            Enregistrer ma version
                          </button>
                        </details>

                        <div className="flex flex-wrap gap-2">
                          <button
                            type="submit"
                            name="action"
                            value="accepter"
                            className={`rounded-lg px-4 py-2 text-sm font-medium text-white ${volet.classeAccent}`}
                          >
                            Accepter
                          </button>
                          <button
                            type="submit"
                            name="action"
                            value="refuser"
                            className="rounded-lg border border-ardoise-300 px-4 py-2 text-sm font-medium text-ardoise-700"
                          >
                            Refuser
                          </button>
                        </div>
                      </form>
                    </Carte>
                  );
                })}
              </div>
            </section>
          )}

          {ecartees.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ardoise-500">
                Écartées par le contrôle ({ecartees.length})
              </h2>
              <Carte>
                <p className="mb-3 text-sm text-ardoise-600">
                  Le contrôle les a rejetées avant de te les montrer. Tu peux
                  les accepter malgré tout : tu es l&apos;auteur du document et
                  tu sais ce qui est vrai. Lis le motif avant.
                </p>
                <div className="space-y-4">
                  {ecartees.map((f) => {
                    const invention = /absent de l'original|Chiffre/.test(
                      f.motif_rejet ?? ""
                    );
                    return (
                      <div
                        key={f.id}
                        className="border-t border-ardoise-100 pt-3"
                      >
                        <p className="text-xs text-ardoise-400">
                          {originaux.get(f.mission_id)?.entreprise}
                        </p>
                        <p className="mt-1 text-sm text-ardoise-500 line-through decoration-ardoise-300">
                          {originaux.get(f.mission_id)?.texte ?? "—"}
                        </p>
                        <p className="mt-1 text-sm text-ardoise-800">
                          {f.texte}
                        </p>
                        <p
                          className={`mt-2 rounded px-2 py-1 text-xs ${
                            invention
                              ? "bg-rose-100 text-rose-900"
                              : "bg-ardoise-100 text-ardoise-600"
                          }`}
                        >
                          {invention
                            ? `Attention, le contrôle a repéré une invention : ${f.motif_rejet}`
                            : f.motif_rejet}
                        </p>

                        <form
                          action={deciderFormulation}
                          className="mt-2 flex flex-wrap gap-2"
                        >
                          <input type="hidden" name="offreId" value={params.id} />
                          <input type="hidden" name="id" value={f.id} />
                          <button
                            type="submit"
                            name="action"
                            value="accepter"
                            className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
                              invention
                                ? "border-rose-300 text-rose-700"
                                : "border-ardoise-300 text-ardoise-700"
                            }`}
                          >
                            Accepter malgré tout
                          </button>
                          <button
                            type="submit"
                            name="action"
                            value="refuser"
                            className="rounded-lg border border-ardoise-300 px-3 py-1.5 text-xs font-medium text-ardoise-500"
                          >
                            Supprimer
                          </button>
                        </form>
                      </div>
                    );
                  })}
                </div>
              </Carte>
            </section>
          )}

          {validees.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ardoise-500">
                Validées, utilisées dans le CV ({validees.length})
              </h2>
              <div className="space-y-3">
                {validees.map((f) => (
                  <Carte key={f.id}>
                    <p className="text-sm text-ardoise-900">{f.texte}</p>
                    <p className="mt-1 text-xs text-ardoise-400">
                      Remplace : {originaux.get(f.mission_id)?.texte ?? "—"}
                      {originaux.get(f.mission_id)?.empruntee && (
                        <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-900">
                          mission empruntée à l&apos;autre volet
                        </span>
                      )}
                    </p>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <form action={adopterCommeReference}>
                        <input type="hidden" name="offreId" value={params.id} />
                        <input type="hidden" name="id" value={f.id} />
                        <BoutonSoumettre
                          libelle="Adopter comme formulation du volet"
                          libelleEnCours="Adoption…"
                          className="rounded-lg border border-ardoise-300 px-3 py-1.5 text-xs font-medium text-ardoise-700"
                        />
                      </form>
                      <form action={deciderFormulation}>
                        <input type="hidden" name="offreId" value={params.id} />
                        <input type="hidden" name="id" value={f.id} />
                        <input type="hidden" name="action" value="retirer" />
                        <BoutonSoumettre
                          libelle="Retirer"
                          libelleEnCours="Retrait…"
                          className="rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-medium text-rose-700"
                        />
                      </form>
                    </div>
                  </Carte>
                ))}
              </div>
              <p className="mt-3 text-xs text-ardoise-400">
                Adopter une formulation la rend générique : elle servira à
                toutes les offres suivantes de ce volet. L&apos;ancienne est
                conservée et réactivable, rien n&apos;est supprimé.
              </p>
            </section>
          )}
        </div>
      )}
    </>
  );
}
