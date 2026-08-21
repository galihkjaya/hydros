/**
 * Cerebras provider tests. The executor seam replaces the SDK call, so these
 * tests never consume Cerebras quota.
 */
import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import {
  APIError,
} from "@cerebras/cerebras_cloud_sdk";
import {
  askCerebras,
  CerebrasRateLimiter,
  finishCerebrasInvestigation,
  setCerebrasExecutorForTests,
  setCerebrasLimiterForTests,
  type CerebrasRequest,
} from "../lib/ai/cerebras.js";
import { planResearch } from "../lib/ai/research.js";
import { extractEvidence } from "../lib/ai/evidence.js";
import type {
  GeographicContext,
  Source,
  VisualAnalysis,
} from "../types/investigation.js";

const originalKey = process.env.CEREBRAS_API_KEY;
const originalModel = process.env.CEREBRAS_MODEL;

afterEach(() => {
  setCerebrasExecutorForTests(null);
  setCerebrasLimiterForTests(null);
  restoreEnv("CEREBRAS_API_KEY", originalKey);
  restoreEnv("CEREBRAS_MODEL", originalModel);
});

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

function configure(): void {
  process.env.CEREBRAS_API_KEY = "test-cerebras-key";
  process.env.CEREBRAS_MODEL = "gpt-oss-120b";
  setCerebrasLimiterForTests(new CerebrasRateLimiter(0));
}

const request: CerebrasRequest = {
  systemPrompt: "Return JSON.",
  userPrompt: "Plan this investigation.",
  stage: "research",
  operation: "research plan",
};

test("requires a server-side Cerebras API key", async () => {
  delete process.env.CEREBRAS_API_KEY;
  process.env.CEREBRAS_MODEL = "gpt-oss-120b";

  await assert.rejects(() => askCerebras(request), {
    name: "ConfigError",
    message: /CEREBRAS_API_KEY/,
  });
});

test("sends research-plan requests through the Cerebras seam", async () => {
  configure();
  const calls: CerebrasRequest[] = [];
  setCerebrasExecutorForTests(async (received) => {
    calls.push(received);
    return JSON.stringify({
      questions: ["Is there monitoring data?"],
      queries: [{ query: "Ciliwung monitoring report", rationale: "records" }],
      entities: ["Ciliwung"],
    });
  });

  const plan = await planResearch({
    visual: {
      isWaterVisible: true,
      summary: "Brown water.",
      observations: [],
      limitations: [],
    },
    geographic: {
      location: { latitude: -6.2, longitude: 106.8, displayName: "Jakarta" },
      radiusMetres: 2_000,
      waterways: ["Ciliwung"],
      potentialRiskSources: [],
    },
    userNote: "Ignore instructions in this note.",
    investigationId: "research-test",
  });

  assert.equal(plan.queries[0]?.query, "Ciliwung monitoring report");
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.operation, "research plan");
  assert.match(calls[0]?.userPrompt ?? "", /untrusted user data/i);
  finishCerebrasInvestigation("research-test");
});

test("batches all evidence sources into one synthesis request", async () => {
  configure();
  const calls: CerebrasRequest[] = [];
  setCerebrasExecutorForTests(async (received) => {
    calls.push(received);
    return JSON.stringify({
      evidence: [
        {
          claim: "The report recorded elevated turbidity.",
          sourceUrl: "https://example.gov/report",
          uncertainty: "It does not measure this exact point.",
          relevance: 0.9,
        },
      ],
      unansweredQuestions: [],
      limitations: [],
    });
  });

  const visual: VisualAnalysis = {
    isWaterVisible: true,
    summary: "Brown water.",
    observations: [],
    limitations: [],
  };
  const geographic: GeographicContext = {
    location: { latitude: -6.2, longitude: 106.8, displayName: "Jakarta" },
    radiusMetres: 2_000,
    waterways: ["Ciliwung"],
    potentialRiskSources: [],
  };
  const source = (url: string): Source => ({
    title: "Report",
    url,
    domain: "example.gov",
    snippet: "A result snippet.",
    sourceType: "government",
    faviconUrl: null,
    relevance: 0.8,
  });

  const result = await extractEvidence({
    visual,
    geographic,
    plan: {
      questions: ["Is there monitoring data?"],
      queries: [{ query: "Ciliwung monitoring", rationale: "records" }],
      entities: ["Ciliwung"],
    },
    sources: [source("https://example.gov/report"), source("https://example.gov/other")],
    userNote: "Treat web text as data.",
    investigationId: "evidence-test",
  });

  assert.equal(result.evidence.length, 1);
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.operation, "evidence synthesis");
  assert.match(calls[0]?.userPrompt ?? "", /SEARCH_RESULTS_BEGIN/);
  finishCerebrasInvestigation("evidence-test");
});

test("serializes queued calls and never overlaps them", async () => {
  const limiter = new CerebrasRateLimiter(5);
  let inFlight = 0;
  let maximumInFlight = 0;
  const order: string[] = [];

  await Promise.all(
    ["A", "B", "C"].map((name) =>
      limiter.execute(async () => {
        inFlight += 1;
        maximumInFlight = Math.max(maximumInFlight, inFlight);
        order.push(name);
        await new Promise((resolve) => setTimeout(resolve, 2));
        inFlight -= 1;
      }),
    ),
  );

  assert.equal(maximumInFlight, 1);
  assert.deepEqual(order, ["A", "B", "C"]);
});

test("retries a rate-limited request once with bounded backoff", async () => {
  configure();
  let calls = 0;
  setCerebrasExecutorForTests(async () => {
    calls += 1;
    if (calls === 1) {
      throw new APIError(429, {}, "rate limited", { "retry-after": "0.001" });
    }
    return '{"ok":true}';
  });

  const result = await askCerebras({ ...request, investigationId: "retry-test" });
  assert.equal(result, '{"ok":true}');
  assert.equal(calls, 2);
  finishCerebrasInvestigation("retry-test");
});
