/**
 * Investigation event helpers.
 *
 * The event union lives in `types/events.ts`; this module holds the runtime
 * pieces both sides of the stream need: SSE encoding, safe decoding, and the
 * mapping from an event to the stage it belongs to.
 *
 * Decoding is deliberately defensive. A stream can deliver a truncated frame or
 * a message from a mismatched deployment, and a malformed event must be dropped
 * rather than crash the workspace.
 */
import {
  INVESTIGATION_STAGES,
  type InvestigationEvent,
  type InvestigationEventType,
  type InvestigationStage,
} from "@/types/events";

/** Events that mean the stream is over, either way. */
const TERMINAL_TYPES = new Set<InvestigationEventType>([
  "awaiting_confirmation",
  "completed",
  "failed",
]);

export function isTerminalEvent(event: InvestigationEvent): boolean {
  return TERMINAL_TYPES.has(event.type);
}

/**
 * Which stage an event belongs to.
 *
 * Used to drive the timeline: an event marks its stage active, and the stage's
 * completion event marks it done.
 */
const EVENT_STAGE: Partial<Record<InvestigationEventType, InvestigationStage>> = {
  vision_started: "vision",
  vision_completed: "vision",
  geo_search_started: "geo",
  risk_source_found: "geo",
  location_resolved: "geo",
  geo_search_completed: "geo",
  research_plan_started: "research",
  research_plan_ready: "research",
  search_started: "search",
  source_found: "search",
  search_completed: "search",
  evidence_analysis_started: "evidence",
  evidence_extracted: "evidence",
  evidence_ready: "evidence",
  health_analysis_started: "health",
  health_pathways_ready: "health",
  final_reasoning_started: "reasoning",
  assessment_completed: "reasoning",
};

export function stageForEvent(
  event: InvestigationEvent,
): InvestigationStage | null {
  return EVENT_STAGE[event.type] ?? null;
}

/** Events that mark their stage as finished. */
const STAGE_COMPLETION_TYPES = new Set<InvestigationEventType>([
  "vision_completed",
  "geo_search_completed",
  "research_plan_ready",
  "search_completed",
  "evidence_ready",
  "health_pathways_ready",
  "assessment_completed",
]);

export function completesStage(event: InvestigationEvent): boolean {
  return STAGE_COMPLETION_TYPES.has(event.type);
}

// ---------------------------------------------------------------------------
// SSE wire format
// ---------------------------------------------------------------------------

/**
 * Encodes one event as an SSE frame.
 *
 * The payload is JSON on a single `data:` line. JSON.stringify escapes newlines,
 * so a multi-line summary cannot break the frame.
 */
export function encodeEvent(event: InvestigationEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}

/** A comment frame. Keeps proxies from closing an idle connection. */
export function encodeKeepAlive(): string {
  return ": keep-alive\n\n";
}

const KNOWN_EVENT_TYPES = new Set<string>([
  "started",
  "vision_started",
  "vision_completed",
  "location_resolved",
  "geo_search_started",
  "risk_source_found",
  "geo_search_completed",
  "research_plan_started",
  "research_plan_ready",
  "search_started",
  "source_found",
  "search_completed",
  "evidence_analysis_started",
  "evidence_extracted",
  "evidence_ready",
  "health_analysis_started",
  "health_pathways_ready",
  "final_reasoning_started",
  "assessment_completed",
  "awaiting_confirmation",
  "completed",
  "failed",
]);

/**
 * Decodes an SSE data payload into an event.
 *
 * Returns null for anything unparseable or unrecognised, so a bad frame is
 * skipped instead of breaking the run.
 */
export function decodeEvent(data: string): InvestigationEvent | null {
  try {
    const parsed: unknown = JSON.parse(data);
    if (typeof parsed !== "object" || parsed === null) return null;
    const type = (parsed as { type?: unknown }).type;
    if (typeof type !== "string" || !KNOWN_EVENT_TYPES.has(type)) return null;
    return parsed as InvestigationEvent;
  } catch {
    return null;
  }
}

/** Guard for a stage id arriving from the wire. */
export function isInvestigationStage(
  value: unknown,
): value is InvestigationStage {
  return (
    typeof value === "string" &&
    (INVESTIGATION_STAGES as readonly string[]).includes(value)
  );
}
