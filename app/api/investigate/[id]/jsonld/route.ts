/**
 * GET /api/investigate/[id]/jsonld — FAIR Dataset record for one investigation.
 */
import { investigationJsonLd, publicBaseUrl } from "@/lib/fair/jsonld";
import { getInvestigation } from "@/lib/supabase/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const investigation = await getInvestigation(id);
  if (!investigation) {
    return Response.json({ error: "Investigation not found." }, { status: 404 });
  }

  return Response.json(investigationJsonLd(investigation, publicBaseUrl(request)), {
    headers: { "Content-Type": "application/ld+json" },
  });
}
