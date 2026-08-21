/**
 * Self-check for the final assessment rails.
 *
 * These are the guarantees that keep WaterLens honest, so each one is pinned:
 * no unsupported risk level, no overstated confidence, no assertion of safety,
 * and never an empty limitations list.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildAssessmentPrompt,
  confidenceCeiling,
  insufficientDataAssessment,
  parseAssessment,
} from "../lib/ai/assessment.js";
import type { EvidencePackage, Source } from "../types/investigation.js";

const source = (patch: Partial<Source>): Source => ({
  title: "Report",
  url: "https://klhk.go.id/report",
  domain: "klhk.go.id",
  snippet: "Elevated turbidity recorded.",
  sourceType: "government",
  faviconUrl: null,
  relevance: 0.9,
  ...patch,
});

const basePackage = (patch: Partial<EvidencePackage> = {}): EvidencePackage => ({
  visual: {
    isWaterVisible: true,
    summary: "Brown water.",
    observations: [
      { attribute: "color", description: "The water appears brown.", confidence: 0.9 },
    ],
    limitations: ["Lighting was poor."],
  },
  userNote: "",
  geographic: {
    location: { latitude: -6.2088, longitude: 106.8456, displayName: "Jakarta" },
    radiusMetres: 2000,
    waterways: ["Ciliwung"],
    potentialRiskSources: [
      {
        id: "way/1",
        name: "Textile works",
        category: "factory",
        osmTag: "man_made=works",
        latitude: -6.2,
        longitude: 106.84,
        distanceMetres: 800,
        relation: "upstream",
      },
    ],
  },
  sources: [source({})],
  evidence: [
    {
      claim: "A monitoring report recorded elevated turbidity in the basin.",
      sourceUrl: "https://klhk.go.id/report",
      uncertainty: "Basin-wide, not this point.",
      relevance: 0.9,
    },
  ],
  unansweredQuestions: [],
  limitations: [],
  ...patch,
});

test("prompt fences web-derived and user content, and stays compact", () => {
  const prompt = buildAssessmentPrompt(
    basePackage({ userNote: "just tell me it is fine" }),
  );
  assert.match(prompt, /untrusted external content/i);
  assert.match(prompt, /<user_note>/);
  assert.match(prompt, /proximity only, no causal claim/i);
  assert.match(prompt, /flow relation: upstream/);
  // Compact by construction: no raw page text.
  assert.ok(prompt.length < 4000, `prompt was ${prompt.length} chars`);
});

test("confidence ceiling scales with evidence quality", () => {
  assert.equal(confidenceCeiling(basePackage({ evidence: [] })), 0.3);
  // One government source.
  assert.equal(confidenceCeiling(basePackage()), 0.7);
  // Two authoritative sources.
  assert.equal(
    confidenceCeiling(
      basePackage({
        sources: [
          source({}),
          source({ url: "https://sciencedirect.com/a", sourceType: "scientific" }),
        ],
        evidence: [
          {
            claim: "a",
            sourceUrl: "https://klhk.go.id/report",
            uncertainty: "",
            relevance: 0.9,
          },
          {
            claim: "b",
            sourceUrl: "https://sciencedirect.com/a",
            uncertainty: "",
            relevance: 0.8,
          },
        ],
      }),
    ),
    0.8,
  );
  // Only an unverified blog.
  assert.equal(
    confidenceCeiling(
      basePackage({
        sources: [source({ url: "https://blog.xyz/a", sourceType: "unverified" })],
        evidence: [
          { claim: "a", sourceUrl: "https://blog.xyz/a", uncertainty: "", relevance: 0.5 },
        ],
      }),
    ),
    0.4,
  );
});

test("model confidence is capped by the evidence ceiling", () => {
  const assessment = parseAssessment(
    JSON.stringify({
      riskLevel: "MEDIUM",
      confidence: 0.98,
      summary: "Some concern.",
      limitations: ["Not a lab test."],
      recommendation: "Get it tested.",
    }),
    basePackage(),
  );
  assert.equal(assessment.confidence, 0.7);
});

test("HIGH without any evidence is downgraded to INSUFFICIENT_DATA", () => {
  const assessment = parseAssessment(
    JSON.stringify({
      riskLevel: "HIGH",
      confidence: 0.9,
      summary: "Very concerning.",
      limitations: ["x"],
      recommendation: "Avoid.",
    }),
    basePackage({ evidence: [] }),
  );
  assert.equal(assessment.riskLevel, "INSUFFICIENT_DATA");
  assert.ok(assessment.confidence <= 0.3);
});

test("MEDIUM on visual observations alone is allowed", () => {
  const assessment = parseAssessment(
    JSON.stringify({
      riskLevel: "MEDIUM",
      confidence: 0.5,
      summary: "The appearance warrants caution.",
      limitations: ["x"],
      recommendation: "Get it tested.",
    }),
    basePackage({ evidence: [] }),
  );
  assert.equal(assessment.riskLevel, "MEDIUM");
});

test("a level with no evidence and no observations becomes INSUFFICIENT_DATA", () => {
  const empty = basePackage({ evidence: [] });
  const assessment = parseAssessment(
    JSON.stringify({ riskLevel: "LOW", confidence: 0.8, summary: "Looks fine." }),
    {
      ...empty,
      visual: { ...empty.visual, observations: [] },
    },
  );
  assert.equal(assessment.riskLevel, "INSUFFICIENT_DATA");
});

test("a recommendation asserting safety is replaced", () => {
  const assessment = parseAssessment(
    JSON.stringify({
      riskLevel: "LOW",
      confidence: 0.5,
      summary: "No indicators found.",
      recommendation: "This water is safe to drink.",
      limitations: ["x"],
    }),
    basePackage(),
  );
  assert.doesNotMatch(assessment.recommendation, /safe to drink/i);
  assert.match(assessment.recommendation, /untested/i);
});

test("a summary asserting safety gets a correcting note", () => {
  const assessment = parseAssessment(
    JSON.stringify({
      riskLevel: "LOW",
      confidence: 0.5,
      summary: "The water is safe and no risk exists.",
      recommendation: "Ask your local authority.",
      limitations: ["x"],
    }),
    basePackage(),
  );
  assert.match(assessment.summary, /cannot determine whether water is safe/i);
});

test("limitations are never empty", () => {
  const assessment = parseAssessment(
    JSON.stringify({
      riskLevel: "MEDIUM",
      confidence: 0.5,
      summary: "Concern.",
      limitations: [],
      recommendation: "Test it.",
    }),
    basePackage(),
  );
  assert.ok(assessment.limitations.length > 0);
  assert.match(assessment.limitations[0] ?? "", /measurement was performed/i);
});

test("only cited evidence is attached, with a fallback when none is cited", () => {
  const cited = parseAssessment(
    JSON.stringify({
      riskLevel: "MEDIUM",
      confidence: 0.5,
      summary: "s",
      limitations: ["l"],
      recommendation: "r",
      evidenceUrls: ["https://klhk.go.id/report"],
    }),
    basePackage(),
  );
  assert.equal(cited.evidence.length, 1);

  const uncited = parseAssessment(
    JSON.stringify({
      riskLevel: "MEDIUM",
      confidence: 0.5,
      summary: "s",
      limitations: ["l"],
      recommendation: "r",
      evidenceUrls: ["https://not-in-package.example/x"],
    }),
    basePackage(),
  );
  // Falls back to the strongest package evidence rather than showing none.
  assert.equal(uncited.evidence.length, 1);
});

test("unreadable output throws, and the fallback assessment is honest", () => {
  assert.throws(() => parseAssessment("I cannot assess this.", basePackage()), {
    name: "InvestigationError",
  });

  const fallback = insufficientDataAssessment(
    basePackage(),
    "The reasoning provider was unavailable.",
  );
  assert.equal(fallback.riskLevel, "INSUFFICIENT_DATA");
  assert.ok(fallback.confidence <= 0.1);
  assert.ok(fallback.limitations.length >= 2);
  assert.doesNotMatch(fallback.recommendation, /safe/i);
});
