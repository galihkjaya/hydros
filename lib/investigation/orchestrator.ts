/**
 * Investigation orchestrator.
 *
 * Runs the pipeline and emits typed events as it goes. Each stage is a separate
 * module, so this file is coordination only: what runs, in what order, what
 * happens when a stage fails, and what the user is told.
 *
 * Two phases with a human in the loop between them:
 * - Phase A: image upload → vision analysis → geographic context, then pause
 *   with `awaiting_confirmation`. The user reviews each observation.
 * - Phase B: resumes from the confirmed set → research → search → evidence →
 *   One Health bridge → assessment.
 *
 * Failure policy, stage by stage:
 * - vision: fatal. Without observations there is nothing to investigate.
 * - geo: degrades. Coordinates alone still support a web search.
 * - research: degrades to a mechanical plan built from real place names.
 * - search: fatal only if every query fails.
 * - evidence: degrades to a sources-only package.
 * - one health: degrades to an empty pathway list.
 * - reasoning: degrades to an honest INSUFFICIENT_DATA assessment.
 *
 * Timing. The research stages use fast Cerebras inference. Vision and the
 * geographic lookup run concurrently because they share no input; everything
 * else is genuinely sequential, since each stage consumes the previous one's
 * output. Model stages carry absolute deadlines (see below).
 */
import { analyzeImage } from "@/lib/ai/vision";
import { planResearch } from "@/lib/ai/research";
import { extractEvidence } from "@/lib/ai/evidence";
import { runOneHealth } from "@/lib/ai/one-health";
import { assessRisk, insufficientDataAssessment } from "@/lib/ai/assessment";
import { finishCerebrasInvestigation } from "@/lib/ai/cerebras";
import { buildGeographicContext, SEARCH_RADIUS_METRES } from "@/lib/geo/context";
import { searchMany } from "@/lib/search/search";
import { toSource } from "@/lib/search/classify";
import { InvestigationError, isInvestigationError } from "./errors";
import { hasInvestigationCredentials } from "@/lib/env";
import { coerceBoolean, coerceEnum, coerceString, coerceStringArray } from "@/lib/ai/coerce";
import { guidedToObservations, hasGuidedResponses } from "./guided";
import {
  MAX_NOTE_LENGTH,
  parseImageDataUrl,
  sanitizeText,
  validateLatitude,
  validateLongitude,
} from "@/lib/utils/validation";
import type { InvestigationEvent } from "@/types/events";
import type {
  ConfirmationInput,
  EvidencePackage,
  GeographicContext,
  GuidedResponses,
  InvestigationInput,
  Location,
  ObservationProvenance,
  ResearchPlan,
  RiskAssessment,
  Source,
  VisualAnalysis,
  VisualAttribute,
  VisualObservation,
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
const ONE_HEALTH_BUDGET_MS = 60_000;
/** Reserved so the final reasoning stage always gets its turn. */
const REASONING_RESERVE_MS = 45_000;

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

/** Phase A input: a photograph, a guided checklist, or both. */
export type PhaseAInput = {
  imageDataUrl?: string;
  location: Location;
  note: string;
  guidedResponses?: GuidedResponses;
};

const GUIDED_FIELDS = [
  "waterColour",
  "waterColourOther",
  "clarity",
  "surface",
  "odour",
  "odourOther",
  "algae",
  "flow",
  "bankVegetation",
  "litter",
  "wildlife",
  "humanActivity",
] as const;

function coerceGuidedResponses(raw: unknown): GuidedResponses | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;
  const record = raw as Record<string, unknown>;
  const responses = {} as GuidedResponses;
  for (const field of GUIDED_FIELDS) {
    const value = record[field];
    responses[field] = typeof value === "string" ? value.slice(0, 300) : "";
  }
  if (!hasGuidedResponses(responses)) return undefined;
  return responses;
}

/**
 * Validates raw input into a trusted PhaseAInput.
 *
 * Server-side and independent of the client's own checks: the client cannot be
 * trusted to have validated anything. A photograph is required unless a
 * guided checklist carries at least one answer.
 */
export function validateInput(raw: {
  imageDataUrl?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  note?: unknown;
  guidedResponses?: unknown;
}): InvestigationInput {
  const rawImage = typeof raw.imageDataUrl === "string" ? raw.imageDataUrl : "";
  const guidedResponses = coerceGuidedResponses(raw.guidedResponses);

  if (rawImage && !parseImageDataUrl(rawImage)) {
    throw new InvestigationError(
      "input",
      "A valid JPEG, PNG or WebP image is required.",
    );
  }
  if (!rawImage && !guidedResponses) {
    throw new InvestigationError(
      "input",
      "A photograph or a completed guided checklist is required.",
    );
  }

  const latitude = Number(raw.latitude);
  const longitude = Number(raw.longitude);
  if (!validateLatitude(latitude).ok || !validateLongitude(longitude).ok) {
    throw new InvestigationError("input", "Valid coordinates are required.");
  }

  return {
    ...(rawImage ? { imageDataUrl: rawImage } : {}),
    location: { latitude, longitude },
    note: sanitizeText(
      typeof raw.note === "string" ? raw.note : "",
      MAX_NOTE_LENGTH,
    ),
    ...(guidedResponses ? { guidedResponses } : {}),
  };
}

// ---------------------------------------------------------------------------
// Phase A — observe, then pause for confirmation
// ---------------------------------------------------------------------------

export type PhaseAResult = {
  visual: VisualAnalysis;
  geographic: GeographicContext;
};

/**
 * Runs Phase A: vision (when a photo exists) and geography concurrently,
 * merges guided observations, then emits `awaiting_confirmation` and stops.
 * Throws only when a fatal stage fails.
 */
export async function runPhaseA(
  input: PhaseAInput,
  emit: Emit,
  investigationId: string,
): Promise<PhaseAResult> {
  if (!hasInvestigationCredentials()) {
    const message =
      "Hydros is not fully configured on the server. Investigations are unavailable.";
    emit({ type: "failed", data: { stage: "input", message } });
    throw new InvestigationError("input", message);
  }

  emit({ type: "started", data: { investigationId } });

  // Wall-clock markers: phase A is vision + geography, so its duration moves
  // with provider latency. These lines are the record when timings vary.
  const phaseAStarted = Date.now();

  try {
    emit({ type: "vision_started" });
    emit({ type: "geo_search_started" });

    const geographyPromise = resolveGeography(input.location, emit);

    let visual: VisualAnalysis;
    if (input.imageDataUrl) {
      try {
        visual = await analyzeImage({
          imageDataUrl: input.imageDataUrl,
          userNote: input.note,
        });
      } catch (error) {
        // Await the in-flight geography so it cannot reject unhandled after
        // the vision failure has already ended the investigation.
        await geographyPromise.catch(() => undefined);
        throw error;
      }
    } else {
      visual = {
        observations: [],
        summary: "Structured visual assessment without a photograph.",
        limitations: [
          "No photograph was supplied; observations come from the guided checklist.",
        ],
        isWaterVisible: true,
      };
    }
    if (input.guidedResponses) {
      visual = {
        ...visual,
        observations: [
          ...visual.observations,
          ...guidedToObservations(input.guidedResponses),
        ],
      };
    }
    emit({ type: "vision_completed", data: visual });

    const geographic = await geographyPromise;
    emit({ type: "location_resolved", data: geographic.location });
    emit({ type: "geo_search_completed", data: geographic });

    emit({ type: "awaiting_confirmation", data: { visual, geographic } });
    console.info(
      `[run] phase A done in ${((Date.now() - phaseAStarted) / 1000).toFixed(1)}s (investigation ${investigationId})`,
    );

    return { visual, geographic };
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

// ---------------------------------------------------------------------------
// Confirmation
// ---------------------------------------------------------------------------

const VISUAL_ATTRIBUTES: readonly VisualAttribute[] = [
  "color",
  "clarity",
  "turbidity",
  "particles",
  "foam",
  "algae",
  "debris",
  "surface",
  "surroundings",
  "other",
];

const PROVENANCES: readonly ObservationProvenance[] = [
  "model",
  "user_confirmed",
  "user_corrected",
  "user_added",
];

/** Re-exported for callers that already import from the orchestrator. */
export type { ConfirmationInput };

/** Validates the confirmed set. Trusts nothing: attributes, lengths, enums. */
export function validateConfirmation(raw: unknown): ConfirmationInput {
  if (typeof raw !== "object" || raw === null) {
    throw new InvestigationError("input", "Invalid confirmation payload.");
  }
  const body = raw as Record<string, unknown>;
  if (!Array.isArray(body.observations) || body.observations.length > 20) {
    throw new InvestigationError("input", "Invalid observation set.");
  }

  const observations: VisualObservation[] = [];
  for (const item of body.observations) {
    if (typeof item !== "object" || item === null) continue;
    const record = item as Record<string, unknown>;
    const description = sanitizeText(
      typeof record.description === "string" ? record.description : "",
      500,
    );
    if (!description) continue;
    const confidence =
      typeof record.confidence === "number" &&
      Number.isFinite(record.confidence)
        ? Math.min(Math.max(record.confidence, 0), 1)
        : 0.5;
    observations.push({
      attribute: coerceEnum(
        record.attribute,
        VISUAL_ATTRIBUTES,
        "other",
      ),
      description,
      confidence,
      provenance: coerceEnum(
        record.provenance,
        PROVENANCES,
        "user_added",
      ),
    });
  }

  const displayName =
    typeof body.displayName === "string" && body.displayName.trim()
      ? sanitizeText(body.displayName, 200)
      : undefined;
  const countryCode =
    typeof body.countryCode === "string" && /^[a-zA-Z]{2}$/.test(body.countryCode)
      ? body.countryCode.toUpperCase()
      : undefined;

  return {
    observations,
    ...(displayName ? { displayName } : {}),
    ...(countryCode ? { countryCode } : {}),
    ...(coerceBoolean(body.notWaterBody, false) ? { notWaterBody: true } : {}),
  };
}

/** Coerces the wire shapes Phase A produced back into trusted documents. */
function coerceVisual(raw: unknown): VisualAnalysis {
  const record =
    typeof raw === "object" && raw !== null
      ? (raw as Record<string, unknown>)
      : {};
  const observations = Array.isArray(record.observations)
    ? validateConfirmation({ observations: record.observations }).observations
    : [];
  return {
    observations,
    summary: coerceString(record.summary, 400),
    limitations: coerceStringArray(record.limitations, 6, 240),
    isWaterVisible: coerceBoolean(record.isWaterVisible, observations.length > 0),
  };
}

const GEO_CATEGORIES = [
  "waterway",
  "industrial",
  "factory",
  "farm",
  "mine",
  "wastewater",
  "water_treatment",
  "landfill",
  "other",
] as const;

const FLOW_RELATIONS = ["upstream", "downstream", "adjacent", "unknown"] as const;

function coerceGeographic(raw: unknown, fallback: Location): GeographicContext {
  const record =
    typeof raw === "object" && raw !== null
      ? (raw as Record<string, unknown>)
      : {};
  const loc =
    typeof record.location === "object" && record.location !== null
      ? (record.location as Record<string, unknown>)
      : {};
  const latitude =
    typeof loc.latitude === "number" && Number.isFinite(loc.latitude)
      ? loc.latitude
      : fallback.latitude;
  const longitude =
    typeof loc.longitude === "number" && Number.isFinite(loc.longitude)
      ? loc.longitude
      : fallback.longitude;
  const location: Location = {
    latitude: validateLatitude(latitude).ok ? latitude : fallback.latitude,
    longitude: validateLongitude(longitude).ok ? longitude : fallback.longitude,
    ...(typeof loc.displayName === "string" && loc.displayName.trim()
      ? { displayName: sanitizeText(loc.displayName, 200) }
      : {}),
    ...(typeof loc.countryCode === "string" && /^[a-zA-Z]{2}$/.test(loc.countryCode)
      ? { countryCode: loc.countryCode.toUpperCase() }
      : {}),
  };

  const rawSources = Array.isArray(record.potentialRiskSources)
    ? record.potentialRiskSources
    : [];
  const potentialRiskSources: GeographicContext["potentialRiskSources"] = [];
  for (const item of rawSources.slice(0, 20)) {
    if (typeof item !== "object" || item === null) continue;
    const source = item as Record<string, unknown>;
    const sourceLat = Number(source.latitude);
    const sourceLon = Number(source.longitude);
    if (!validateLatitude(sourceLat).ok || !validateLongitude(sourceLon).ok) {
      continue;
    }
    potentialRiskSources.push({
      id: coerceString(source.id, 120),
      name: coerceString(source.name, 200),
      category: coerceEnum(source.category, GEO_CATEGORIES, "other"),
      osmTag: coerceString(source.osmTag, 120),
      latitude: sourceLat,
      longitude: sourceLon,
      distanceMetres:
        typeof source.distanceMetres === "number" &&
        Number.isFinite(source.distanceMetres)
          ? Math.max(0, source.distanceMetres)
          : 0,
      relation: coerceEnum(source.relation, FLOW_RELATIONS, "unknown"),
    });
  }

  return {
    location,
    radiusMetres:
      typeof record.radiusMetres === "number" &&
      Number.isFinite(record.radiusMetres)
        ? Math.min(Math.max(record.radiusMetres, 0), 50_000)
        : SEARCH_RADIUS_METRES,
    waterways: coerceStringArray(record.waterways, 12, 200),
    potentialRiskSources,
  };
}

/**
 * Validates the confirm payload into a Phase B input.
 *
 * The server is stateless between phases, so the client sends Phase A context
 * back; everything is re-validated here rather than trusted.
 */
export function validatePhaseBInput(
  raw: unknown,
  fallbackLocation: Location,
): PhaseBInput {
  if (typeof raw !== "object" || raw === null) {
    throw new InvestigationError("input", "Invalid confirmation payload.");
  }
  const body = raw as Record<string, unknown>;
  const confirmation = validateConfirmation(body.confirmation ?? body);

  const rawImage = typeof body.imageDataUrl === "string" ? body.imageDataUrl : "";
  if (rawImage && !parseImageDataUrl(rawImage)) {
    throw new InvestigationError("input", "Invalid image in confirmation.");
  }

  return {
    visual: coerceVisual(body.visual),
    geographic: coerceGeographic(body.geographic, fallbackLocation),
    note: sanitizeText(
      typeof body.note === "string" ? body.note : "",
      MAX_NOTE_LENGTH,
    ),
    ...(rawImage ? { imageDataUrl: rawImage } : {}),
    confirmation,
  };
}

// ---------------------------------------------------------------------------
// Phase B — research, evidence, One Health, assessment
// ---------------------------------------------------------------------------

export type PhaseBInput = {
  visual: VisualAnalysis;
  geographic: GeographicContext;
  note: string;
  imageDataUrl?: string;
  guidedResponses?: GuidedResponses;
  confirmation: ConfirmationInput;
};

/**
 * Runs Phase B from the confirmed observation set.
 *
 * The confirmed set replaces the model's: removed observations never reach
 * research, and provenance travels with each observation into the report.
 */
export async function runPhaseB(
  input: PhaseBInput,
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
  const phaseBStarted = startedAt;
  const runDeadline = startedAt + TOTAL_BUDGET_MS;
  /** A stage budget, never extending past the run deadline or the reasoning reserve. */
  const stageDeadline = (budgetMs: number): number =>
    Math.min(Date.now() + budgetMs, runDeadline - REASONING_RESERVE_MS);

  try {
    const visual: VisualAnalysis = {
      ...input.visual,
      observations: input.confirmation.observations,
    };
    const geographic: GeographicContext = input.confirmation.displayName
      ? {
          ...input.geographic,
          location: {
            ...input.geographic.location,
            displayName: input.confirmation.displayName,
            ...(input.confirmation.countryCode
              ? { countryCode: input.confirmation.countryCode }
              : {}),
          },
        }
      : input.geographic;

    if (input.confirmation.notWaterBody) {
      const empty: EvidencePackage = {
        visual,
        userNote: input.note,
        geographic,
        sources: [],
        evidence: [],
        healthPathways: [],
        unansweredQuestions: [],
        limitations: ["The reporter flagged that this is not a water body."],
      };
      const assessment = insufficientDataAssessment(
        empty,
        "This was flagged as not a water body, so no water investigation was run.",
      );
      emit({ type: "health_pathways_ready", data: [] });
      emit({ type: "final_reasoning_started" });
      emit({ type: "assessment_completed", data: assessment });
      emit({ type: "completed" });
      return { visual, geographic, evidence: empty, assessment };
    }

    // --- Research plan (degrades internally) --------------------------------
    emit({ type: "research_plan_started" });
    const plan: ResearchPlan = await planResearch({
      visual,
      geographic,
      userNote: input.note,
      deadline: stageDeadline(RESEARCH_BUDGET_MS),
      investigationId,
    });
    emit({ type: "research_plan_ready", data: plan });

    // --- Web search (fatal only if every query fails) -----------------------
    emit({ type: "search_started" });
    const { sources, failedQueries } = await runSearches(plan, geographic, emit);
    emit({ type: "search_completed", data: { sourceCount: sources.length } });

    // --- Evidence synthesis (degrades internally) ----------------------------
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

    // --- One Health bridge (degrades to no pathways) ------------------------
    emit({ type: "health_analysis_started" });
    const healthPathways = await runOneHealth({
      pkg: evidence,
      deadline: stageDeadline(ONE_HEALTH_BUDGET_MS),
      investigationId,
    });
    const withPathways: EvidencePackage = { ...evidence, healthPathways };
    emit({ type: "health_pathways_ready", data: healthPathways });

    // --- Final reasoning (degrades) -----------------------------------------
    emit({ type: "final_reasoning_started" });
    const assessment = await produceAssessment(withPathways);
    emit({ type: "assessment_completed", data: assessment });

    emit({ type: "completed" });
    console.info(
      `[run] phase B done in ${((Date.now() - phaseBStarted) / 1000).toFixed(1)}s (investigation ${investigationId})`,
    );

    return { visual, geographic, evidence: withPathways, assessment };
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
 * Runs a full investigation without a confirmation pause.
 *
 * Compatibility wrapper: Phase A straight into Phase B with the model's own
 * observations. Used by tests and any caller that passes `skipConfirmation`.
 */
export async function runInvestigation(
  input: InvestigationInput,
  emit: Emit,
  investigationId: string,
): Promise<InvestigationResult> {
  const phaseA = await runPhaseA(input, forwardSkippingPause(emit), investigationId);
  return runPhaseB(
    {
      visual: phaseA.visual,
      geographic: phaseA.geographic,
      note: input.note,
      ...(input.imageDataUrl ? { imageDataUrl: input.imageDataUrl } : {}),
      ...(input.guidedResponses
        ? { guidedResponses: input.guidedResponses }
        : {}),
      confirmation: { observations: phaseA.visual.observations },
    },
    emit,
    investigationId,
  );
}

/** Forwards every event except the Phase A pause marker. */
function forwardSkippingPause(emit: Emit): Emit {
  return (event) => {
    if (event.type === "awaiting_confirmation") return;
    emit(event);
  };
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
