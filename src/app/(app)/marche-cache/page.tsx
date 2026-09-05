import { TitrePage, EtatVide } from "@/components/ui";

export default function MarcheCache() {
  return (
    <>
      <TitrePage
        titre="🕵️ Marché caché"
        sousTitre="Contrôle de gestion uniquement"
      />
      <EtatVide
        titre="Module prévu en V1.1"
        description="Recherche d'entreprises pertinentes via les API publiques françaises : Recherche d'Entreprises, Sirene, BODACC, et les offres France Travail comme signal de recrutement. Aucune donnée issue de scraping, aucun contact nominatif."
        etape="étape V1.1"
      />
    </>
  );
}
