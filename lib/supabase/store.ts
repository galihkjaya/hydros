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
import { siteGeohashFor } from "@/lib/geo/site";
import type {
  AssessmentRow,
  EvidenceRow,
  InvestigationRow,
  SiteRow,
  SourceRow,
} from "@/types/database";
import type {
  Evidence,
  GeographicContext,
  GuidedResponses,
  HealthPathway,
  Investigation,
  Location,
  RiskAssessment,
  Source,
  VisualAnalysis,
  VisualObservation,
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

/**
 * Phase A draft: persists the model's observations and geography with
 * `awaiting_confirmation` so the run can pause for human review and resume
 * from the confirmed set — including from another session.
 */
export async function persistDraftPhase(
  id: string,
  location: Location,
  userNote: string,
  visual: VisualAnalysis,
  geographic: GeographicContext,
  guidedResponses?: GuidedResponses,
): Promise<void> {
  if (!isPersistenceEnabled()) return;
  await upsertRow("investigations", {
    id,
    status: "awaiting_confirmation",
    latitude: location.latitude,
    longitude: location.longitude,
    place_name: geographic.location.displayName ?? null,
    country_code: geographic.location.countryCode ?? null,
    user_note: userNote,
    image_url: null,
    visual,
    geographic,
    health_pathways: [],
    guided_responses: guidedResponses ?? null,
    error: null,
  });
}

/** Phase B start: stores the confirmed set and reopens the run. */
export async function persistConfirmedVisual(
  id: string,
  observations: VisualObservation[],
  visual: VisualAnalysis,
): Promise<void> {
  if (!isPersistenceEnabled()) return;
  await patchRow("investigations", id, {
    status: "running",
    visual: { ...visual, observations },
  });
}

export async function persistHealthPathways(
  id: string,
  pathways: HealthPathway[],
): Promise<void> {
  if (!isPersistenceEnabled() || pathways.length === 0) return;
  await patchRow("investigations", id, { health_pathways: pathways });
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

  type EmbeddedAssessment = {
    risk_level: RiskAssessment["riskLevel"];
    confidence: number;
  };

  /**
   * `assessments.investigation_id` is both the primary key and the foreign key,
   * so PostgREST detects a one-to-one relationship and embeds a single object —
   * not an array. Both shapes are accepted here because that detection depends
   * on the schema, and a to-many embed would otherwise silently produce a
   * history list with no risk levels.
   */
  type Row = InvestigationRow & {
    assessments: EmbeddedAssessment | EmbeddedAssessment[] | null;
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
    const assessment = Array.isArray(row.assessments)
      ? row.assessments[0]
      : row.assessments;
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
    healthPathways: row.health_pathways ?? [],
    ...(row.guided_responses ? { guidedResponses: row.guided_responses } : {}),
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

// ---------------------------------------------------------------------------
// Sites, visits, map points
// ---------------------------------------------------------------------------

export type SiteSummary = {
  geohash: string;
  centroidLat: number;
  centroidLng: number;
  displayName: string | null;
  waterwayName: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  investigationCount: number;
};

function toSiteSummary(row: SiteRow): SiteSummary {
  return {
    geohash: row.geohash,
    centroidLat: row.centroid_lat,
    centroidLng: row.centroid_lng,
    displayName: row.display_name,
    waterwayName: row.waterway_name,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    investigationCount: row.investigation_count,
  };
}

export async function getSite(geohash: string): Promise<SiteSummary | null> {
  if (!isPersistenceEnabled()) return null;
  const rows = await selectRows<SiteRow>(
    "sites",
    new URLSearchParams({
      select: "*",
      geohash: `eq.${geohash}`,
      limit: "1",
    }).toString(),
  );
  return rows[0] ? toSiteSummary(rows[0]) : null;
}

export async function listSites(limit = 100): Promise<SiteSummary[]> {
  if (!isPersistenceEnabled()) return [];
  const rows = await selectRows<SiteRow>(
    "sites",
    new URLSearchParams({
      select: "*",
      order: "last_seen_at.desc",
      limit: String(limit),
    }).toString(),
  );
  return rows.map(toSiteSummary);
}

/**
 * Records a completed investigation at its site.
 *
 * Computes the geohash cell, upserts the site row (running centroid and
 * count), and links the investigation. Best-effort like every write here.
 */
export async function touchSite(
  investigationId: string,
  geographic: GeographicContext,
): Promise<string | null> {
  if (!isPersistenceEnabled()) return null;
  const geohash = siteGeohashFor(
    geographic.location.latitude,
    geographic.location.longitude,
  );

  const existing = await getSite(geohash);
  const count = (existing?.investigationCount ?? 0) + 1;
  const centroidLat = existing
    ? (existing.centroidLat * (count - 1) + geographic.location.latitude) / count
    : geographic.location.latitude;
  const centroidLng = existing
    ? (existing.centroidLng * (count - 1) + geographic.location.longitude) / count
    : geographic.location.longitude;

  await upsertRow("sites", {
    geohash,
    centroid_lat: centroidLat,
    centroid_lng: centroidLng,
    display_name:
      existing?.displayName ?? geographic.location.displayName ?? null,
    waterway_name: existing?.waterwayName ?? geographic.waterways[0] ?? null,
    last_seen_at: new Date().toISOString(),
    investigation_count: count,
  });
  await patchRow("investigations", investigationId, {
    site_geohash: geohash,
  });
  return geohash;
}

export type VisitRecord = {
  siteGeohash: string | null;
  id: string;
  createdAt: string;
  placeName: string | null;
  latitude: number;
  longitude: number;
  imageUrl: string | null;
  riskLevel: RiskAssessment["riskLevel"] | null;
  confidence: number | null;
  guidedMode: boolean;
  guidedResponses: Record<string, string> | null;
  sourceUrls: string[];
  hasAuthoritativeSource: boolean;
  maxPathwayStrength: number | null;
  assessmentSummary: string | null;
};

/**
 * Visit-level rows for trends and alerts, across one site or all sites.
 *
 * Three queries (investigations + assessments + sources), composed in memory —
 * bounded by `limit`, newest first from the database, oldest first out.
 */
export async function listVisits(
  siteGeohash?: string,
  limit = 500,
): Promise<VisitRecord[]> {
  if (!isPersistenceEnabled()) return [];

  const invParams = new URLSearchParams({
    select:
      "id,created_at,place_name,latitude,longitude,image_url,site_geohash,visual,guided_responses,health_pathways",
    order: "created_at.desc",
    limit: String(limit),
  });
  if (siteGeohash) invParams.set("site_geohash", `eq.${siteGeohash}`);
  const invRows = await selectRows<
    Pick<
      InvestigationRow,
      | "id"
      | "created_at"
      | "place_name"
      | "latitude"
      | "longitude"
      | "image_url"
      | "visual"
      | "guided_responses"
      | "health_pathways"
    > & { site_geohash: string | null }
  >("investigations", invParams.toString());
  if (invRows.length === 0) return [];

  const ids = invRows.map((row) => row.id);
  const [assessmentRows, sourceRows] = await Promise.all([
    selectRows<AssessmentRow>(
      "assessments",
      new URLSearchParams({
        select: "investigation_id,risk_level,confidence,summary",
        investigation_id: `in.(${ids.join(",")})`,
      }).toString(),
    ),
    selectRows<Pick<SourceRow, "investigation_id" | "url" | "source_type">>(
      "sources",
      new URLSearchParams({
        select: "investigation_id,url,source_type",
        investigation_id: `in.(${ids.join(",")})`,
      }).toString(),
    ),
  ]);

  const assessments = new Map(assessmentRows.map((row) => [row.investigation_id, row]));
  const sourcesByInv = new Map<string, { url: string; source_type: SourceRow["source_type"] }[]>();
  for (const row of sourceRows) {
    const list = sourcesByInv.get(row.investigation_id) ?? [];
    list.push({ url: row.url, source_type: row.source_type });
    sourcesByInv.set(row.investigation_id, list);
  }

  return invRows
    .map((row) => {
      const assessment = assessments.get(row.id);
      const sources = sourcesByInv.get(row.id) ?? [];
      const pathways = row.health_pathways ?? [];
      return {
        siteGeohash: row.site_geohash,
        id: row.id,
        createdAt: row.created_at,
        placeName: row.place_name,
        latitude: row.latitude,
        longitude: row.longitude,
        imageUrl: row.image_url,
        riskLevel: assessment?.risk_level ?? null,
        confidence: assessment?.confidence ?? null,
        guidedMode: row.guided_responses !== null,
        guidedResponses: (row.guided_responses ?? null) as Record<string, string> | null,
        sourceUrls: sources.map((s) => s.url),
        hasAuthoritativeSource: sources.some(
          (s) => s.source_type === "government" || s.source_type === "scientific",
        ),
        maxPathwayStrength:
          pathways.length > 0
            ? Math.max(...pathways.map((p) => p.strength))
            : null,
        assessmentSummary: assessment?.summary ?? null,
      };
    })
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
}
