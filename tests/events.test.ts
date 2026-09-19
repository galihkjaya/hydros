/**
 * Self-check for the event wire format and stage mapping.
 *
 * The round-trip matters because the stream is the only channel between the
 * pipeline and the UI: a frame that cannot be decoded is progress the user never
 * sees.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  completesStage,
  decodeEvent,
  encodeEvent,
  encodeKeepAlive,
  isInvestigationStage,
  isTerminalEvent,
  stageForEvent,
} from "../lib/investigation/events.js";
import { INVESTIGATION_STAGES } from "../types/events.js";
import type { InvestigationEvent } from "../types/events.js";

test("frames are well-formed SSE and round-trip", () => {
  const event: InvestigationEvent = {
    type: "source_found",
    data: {
      title: "Report",
      url: "https://klhk.go.id/a",
      domain: "klhk.go.id",
      snippet: "s",
      sourceType: "government",
      faviconUrl: null,
      relevance: 0.9,
    },
  };

  const frame = encodeEvent(event);
  assert.match(frame, /^event: source_found\n/);
  assert.ok(frame.endsWith("\n\n"));

  const payload = frame.split("\ndata: ")[1]?.trimEnd() ?? "";
  assert.deepEqual(decodeEvent(payload), event);
});

test("multi-line text cannot break a frame", () => {
  const event: InvestigationEvent = {
    type: "failed",
    data: { stage: "vision", message: "line one\nline two\n\ndata: fake" },
  };
  const frame = encodeEvent(event);
  // Exactly one data line, and the frame terminates only at the end.
  assert.equal(frame.split("\n").filter((line) => line.startsWith("data: ")).length, 1);
  assert.equal(frame.indexOf("\n\n"), frame.length - 2);
});

test("malformed and foreign payloads decode to null", () => {
  assert.equal(decodeEvent("not json"), null);
  assert.equal(decodeEvent('{"type":"unknown_event"}'), null);
  assert.equal(decodeEvent('{"nope":1}'), null);
  assert.equal(decodeEvent("[1,2]"), null);
  assert.equal(decodeEvent(""), null);
  // Truncated frame.
  assert.equal(decodeEvent('{"type":"source_found","data":{'), null);
});

test("keep-alive is a comment frame, not an event", () => {
  const frame = encodeKeepAlive();
  assert.ok(frame.startsWith(":"));
  assert.ok(frame.endsWith("\n\n"));
});

test("terminal events are identified", () => {
  assert.equal(isTerminalEvent({ type: "completed" }), true);
  assert.equal(
    isTerminalEvent({ type: "failed", data: { stage: "geo", message: "m" } }),
    true,
  );
  assert.equal(isTerminalEvent({ type: "vision_started" }), false);
});

test("every stage has at least one start and one completion event", () => {
  const starts = new Map<string, boolean>();
  const completions = new Map<string, boolean>();

  const samples: InvestigationEvent[] = [
    { type: "vision_started" },
    { type: "vision_completed", data: { isWaterVisible: true, summary: "", observations: [], limitations: [] } },
    { type: "geo_search_started" },
    { type: "geo_search_completed", data: { location: { latitude: 0, longitude: 0 }, radiusMetres: 2000, waterways: [], potentialRiskSources: [] } },
    { type: "research_plan_started" },
    { type: "research_plan_ready", data: { questions: [], queries: [], entities: [] } },
    { type: "search_started" },
    { type: "search_completed", data: { sourceCount: 0 } },
    { type: "evidence_analysis_started" },
    { type: "evidence_ready", data: { visual: { isWaterVisible: true, summary: "", observations: [], limitations: [] }, userNote: "", geographic: { location: { latitude: 0, longitude: 0 }, radiusMetres: 2000, waterways: [], potentialRiskSources: [] }, sources: [], evidence: [], healthPathways: [], unansweredQuestions: [], limitations: [] } },
    { type: "health_analysis_started" },
    { type: "health_pathways_ready", data: [] },
    { type: "final_reasoning_started" },
    { type: "assessment_completed", data: { riskLevel: "INSUFFICIENT_DATA", confidence: 0.1, summary: "", riskFactors: [], evidence: [], recommendation: "", limitations: [] } },
  ];

  for (const event of samples) {
    const stage = stageForEvent(event);
    assert.ok(stage, `no stage for ${event.type}`);
    if (completesStage(event)) completions.set(stage, true);
    else starts.set(stage, true);
  }

  for (const stage of INVESTIGATION_STAGES) {
    assert.ok(starts.get(stage), `${stage} has no start event`);
    assert.ok(completions.get(stage), `${stage} has no completion event`);
  }
});

test("lifecycle events belong to no stage", () => {
  assert.equal(stageForEvent({ type: "started", data: { investigationId: "x" } }), null);
  assert.equal(
    stageForEvent({
      type: "awaiting_confirmation",
      data: {
        visual: { isWaterVisible: true, summary: "", observations: [], limitations: [] },
        geographic: { location: { latitude: 0, longitude: 0 }, radiusMetres: 2000, waterways: [], potentialRiskSources: [] },
      },
    }),
    null,
  );
  assert.equal(stageForEvent({ type: "completed" }), null);
  assert.equal(
    stageForEvent({ type: "failed", data: { stage: "vision", message: "m" } }),
    null,
  );
});

test("stage ids from the wire are validated", () => {
  assert.equal(isInvestigationStage("vision"), true);
  assert.equal(isInvestigationStage("reasoning"), true);
  assert.equal(isInvestigationStage("input"), false);
  assert.equal(isInvestigationStage(null), false);
});
