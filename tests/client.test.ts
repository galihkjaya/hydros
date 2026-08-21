/**
 * Self-check for the shared provider transport.
 *
 * `fetch` is stubbed, so no network access. The cases here are the ones observed
 * in practice against NVIDIA NIM, OpenRouter and Groq.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { chatCompletion } from "../lib/ai/client.js";

type FetchArgs = Parameters<typeof fetch>;

/** Installs a stub fetch for the duration of `run`. */
async function withFetch<T>(
  handler: (calls: number) => Response | Promise<Response>,
  run: () => Promise<T>,
): Promise<{ value: T | undefined; error: unknown; calls: number }> {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async (..._args: FetchArgs) => {
    calls += 1;
    return handler(calls);
  }) as typeof fetch;
  try {
    return { value: await run(), error: undefined, calls };
  } catch (error) {
    return { value: undefined, error, calls };
  } finally {
    globalThis.fetch = original;
  }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const completion = (content: string) =>
  json({ choices: [{ message: { role: "assistant", content } }] });

const request = {
  baseUrl: "https://example.invalid/v1/chat/completions",
  apiKey: "test-key",
  model: "test-model",
  messages: [{ role: "user" as const, content: "hi" }],
  maxTokens: 100,
  stage: "vision" as const,
};

test("returns the assistant content", async () => {
  const { value, calls } = await withFetch(
    () => completion("  hello  "),
    () => chatCompletion(request),
  );
  assert.equal(value, "hello");
  assert.equal(calls, 1);
});

test("ignores reasoning_content from reasoning models", async () => {
  const { value } = await withFetch(
    () =>
      json({
        choices: [
          {
            message: {
              role: "assistant",
              content: '{"ok":true}',
              reasoning_content: "Let me think about whether to say ok...",
            },
          },
        ],
      }),
    () => chatCompletion(request),
  );
  assert.equal(value, '{"ok":true}');
});

test("treats an HTTP 200 body-level error as a failure and retries", async () => {
  // OpenRouter reports upstream overload this way.
  const { error, calls } = await withFetch(
    (n) =>
      n === 1
        ? json({ error: { code: 502, message: "Upstream error" } })
        : completion("recovered"),
    () => chatCompletion({ ...request, retries: 1 }),
  );
  assert.equal(error, undefined);
  assert.equal(calls, 2);
});

test("gives up on a persistent body-level error with a safe message", async () => {
  const { error } = await withFetch(
    () => json({ error: { code: 502, message: "Upstream error from Nvidia" } }),
    () => chatCompletion({ ...request, retries: 1 }),
  );
  assert.equal((error as Error).name, "InvestigationError");
  // The provider's own wording is never surfaced.
  assert.doesNotMatch((error as Error).message, /Nvidia|Upstream/);
  assert.match((error as Error).message, /temporarily unavailable/);
});

test("retries 429 and 5xx but not 401", async () => {
  const rateLimited = await withFetch(
    (n) => (n === 1 ? json({}, 429) : completion("ok")),
    () => chatCompletion({ ...request, retries: 1 }),
  );
  assert.equal(rateLimited.calls, 2);
  assert.equal(rateLimited.value, "ok");

  const unauthorized = await withFetch(
    () => json({}, 401),
    () => chatCompletion({ ...request, retries: 2 }),
  );
  assert.equal(unauthorized.calls, 1);
  assert.match((unauthorized.error as Error).message, /credentials/);
});

test("an empty completion is retried, then reported", async () => {
  const recovered = await withFetch(
    (n) => (n === 1 ? completion("") : completion("second try")),
    () => chatCompletion({ ...request, retries: 1 }),
  );
  assert.equal(recovered.value, "second try");

  const persistent = await withFetch(
    () => completion(""),
    () => chatCompletion({ ...request, retries: 1 }),
  );
  assert.match((persistent.error as Error).message, /empty response/);
});

test("never includes the api key in an error message", async () => {
  const { error } = await withFetch(
    () => json({}, 403),
    () => chatCompletion({ ...request, apiKey: "sk-secret-value", retries: 0 }),
  );
  assert.doesNotMatch((error as Error).message, /sk-secret-value/);
});
