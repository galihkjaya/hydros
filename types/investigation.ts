/**
 * Core investigation contracts.
 *
 * The three-layer model is encoded in the type system, not just the UI:
 * `VisualObservation` is what the image shows, `Evidence` is what a source
 * states, and only `RiskAssessment` may contain inference. Nothing collapses
 * them, so a stage cannot accidentally promote an observation to a conclusion.
 */

/** WGS84 coordinate pair plus optional resolved place context. */
export type Location = {
  latitude: number;
  longitude: number;
  /** Human-readable place name, when reverse geocoding succeeded. */
  displayName?: string;
  /** ISO 3166-1 alpha-2, used to bias search results regionally. */
  countryCode?: string;
};

export type InvestigationInput = {
  /** Data URL or https URL for the image. Absent in guided mode without a photo. */
  imageDataUrl?: string;
  location: Location;
  /** Optional user observation or question. Untrusted text. */
  note: string;
  /** Guided checklist answers, when the run started in guided mode. */
  guidedResponses?: GuidedResponses;
};

// ---------------------------------------------------------------------------
// Layer 1 — OBSERVATION: what is visible in the photograph
// ---------------------------------------------------------------------------

/** Visual attributes the vision model is allowed to report on. */
export type VisualAttribute =
  | "color"
  | "clarity"
  | "turbidity"
  | "particles"
  | "foam"
  | "algae"
  | "debris"
  | "surface"
  | "surroundings"
  | "other";

export type VisualObservation = {
  attribute: VisualAttribute;
  /** Strictly descriptive. Must not assert safety or contamination. */
  description: string;
  /** How clearly this is visible in the image, 0–1. */
  confidence: number;
  /**
   * Who stands behind this observation. `model` until a person reviews it;
   * the confirmation step upgrades it. Visible in the final report.
   */
  provenance: ObservationProvenance;
};

/** Human-in-the-loop provenance for a visual observation. */
export type ObservationProvenance =
  | "model"
  | "user_confirmed"
  | "user_corrected"
  | "user_added";

export type VisualAnalysis = {
  observations: VisualObservation[];
  /** One-sentence description of the scene, still purely descriptive. */
  summary: string;
  /** What the photograph cannot show (framing, lighting, scale, chemistry). */
  limitations: string[];
  /** True when the image does not depict a water source at all. */
  isWaterVisible: boolean;
};

// ---------------------------------------------------------------------------
// Geographic context
// ---------------------------------------------------------------------------

export type GeographicCategory =
  | "waterway"
  | "industrial"
  | "factory"
  | "farm"
  | "mine"
  | "wastewater"
  | "water_treatment"
  | "landfill"
  | "other";

/**
 * Hydrological relationship to the sampling point. `upstream` is only set where
 * waterway geometry makes it defensible; otherwise `unknown`.
 */
export type FlowRelation = "upstream" | "downstream" | "adjacent" | "unknown";

export type GeographicSource = {
  /** OSM element id, e.g. "way/123456". Stable enough to deduplicate on. */
  id: string;
  name: string;
  category: GeographicCategory;
  /** Raw OSM tag that produced the category, kept for traceability. */
  osmTag: string;
  latitude: number;
  longitude: number;
  distanceMetres: number;
  relation: FlowRelation;
};

export type GeographicContext = {
  location: Location;
  /** Radius actually queried, so the UI can say what was covered. */
  radiusMetres: number;
  /** Named waterways at or near the point, used in search queries. */
  waterways: string[];
  /** Potential risk sources — proximity only, never causation. */
  potentialRiskSources: GeographicSource[];
};

// ---------------------------------------------------------------------------
// Research and search
// ---------------------------------------------------------------------------

export type SearchQuery = {
  query: string;
  /** Why this query was chosen — surfaced for transparency. */
  rationale: string;
};

export type ResearchPlan = {
  /** Questions the research should try to answer. */
  questions: string[];
  queries: SearchQuery[];
  /** Named places, waterways, companies or facilities worth investigating. */
  entities: string[];
};

/** Reliability tiers, most authoritative first. */
export type SourceType =
  | "government"
  | "scientific"
  | "news"
  | "community"
  | "unverified";

/** A normalized search hit, before any relevance judgement. */
export type SearchResult = {
  title: string;
  url: string;
  domain: string;
  snippet: string;
  /** ISO date or partial ("2024-08"), when the provider reports one. */
  publishedAt?: string;
};

/** A search result that has been classified and scored. */
export type Source = SearchResult & {
  sourceType: SourceType;
  faviconUrl: string | null;
  /** Relevance to this specific investigation, 0–1. */
  relevance: number;
};

// ---------------------------------------------------------------------------
// Layer 2 — EVIDENCE: what an external source states
// ---------------------------------------------------------------------------

export type Evidence = {
  /** A factual claim as stated by the source. Not a conclusion. */
  claim: string;
  /** URL of the source this claim came from; must match a Source in the package. */
  sourceUrl: string;
  /** What this claim does not establish. */
  uncertainty: string;
  /** Relevance of the claim to this investigation, 0–1. */
  relevance: number;
};

/**
 * Compact bundle handed to the final reasoning model.
 *
 * Deliberately small: summarized claims and metadata only, never raw page text.
 * Keeps the final request inside token limits and inside free-tier budgets.
 */
export type EvidencePackage = {
  visual: VisualAnalysis;
  /** Untrusted user text, passed through as data. */
  userNote: string;
  geographic: GeographicContext;
  sources: Source[];
  evidence: Evidence[];
  /** One Health exposure pathways. A bridge, not an inference. */
  healthPathways: HealthPathway[];
  /** Research questions that returned nothing useful. */
  unansweredQuestions: string[];
  /** Package-level caveats, e.g. no local monitoring data found. */
  limitations: string[];
};

// ---------------------------------------------------------------------------
// Layer 2.5 — ONE HEALTH BRIDGE: observation/evidence → potential pathway
// ---------------------------------------------------------------------------

/** Which One Health domain a pathway affects. */
export type HealthDomain = "human" | "animal" | "ecosystem";

/** How exposure could plausibly occur. Descriptive, never predictive. */
export type ExposureRoute =
  | "ingestion"
  | "dermal"
  | "inhalation"
  | "recreational"
  | "food_chain"
  | "irrigation"
  | "livestock_watering"
  | "habitat";

/**
 * Layer 2.5 — a bridge, not an inference.
 *
 * Links an observation or evidence claim to a potential health pathway.
 * Must cite at least one Evidence.sourceUrl or one VisualObservation.
 * May NEVER assert that harm has occurred, only that a pathway exists.
 */
export type HealthPathway = {
  domain: HealthDomain;
  route: ExposureRoute;
  /** The pathway, stated conditionally. */
  description: string;
  /** Who or what would be exposed. */
  affectedGroup: string;
  /** Source URLs or `observation:<attribute>` refs this rests on. Never empty. */
  basis: string[];
  /** How strongly the basis supports the pathway, 0–1. */
  strength: number;
  /** What would need to be measured to confirm it. */
  confirmationRequired: string;
};

// ---------------------------------------------------------------------------
// Guided stream assessment — structured observations without a photograph
// ---------------------------------------------------------------------------

/** Raw answers from the guided checklist. Stored whole as JSONB. */
export type GuidedResponses = {
  waterColour: string;
  waterColourOther?: string;
  clarity: string;
  surface: string;
  odour: string;
  odourOther?: string;
  algae: string;
  flow: string;
  bankVegetation: string;
  litter: string;
  wildlife: string;
  humanActivity: string;
};

// ---------------------------------------------------------------------------
// Human-in-the-loop confirmation — the edited observation set
// ---------------------------------------------------------------------------

/** What the confirmation step sends back: the human-reviewed observations. */
export type ConfirmationInput = {
  observations: VisualObservation[];
  /** Corrected place name; the resolved one stands when absent. */
  displayName?: string;
  countryCode?: string;
  /** "This is not a water body" — skips research for an honest no-result. */
  notWaterBody?: boolean;
};

// ---------------------------------------------------------------------------
// Layer 3 — INFERENCE: the only place conclusions may appear
// ---------------------------------------------------------------------------

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "INSUFFICIENT_DATA";

export type RiskAssessment = {
  riskLevel: RiskLevel;
  /** 0–1. Low confidence with a definite level is a valid, honest output. */
  confidence: number;
  /** Inference drawn from observations and evidence together. */
  summary: string;
  riskFactors: string[];
  /** Evidence the conclusion actually rests on. */
  evidence: Evidence[];
  /** Cautious next step. Never asserts safety. */
  recommendation: string;
  limitations: string[];
};

export type InvestigationStatus =
  | "running"
  | "awaiting_confirmation"
  | "completed"
  | "failed";

export type Investigation = {
  id: string;
  status: InvestigationStatus;
  createdAt: string;
  location: Location;
  userNote: string;
  /** Storage URL once persisted; absent while the investigation is in flight. */
  imageUrl?: string;
  visual?: VisualAnalysis;
  geographic?: GeographicContext;
  sources: Source[];
  evidence: Evidence[];
  healthPathways: HealthPathway[];
  /** Raw guided-checklist answers, when the run started in guided mode. */
  guidedResponses?: GuidedResponses;
  assessment?: RiskAssessment;
  /** User-safe failure message. Never a stack trace or provider payload. */
  error?: string;
};
