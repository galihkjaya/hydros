/**
 * POST /api/investigate/[id]/confirm — Phase B (research → assessment).
 *
 * Accepts the human-reviewed observation set plus the Phase A context the
 * client sends back (the server is stateless between phases), then streams
 * research, evidence, One Health pathways, and the final assessment.
 */
import {
  validatePhaseBInput,
  runPhaseB,
} from "@/lib/investigation/orchestrator";
import { isInvestigationError } from "@/lib/investigation/errors";
import {
  jsonError,
  streamEvents,
} from "@/lib/investigation/stream";
import {
  getInvestigation,
  persistAssessment,
  persistConfirmedVisual,
  persistEvidence,
  persistFailure,
  persistHealthPathways,
  persistSources,
  touchSite,
} from "@/lib/supabase/store";
import type { InvestigationEvent } from "@/types/events";

export const runtime = "nodejs";

/** Measured worst case fits Vercel's 300s function ceiling. */
export const maxDuration = 300;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id: investigationId } = await params;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return jsonError("Invalid request body.", 400);
  }

  // Fallback coordinates when the client sends no usable geography. Prefer the
  // persisted draft's location so a thin client only needs to send the edit.
  let fallbackLocation = { latitude: 0, longitude: 0 };
  try {
    const stored = await getInvestigation(investigationId);
    if (stored) {
      fallbackLocation = {
        latitude: stored.location.latitude,
        longitude: stored.location.longitude,
      };
    }
  } catch {
    // Persistence is optional; the payload carries everything needed.
  }

  let phaseB;
  try {
    // Phase B input validation lives in validatePhaseBInput: coordinates fall
    // back to the persisted draft's location, observations are re-validated,
    // and a photo is not required (guided mode may have none).
    phaseB = validatePhaseBInput(raw, fallbackLocation);
  } catch (error) {
    if (isInvestigationError(error)) return jsonError(error.message, 400);
    return jsonError("Invalid request body.", 400);
  }

  return streamEvents(async (emit, persist) => {
    const emitAndPersist = (event: InvestigationEvent) => {
      emit(event);
      switch (event.type) {
        case "started":
          persist(() =>
            persistConfirmedVisual(
              investigationId,
              phaseB.confirmation.observations,
              phaseB.visual,
            ),
          );
          break;
        case "evidence_ready":
          persist(() => persistSources(investigationId, event.data.sources));
          persist(() => persistEvidence(investigationId, event.data.evidence));
          break;
        case "health_pathways_ready":
          persist(() => persistHealthPathways(investigationId, event.data));
          break;
        case "assessment_completed":
          persist(() => persistAssessment(investigationId, event.data));
          persist(() => touchSite(investigationId, phaseB.geographic));
          break;
        case "failed":
          persist(() => persistFailure(investigationId, event.data.message));
          break;
        default:
          break;
      }
    };

    await runPhaseB(phaseB, emitAndPersist, investigationId);
  });
}
