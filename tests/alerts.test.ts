/**
 * Alert self-check: each deterministic rule fires exactly when its threshold
 * holds, with an auditable basis — and never on thin or unordered data.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateSiteAlerts } from "../lib/investigation/alerts.js";
import type { AlertInvestigation } from "../lib/investigation/alerts.js";

const visit = (
  patch: Partial<AlertInvestigation> & { id: string },
): AlertInvestigation => ({
  createdAt: "2026-01-01T00:00:00Z",
  riskLevel: null,
  confidence: null,
  hasAuthoritativeSource: false,
  maxPathwayStrength: null,
  ...patch,
});

test("escalation fires on a confident rise, not on noise", () => {
  const alerts = evaluateSiteAlerts("u8vxyzb", [
    visit({ id: "a", createdAt: "2026-01-01T00:00:00Z", riskLevel: "LOW", confidence: 0.6 }),
    visit({ id: "b", createdAt: "2026-02-01T00:00:00Z", riskLevel: "MEDIUM", confidence: 0.6 }),
  ]);
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0]?.severity, "concern");
  assert.deepEqual(alerts[0]?.basis, ["a", "b"]);
  assert.match(alerts[0]?.reason ?? "", /LOW to MEDIUM/);

  const lowConfidence = evaluateSiteAlerts("u8vxyzb", [
    visit({ id: "a", createdAt: "2026-01-01T00:00:00Z", riskLevel: "LOW", confidence: 0.6 }),
    visit({ id: "b", createdAt: "2026-02-01T00:00:00Z", riskLevel: "MEDIUM", confidence: 0.4 }),
  ]);
  assert.equal(lowConfidence.length, 0);
});

test("persistence needs three straight MEDIUM-plus visits", () => {
  const two = evaluateSiteAlerts("u8vxyzb", [
    visit({ id: "a", createdAt: "2026-01-01T00:00:00Z", riskLevel: "MEDIUM", confidence: 0.6 }),
    visit({ id: "b", createdAt: "2026-02-01T00:00:00Z", riskLevel: "HIGH", confidence: 0.6 }),
  ]);
  assert.ok(!two.some((a) => a.severity === "watch" && /consecutive/.test(a.reason)));

  const three = evaluateSiteAlerts("u8vxyzb", [
    visit({ id: "a", createdAt: "2026-01-01T00:00:00Z", riskLevel: "MEDIUM", confidence: 0.6 }),
    visit({ id: "b", createdAt: "2026-02-01T00:00:00Z", riskLevel: "MEDIUM", confidence: 0.6 }),
    visit({ id: "c", createdAt: "2026-03-01T00:00:00Z", riskLevel: "HIGH", confidence: 0.6 }),
  ]);
  assert.ok(three.some((a) => /3 consecutive/.test(a.reason)));
});

test("new authoritative sources and strong pathways fire once", () => {
  const alerts = evaluateSiteAlerts("u8vxyzb", [
    visit({ id: "a", createdAt: "2026-01-01T00:00:00Z", riskLevel: "LOW", confidence: 0.5 }),
    visit({ id: "b", createdAt: "2026-02-01T00:00:00Z", riskLevel: "LOW", confidence: 0.5, hasAuthoritativeSource: true }),
    visit({ id: "c", createdAt: "2026-03-01T00:00:00Z", riskLevel: "MEDIUM", confidence: 0.6, hasAuthoritativeSource: true, maxPathwayStrength: 0.8 }),
  ]);
  assert.ok(alerts.some((a) => /government or scientific/.test(a.reason)));
  assert.ok(alerts.some((a) => /0\.80/.test(a.reason)));
  // Rule 4 fires once even though strength stays high afterwards.
  const extended = evaluateSiteAlerts("u8vxyzb", [
    visit({ id: "a", createdAt: "2026-01-01T00:00:00Z", riskLevel: "LOW", confidence: 0.5 }),
    visit({ id: "c", createdAt: "2026-03-01T00:00:00Z", riskLevel: "MEDIUM", confidence: 0.6, maxPathwayStrength: 0.8 }),
    visit({ id: "d", createdAt: "2026-04-01T00:00:00Z", riskLevel: "MEDIUM", confidence: 0.6, maxPathwayStrength: 0.85 }),
  ]);
  assert.equal(extended.filter((a) => /pathway/.test(a.reason)).length, 1);
});

test("INSUFFICIENT_DATA never orders into an escalation", () => {
  const alerts = evaluateSiteAlerts("u8vxyzb", [
    visit({ id: "a", createdAt: "2026-01-01T00:00:00Z", riskLevel: "INSUFFICIENT_DATA", confidence: 0.1 }),
    visit({ id: "b", createdAt: "2026-02-01T00:00:00Z", riskLevel: "MEDIUM", confidence: 0.6 }),
  ]);
  assert.ok(!alerts.some((a) => /rose from/.test(a.reason)));
});
