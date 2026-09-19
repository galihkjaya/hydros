/**
 * Presentation helpers for the investigation workspace.
 *
 * The data shapes now come from `types/investigation.ts`; this module only
 * holds display concerns — stage labels and the timeline row state.
 */
import type { InvestigationStage } from "@/types/events";
import type { RiskLevel, VisualAttribute } from "@/types/investigation";

export type StageId = InvestigationStage;

export type StageState = "pending" | "active" | "done" | "failed";

export type TimelineStage = {
  id: StageId;
  label: string;
  /** Shown while the stage is active. */
  activeLabel: string;
  state: StageState;
  /** One-line result once the stage completes. */
  detail?: string;
};

export const STAGE_ORDER: readonly StageId[] = [
  "vision",
  "geo",
  "research",
  "search",
  "evidence",
  "health",
  "reasoning",
];

export const STAGE_LABELS: Record<
  StageId,
  { label: string; activeLabel: string }
> = {
  vision: {
    label: "Visual analysis",
    activeLabel: "Identifying visual characteristics…",
  },
  geo: {
    label: "Geographic context",
    activeLabel: "Checking the surrounding area…",
  },
  research: {
    label: "Research plan",
    activeLabel: "Planning what to investigate…",
  },
  search: { label: "Web search", activeLabel: "Searching the web…" },
  evidence: {
    label: "Evidence synthesis",
    activeLabel: "Analysing evidence…",
  },
  health: {
    label: "One Health pathways",
    activeLabel: "Mapping exposure pathways…",
  },
  reasoning: { label: "Assessment", activeLabel: "Preparing assessment…" },
};

export function emptyStages(): TimelineStage[] {
  return STAGE_ORDER.map((id) => ({
    id,
    label: STAGE_LABELS[id].label,
    activeLabel: STAGE_LABELS[id].activeLabel,
    state: "pending" as StageState,
  }));
}

/** Human labels for the vision model's attribute enum. */
export const ATTRIBUTE_LABELS: Record<VisualAttribute, string> = {
  color: "Colour",
  clarity: "Clarity",
  turbidity: "Turbidity",
  particles: "Particles",
  foam: "Foam",
  algae: "Algae",
  debris: "Debris",
  surface: "Surface",
  surroundings: "Surroundings",
  other: "Other",
};

export const RISK_LEVEL_LABELS: Record<RiskLevel, string> = {
  LOW: "Low concern",
  MEDIUM: "Moderate concern",
  HIGH: "High concern",
  INSUFFICIENT_DATA: "Insufficient data",
};
