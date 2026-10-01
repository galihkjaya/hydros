/**
 * Server-only Juan research client (OpenAI SDK compatible).
 *
 * Research planning, evidence synthesis, and One Health pathways run through
 * Juan router (https://router.juan.web.id/v1/chat/completions).
 *
 * Calls are serialized with retry and error normalization matching the rest
 * of the AI pipeline.
 */
import OpenAI, { APIError } from "openai";
import { requireEnv } from "@/lib/env";
import { InvestigationError } from "@/lib/investigation/errors";
import type { InvestigationStage } from "@/types/events";

export const JUAN_MIN_INTERVAL_MS = 0;
const DEFAULT_TIMEOUT_MS = 45_000;
const DEFAULT_RETRIES = 1;
export const JUAN_DEFAULT_BASE_URL = "https://router.juan.web.id/v1";
export const JUAN_CHAT_URL = "https://router.juan.web.id/v1/chat/completions";

export type JuanOperation =
  | "research plan"
  | "evidence synthesis"
  | "one health pathways";

export type JuanRequest = {
  systemPrompt: string;
  userPrompt: string;
  stage: InvestigationStage;
  operation: JuanOperation;
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
  deadline?: number;
  investigationId?: string;
};

/**
 * Serializes tasks and enforces start-to-start spacing if configured.
 * The queue continues after a rejected task so one failed request cannot strand later work.
 */
export class JuanRateLimiter {
  private tail: Promise<void> = Promise.resolve();
  private lastStartedAt = 0;

  constructor(private readonly intervalMs = JUAN_MIN_INTERVAL_MS) {}

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
          "The Juan request could not start within the investigation time budget.",
        );
      }

      if (waitMs > 0) await delay(waitMs);

      if (deadline && Date.now() >= deadline) {
        throw new InvestigationError(
          stage,
          "The Juan request could not start within the investigation time budget.",
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

const limiter = new JuanRateLimiter();
const investigationStats = new Map<string, RequestStats>();

type TestExecutor = (
  request: JuanRequest,
  timeoutMs: number,
) => Promise<string>;

let testExecutor: TestExecutor | null = null;
let testLimiter: JuanRateLimiter | null = null;

/** Test-only seam; production requests use the OpenAI SDK. */
export function setJuanExecutorForTests(executor: TestExecutor | null): void {
  testExecutor = executor;
}

/** Test-only seam for exercising queue behavior. */
export function setJuanLimiterForTests(
  replacement: JuanRateLimiter | null,
): void {
  testLimiter = replacement;
}

/** Flushes and logs per-investigation request metrics. */
export function finishJuanInvestigation(investigationId: string): void {
  const stats = investigationStats.get(investigationId);
  if (!stats) return;
  console.info(
    `[Juan] total requests: ${stats.requests} (investigation ${investigationId}; retries: ${stats.retries}; rate-limit waits: ${stats.rateLimitWaits})`,
  );
  investigationStats.delete(investigationId);
}

function getJuanBaseUrl(): string {
  const configured = process.env.JUAN_BASE_URL?.trim();
  if (!configured) return JUAN_DEFAULT_BASE_URL;
  return configured.replace(/\/chat\/completions\/?$/, "").replace(/\/+$/, "");
}

/** Generates one non-streaming structured-response completion. */
export async function askJuan(request: JuanRequest): Promise<string> {
  // Resolve both values before queueing so configuration failures are instant
  // and do not occupy a slot in the shared rate limiter.
  const apiKey = requireEnv("JUAN_API_KEY");
  const model = requireEnv("JUAN_MODEL");
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
        "The Juan request did not respond in time.",
      );
    }

    const attemptTimeout = Math.min(timeoutMs, remaining);
    try {
      const result = await activeLimiter.execute(
        () => {
          if (stats) stats.requests += 1;
          console.info(
            `[Juan] ${request.operation} request${request.investigationId ? ` (investigation ${request.investigationId})` : ""}`,
          );
          return testExecutor
            ? testExecutor(request, attemptTimeout)
            : executeWithSdk(request, apiKey, model, attemptTimeout);
        },
        request.deadline,
        request.stage,
      );

      if (!result.trim()) {
        throw new JuanRequestFailure(
          "The Juan provider returned an empty response.",
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
        `[Juan] ${request.operation} retry ${attempt + 1}; waiting ${waitMs}ms${failure.status === 429 ? " after rate limit" : ""}`,
      );
      await delay(waitMs);
    }
  }

  throw new InvestigationError(request.stage, "The Juan request failed.");
}

async function executeWithSdk(
  request: JuanRequest,
  apiKey: string,
  model: string,
  timeoutMs: number,
): Promise<string> {
  const client = new OpenAI({
    apiKey,
    baseURL: getJuanBaseUrl(),
    timeout: timeoutMs,
    maxRetries: 0,
  });

  const completion = await client.chat.completions.create(
    {
      messages: [
        { role: "system", content: request.systemPrompt },
        { role: "user", content: request.userPrompt },
      ],
      model,
      max_tokens: request.maxTokens ?? 3000,
      temperature: request.temperature ?? 0.2,
      top_p: 1,
      stream: false,
      response_format: { type: "json_object" },
    },
    { timeout: timeoutMs, maxRetries: 0 },
  );

  const content = readCompletionContent(completion);
  if (typeof content !== "string" || !content.trim()) {
    throw new JuanRequestFailure(
      "The Juan provider returned an empty response.",
      undefined,
      true,
    );
  }
  return content.trim();
}

class JuanRequestFailure extends Error {
  constructor(
    message: string,
    readonly status: number | undefined,
    readonly retryable: boolean,
    readonly retryAfterMs = 0,
  ) {
    super(message);
    this.name = "JuanRequestFailure";
  }
}

function normalizeFailure(
  error: unknown,
  stage: InvestigationStage,
): JuanRequestFailure {
  if (error instanceof JuanRequestFailure) return error;

  if (error instanceof APIError) {
    const status = error.status;
    const retryAfterMs = status === 429 ? readRetryAfter(error.headers) : 0;
    return new JuanRequestFailure(
      juanMessageForStatus(status, stage),
      status,
      status === 408 || status === 429 || status >= 500,
      retryAfterMs,
    );
  }

  return new JuanRequestFailure(
    "The Juan provider did not respond in time.",
    undefined,
    true,
  );
}

function juanMessageForStatus(
  status: number | undefined,
  _stage: InvestigationStage,
): string {
  if (status === 401 || status === 403) {
    return "The Juan provider rejected the request credentials.";
  }
  if (status === 404) return "The configured Juan model was not found.";
  if (status === 413) return "The Juan request was too large.";
  if (status === 429) {
    return "The Juan provider is rate limiting requests. Try again shortly.";
  }
  if (status && status >= 500) {
    return "The Juan provider is temporarily unavailable.";
  }
  return "The Juan provider could not process the request.";
}

function readRetryAfter(
  headers: Headers | Record<string, string | null | undefined> | undefined,
): number {
  if (!headers) return 0;
  let value: string | null | undefined;
  if (typeof (headers as Headers).get === "function") {
    value =
      (headers as Headers).get("retry-after") ??
      (headers as Headers).get("Retry-After");
  } else {
    const record = headers as Record<string, string | null | undefined>;
    value = record["retry-after"] ?? record["Retry-After"];
  }
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

// Backwards compatibility aliases
export const askCerebras = askJuan;
export const CerebrasRateLimiter = JuanRateLimiter;
export const finishCerebrasInvestigation = finishJuanInvestigation;
export const setCerebrasExecutorForTests = setJuanExecutorForTests;
export const setCerebrasLimiterForTests = setJuanLimiterForTests;
export type CerebrasRequest = JuanRequest;
export type CerebrasOperation = JuanOperation;
export const CEREBRAS_MIN_INTERVAL_MS = JUAN_MIN_INTERVAL_MS;
