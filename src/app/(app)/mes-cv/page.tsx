import { TitrePage, EtatVide } from "@/components/ui";

export default function MesCV() {
  return (
    <>
      <TitrePage
        titre="📄 Mes CV"
        sousTitre="Modèles de référence et CV générés"
      />
      <EtatVide
        titre="Aucun CV généré"
        description="Les deux modèles seront reconstruits en React-PDF à l'étape 4, fidèlement à tes CV actuels. Les CV générés pour chaque offre apparaîtront ici, avec leur historique de versions."
        etape="étape 4"
      />
    </>
  );
}
