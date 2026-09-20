/**
 * Longitudinal trend computation over a site's investigations.
 *
 * Pure functions over stored data: no model call, no inference, just
 * arithmetic. The site profile renders the results as inline SVG and ruled
 * tables; the alert engine consumes the same shapes.
 */
import type { RiskLevel } from "@/types/investigation";

export type TrendPoint = {
  investigationId: string;
  at: string;
  riskLevel: RiskLevel;
  confidence: number;
};

export type InvestigationLike = {
  id: string;
  createdAt: string;
  riskLevel: RiskLevel | null;
  confidence: number | null;
  /** Categorical answers, when the visit ran in guided mode. */
  guidedResponses?: Record<string, string> | null;
  /** Source URLs cited at this visit. */
  sourceUrls?: readonly string[];
};

const byTime = (a: InvestigationLike, b: InvestigationLike) =>
  a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0;

/** Risk level over time, oldest first. Skips visits without an assessment. */
export function riskTimeline(
  investigations: readonly InvestigationLike[],
): TrendPoint[] {
  return [...investigations]
    .sort(byTime)
    .filter(
      (investigation): investigation is InvestigationLike & {
        riskLevel: RiskLevel;
        confidence: number;
      } =>
        investigation.riskLevel !== null && investigation.confidence !== null,
    )
    .map((investigation) => ({
      investigationId: investigation.id,
      at: investigation.createdAt,
      riskLevel: investigation.riskLevel,
      confidence: investigation.confidence,
    }));
}

export type ObservationDrift = {
  item: string;
  from: string;
  to: string;
  at: string;
  investigationId: string;
};

/**
 * Which guided answers changed between consecutive guided visits.
 * Model-only visits carry no checklist, so they are skipped, not interpolated.
 */
export function observationDrift(
  investigations: readonly InvestigationLike[],
): ObservationDrift[] {
  const guided = [...investigations]
    .sort(byTime)
    .filter(
      (investigation) =>
        investigation.guidedResponses &&
        Object.keys(investigation.guidedResponses).length > 0,
    );
  if (guided.length < 2) return [];

  const drift: ObservationDrift[] = [];
  for (let index = 1; index < guided.length; index += 1) {
    const previous = guided[index - 1]?.guidedResponses ?? {};
    const current = guided[index]?.guidedResponses ?? {};
    const visit = guided[index];
    if (!visit) continue;
    const items = new Set([...Object.keys(previous), ...Object.keys(current)]);
    for (const item of [...items].sort()) {
      const from = (previous[item] ?? "").trim();
      const to = (current[item] ?? "").trim();
      if (from !== to && (from || to)) {
        drift.push({
          item,
          from: from || "—",
          to: to || "—",
          at: visit.createdAt,
          investigationId: visit.id,
        });
      }
    }
  }
  return drift;
}

export type EvidenceAccumulation = {
  /** Distinct source URLs seen across all visits at the site. */
  totalDistinctSources: number;
  /** Per visit, oldest first: which sources were new. */
  perVisit: {
    investigationId: string;
    at: string;
    newSources: string[];
    totalSoFar: number;
  }[];
};

/** Source accumulation across visits: what is new since the previous visit. */
export function evidenceAccumulation(
  investigations: readonly InvestigationLike[],
): EvidenceAccumulation {
  const seen = new Set<string>();
  const perVisit = [...investigations].sort(byTime).map((investigation) => {
    const urls = investigation.sourceUrls ?? [];
    const fresh = urls.filter((url) => !seen.has(url));
    for (const url of urls) seen.add(url);
    return {
      investigationId: investigation.id,
      at: investigation.createdAt,
      newSources: fresh,
      totalSoFar: seen.size,
    };
  });

  return { totalDistinctSources: seen.size, perVisit };
}
