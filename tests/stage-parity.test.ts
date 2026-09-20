/**
 * Orchestrator/reducer stage-parity self-check.
 *
 * The drift this prevents: the server emits an event type the client does not
 * know (or vice versa) and progress silently freezes. The exhaustiveness
 * record below fails compilation the moment the event union gains a member,
 * so the two sides cannot drift apart again.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  INVESTIGATION_STAGES,
  type InvestigationEvent,
  type InvestigationEventType,
} from "../types/events.js";
import {
  decodeEvent,
  isTerminalEvent,
  stageForEvent,
} from "../lib/investigation/events.js";
import {
  initialWorkspaceState,
  workspaceReducer,
} from "../components/investigation/useInvestigation.js";
import { STAGE_LABELS } from "../components/investigation/view-model.js";

/** Every event type in the union. Adding a member breaks this until listed. */
const ALL_EVENT_TYPES: Record<InvestigationEventType, true> = {
  started: true,
  vision_started: true,
  vision_completed: true,
  location_resolved: true,
  geo_search_started: true,
  risk_source_found: true,
  geo_search_completed: true,
  research_plan_started: true,
  research_plan_ready: true,
  search_started: true,
  source_found: true,
  search_completed: true,
  evidence_analysis_started: true,
  evidence_extracted: true,
  evidence_ready: true,
  health_analysis_started: true,
  health_pathways_ready: true,
  final_reasoning_started: true,
  assessment_completed: true,
  awaiting_confirmation: true,
  completed: true,
  failed: true,
};

/** Minimal well-formed payload per event type. */
function sampleEvent(type: InvestigationEventType): InvestigationEvent {
  const visual = {
    isWaterVisible: true,
    summary: "",
    observations: [],
    limitations: [],
  };
  const geographic = {
    location: { latitude: 0, longitude: 0 },
    radiusMetres: 2000,
    waterways: [],
    potentialRiskSources: [],
  };
  switch (type) {
    case "started":
      return { type, data: { investigationId: "x" } };
    case "vision_completed":
      return { type, data: visual };
    case "location_resolved":
      return { type, data: geographic.location };
    case "risk_source_found":
      return {
        type,
        data: {
          id: "way/1",
          name: "Works",
          category: "factory",
          osmTag: "man_made=works",
          latitude: 0,
          longitude: 0,
          distanceMetres: 100,
          relation: "unknown",
        },
      };
    case "geo_search_completed":
      return { type, data: geographic };
    case "research_plan_ready":
      return { type, data: { questions: [], queries: [], entities: [] } };
    case "search_started":
      return { type, data: { query: "q" } };
    case "source_found":
      return {
        type,
        data: {
          title: "t",
          url: "https://example.com",
          domain: "example.com",
          snippet: "s",
          sourceType: "news",
          faviconUrl: null,
          relevance: 0.5,
        },
      };
    case "search_completed":
      return { type, data: { sourceCount: 1 } };
    case "evidence_extracted":
      return { type, data: [] };
    case "evidence_ready":
      return {
        type,
        data: {
          visual,
          userNote: "",
          geographic,
          sources: [],
          evidence: [],
          healthPathways: [],
          unansweredQuestions: [],
          limitations: [],
        },
      };
    case "health_pathways_ready":
      return { type, data: [] };
    case "assessment_completed":
      return {
        type,
        data: {
          riskLevel: "LOW",
          confidence: 0.5,
          summary: "s",
          riskFactors: [],
          evidence: [],
          recommendation: "r",
          limitations: ["l"],
        },
      };
    case "awaiting_confirmation":
      return { type, data: { visual, geographic } };
    case "failed":
      return { type, data: { stage: "vision", message: "m" } };
    default:
      // Start-only markers with no payload.
      return { type } as InvestigationEvent;
  }
}

test("every stage has a label", () => {
  for (const stage of INVESTIGATION_STAGES) {
    assert.ok(STAGE_LABELS[stage]?.label, `${stage} has a label`);
    assert.ok(STAGE_LABELS[stage]?.activeLabel, `${stage} has an active label`);
  }
});

test("every event type decodes and maps to its stage (or none, for lifecycle)", () => {
  const lifecycle: InvestigationEventType[] = [
    "started",
    "awaiting_confirmation",
    "completed",
    "failed",
  ];
  for (const type of Object.keys(ALL_EVENT_TYPES) as InvestigationEventType[]) {
    const event = sampleEvent(type);
    assert.deepEqual(
      decodeEvent(JSON.stringify(event)),
      event,
      `${type} round-trips through the wire format`,
    );
    const stage = stageForEvent(event);
    if (lifecycle.includes(type)) {
      assert.equal(stage, null, `${type} is lifecycle`);
    } else {
      assert.ok(stage, `${type} belongs to a stage`);
      assert.ok(
        (INVESTIGATION_STAGES as readonly string[]).includes(stage!),
        `${type} maps to a known stage`,
      );
    }
  }
});

test("the reducer accepts every event without throwing", () => {
  let state = initialWorkspaceState;
  for (const type of Object.keys(ALL_EVENT_TYPES) as InvestigationEventType[]) {
    state = workspaceReducer(state, sampleEvent(type));
  }
  // The full sweep ends failed (the `failed` sample is terminal).
  assert.equal(state.finished, true);
});

test("a full run is percentage-monotonic and ends at 100%", () => {
  const sequence: InvestigationEventType[] = [
    "started",
    "vision_started",
    "geo_search_started",
    "vision_completed",
    "geo_search_completed",
    "awaiting_confirmation",
    "started",
    "research_plan_started",
    "research_plan_ready",
    "search_started",
    "search_completed",
    "evidence_analysis_started",
    "evidence_ready",
    "health_analysis_started",
    "health_pathways_ready",
    "final_reasoning_started",
    "assessment_completed",
    "completed",
  ];
  const percent = (state: typeof initialWorkspaceState) => {
    const settled = state.stages.filter(
      (stage) => stage.state === "done" || stage.state === "skipped",
    ).length;
    return Math.round((settled / state.stages.length) * 100);
  };

  let state = initialWorkspaceState;
  let previous = 0;
  for (const type of sequence) {
    state = workspaceReducer(state, sampleEvent(type));
    const current = percent(state);
    assert.ok(
      current >= previous,
      `${type} moved percentage backwards (${previous} -> ${current})`,
    );
    previous = current;
  }
  assert.equal(previous, 100);
});

test("terminal states render even from a bare persisted shape", () => {
  const failed = workspaceReducer(initialWorkspaceState, {
    type: "failed",
    data: { stage: "input", message: "boom" },
  });
  assert.equal(failed.finished, true);
  assert.equal(failed.error, "boom");
});

test("unknown events warn in development instead of silently no-op", () => {
  const warnings: string[] = [];
  const original = console.warn;
  console.warn = (message: string) => {
    warnings.push(String(message));
  };
  try {
    workspaceReducer(
      initialWorkspaceState,
      // A deployment-skewed event the union does not know.
      { type: "future_stage_started" } as unknown as InvestigationEvent,
    );
  } finally {
    console.warn = original;
  }
  // In the test env NODE_ENV is "test", not "production", so the warn fires.
  assert.ok(
    warnings.some((warning) => warning.includes("future_stage_started")),
    "unknown event type warns",
  );
});

test("terminal classification matches the reducer", () => {
  assert.equal(
    isTerminalEvent(sampleEvent("completed")),
    true,
  );
  assert.equal(isTerminalEvent(sampleEvent("failed")), true);
  assert.equal(
    isTerminalEvent(sampleEvent("awaiting_confirmation")),
    true,
  );
  assert.equal(isTerminalEvent(sampleEvent("vision_completed")), false);
});
