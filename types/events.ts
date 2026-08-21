/**
 * Investigation event stream contract.
 *
 * A discriminated union on `type`, so the frontend reducer and the server
 * emitter cannot drift: adding a stage without handling it is a type error.
 *
 * Every event carries only what the UI needs to render. Raw provider payloads
 * and prompts never appear here.
 */
import type {
  Evidence,
  EvidencePackage,
  GeographicContext,
  GeographicSource,
  Location,
  ResearchPlan,
  RiskAssessment,
  Source,
  VisualAnalysis,
} from "./investigation";

/** Pipeline stages, in execution order. Used for progress and failure reporting. */
export const INVESTIGATION_STAGES = [
  "vision",
  "geo",
  "research",
  "search",
  "evidence",
  "reasoning",
] as const;

export type InvestigationStage = (typeof INVESTIGATION_STAGES)[number];

export type InvestigationEvent =
  | { type: "started"; data: { investigationId: string } }
  | { type: "vision_started" }
  | { type: "vision_completed"; data: VisualAnalysis }
  | { type: "location_resolved"; data: Location }
  | { type: "geo_search_started" }
  /** One nearby feature found. Emitted per feature so the list grows live. */
  | { type: "risk_source_found"; data: GeographicSource }
  | { type: "geo_search_completed"; data: GeographicContext }
  | { type: "research_plan_started" }
  | { type: "research_plan_ready"; data: ResearchPlan }
  /** `query` is present once the plan exists; absent for the initial notice. */
  | { type: "search_started"; data?: { query?: string } }
  /** One classified source. Drives the favicon gathering animation. */
  | { type: "source_found"; data: Source }
  | { type: "search_completed"; data: { sourceCount: number } }
  | { type: "evidence_analysis_started" }
  | { type: "evidence_extracted"; data: Evidence[] }
  | { type: "evidence_ready"; data: EvidencePackage }
  | { type: "final_reasoning_started" }
  | { type: "assessment_completed"; data: RiskAssessment }
  | { type: "completed" }
  /** Terminal failure. `message` is always user-safe. */
  | { type: "failed"; data: { stage: InvestigationStage | "input"; message: string } };

export type InvestigationEventType = InvestigationEvent["type"];

/** Narrowing helper for consumers that switch on a subset of events. */
export function isEventOfType<T extends InvestigationEventType>(
  event: InvestigationEvent,
  type: T,
): event is Extract<InvestigationEvent, { type: T }> {
  return event.type === type;
}
