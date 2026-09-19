/**
 * Self-check for the workspace reducer.
 *
 * The reducer consumes pipeline events directly, so these cases double as a
 * contract test: the awkward real sequences (repeated search_started, a failure
 * mid-run, duplicate sources) must all land the UI in a sane state.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  initialWorkspaceState,
  workspaceReducer,
} from "../components/investigation/useInvestigation.js";
import type { InvestigationEvent } from "../types/events.js";
import type { Source, VisualAnalysis } from "../types/investigation.js";

const visual: VisualAnalysis = {
  isWaterVisible: true,
  summary: "Brown water.",
  observations: [
    { attribute: "color", description: "Brown.", confidence: 0.9, provenance: "model" },
    { attribute: "clarity", description: "Turbid.", confidence: 0.7, provenance: "model" },
  ],
  limitations: ["Not a lab test."],
};

const source = (url: string): Source => ({
  title: "Report",
  url,
  domain: "klhk.go.id",
  snippet: "s",
  sourceType: "government",
  faviconUrl: null,
  relevance: 0.9,
});

const run = (events: InvestigationEvent[]) =>
  events.reduce(workspaceReducer, initialWorkspaceState);

const stageOf = (state: ReturnType<typeof run>, id: string) =>
  state.stages.find((stage) => stage.id === id);

test("a stage becomes active then done, with a detail line", () => {
  const state = run([
    { type: "started", data: { investigationId: "x" } },
    { type: "vision_started" },
  ]);
  assert.equal(stageOf(state, "vision")?.state, "active");

  const done = workspaceReducer(state, {
    type: "vision_completed",
    data: visual,
  });
  assert.equal(stageOf(done, "vision")?.state, "done");
  assert.equal(stageOf(done, "vision")?.detail, "2 visual characteristics recorded");
  assert.equal(done.visual?.observations.length, 2);
});

test("repeated search_started does not reopen a completed stage", () => {
  const state = run([
    { type: "search_started" },
    { type: "source_found", data: source("https://a.example/1") },
    { type: "search_completed", data: { sourceCount: 1 } },
    // A late frame arriving after completion must not undo it.
    { type: "search_started", data: { query: "late query" } },
  ]);
  assert.equal(stageOf(state, "search")?.state, "done");
});

test("the live query is tracked and cleared", () => {
  const searching = run([{ type: "search_started", data: { query: "q1" } }]);
  assert.equal(searching.currentQuery, "q1");
  const finished = workspaceReducer(searching, {
    type: "search_completed",
    data: { sourceCount: 0 },
  });
  assert.equal(finished.currentQuery, undefined);
});

test("duplicate sources and geo features are ignored", () => {
  const state = run([
    { type: "source_found", data: source("https://a.example/1") },
    { type: "source_found", data: source("https://a.example/1") },
    { type: "source_found", data: source("https://b.example/2") },
  ]);
  assert.equal(state.sources.length, 2);
});

test("singular and plural detail lines, and empty-result wording", () => {
  const one = workspaceReducer(initialWorkspaceState, {
    type: "search_completed",
    data: { sourceCount: 1 },
  });
  assert.equal(stageOf(one, "search")?.detail, "1 relevant source");

  const none = workspaceReducer(initialWorkspaceState, {
    type: "search_completed",
    data: { sourceCount: 0 },
  });
  assert.equal(stageOf(none, "search")?.detail, "No relevant sources found");
});

test("failure marks the failing stage and stops the active one", () => {
  const state = run([
    { type: "vision_started" },
    { type: "vision_completed", data: visual },
    { type: "geo_search_started" },
    { type: "failed", data: { stage: "geo", message: "Map service down." } },
  ]);

  assert.equal(stageOf(state, "vision")?.state, "done");
  assert.equal(stageOf(state, "geo")?.state, "failed");
  assert.equal(stageOf(state, "geo")?.detail, "Map service down.");
  assert.equal(stageOf(state, "search")?.state, "pending");
  assert.equal(state.error, "Map service down.");
  assert.equal(state.finished, true);
});

test("an input-stage failure leaves no stage marked failed", () => {
  const state = run([
    { type: "failed", data: { stage: "input", message: "Not configured." } },
  ]);
  assert.ok(state.stages.every((stage) => stage.state === "pending"));
  assert.equal(state.error, "Not configured.");
});

test("completed marks the run finished without an error", () => {
  const state = run([
    {
      type: "assessment_completed",
      data: {
        riskLevel: "MEDIUM",
        confidence: 0.5,
        summary: "s",
        riskFactors: [],
        evidence: [],
        recommendation: "r",
        limitations: ["l"],
      },
    },
    { type: "completed" },
  ]);
  assert.equal(state.finished, true);
  assert.equal(state.error, undefined);
  assert.equal(state.assessment?.riskLevel, "MEDIUM");
  assert.equal(stageOf(state, "reasoning")?.state, "done");
});

test("started resets state so a re-run does not show stale data", () => {
  const dirty = run([
    { type: "source_found", data: source("https://a.example/1") },
    { type: "failed", data: { stage: "search", message: "m" } },
  ]);
  const restarted = workspaceReducer(dirty, {
    type: "started",
    data: { investigationId: "y" },
  });
  assert.equal(restarted.sources.length, 0);
  assert.equal(restarted.error, undefined);
  assert.equal(restarted.finished, false);
});
