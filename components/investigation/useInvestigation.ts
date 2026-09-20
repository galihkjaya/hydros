"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
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
  GeographicContext,
  GeographicSource,
  HealthPathway,
  Investigation,
  ResearchPlan,
  RiskAssessment,
  Source,
  VisualAnalysis,
} from "@/types/investigation";
import type { InvestigationDraft } from "@/lib/investigation/draft";
import type { ConfirmationInput } from "@/types/investigation";

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
  healthPathways: HealthPathway[];
  assessment: RiskAssessment | null;
  /** Phase A output waiting for human review. Present only mid-confirmation. */
  pendingConfirmation: {
    visual: VisualAnalysis;
    geographic: GeographicContext;
  } | null;
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
  healthPathways: [],
  assessment: null,
  pendingConfirmation: null,
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
    case "health_pathways_ready": {
      const count = event.data.length;
      return count === 0
        ? "No exposure pathways mapped"
        : `${count} exposure pathway${count === 1 ? "" : "s"} mapped`;
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
      // Phase B re-emits `started` on resume: the confirmed observations
      // stand, so vision and geography stay done (marked confirmed) and only
      // the downstream timeline reopens.
      if (state.visual || state.pendingConfirmation) {
        return {
          ...state,
          stages: state.stages.map((stage) =>
            stage.id === "vision" || stage.id === "geo"
              ? {
                  ...stage,
                  state: "done" as const,
                  detail: "Confirmed by you",
                }
              : { ...stage, state: "pending" as const, detail: undefined },
          ),
          finished: false,
          error: undefined,
          currentQuery: undefined,
          pendingConfirmation: null,
        };
      }
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

    case "health_pathways_ready":
      return { ...state, stages, healthPathways: event.data };

    case "awaiting_confirmation":
      return {
        ...state,
        stages,
        visual: event.data.visual,
        geoSources: event.data.geographic.potentialRiskSources,
        pendingConfirmation: {
          visual: event.data.visual,
          geographic: event.data.geographic,
        },
      };

    case "assessment_completed":
      return { ...state, stages, assessment: event.data };

    case "completed":
      // Terminal: anything that never ran was skipped, never silently
      // pending. Skipped stages keep the percentage honest at 100%.
      return {
        ...state,
        stages: state.stages.map((stage) =>
          stage.state === "pending"
            ? { ...stage, state: "skipped" as const }
            : stage,
        ),
        finished: true,
      };

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
      // Unknown event type. Never a silent no-op: warn in development so a
      // server/client drift gets noticed instead of freezing progress.
      if (process.env.NODE_ENV !== "production") {
        console.warn(`[hydros] unhandled investigation event: ${(event as { type: string }).type}`);
      }
      return { ...state, stages };
  }
}

/**
 * Shared SSE subscriptions.
 *
 * One live reader per investigation id, broadcasting to every mounted
 * listener. This is what makes progress survive React StrictMode remounts:
 * the remount re-subscribes to the still-running reader instead of starting a
 * duplicate backend run (double cost) or aborting the live one (frozen 0%
 * with an orphaned run completing invisibly server-side — the exact failure
 * this replaces).
 *
 * Cleanup never aborts the shared run: a cleanup may be a StrictMode
 * remount, and aborting would orphan the backend run while freezing the UI.
 * Runs are bounded — the reader stops at the terminal event.
 */
type StreamHooks = {
  onEvent: (event: InvestigationEvent) => void;
  onError: (message: string) => void;
};

const streamListeners = new Map<string, Set<StreamHooks>>();
const streamRuns = new Map<string, Promise<void>>();

function subscribeStream(
  id: string,
  url: string,
  body: unknown,
  hooks: StreamHooks,
): () => void {
  let set = streamListeners.get(id);
  if (!set) {
    set = new Set();
    streamListeners.set(id, set);
  }
  set.add(hooks);

  if (!streamRuns.has(id)) {
    streamRuns.set(
      id,
      runStream(id, url, body).finally(() => {
        streamRuns.delete(id);
      }),
    );
  }

  return () => {
    const live = streamListeners.get(id);
    if (live) {
      live.delete(hooks);
      if (live.size === 0) streamListeners.delete(id);
    }
  };
}

async function runStream(id: string, url: string, body: unknown): Promise<void> {
  const emit = (event: InvestigationEvent) => {
    for (const hooks of streamListeners.get(id) ?? []) hooks.onEvent(event);
  };
  const fail = (message: string) => {
    for (const hooks of streamListeners.get(id) ?? []) hooks.onError(message);
  };

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    fail("The connection to the server was lost.");
    return;
  }

  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => null);
    fail(
      payload && typeof payload === "object" && "error" in payload
        ? String((payload as { error: unknown }).error)
        : "The investigation could not be started.",
    );
    return;
  }

  if (!response.body) {
    fail("Streaming is not supported by this browser.");
    return;
  }

  try {
    // Never aborted: listeners come and go, the run is bounded by the
    // terminal event.
    await consumeEventStream(response.body, emit, new AbortController().signal);
  } catch {
    fail("The investigation stopped unexpectedly.");
  }
}

/**
 * Maps a persisted investigation onto synthetic events.
 *
 * Poll fallback when the stream drops: lets a dead stream still reach the
 * terminal states instead of freezing. Shapes match the live events exactly,
 * so the reducer cannot tell the difference.
 */
export function persistedToEvents(
  investigation: Investigation,
): InvestigationEvent[] {
  const events: InvestigationEvent[] = [
    { type: "started", data: { investigationId: investigation.id } },
  ];
  if (investigation.visual) {
    events.push({ type: "vision_completed", data: investigation.visual });
  }
  if (investigation.geographic) {
    events.push({
      type: "location_resolved",
      data: investigation.geographic.location,
    });
    events.push({ type: "geo_search_completed", data: investigation.geographic });
  }
  if (investigation.status === "awaiting_confirmation" && investigation.visual && investigation.geographic) {
    events.push({
      type: "awaiting_confirmation",
      data: {
        visual: investigation.visual,
        geographic: investigation.geographic,
      },
    });
    return events;
  }
  for (const source of investigation.sources) {
    events.push({ type: "source_found", data: source });
  }
  events.push({
    type: "search_completed",
    data: { sourceCount: investigation.sources.length },
  });
  if (investigation.evidence.length > 0 || investigation.sources.length > 0) {
    events.push({ type: "evidence_extracted", data: investigation.evidence });
  }
  if (investigation.healthPathways.length > 0) {
    events.push({
      type: "health_pathways_ready",
      data: investigation.healthPathways,
    });
  }
  if (investigation.assessment) {
    events.push({
      type: "assessment_completed",
      data: investigation.assessment,
    });
  }
  if (investigation.status === "completed") {
    events.push({ type: "completed" });
  } else if (investigation.status === "failed") {
    events.push({
      type: "failed",
      data: { stage: "input", message: investigation.error ?? "The investigation could not be completed." },
    });
  }
  return events;
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

/**
 * Two-phase investigation: Phase A streams observations, pauses for human
 * confirmation, then Phase B streams research → assessment into the same
 * reducer state. `confirm` resumes; `skip` resumes with the model's own set.
 */
export function usePhasedInvestigation(
  draft: InvestigationDraft | null | undefined,
  investigationId: string,
) {
  const [state, dispatch] = useReducer(workspaceReducer, initialWorkspaceState);
  const [connectionError, setConnectionError] = useState<string | undefined>();
  const [confirming, setConfirming] = useState(false);
  /** Visible "still working" state when events stall beyond the watchdog. */
  const [stalled, setStalled] = useState(false);
  const phaseARef = useRef<{
    visual: VisualAnalysis;
    geographic: GeographicContext;
  } | null>(null);
  const lastEventAt = useRef<number>(0);
  const finishedRef = useRef(false);
  const pollGeneration = useRef(0);

  function noteEvent() {
    lastEventAt.current = Date.now();
    setStalled(false);
  }

  /** Polls the persisted investigation until it reaches a poll-terminal state. */
  const startPolling = useCallback(() => {
    const generation = ++pollGeneration.current;
    void (async () => {
      for (let attempt = 0; attempt < 75; attempt += 1) {
        // Superseded, unmounted, or already finished via the stream.
        if (generation !== pollGeneration.current || finishedRef.current) return;
        await new Promise((resolve) => setTimeout(resolve, 8000));
        if (generation !== pollGeneration.current || finishedRef.current) return;
        try {
          const response = await fetch(`/api/investigate/${investigationId}`);
          if (!response.ok) continue;
          const investigation = (await response.json()) as Investigation;
          for (const event of persistedToEvents(investigation)) {
            noteEvent();
            dispatch(event);
          }
          if (
            investigation.status === "completed" ||
            investigation.status === "failed" ||
            investigation.status === "awaiting_confirmation"
          ) {
            return;
          }
        } catch {
          // Polling is best-effort; the next round retries.
        }
      }
    })();
  }, [investigationId]);

  useEffect(() => {
    finishedRef.current = state.finished;
  }, [state.finished]);

  // Watchdog: silence beyond 45s is "still working", never a frozen 0%.
  useEffect(() => {
    const timer = setInterval(() => {
      if (
        !finishedRef.current &&
        Date.now() - lastEventAt.current > 45_000
      ) {
        setStalled(true);
      }
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!draft) return;
    pollGeneration.current += 1;
    lastEventAt.current = Date.now();

    const unsubscribe = subscribeStream(
      investigationId,
      "/api/investigate",
      {
        ...(draft.imageDataUrl ? { imageDataUrl: draft.imageDataUrl } : {}),
        latitude: draft.latitude,
        longitude: draft.longitude,
        note: draft.note,
        ...(draft.guidedResponses
          ? { guidedResponses: draft.guidedResponses }
          : {}),
        investigationId,
      },
      {
        onEvent: (event) => {
          noteEvent();
          if (event.type === "awaiting_confirmation") {
            phaseARef.current = event.data;
          }
          if (isTerminalEvent(event)) finishedRef.current = true;
          dispatch(event);
        },
        onError: (message) => {
          setConnectionError(message);
          // The stream died: fall back to polling so terminal states still
          // render instead of freezing.
          startPolling();
        },
      },
    );

    return unsubscribe;
  }, [draft, investigationId, startPolling]);

  async function resume(confirmation: ConfirmationInput) {
    const phaseA = phaseARef.current;
    if (!phaseA || confirming) return;
    setConfirming(true);
    setConnectionError(undefined);
    pollGeneration.current += 1;

    const onStreamEvent = (event: InvestigationEvent) => {
      noteEvent();
      if (isTerminalEvent(event)) finishedRef.current = true;
      dispatch(event);
    };

    try {
      const response = await fetch(`/api/investigate/${investigationId}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visual: phaseA.visual,
          geographic: phaseA.geographic,
          note: draft && typeof draft === "object" ? draft.note : "",
          ...(draft?.imageDataUrl
            ? { imageDataUrl: draft.imageDataUrl }
            : {}),
          confirmation,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        const message =
          payload && typeof payload === "object" && "error" in payload
            ? String((payload as { error: unknown }).error)
            : "The investigation could not continue.";
        setConnectionError(message);
        setConfirming(false);
        startPolling();
        return;
      }

      if (!response.body) {
        setConnectionError("Streaming is not supported by this browser.");
        setConfirming(false);
        return;
      }

      await consumeEventStream(response.body, onStreamEvent, new AbortController().signal);
    } catch (error) {
      if (error instanceof Error && error.name === "TypeError") {
        setConnectionError("The connection to the server was lost.");
      } else {
        setConnectionError("The investigation stopped unexpectedly.");
      }
      startPolling();
    } finally {
      setConfirming(false);
    }
  }

  return { state, connectionError, confirming, resume, stalled };
}
