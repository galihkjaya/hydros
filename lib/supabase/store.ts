/**
 * Investigation persistence.
 *
 * Maps domain objects to rows and back. Every function is best-effort: if
 * Supabase is unconfigured or unreachable, an investigation still runs to
 * completion and the user still sees their result.
 */
import {
  insertRows,
  isPersistenceEnabled,
  patchRow,
  selectRows,
  uploadInvestigationImage,
  upsertRow,
} from "./client";
import { parseImageDataUrl } from "@/lib/utils/validation";
import type {
  AssessmentRow,
  EvidenceRow,
  InvestigationRow,
  SourceRow,
} from "@/types/database";
import type {
  Evidence,
  GeographicContext,
  Investigation,
  Location,
  RiskAssessment,
  Source,
  VisualAnalysis,
} from "@/types/investigation";

export { isPersistenceEnabled };

/** Creates the investigation row at the start of a run. */
export async function createInvestigation(
  id: string,
  location: Location,
  userNote: string,
): Promise<void> {
  if (!isPersistenceEnabled()) return;

  await insertRows("investigations", [
    {
      id,
      status: "running",
      latitude: location.latitude,
      longitude: location.longitude,
      place_name: null,
      country_code: null,
      user_note: userNote,
      image_url: null,
      visual: null,
      geographic: null,
      error: null,
    },
  ]);
}

/**
 * Stores the uploaded image and records its URL.
 *
 * Decoding happens here rather than at the call site so the base64 payload is
 * turned into bytes exactly once.
 */
export async function persistImage(
  id: string,
  imageDataUrl: string,
): Promise<void> {
  if (!isPersistenceEnabled()) return;

  const parsed = parseImageDataUrl(imageDataUrl);
  if (!parsed) return;

  const bytes = Uint8Array.from(Buffer.from(parsed.base64, "base64"));
  const url = await uploadInvestigationImage(id, bytes, parsed.mimeType);
  if (url) await patchRow("investigations", id, { image_url: url });
}

export async function persistVisual(
  id: string,
  visual: VisualAnalysis,
): Promise<void> {
  if (!isPersistenceEnabled()) return;
  await patchRow("investigations", id, { visual });
}

export async function persistGeographic(
  id: string,
  geographic: GeographicContext,
): Promise<void> {
  if (!isPersistenceEnabled()) return;
  await patchRow("investigations", id, {
    geographic,
    place_name: geographic.location.displayName ?? null,
    country_code: geographic.location.countryCode ?? null,
  });
}

export async function persistSources(
  id: string,
  sources: readonly Source[],
): Promise<void> {
  if (!isPersistenceEnabled() || sources.length === 0) return;

  const rows: SourceRow[] = sources.map((source) => ({
    investigation_id: id,
    title: source.title,
    url: source.url,
    domain: source.domain,
    snippet: source.snippet,
    published_at: source.publishedAt ?? null,
    source_type: source.sourceType,
    relevance: source.relevance,
  }));

  await insertRows("sources", rows);
}

export async function persistEvidence(
  id: string,
  evidence: readonly Evidence[],
): Promise<void> {
  if (!isPersistenceEnabled() || evidence.length === 0) return;

  const rows: EvidenceRow[] = evidence.map((item) => ({
    investigation_id: id,
    claim: item.claim,
    source_url: item.sourceUrl,
    uncertainty: item.uncertainty,
    relevance: item.relevance,
  }));

  await insertRows("evidence", rows);
}

/** Stores the assessment and marks the investigation complete. */
export async function persistAssessment(
  id: string,
  assessment: RiskAssessment,
): Promise<void> {
  if (!isPersistenceEnabled()) return;

  const row: AssessmentRow = {
    investigation_id: id,
    risk_level: assessment.riskLevel,
    confidence: assessment.confidence,
    summary: assessment.summary,
    recommendation: assessment.recommendation,
    risk_factors: assessment.riskFactors,
    limitations: assessment.limitations,
    cited_evidence: assessment.evidence,
  };

  await upsertRow("assessments", row);
  await patchRow("investigations", id, { status: "completed" });
}

/** Records a failure, so history shows what happened rather than a blank row. */
export async function persistFailure(
  id: string,
  message: string,
): Promise<void> {
  if (!isPersistenceEnabled()) return;
  await patchRow("investigations", id, { status: "failed", error: message });
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export type InvestigationSummary = {
  id: string;
  createdAt: string;
  status: InvestigationRow["status"];
  placeName: string | null;
  latitude: number;
  longitude: number;
  imageUrl: string | null;
  riskLevel: RiskAssessment["riskLevel"] | null;
  confidence: number | null;
};

/**
 * Recent investigations for the history view.
 *
 * One embedded select rather than two round trips; PostgREST resolves the
 * relationship through the foreign key.
 */
export async function listRecentInvestigations(
  limit = 12,
): Promise<InvestigationSummary[]> {
  if (!isPersistenceEnabled()) return [];

  type Row = InvestigationRow & {
    assessments: Array<{ risk_level: RiskAssessment["riskLevel"]; confidence: number }> | null;
  };

  const rows = await selectRows<Row>(
    "investigations",
    new URLSearchParams({
      select:
        "id,created_at,status,place_name,latitude,longitude,image_url,assessments(risk_level,confidence)",
      order: "created_at.desc",
      limit: String(limit),
    }).toString(),
  );

  return rows.map((row) => {
    const assessment = row.assessments?.[0];
    return {
      id: row.id,
      createdAt: row.created_at,
      status: row.status,
      placeName: row.place_name,
      latitude: row.latitude,
      longitude: row.longitude,
      imageUrl: row.image_url,
      riskLevel: assessment?.risk_level ?? null,
      confidence: assessment?.confidence ?? null,
    };
  });
}

/** Full investigation by id, or null when absent. */
export async function getInvestigation(
  id: string,
): Promise<Investigation | null> {
  if (!isPersistenceEnabled()) return null;

  const rows = await selectRows<InvestigationRow>(
    "investigations",
    new URLSearchParams({
      select: "*",
      id: `eq.${id}`,
      limit: "1",
    }).toString(),
  );

  const row = rows[0];
  if (!row) return null;

  const [sources, evidence, assessments] = await Promise.all([
    selectRows<SourceRow>(
      "sources",
      new URLSearchParams({
        select: "*",
        investigation_id: `eq.${id}`,
        order: "relevance.desc",
      }).toString(),
    ),
    selectRows<EvidenceRow>(
      "evidence",
      new URLSearchParams({
        select: "*",
        investigation_id: `eq.${id}`,
        order: "relevance.desc",
      }).toString(),
    ),
    selectRows<AssessmentRow>(
      "assessments",
      new URLSearchParams({
        select: "*",
        investigation_id: `eq.${id}`,
        limit: "1",
      }).toString(),
    ),
  ]);

  const assessmentRow = assessments[0];

  return {
    id: row.id,
    status: row.status,
    createdAt: row.created_at,
    location: {
      latitude: row.latitude,
      longitude: row.longitude,
      ...(row.place_name ? { displayName: row.place_name } : {}),
      ...(row.country_code ? { countryCode: row.country_code } : {}),
    },
    userNote: row.user_note,
    ...(row.image_url ? { imageUrl: row.image_url } : {}),
    ...(row.visual ? { visual: row.visual } : {}),
    ...(row.geographic ? { geographic: row.geographic } : {}),
    sources: sources.map((source) => ({
      title: source.title,
      url: source.url,
      domain: source.domain,
      snippet: source.snippet,
      ...(source.published_at ? { publishedAt: source.published_at } : {}),
      sourceType: source.source_type,
      // Regenerated on read rather than stored: it is derived from the URL.
      faviconUrl: null,
      relevance: source.relevance,
    })),
    evidence: evidence.map((item) => ({
      claim: item.claim,
      sourceUrl: item.source_url,
      uncertainty: item.uncertainty,
      relevance: item.relevance,
    })),
    ...(assessmentRow
      ? {
          assessment: {
            riskLevel: assessmentRow.risk_level,
            confidence: assessmentRow.confidence,
            summary: assessmentRow.summary,
            riskFactors: assessmentRow.risk_factors,
            evidence: assessmentRow.cited_evidence,
            recommendation: assessmentRow.recommendation,
            limitations: assessmentRow.limitations,
          },
        }
      : {}),
    ...(row.error ? { error: row.error } : {}),
  };
}
