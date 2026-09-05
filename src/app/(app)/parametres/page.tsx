import { TitrePage, Carte } from "@/components/ui";
import { creerClientServeur } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Parametres() {
  const supabase = creerClientServeur();
  const { data } = await supabase
    .from("parametres")
    .select("cle, valeur")
    .order("cle");

  return (
    <>
      <TitrePage
        titre="⚙️ Paramètres"
        sousTitre="Valeurs modifiables sans redéploiement"
      />

      {!data || data.length === 0 ? (
        <Carte className="border-dashed">
          <p className="text-sm text-ardoise-500">
            Aucun paramètre lu. Si la migration a bien été appliquée, cela
            signifie que les lignes appartiennent à un autre compte : reconnecte-toi
            puis rejoue la section 9 de la migration.
          </p>
        </Carte>
      ) : (
        <div className="space-y-4">
          {data.map((p) => (
            <Carte key={p.cle}>
              <p className="text-sm font-medium text-ardoise-800">{p.cle}</p>
              <pre className="mt-3 overflow-x-auto rounded-lg bg-ardoise-50 p-3 text-xs text-ardoise-700">
                {JSON.stringify(p.valeur, null, 2)}
              </pre>
            </Carte>
          ))}
        </div>
      )}

      <p className="mt-6 text-xs text-ardoise-400">
        L&apos;édition de ces valeurs depuis l&apos;interface arrive à
        l&apos;étape 6. Pour l&apos;instant elles sont lisibles seulement.
      </p>
    </>
  );
}
