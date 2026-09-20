/**
 * Trend self-check: ordering, gaps, and single-visit sites.
 * Pure arithmetic over stored data — no model, no inference.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  evidenceAccumulation,
  observationDrift,
  riskTimeline,
} from "../lib/investigation/trends.js";
import type { InvestigationLike } from "../lib/investigation/trends.js";

const visit = (patch: Partial<InvestigationLike> & { id: string }): InvestigationLike => ({
  createdAt: "2026-01-01T00:00:00Z",
  riskLevel: null,
  confidence: null,
  ...patch,
});

test("timeline orders oldest first and skips unassessed visits", () => {
  const points = riskTimeline([
    visit({ id: "b", createdAt: "2026-03-01T00:00:00Z", riskLevel: "HIGH", confidence: 0.7 }),
    visit({ id: "a", createdAt: "2026-01-01T00:00:00Z", riskLevel: "LOW", confidence: 0.5 }),
    visit({ id: "draft", createdAt: "2026-02-01T00:00:00Z" }),
  ]);
  assert.deepEqual(points.map((p) => p.investigationId), ["a", "b"]);
});

test("single-visit sites yield a one-point timeline and no drift", () => {
  const visits = [
    visit({
      id: "only",
      riskLevel: "MEDIUM",
      confidence: 0.6,
      guidedResponses: { clarity: "not_visible" },
    }),
  ];
  assert.equal(riskTimeline(visits).length, 1);
  assert.deepEqual(observationDrift(visits), []);
});

test("drift reports only changed guided answers", () => {
  const drift = observationDrift([
    visit({
      id: "v1",
      createdAt: "2026-01-01T00:00:00Z",
      guidedResponses: { clarity: "bed_visible", litter: "none" },
    }),
    visit({
      id: "v2",
      createdAt: "2026-02-01T00:00:00Z",
      guidedResponses: { clarity: "not_visible", litter: "none" },
    }),
  ]);
  assert.equal(drift.length, 1);
  assert.equal(drift[0]?.item, "clarity");
  assert.equal(drift[0]?.from, "bed_visible");
  assert.equal(drift[0]?.to, "not_visible");
});

test("accumulation counts distinct sources and per-visit novelty", () => {
  const result = evidenceAccumulation([
    visit({ id: "v1", createdAt: "2026-01-01T00:00:00Z", sourceUrls: ["https://a.example", "https://b.example"] }),
    visit({ id: "v2", createdAt: "2026-02-01T00:00:00Z", sourceUrls: ["https://b.example", "https://c.example"] }),
  ]);
  assert.equal(result.totalDistinctSources, 3);
  assert.deepEqual(result.perVisit[1]?.newSources, ["https://c.example"]);
  assert.equal(result.perVisit[1]?.totalSoFar, 3);
});
