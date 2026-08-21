"use client";

import { useEffect, useReducer } from "react";
import {
  emptyStages,
  type AssessmentView,
  type EvidenceView,
  type GeographicSourceView,
  type SourceView,
  type StageId,
  type TimelineStage,
  type VisualObservationView,
} from "./view-model";

/**
 * Workspace state and its reducer.
 *
 * The reducer is shaped around pipeline events, so commit 22 can feed it real
 * server-sent events without changing the UI: only the driver that dispatches
 * actions is replaced.
 */

export type WorkspaceState = {
  stages: TimelineStage[];
  observations: VisualObservationView[];
  geoSources: GeographicSourceView[];
  sources: SourceView[];
  evidence: EvidenceView[];
  assessment: AssessmentView | null;
  finished: boolean;
  error?: string;
};

export type WorkspaceAction =
  | { type: "stage_active"; id: StageId }
  | { type: "stage_done"; id: StageId; detail?: string }
  | { type: "stage_failed"; id: StageId; message: string }
  | { type: "observations"; data: VisualObservationView[] }
  | { type: "geo_sources"; data: GeographicSourceView[] }
  | { type: "source_found"; data: SourceView }
  | { type: "evidence"; data: EvidenceView[] }
  | { type: "assessment"; data: AssessmentView }
  | { type: "failed"; message: string };

export const initialWorkspaceState: WorkspaceState = {
  stages: emptyStages(),
  observations: [],
  geoSources: [],
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
  return stages.map((stage) => (stage.id === id ? { ...stage, ...patch } : stage));
}

export function workspaceReducer(
  state: WorkspaceState,
  action: WorkspaceAction,
): WorkspaceState {
  switch (action.type) {
    case "stage_active":
      return { ...state, stages: setStage(state.stages, action.id, { state: "active" }) };

    case "stage_done":
      return {
        ...state,
        stages: setStage(state.stages, action.id, {
          state: "done",
          detail: action.detail,
        }),
        // The last stage completing ends the investigation.
        finished: action.id === "reasoning" ? true : state.finished,
      };

    case "stage_failed":
      return {
        ...state,
        stages: setStage(state.stages, action.id, {
          state: "failed",
          detail: action.message,
        }),
        error: action.message,
      };

    case "observations":
      return { ...state, observations: action.data };

    case "geo_sources":
      return { ...state, geoSources: action.data };

    case "source_found":
      // Deduplicate by URL: the same page can surface across several queries.
      return state.sources.some((source) => source.url === action.data.url)
        ? state
        : { ...state, sources: [...state.sources, action.data] };

    case "evidence":
      return { ...state, evidence: action.data };

    case "assessment":
      return { ...state, assessment: action.data };

    case "failed":
      return { ...state, error: action.message };

    default:
      return state;
  }
}

export function useWorkspaceState() {
  return useReducer(workspaceReducer, initialWorkspaceState);
}

/** Cancellable sleep used by the mock driver. */
function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new Error("aborted"));
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new Error("aborted"));
    });
  });
}

/**
 * MOCK DRIVER — UI DEVELOPMENT ONLY.
 *
 * Replays a scripted investigation so the workspace can be reviewed before the
 * providers exist. Deleted in commit 22 when the real event stream lands.
 * The workspace labels this state clearly; it is never presented as a result.
 */
export function useMockInvestigation(
  dispatch: (action: WorkspaceAction) => void,
  enabled: boolean,
) {
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    const { signal } = controller;

    (async () => {
      const { MOCK_ASSESSMENT, MOCK_EVIDENCE, MOCK_GEO_SOURCES, MOCK_OBSERVATIONS, MOCK_SOURCES } =
        await import("./mock-data");

      dispatch({ type: "stage_active", id: "vision" });
      await sleep(900, signal);
      dispatch({ type: "observations", data: MOCK_OBSERVATIONS });
      dispatch({
        type: "stage_done",
        id: "vision",
        detail: `${MOCK_OBSERVATIONS.length} visual characteristics recorded`,
      });

      dispatch({ type: "stage_active", id: "geo" });
      await sleep(800, signal);
      dispatch({ type: "geo_sources", data: MOCK_GEO_SOURCES });
      dispatch({
        type: "stage_done",
        id: "geo",
        detail: `${MOCK_GEO_SOURCES.length} nearby features mapped`,
      });

      dispatch({ type: "stage_active", id: "research" });
      await sleep(700, signal);
      dispatch({ type: "stage_done", id: "research", detail: "3 research questions" });

      dispatch({ type: "stage_active", id: "search" });
      for (const source of MOCK_SOURCES) {
        await sleep(600, signal);
        dispatch({ type: "source_found", data: source });
      }
      dispatch({
        type: "stage_done",
        id: "search",
        detail: `${MOCK_SOURCES.length} relevant sources`,
      });

      dispatch({ type: "stage_active", id: "evidence" });
      await sleep(900, signal);
      dispatch({ type: "evidence", data: MOCK_EVIDENCE });
      dispatch({
        type: "stage_done",
        id: "evidence",
        detail: `${MOCK_EVIDENCE.length} claims extracted`,
      });

      dispatch({ type: "stage_active", id: "reasoning" });
      await sleep(1000, signal);
      dispatch({ type: "assessment", data: MOCK_ASSESSMENT });
      dispatch({ type: "stage_done", id: "reasoning" });
    })().catch(() => {
      // Aborted on unmount; nothing to report.
    });

    return () => controller.abort();
  }, [dispatch, enabled]);
}
