/**
 * Server-only Cerebras research client.
 *
 * Research planning and evidence synthesis share one queue because Cerebras
 * is limited to five requests per minute for this project. Keeping the queue
 * here means callers cannot accidentally create parallel provider requests.
 * The queue is intentionally process-local: it protects concurrent work in a
 * serverless instance without introducing infrastructure the MVP does not
 * need.
 */
import Cerebras, { APIError } from "@cerebras/cerebras_cloud_sdk";
import { requireEnv } from "@/lib/env";
import { InvestigationError } from "@/lib/investigation/errors";
import type { InvestigationStage } from "@/types/events";

/** Start-to-start spacing with a small margin below the five-RPM ceiling. */
export const CEREBRAS_MIN_INTERVAL_MS = 13_500;
const DEFAULT_TIMEOUT_MS = 45_000;
const DEFAULT_RETRIES = 1;

export type CerebrasOperation = "research plan" | "evidence synthesis";

export type CerebrasRequest = {
  systemPrompt: string;
  userPrompt: string;
  stage: InvestigationStage;
  operation: CerebrasOperation;
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
  deadline?: number;
  investigationId?: string;
};

/**
 * Serializes tasks and enforces start-to-start spacing. The queue continues
 * after a rejected task so one failed request cannot strand later work.
 */
export class CerebrasRateLimiter {
  private tail: Promise<void> = Promise.resolve();
  private lastStartedAt = 0;

  constructor(private readonly intervalMs = CEREBRAS_MIN_INTERVAL_MS) {}

  execute<T>(
    task: () => Promise<T>,
    deadline?: number,
    stage: InvestigationStage = "research",
  ): Promise<T> {
    const run = this.tail.then(async () => {
      const waitMs = Math.max(
        0,
        this.lastStartedAt + this.intervalMs - Date.now(),
      );

      if (deadline && Date.now() + waitMs >= deadline) {
        throw new InvestigationError(
          stage,
          "The Cerebras request could not start within the investigation time budget.",
        );
      }

      if (waitMs > 0) await delay(waitMs);

      if (deadline && Date.now() >= deadline) {
        throw new InvestigationError(
          stage,
          "The Cerebras request could not start within the investigation time budget.",
        );
      }

      this.lastStartedAt = Date.now();
      return task();
    });

    this.tail = run.then(
      () => undefined,
      () => undefined,
    );
    return run as Promise<T>;
  }
}

type RequestStats = {
  requests: number;
  retries: number;
  rateLimitWaits: number;
};

const limiter = new CerebrasRateLimiter();
const investigationStats = new Map<string, RequestStats>();

type TestExecutor = (
  request: CerebrasRequest,
  timeoutMs: number,
) => Promise<string>;

let testExecutor: TestExecutor | null = null;
let testLimiter: CerebrasRateLimiter | null = null;

/** Test-only seam; production requests always use the official SDK. */
export function setCerebrasExecutorForTests(executor: TestExecutor | null): void {
  testExecutor = executor;
}

/** Test-only seam for exercising queue behavior without a 13.5s wait. */
export function setCerebrasLimiterForTests(
  replacement: CerebrasRateLimiter | null,
): void {
  testLimiter = replacement;
}

/** Flushes and logs per-investigation request metrics. */
export function finishCerebrasInvestigation(investigationId: string): void {
  const stats = investigationStats.get(investigationId);
  if (!stats) return;
  console.info(
    `[Cerebras] total requests: ${stats.requests} (investigation ${investigationId}; retries: ${stats.retries}; rate-limit waits: ${stats.rateLimitWaits})`,
  );
  investigationStats.delete(investigationId);
}

/** Generates one non-streaming structured-response completion. */
export async function askCerebras(request: CerebrasRequest): Promise<string> {
  // Resolve both values before queueing so configuration failures are instant
  // and do not occupy a slot in the shared rate limiter.
  const apiKey = requireEnv("CEREBRAS_API_KEY");
  const model = requireEnv("CEREBRAS_MODEL");
  const timeoutMs = request.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const activeLimiter = testLimiter ?? limiter;
  const stats = request.investigationId
    ? getStats(request.investigationId)
    : undefined;

  for (let attempt = 0; attempt <= DEFAULT_RETRIES; attempt += 1) {
    const remaining = request.deadline
      ? request.deadline - Date.now()
      : timeoutMs;
    if (remaining <= 0) {
      throw new InvestigationError(
        request.stage,
        "The Cerebras request did not respond in time.",
      );
    }

    const attemptTimeout = Math.min(timeoutMs, remaining);
    try {
      const result = await activeLimiter.execute(
        () => {
          if (stats) stats.requests += 1;
          console.info(
            `[Cerebras] ${request.operation} request${request.investigationId ? ` (investigation ${request.investigationId})` : ""}`,
          );
          return testExecutor
            ? testExecutor(request, attemptTimeout)
            : executeWithSdk(request, apiKey, model, attemptTimeout);
        },
        request.deadline,
        request.stage,
      );

      if (!result.trim()) {
        throw new CerebrasRequestFailure(
          "The Cerebras provider returned an empty response.",
          undefined,
          true,
        );
      }
      return result.trim();
    } catch (error) {
      if (error instanceof InvestigationError) throw error;

      const failure = normalizeFailure(error, request.stage);
      const canRetry =
        failure.retryable &&
        attempt < DEFAULT_RETRIES &&
        (!request.deadline ||
          request.deadline - Date.now() > failure.retryAfterMs + 5_000);

      if (!canRetry) {
        throw new InvestigationError(request.stage, failure.message, {
          cause: error,
        });
      }

      if (stats) {
        stats.retries += 1;
        if (failure.status === 429) stats.rateLimitWaits += 1;
      }
      const waitMs = failure.retryAfterMs || 1_000 * (attempt + 1);
      console.info(
        `[Cerebras] ${request.operation} retry ${attempt + 1}; waiting ${waitMs}ms${failure.status === 429 ? " after rate limit" : ""}`,
      );
      await delay(waitMs);
    }
  }

  throw new InvestigationError(request.stage, "The Cerebras request failed.");
}

async function executeWithSdk(
  request: CerebrasRequest,
  apiKey: string,
  model: string,
  timeoutMs: number,
): Promise<string> {
  const client = new Cerebras({
    apiKey,
    timeout: timeoutMs,
    maxRetries: 0,
    warmTCPConnection: false,
  });

  const completion = await client.chat.completions.create(
    {
      messages: [
        { role: "system", content: request.systemPrompt },
        { role: "user", content: request.userPrompt },
      ],
      model,
      max_completion_tokens: request.maxTokens ?? 3000,
      temperature: request.temperature ?? 0.2,
      top_p: 1,
      stream: false,
      reasoning_effort: "medium",
      response_format: { type: "json_object" },
    },
    { timeout: timeoutMs, maxRetries: 0 },
  );

  const content = readCompletionContent(completion);
  if (typeof content !== "string" || !content.trim()) {
    throw new CerebrasRequestFailure(
      "The Cerebras provider returned an empty response.",
      undefined,
      true,
    );
  }
  return content;
}

class CerebrasRequestFailure extends Error {
  constructor(
    message: string,
    readonly status: number | undefined,
    readonly retryable: boolean,
    readonly retryAfterMs = 0,
  ) {
    super(message);
    this.name = "CerebrasRequestFailure";
  }
}

function normalizeFailure(
  error: unknown,
  stage: InvestigationStage,
): CerebrasRequestFailure {
  if (error instanceof CerebrasRequestFailure) return error;

  if (error instanceof APIError) {
    const status = error.status;
    const retryAfterMs = status === 429 ? readRetryAfter(error.headers) : 0;
    return new CerebrasRequestFailure(
      cerebrasMessageForStatus(status, stage),
      status,
      status === 408 || status === 429 || status >= 500,
      retryAfterMs,
    );
  }

  return new CerebrasRequestFailure(
    "The Cerebras provider did not respond in time.",
    undefined,
    true,
  );
}

function cerebrasMessageForStatus(
  status: number | undefined,
  _stage: InvestigationStage,
): string {
  if (status === 401 || status === 403) {
    return "The Cerebras provider rejected the request credentials.";
  }
  if (status === 404) return "The configured Cerebras model was not found.";
  if (status === 413) return "The Cerebras request was too large.";
  if (status === 429) {
    return "The Cerebras provider is rate limiting requests. Try again shortly.";
  }
  if (status && status >= 500) {
    return "The Cerebras provider is temporarily unavailable.";
  }
  return "The Cerebras provider could not process the request.";
}

function readRetryAfter(
  headers: Record<string, string | null | undefined> | undefined,
): number {
  const value = headers?.["retry-after"] ?? headers?.["Retry-After"];
  if (!value) return 0;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? Math.max(0, timestamp - Date.now()) : 0;
}

function getStats(investigationId: string): RequestStats {
  const existing = investigationStats.get(investigationId);
  if (existing) return existing;
  const stats = { requests: 0, retries: 0, rateLimitWaits: 0 };
  investigationStats.set(investigationId, stats);
  return stats;
}

function readCompletionContent(payload: unknown): string | undefined {
  if (typeof payload !== "object" || payload === null) return undefined;
  const choices = (payload as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return undefined;
  const first = choices[0];
  if (typeof first !== "object" || first === null) return undefined;
  const message = (first as { message?: unknown }).message;
  if (typeof message !== "object" || message === null) return undefined;
  const content = (message as { content?: unknown }).content;
  return typeof content === "string" ? content : undefined;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
