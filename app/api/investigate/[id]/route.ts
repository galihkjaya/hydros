/**
 * GET /api/investigate/[id] — poll a persisted investigation.
 *
 * Returns the stored investigation (Phase A draft, confirmed set, pathways,
 * assessment) as JSON. 404 when persistence is off or the id is unknown —
 * the live workspace does not depend on this; it streams.
 */
import { getInvestigation } from "@/lib/supabase/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const investigation = await getInvestigation(id);
  if (!investigation) {
    return Response.json({ error: "Investigation not found." }, { status: 404 });
  }
  return Response.json(investigation);
}
