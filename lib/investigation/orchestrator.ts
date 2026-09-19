/**
 * Investigation orchestrator.
 *
 * Runs the pipeline and emits typed events as it goes. Each stage is a separate
 * module, so this file is coordination only: what runs, in what order, what
 * happens when a stage fails, and what the user is told.
 *
 * Failure policy, stage by stage:
 * - vision: fatal. Without observations there is nothing to investigate.
 * - geo: degrades. Coordinates alone still support a web search.
 * - research: degrades to a mechanical plan built from real place names.
 * - search: fatal only if every query fails.
 * - evidence: degrades to a sources-only package.
 * - reasoning: degrades to an honest INSUFFICIENT_DATA assessment.
 *
 * Timing. The research stages now use fast Cerebras inference. Vision and the
 * geographic lookup run concurrently because they share no input; everything
 * else is genuinely sequential, since each stage consumes the previous one's
 * output. Model stages carry absolute deadlines (see below).
 */
import { analyzeImage } from "@/lib/ai/vision";
import { planResearch } from "@/lib/ai/research";
import { extractEvidence } from "@/lib/ai/evidence";
import { assessRisk, insufficientDataAssessment } from "@/lib/ai/assessment";
import { finishCerebrasInvestigation } from "@/lib/ai/cerebras";
import { buildGeographicContext, SEARCH_RADIUS_METRES } from "@/lib/geo/context";
import { searchMany } from "@/lib/search/search";
import { toSource } from "@/lib/search/classify";
import { InvestigationError, isInvestigationError } from "./errors";
import { hasInvestigationCredentials } from "@/lib/env";
import {
  MAX_NOTE_LENGTH,
  parseImageDataUrl,
  sanitizeText,
  validateLatitude,
  validateLongitude,
} from "@/lib/utils/validation";
import type { InvestigationEvent } from "@/types/events";
import type {
  EvidencePackage,
  GeographicContext,
  InvestigationInput,
  Location,
  ResearchPlan,
  RiskAssessment,
  Source,
  VisualAnalysis,
} from "@/types/investigation";

export type Emit = (event: InvestigationEvent) => void;

export type InvestigationResult = {
  visual: VisualAnalysis;
  geographic: GeographicContext;
  evidence: EvidencePackage;
  assessment: RiskAssessment;
};

/** Sources kept per investigation. Bounds the evidence prompt and the UI list. */
const MAX_SOURCES = 12;

/**
 * Total budget for one investigation, and the share each model stage may take.
 *
 * Measured worst case was ~8 minutes, well past Vercel's 300s ceiling: the
 * a slow provider can stall, and retries can otherwise occupy too much time.
 * Absolute deadlines bound each
 * model stage so a slow provider degrades that stage rather than truncating the
 * whole run mid-stream.
 *
 * Both Cerebras stages degrade gracefully when their budget runs out — research
 * falls back to a mechanical plan, evidence to a sources-only package — so the
 * user still reaches an assessment.
 */
const TOTAL_BUDGET_MS = 260_000;
const RESEARCH_BUDGET_MS = 70_000;
const EVIDENCE_BUDGET_MS = 90_000;
/** Reserved so the final reasoning stage always gets its turn. */
const REASONING_RESERVE_MS = 45_000;

/**
 * Validates raw input into a trusted InvestigationInput.
 *
 * Server-side and independent of the client's own checks: the client cannot be
 * trusted to have validated anything.
 */
export function validateInput(raw: {
  imageDataUrl?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  note?: unknown;
}): InvestigationInput {
  const imageDataUrl =
    typeof raw.imageDataUrl === "string" ? raw.imageDataUrl : "";
  if (!parseImageDataUrl(imageDataUrl)) {
    throw new InvestigationError(
      "input",
      "A valid JPEG, PNG or WebP image is required.",
    );
  }

  const latitude = Number(raw.latitude);
  const longitude = Number(raw.longitude);
  if (!validateLatitude(latitude).ok || !validateLongitude(longitude).ok) {
    throw new InvestigationError("input", "Valid coordinates are required.");
  }

  return {
    imageDataUrl,
    location: { latitude, longitude },
    note: sanitizeText(
      typeof raw.note === "string" ? raw.note : "",
      MAX_NOTE_LENGTH,
    ),
  };
}

/**
 * Runs a full investigation.
 *
 * Emits events as stages progress and returns the final result. Throws only when
 * a fatal stage fails; a `failed` event is emitted first so a streaming consumer
 * always learns why.
 */
export async function runInvestigation(
  input: InvestigationInput,
  emit: Emit,
  investigationId: string,
): Promise<InvestigationResult> {
  if (!hasInvestigationCredentials()) {
    const message =
      "Hydros is not fully configured on the server. Investigations are unavailable.";
    emit({ type: "failed", data: { stage: "input", message } });
    throw new InvestigationError("input", message);
  }

  emit({ type: "started", data: { investigationId } });

  const startedAt = Date.now();
  const runDeadline = startedAt + TOTAL_BUDGET_MS;
  /** A stage budget, never extending past the run deadline or the reasoning reserve. */
  const stageDeadline = (budgetMs: number): number =>
    Math.min(Date.now() + budgetMs, runDeadline - REASONING_RESERVE_MS);

  try {
    // --- Stages 1 & 2: vision and geography, concurrently ------------------
    // They share no input, and the geographic lookup is the slowest non-model
    // stage, so overlapping them removes ~30s from the total.
    emit({ type: "vision_started" });
    emit({ type: "geo_search_started" });

    const geographyPromise = resolveGeography(input.location, emit);

    let visual: VisualAnalysis;
    try {
      visual = await analyzeImage({
        imageDataUrl: input.imageDataUrl,
        userNote: input.note,
      });
    } catch (error) {
      // Await the in-flight geography so it cannot reject unhandled after the
      // vision failure has already ended the investigation.
      await geographyPromise.catch(() => undefined);
      throw error;
    }
    emit({ type: "vision_completed", data: visual });

    const geographic = await geographyPromise;
    emit({ type: "location_resolved", data: geographic.location });
    emit({ type: "geo_search_completed", data: geographic });

    // --- Stage 3: research plan (degrades internally) ----------------------
    emit({ type: "research_plan_started" });
    const plan: ResearchPlan = await planResearch({
      visual,
      geographic,
      userNote: input.note,
      deadline: stageDeadline(RESEARCH_BUDGET_MS),
      investigationId,
    });
    emit({ type: "research_plan_ready", data: plan });

    // --- Stage 4: web search (fatal only if every query fails) -------------
    emit({ type: "search_started" });
    const { sources, failedQueries } = await runSearches(plan, geographic, emit);
    emit({ type: "search_completed", data: { sourceCount: sources.length } });

    // --- Stage 5: evidence synthesis (degrades internally) -----------------
    emit({ type: "evidence_analysis_started" });
    const evidence = await extractEvidence({
      visual,
      geographic,
      plan,
      sources,
      userNote: input.note,
      failedQueries,
      deadline: stageDeadline(EVIDENCE_BUDGET_MS),
      investigationId,
    });
    emit({ type: "evidence_extracted", data: evidence.evidence });
    emit({ type: "evidence_ready", data: evidence });

    // --- Stage 6: final reasoning (degrades) -------------------------------
    emit({ type: "final_reasoning_started" });
    const assessment = await produceAssessment(evidence);
    emit({ type: "assessment_completed", data: assessment });

    emit({ type: "completed" });

    return { visual, geographic, evidence, assessment };
  } catch (error) {
    const stage = isInvestigationError(error) ? error.stage : "input";
    const message = isInvestigationError(error)
      ? error.message
      : "The investigation could not be completed.";
    emit({ type: "failed", data: { stage, message } });
    throw error;
  } finally {
    finishCerebrasInvestigation(investigationId);
  }
}

/**
 * Geographic context, degrading to bare coordinates.
 *
 * Overpass and Nominatim are free public services and fail regularly; losing
 * them costs search quality, not the investigation.
 */
async function resolveGeography(
  location: Location,
  emit: Emit,
): Promise<GeographicContext> {
  try {
    return await buildGeographicContext(location, (source) => {
      emit({ type: "risk_source_found", data: source });
    });
  } catch (error) {
    if (!isInvestigationError(error)) throw error;
    return {
      location,
      radiusMetres: SEARCH_RADIUS_METRES,
      waterways: [],
      potentialRiskSources: [],
    };
  }
}

/** Runs the planned queries, classifying and emitting each new source. */
async function runSearches(
  plan: ResearchPlan,
  geographic: GeographicContext,
  emit: Emit,
): Promise<{ sources: Source[]; failedQueries: string[] }> {
  const sources: Source[] = [];

  const { failedQueries } = await searchMany(
    plan.queries.map((query) => query.query),
    { countryCode: geographic.location.countryCode },
    (query, results) => {
      emit({ type: "search_started", data: { query } });
      for (const result of results) {
        if (sources.length >= MAX_SOURCES) break;
        const source = toSource(result, plan.entities);
        sources.push(source);
        emit({ type: "source_found", data: source });
      }
    },
  );

  return { sources, failedQueries };
}

/** Final assessment, degrading to an honest INSUFFICIENT_DATA result. */
async function produceAssessment(
  evidence: EvidencePackage,
): Promise<RiskAssessment> {
  try {
    return await assessRisk(evidence);
  } catch (error) {
    if (!isInvestigationError(error)) throw error;
    return insufficientDataAssessment(evidence, error.message);
  }
}
