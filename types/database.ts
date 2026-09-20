/**
 * Database row shapes.
 *
 * Hand-written rather than generated, since the schema is small and this keeps
 * the repo free of a codegen step. Column names are snake_case to match
 * PostgREST exactly; mapping to domain types happens in `lib/supabase/store.ts`.
 */
import type {
  GeographicContext,
  GuidedResponses,
  HealthPathway,
  RiskLevel,
  SourceType,
  VisualAnalysis,
} from "./investigation";

export type InvestigationRow = {
  id: string;
  created_at: string;
  status: "running" | "awaiting_confirmation" | "completed" | "failed";
  latitude: number;
  longitude: number;
  place_name: string | null;
  country_code: string | null;
  user_note: string;
  image_url: string | null;
  visual: VisualAnalysis | null;
  geographic: GeographicContext | null;
  health_pathways: HealthPathway[];
  guided_responses: GuidedResponses | null;
  error: string | null;
};

export type SourceRow = {
  investigation_id: string;
  title: string;
  url: string;
  domain: string;
  snippet: string;
  published_at: string | null;
  source_type: SourceType;
  relevance: number;
};

export type EvidenceRow = {
  investigation_id: string;
  claim: string;
  source_url: string;
  uncertainty: string;
  relevance: number;
};

export type AssessmentRow = {
  investigation_id: string;
  risk_level: RiskLevel;
  confidence: number;
  summary: string;
  recommendation: string;
  risk_factors: string[];
  limitations: string[];
  cited_evidence: Array<{
    claim: string;
    sourceUrl: string;
    uncertainty: string;
    relevance: number;
  }>;
};

/** Insert payloads omit server-generated columns. */
export type InvestigationInsert = Omit<InvestigationRow, "created_at"> ;

export type SiteRow = {
  geohash: string;
  centroid_lat: number;
  centroid_lng: number;
  display_name: string | null;
  waterway_name: string | null;
  first_seen_at: string;
  last_seen_at: string;
  investigation_count: number;
};
