/**
 * Evidence integrity: weighting, staleness, and claim–source checks.
 *
 * Three rules, all deterministic and explainable:
 * 1. Source-type weighting — government > scientific > news > community >
 *    unverified. Applied to evidence relevance so the ranking is legible.
 * 2. Staleness — sources older than five years are down-weighted for
 *    acute-contamination claims and always shown with their age.
 * 3. Claim–source integrity — every claim must resolve to a Source in the
 *    package. A hard validation pass, not just a documented invariant.
 */
import type { Evidence, Source, SourceType } from "@/types/investigation";

/** Base credibility weight per tier. Surfaced in the UI beside each source. */
export const SOURCE_TYPE_WEIGHT: Record<SourceType, number> = {
  government: 1,
  scientific: 0.9,
  news: 0.7,
  community: 0.5,
  unverified: 0.4,
};

export const SOURCE_TYPE_LABEL: Record<SourceType, string> = {
  government: "Government",
  scientific: "Scientific",
  news: "News",
  community: "Community",
  unverified: "Unverified",
};

/** Sources older than this are stale for acute-contamination claims. */
export const STALENESS_THRESHOLD_YEARS = 5;

/** Claims about sudden events go stale; background context does not. */
const ACUTE_CLAIM_PATTERNS: readonly RegExp[] = [
  /outbreak/i,
  /spill/i,
  /contamina/i,
  /discharge/i,
  /flood/i,
  /algal bloom/i,
  /fish kill/i,
  /elevated .* (turbidity|bacteria|coliform|lead|mercury)/i,
];

/** Whole years since `publishedAt`, or null when unknown/unparseable. */
export function sourceAgeYears(
  publishedAt: string | undefined,
  now = new Date(),
): number | null {
  if (!publishedAt) return null;
  const match = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?/.exec(publishedAt.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = match[2] ? Number(match[2]) - 1 : 0;
  const day = match[3] ? Number(match[3]) : 1;
  if (year < 1900 || year > now.getFullYear() + 1) return null;
  const published = new Date(Date.UTC(year, month, day));
  const ageMs = now.getTime() - published.getTime();
  if (ageMs < 0) return null;
  return Math.floor(ageMs / (365.25 * 24 * 60 * 60 * 1000));
}

/** True when the source is dated and older than the staleness threshold. */
export function isStaleSource(
  source: Pick<Source, "publishedAt">,
  now = new Date(),
): boolean {
  const age = sourceAgeYears(source.publishedAt, now);
  return age !== null && age > STALENESS_THRESHOLD_YEARS;
}

/** Short display age: "2021 · 5y ago" or "date unknown". */
export function formatSourceAge(
  source: Pick<Source, "publishedAt">,
  now = new Date(),
): string {
  const age = sourceAgeYears(source.publishedAt, now);
  if (age === null) return "date unknown";
  if (age === 0) return "this year";
  return `${age}y ago`;
}

/**
 * Applies source-type weighting (and the staleness discount for acute
 * claims) to evidence relevance. Returns new objects, sorted descending.
 */
export function weightEvidenceBySourceType(
  evidence: readonly Evidence[],
  sources: readonly Source[],
  now = new Date(),
): Evidence[] {
  const byUrl = new Map(sources.map((source) => [source.url, source]));

  return evidence
    .map((item) => {
      const source = byUrl.get(item.sourceUrl);
      const weight = source ? SOURCE_TYPE_WEIGHT[source.sourceType] : 0.4;
      const staleAcute =
        !!source &&
        isStaleSource(source, now) &&
        ACUTE_CLAIM_PATTERNS.some((pattern) => pattern.test(item.claim));
      const relevance = Math.min(
        Math.max(item.relevance * weight * (staleAcute ? 0.5 : 1), 0),
        1,
      );
      return {
        ...item,
        relevance: Number(relevance.toFixed(3)),
      };
    })
    .sort((a, b) => b.relevance - a.relevance);
}

/**
 * Hard claim–source integrity pass.
 *
 * Returns the claims whose source URL matches no Source in the package.
 * Empty means the package is intact. Callers drop or flag orphans rather
 * than rendering unattributed claims as evidence.
 */
export function findOrphanedEvidence(
  evidence: readonly Pick<Evidence, "sourceUrl">[],
  sources: readonly Pick<Source, "url">[],
): string[] {
  const urls = new Set(sources.map((source) => source.url));
  const orphans = new Set<string>();
  for (const item of evidence) {
    if (!urls.has(item.sourceUrl)) orphans.add(item.sourceUrl);
  }
  return [...orphans];
}
