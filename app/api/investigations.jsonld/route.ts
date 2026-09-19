/**
 * GET /api/investigations.jsonld — FAIR DataCatalog over public investigations.
 */
import {
  investigationsCatalogJsonLd,
  publicBaseUrl,
} from "@/lib/fair/jsonld";
import {
  isPersistenceEnabled,
  listRecentInvestigations,
} from "@/lib/supabase/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const entries = isPersistenceEnabled()
    ? await listRecentInvestigations(50)
    : [];

  const catalog = investigationsCatalogJsonLd(
    entries.map((entry) => ({
      id: entry.id,
      createdAt: entry.createdAt,
      placeName: entry.placeName,
      latitude: entry.latitude,
      longitude: entry.longitude,
      riskLevel: entry.riskLevel,
    })),
    publicBaseUrl(request),
  );

  return Response.json(catalog, {
    headers: { "Content-Type": "application/ld+json" },
  });
}
