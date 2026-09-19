/**
 * Shared SSE streaming for the investigation routes.
 *
 * Both phases stream typed events the same way: emit as they happen, persist
 * alongside (never inside) the stream, keep-alive against proxy timeouts.
 */
import { encodeEvent, encodeKeepAlive } from "./events";
import { isPersistenceEnabled } from "@/lib/supabase/client";
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

export type Persist = (work: () => Promise<unknown>) => void;

/** Runs `run` with emit-then-persist semantics inside an SSE response. */
export function streamEvents(
  run: (emit: (event: InvestigationEvent) => void, persist: Persist) => Promise<void>,
): Response {
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
       * Writes are fired as their data becomes available and awaited only at
       * the end, so a slow database never delays an event reaching the user.
       * Every write already swallows its own failures.
       */
      const writes: Array<Promise<unknown>> = [];
      const persist: Persist = (work) => {
        if (!isPersistenceEnabled()) return;
        writes.push(work().catch(() => undefined));
      };

      try {
        await run(emit, persist);
      } catch {
        // Stages emit their own `failed` event with a user-safe message;
        // this catch only prevents an unhandled rejection.
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

/** Client-supplied ids must be uuids, since that is the database primary key type. */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Coerces a client id to a uuid, replacing anything else. */
export function coerceInvestigationId(value: unknown): string {
  return typeof value === "string" && UUID_PATTERN.test(value)
    ? value
    : crypto.randomUUID();
}

export function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}
