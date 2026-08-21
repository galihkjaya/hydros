"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import { emptyStages, type StageId, type TimelineStage } from "./view-model";
import {
  completesStage,
  decodeEvent,
  isTerminalEvent,
  stageForEvent,
} from "@/lib/investigation/events";
import type { InvestigationEvent } from "@/types/events";
import type {
  Evidence,
  GeographicSource,
  ResearchPlan,
  RiskAssessment,
  Source,
  VisualAnalysis,
} from "@/types/investigation";
import type { InvestigationDraft } from "@/lib/investigation/draft";

/**
 * Workspace state, driven entirely by real pipeline events.
 *
 * The reducer takes `InvestigationEvent` directly, so there is no translation
 * layer that could drift from the server's contract, and no timers inventing
 * progress the backend has not made.
 */

export type WorkspaceState = {
  stages: TimelineStage[];
  visual: VisualAnalysis | null;
  geoSources: GeographicSource[];
  plan: ResearchPlan | null;
  sources: Source[];
  evidence: Evidence[];
  assessment: RiskAssessment | null;
  /** Live query text, shown while the search stage runs. */
  currentQuery?: string;
  finished: boolean;
  /** User-safe failure message. */
  error?: string;
};

export const initialWorkspaceState: WorkspaceState = {
  stages: emptyStages(),
  visual: null,
  geoSources: [],
  plan: null,
  sources: [],
  evidence: [],
  assessment: null,
  finished: false,
};

function setStage(
  stages: TimelineStage[],
  id: StageId,
  patch: Partial<TimelineStage>,
): TimelineStage[] {
  return stages.map((stage) =>
    stage.id === id ? { ...stage, ...patch } : stage,
  );
}

/** Marks every stage still pending as skipped-by-failure. */
function haltPendingStages(
  stages: TimelineStage[],
  failedStage: StageId | null,
  message: string,
): TimelineStage[] {
  return stages.map((stage) => {
    if (stage.id === failedStage) {
      return { ...stage, state: "failed", detail: message };
    }
    // An active stage that is not the failing one simply stops.
    if (stage.state === "active") return { ...stage, state: "pending" };
    return stage;
  });
}

/** One-line summary shown under a completed stage. */
function stageDetail(event: InvestigationEvent): string | undefined {
  switch (event.type) {
    case "vision_completed": {
      const count = event.data.observations.length;
      return `${count} visual characteristic${count === 1 ? "" : "s"} recorded`;
    }
    case "geo_search_completed": {
      const count = event.data.potentialRiskSources.length;
      return count === 0
        ? "No mapped features of interest nearby"
        : `${count} nearby feature${count === 1 ? "" : "s"} mapped`;
    }
    case "research_plan_ready": {
      const count = event.data.queries.length;
      return `${count} search${count === 1 ? "" : "es"} planned`;
    }
    case "search_completed": {
      const count = event.data.sourceCount;
      return count === 0
        ? "No relevant sources found"
        : `${count} relevant source${count === 1 ? "" : "s"}`;
    }
    case "evidence_ready": {
      const count = event.data.evidence.length;
      return count === 0
        ? "No sourced claims could be extracted"
        : `${count} sourced claim${count === 1 ? "" : "s"}`;
    }
    case "assessment_completed":
      return undefined;
    default:
      return undefined;
  }
}

export function workspaceReducer(
  state: WorkspaceState,
  event: InvestigationEvent,
): WorkspaceState {
  // Every event first updates the timeline for its stage.
  const stage = stageForEvent(event);
  let stages = state.stages;
  if (stage) {
    stages = completesStage(event)
      ? setStage(stages, stage, { state: "done", detail: stageDetail(event) })
      : // Do not reopen a finished stage: `search_started` arrives repeatedly,
        // once per query.
        stages.some((entry) => entry.id === stage && entry.state === "done")
        ? stages
        : setStage(stages, stage, { state: "active" });
  }

  switch (event.type) {
    case "started":
      return { ...initialWorkspaceState, stages };

    case "vision_completed":
      return { ...state, stages, visual: event.data };

    case "risk_source_found":
      return state.geoSources.some((source) => source.id === event.data.id)
        ? { ...state, stages }
        : { ...state, stages, geoSources: [...state.geoSources, event.data] };

    case "geo_search_completed":
      // Authoritative list, in ranked order.
      return { ...state, stages, geoSources: event.data.potentialRiskSources };

    case "research_plan_ready":
      return { ...state, stages, plan: event.data };

    case "search_started":
      return { ...state, stages, currentQuery: event.data?.query };

    case "source_found":
      return state.sources.some((source) => source.url === event.data.url)
        ? { ...state, stages }
        : { ...state, stages, sources: [...state.sources, event.data] };

    case "search_completed":
      return { ...state, stages, currentQuery: undefined };

    case "evidence_extracted":
      return { ...state, stages, evidence: event.data };

    case "evidence_ready":
      return {
        ...state,
        stages,
        evidence: event.data.evidence,
        // The package carries the full ranked source list.
        sources: event.data.sources,
      };

    case "assessment_completed":
      return { ...state, stages, assessment: event.data };

    case "completed":
      return { ...state, stages, finished: true };

    case "failed": {
      const failedStage = event.data.stage === "input" ? null : event.data.stage;
      return {
        ...state,
        stages: haltPendingStages(state.stages, failedStage, event.data.message),
        error: event.data.message,
        finished: true,
      };
    }

    default:
      return { ...state, stages };
  }
}

/**
 * Runs an investigation and streams its events into the reducer.
 *
 * SSE over `fetch` rather than `EventSource`, because the request needs to be a
 * POST carrying the image. Parsing the frames by hand is a few lines and avoids
 * a dependency.
 */
export function useInvestigationStream(draft: InvestigationDraft | null | undefined, investigationId: string) {
  const [state, dispatch] = useReducer(workspaceReducer, initialWorkspaceState);
  const [connectionError, setConnectionError] = useState<string | undefined>();
  // Guards against React's development double-effect starting two runs.
  const startedRef = useRef(false);

  useEffect(() => {
    if (!draft || startedRef.current) return;
    startedRef.current = true;

    const controller = new AbortController();

    void (async () => {
      try {
        const response = await fetch("/api/investigate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageDataUrl: draft.imageDataUrl,
            latitude: draft.latitude,
            longitude: draft.longitude,
            note: draft.note,
            investigationId,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          const message =
            payload && typeof payload === "object" && "error" in payload
              ? String((payload as { error: unknown }).error)
              : "The investigation could not be started.";
          setConnectionError(message);
          return;
        }

        if (!response.body) {
          setConnectionError("Streaming is not supported by this browser.");
          return;
        }

        await consumeEventStream(response.body, dispatch, controller.signal);
      } catch (error) {
        if (controller.signal.aborted) return;
        setConnectionError(
          error instanceof Error && error.name === "TypeError"
            ? "The connection to the server was lost."
            : "The investigation stopped unexpectedly.",
        );
      }
    })();

    return () => controller.abort();
  }, [draft, investigationId]);

  return { state, connectionError };
}

/**
 * Reads an SSE body and dispatches each decoded event.
 *
 * Frames are separated by a blank line; a partial frame stays in the buffer
 * until the rest arrives. Undecodable frames are skipped rather than fatal.
 */
async function consumeEventStream(
  body: ReadableStream<Uint8Array>,
  dispatch: (event: InvestigationEvent) => void,
  signal: AbortSignal,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (!signal.aborted) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    let separator = buffer.indexOf("\n\n");
    while (separator !== -1) {
      const frame = buffer.slice(0, separator);
      buffer = buffer.slice(separator + 2);
      const event = readFrame(frame);
      if (event) {
        dispatch(event);
        if (isTerminalEvent(event)) return;
      }
      separator = buffer.indexOf("\n\n");
    }
  }
}

/** Extracts the event from one SSE frame, ignoring comments and unknown fields. */
function readFrame(frame: string): InvestigationEvent | null {
  const dataLines: string[] = [];
  for (const line of frame.split("\n")) {
    // Comment frame (keep-alive).
    if (line.startsWith(":")) continue;
    if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
  }
  if (dataLines.length === 0) return null;
  return decodeEvent(dataLines.join("\n"));
}
