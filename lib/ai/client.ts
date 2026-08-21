/**
 * Shared transport for OpenAI-compatible chat completion APIs.
 *
 * NVIDIA NIM, OpenRouter and Groq all speak the same wire format, so timeout,
 * abort, retry and error normalisation live here once instead of three times.
 * Provider modules supply only the base URL, credential and request shape.
 *
 * Nothing in this module logs or returns credentials or raw provider bodies.
 */
import { InvestigationError } from "@/lib/investigation/errors";
import type { InvestigationStage } from "@/types/events";

export type ChatRole = "system" | "user" | "assistant";

/** Multimodal content part. Vision requests use the image variant. */
export type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export type ChatMessage = {
  role: ChatRole;
  content: string | ContentPart[];
};

export type ChatRequest = {
  baseUrl: string;
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  maxTokens: number;
  temperature?: number;
  /** Ask the provider to guarantee a JSON object body. */
  jsonMode?: boolean;
  /** Wall-clock budget for the call. Keeps us inside serverless limits. */
  timeoutMs?: number;
  /** Stage reported if this call fails. */
  stage: InvestigationStage;
  /** Extra provider-specific headers (e.g. OpenRouter attribution). */
  headers?: Record<string, string>;
  /** Retries on timeout, 429 and 5xx. One retry by default. */
  retries?: number;
};

const DEFAULT_TIMEOUT_MS = 45_000;

/** Human-readable, non-leaking failure messages per HTTP class. */
function messageForStatus(status: number): string {
  if (status === 401 || status === 403) {
    return "The AI provider rejected the request credentials.";
  }
  if (status === 429) {
    return "The AI provider is rate limiting requests. Try again shortly.";
  }
  if (status === 413) return "The request was too large for the AI provider.";
  if (status >= 500) return "The AI provider is temporarily unavailable.";
  return "The AI provider could not process the request.";
}

function isRetryable(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

/**
 * Performs one chat completion and returns the assistant's message text.
 *
 * Reasoning models return their chain of thought in a separate
 * `reasoning_content` field; only `content` is returned here, so downstream
 * parsers never see the reasoning text.
 */
export async function chatCompletion(request: ChatRequest): Promise<string> {
  const {
    baseUrl,
    apiKey,
    model,
    messages,
    maxTokens,
    temperature = 0.2,
    jsonMode = false,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    stage,
    headers = {},
    retries = 1,
  } = request;

  const body = JSON.stringify({
    model,
    messages,
    max_tokens: maxTokens,
    temperature,
    ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
  });

  let lastError: InvestigationError | null = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(baseUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          ...headers,
        },
        body,
        signal: controller.signal,
      });

      if (!response.ok) {
        // Drain the body so the connection can be reused; never surface it.
        await response.text().catch(() => "");
        const error = new InvestigationError(stage, messageForStatus(response.status));
        if (isRetryable(response.status) && attempt < retries) {
          lastError = error;
          await backoff(attempt);
          continue;
        }
        throw error;
      }

      const payload: unknown = await response.json();
      const text = readMessageContent(payload);
      if (!text) {
        throw new InvestigationError(
          stage,
          "The AI provider returned an empty response.",
        );
      }
      return text;
    } catch (error) {
      if (error instanceof InvestigationError) {
        if (!lastError) throw error;
        throw lastError;
      }
      // AbortError (timeout) or a network fault.
      const wrapped = new InvestigationError(
        stage,
        "The AI provider did not respond in time.",
        { cause: error },
      );
      if (attempt < retries) {
        lastError = wrapped;
        await backoff(attempt);
        continue;
      }
      throw wrapped;
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError ?? new InvestigationError(stage, "The AI request failed.");
}

function backoff(attempt: number): Promise<void> {
  // 600ms then 1.2s. Short enough to stay inside the serverless budget.
  return new Promise((resolve) => setTimeout(resolve, 600 * (attempt + 1)));
}

/** Pulls choices[0].message.content out of an unknown payload. */
function readMessageContent(payload: unknown): string {
  if (typeof payload !== "object" || payload === null) return "";
  const choices = (payload as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return "";
  const message = (choices[0] as { message?: unknown }).message;
  if (typeof message !== "object" || message === null) return "";
  const content = (message as { content?: unknown }).content;
  return typeof content === "string" ? content.trim() : "";
}
