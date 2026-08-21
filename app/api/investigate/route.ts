/**
 * POST /api/investigate — streaming investigation.
 *
 * Returns Server-Sent Events. The client receives stage progress as it happens
 * rather than waiting ~2 minutes for one JSON response, which also keeps the
 * connection active well inside proxy idle timeouts.
 *
 * All provider credentials stay here: the browser never talks to NVIDIA,
 * OpenRouter, Groq or the search API directly.
 */
import { runInvestigation, validateInput } from "@/lib/investigation/orchestrator";
import { encodeEvent, encodeKeepAlive } from "@/lib/investigation/events";
import { isInvestigationError } from "@/lib/investigation/errors";
import { toSafeErrorMessage } from "@/lib/env";
import {
  createInvestigation,
  isPersistenceEnabled,
  persistAssessment,
  persistEvidence,
  persistFailure,
  persistGeographic,
  persistImage,
  persistSources,
  persistVisual,
} from "@/lib/supabase/store";
import type { InvestigationEvent } from "@/types/events";

/** Node runtime: the pipeline uses Node APIs and long-running fetches. */
export const runtime = "nodejs";

/**
 * Measured worst case is ~180s. Vercel's Hobby plan caps a function at 300s,
 * which this fits inside; the platform enforces its own ceiling regardless.
 */
export const maxDuration = 300;

/** Comment frame interval, well under typical 60s proxy idle timeouts. */
const KEEP_ALIVE_MS = 15_000;

/** Request body cap. The image dominates; 12 MB leaves headroom over the 8 MB limit. */
const MAX_BODY_BYTES = 12 * 1024 * 1024;

/** Client-supplied ids must be uuids, since that is the database primary key type. */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
    });
    // The id becomes a uuid primary key, so anything else is replaced rather
    // than passed through to fail the insert.
    investigationId =
      typeof body.investigationId === "string" && UUID_PATTERN.test(body.investigationId)
        ? body.investigationId
        : crypto.randomUUID();
  } catch (error) {
    if (isInvestigationError(error)) return jsonError(error.message, 400);
    return jsonError("Invalid request body.", 400);
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;

      const send = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          // The client disconnected; stop writing.
          closed = true;
        }
      };

      const emit = (event: InvestigationEvent) => send(encodeEvent(event));

      const keepAlive = setInterval(() => send(encodeKeepAlive()), KEEP_ALIVE_MS);

      /**
       * Persistence runs alongside the stream, not inside it.
       *
       * Writes are fired as their data becomes available and awaited only at the
       * end, so a slow database never delays an event reaching the user. Every
       * write already swallows its own failures.
       */
      const writes: Array<Promise<unknown>> = [];
      const persist = (work: () => Promise<unknown>) => {
        if (!isPersistenceEnabled()) return;
        writes.push(work().catch(() => undefined));
      };

      persist(() =>
        createInvestigation(investigationId, input.location, input.note).then(
          // Chained: the image row update needs the parent row to exist first.
          () => persistImage(investigationId, input.imageDataUrl),
        ),
      );

      const emitAndPersist = (event: InvestigationEvent) => {
        emit(event);
        switch (event.type) {
          case "vision_completed":
            persist(() => persistVisual(investigationId, event.data));
            break;
          case "geo_search_completed":
            persist(() => persistGeographic(investigationId, event.data));
            break;
          case "evidence_ready":
            persist(() => persistSources(investigationId, event.data.sources));
            persist(() => persistEvidence(investigationId, event.data.evidence));
            break;
          case "assessment_completed":
            persist(() => persistAssessment(investigationId, event.data));
            break;
          case "failed":
            persist(() => persistFailure(investigationId, event.data.message));
            break;
          default:
            break;
        }
      };

      try {
        await runInvestigation(input, emitAndPersist, investigationId);
      } catch (error) {
        // runInvestigation has already emitted a `failed` event with a
        // user-safe message; this catch only prevents an unhandled rejection.
        // Emit a fallback if the failure escaped before any event was sent.
        if (!isInvestigationError(error)) {
          emitAndPersist({
            type: "failed",
            data: { stage: "input", message: toSafeErrorMessage(error) },
          });
        }
      } finally {
        clearInterval(keepAlive);
        // Let the pending writes finish before the function can be frozen.
        await Promise.allSettled(writes);
        closed = true;
        try {
          controller.close();
        } catch {
          // Already closed by a client disconnect.
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Disables proxy buffering, which would otherwise defeat streaming.
      "X-Accel-Buffering": "no",
    },
  });
}

function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}
