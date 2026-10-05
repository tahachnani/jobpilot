import { exporterTout } from "@/lib/sauvegarde";

export const dynamic = "force-dynamic";

/**
 * Sert la sauvegarde complète, en JSON, prête à télécharger.
 *
 * L'accès passe par le middleware, et chaque table est filtrée par RLS : on
 * n'exporte que ce qui appartient à la session. Les PDF n'y sont pas — ils se
 * régénèrent — mais tout ce qui les produit s'y trouve.
 */
export async function GET() {
  const sauvegarde = await exporterTout();
  const jour = new Date().toISOString().slice(0, 10);

  return new Response(JSON.stringify(sauvegarde, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="jobpilot-sauvegarde-${jour}.json"`,
      "cache-control": "no-store",
    },
  });
}
