/**
 * GET /api/investigate/[id]/fhir — FHIR R4 Bundle export.
 *
 * Returns `application/fhir+json`: Location, survey and exposure
 * Observations, RiskAssessment, DocumentReference, and Provenance.
 */
import { buildFhirBundle } from "@/lib/fhir/bundle";
import { optionalEnv } from "@/lib/env";
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

  const bundle = buildFhirBundle(investigation, {
    vision: optionalEnv("NVIDIA_VISION_MODEL") ?? "nvidia-vision (unconfigured)",
    research: optionalEnv("CEREBRAS_MODEL") ?? "cerebras (unconfigured)",
    evidence: optionalEnv("CEREBRAS_MODEL") ?? "cerebras (unconfigured)",
    oneHealth: optionalEnv("CEREBRAS_MODEL") ?? "cerebras (unconfigured)",
    reasoning: optionalEnv("GROQ_MODEL") ?? "groq (unconfigured)",
  });

  return Response.json(bundle, {
    headers: { "Content-Type": "application/fhir+json" },
  });
}
