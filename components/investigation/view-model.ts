/**
 * View model for the investigation workspace.
 *
 * These shapes mirror what the pipeline will emit. They live here so the UI can
 * be built and reviewed before the providers are wired; commit 8 promotes the
 * canonical versions into `types/` and the workspace switches to real events.
 */

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "INSUFFICIENT_DATA";

export type StageId =
  | "vision"
  | "geo"
  | "research"
  | "search"
  | "evidence"
  | "reasoning";

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

export type VisualObservationView = {
  attribute: string;
  description: string;
  /** How clearly this is visible in the photograph. */
  confidence: number;
};

export type GeographicSourceView = {
  name: string;
  category: string;
  distanceMetres: number;
  /** Present only where an upstream relationship is defensible. */
  relation?: "upstream" | "downstream" | "adjacent" | "unknown";
};

export type SourceView = {
  title: string;
  url: string;
  domain: string;
  snippet: string;
  sourceType:
    | "government"
    | "scientific"
    | "news"
    | "community"
    | "unverified";
  publishedAt?: string;
  relevance: number;
};

export type EvidenceView = {
  claim: string;
  /** Index into the sources array this claim came from. */
  sourceIndex: number;
  uncertainty: string;
};

export type AssessmentView = {
  riskLevel: RiskLevel;
  confidence: number;
  summary: string;
  riskFactors: string[];
  recommendation: string;
  limitations: string[];
};

export const STAGE_ORDER: readonly StageId[] = [
  "vision",
  "geo",
  "research",
  "search",
  "evidence",
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
  reasoning: {
    label: "Assessment",
    activeLabel: "Preparing assessment…",
  },
};

export function emptyStages(): TimelineStage[] {
  return STAGE_ORDER.map((id) => ({
    id,
    label: STAGE_LABELS[id].label,
    activeLabel: STAGE_LABELS[id].activeLabel,
    state: "pending" as StageState,
  }));
}
