import { TitrePage, EtatVide, Carte } from "@/components/ui";
import { creerClientServeur } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Profil() {
  const supabase = creerClientServeur();
  const { count } = await supabase
    .from("experiences")
    .select("id", { count: "exact", head: true });

  return (
    <>
      <TitrePage
        titre="👤 Mon profil"
        sousTitre="Base professionnelle unique, deux jeux de formulations"
      />

      {count && count > 0 ? (
        <Carte>
          <p className="text-sm text-ardoise-700">
            {count} expérience{count > 1 ? "s" : ""} en base.
          </p>
        </Carte>
      ) : (
        <EtatVide
          titre="Base professionnelle vide"
          description="À l'étape 2, tes deux CV seront analysés et une base structurée te sera proposée champ par champ, à côté du texte source. Rien n'entre en base sans ta validation : c'est là que la règle zéro invention se garantit."
          etape="étape 2"
        />
      )}
    </>
  );
}
