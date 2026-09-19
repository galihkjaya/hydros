/**
 * POST /api/investigate — Phase A (observe, then pause).
 *
 * Runs vision analysis and geographic context as a Server-Sent Events stream,
 * then ends with `awaiting_confirmation` carrying the model's observations.
 * The client shows the confirmation UI; Phase B starts at
 * POST /api/investigate/[id]/confirm.
 *
 * All provider credentials stay here: the browser never talks to NVIDIA,
 * Cerebras, Groq or the search API directly.
 */
import { runPhaseA, validateInput } from "@/lib/investigation/orchestrator";
import { isInvestigationError } from "@/lib/investigation/errors";
import {
  coerceInvestigationId,
  jsonError,
  maxDuration,
  runtime,
  streamEvents,
} from "@/lib/investigation/stream";
import {
  createInvestigation,
  persistDraftPhase,
  persistFailure,
  persistImage,
} from "@/lib/supabase/store";
import type { InvestigationEvent } from "@/types/events";

export { runtime, maxDuration };

/** Request body cap. The image dominates; 12 MB leaves headroom over the 8 MB limit. */
const MAX_BODY_BYTES = 12 * 1024 * 1024;

export async function POST(request: Request): Promise<Response> {
  // Parse and validate before opening the stream, so input errors are ordinary
  // HTTP failures the client can show directly.
  let input;
  let investigationId: string;

  try {
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > MAX_BODY_BYTES) {
      return jsonError("The uploaded image is too large.", 413);
    }

    const raw: unknown = await request.json();
    if (typeof raw !== "object" || raw === null) {
      return jsonError("Invalid request body.", 400);
    }

    const body = raw as Record<string, unknown>;
    input = validateInput({
      imageDataUrl: body.imageDataUrl,
      latitude: body.latitude,
      longitude: body.longitude,
      note: body.note,
      guidedResponses: body.guidedResponses,
    });
    // The id becomes a uuid primary key, so anything else is replaced rather
    // than passed through to fail the insert.
    investigationId = coerceInvestigationId(body.investigationId);
  } catch (error) {
    if (isInvestigationError(error)) return jsonError(error.message, 400);
    return jsonError("Invalid request body.", 400);
  }

  return streamEvents(async (emit, persist) => {
    persist(() =>
      createInvestigation(investigationId, input.location, input.note).then(() => {
        if (input.imageDataUrl) return persistImage(investigationId, input.imageDataUrl);
      }),
    );

    const emitAndPersist = (event: InvestigationEvent) => {
      emit(event);
      switch (event.type) {
        case "awaiting_confirmation":
          persist(() =>
            persistDraftPhase(
              investigationId,
              input.location,
              input.note,
              event.data.visual,
              event.data.geographic,
              input.guidedResponses,
            ),
          );
          break;
        case "failed":
          persist(() => persistFailure(investigationId, event.data.message));
          break;
        default:
          break;
      }
    };

    await runPhaseA(input, emitAndPersist, investigationId);
  });
}
