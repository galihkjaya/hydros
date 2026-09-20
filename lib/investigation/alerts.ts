/**
 * Deterministic degradation alerts.
 *
 * Threshold rules over observed data — NOT predictive modelling, and the UI
 * and README say so. Every alert states the rule that fired and links the
 * investigations it fired on, so the reasoning stays auditable.
 */
import type { RiskLevel } from "@/types/investigation";

export type AlertSeverity = "watch" | "concern";

export type Alert = {
  siteGeohash: string;
  severity: AlertSeverity;
  /** Which rule fired, in plain language. */
  reason: string;
  /** Investigation IDs the rule fired on. */
  basis: string[];
  triggeredAt: string;
};

export type AlertInvestigation = {
  id: string;
  createdAt: string;
  riskLevel: RiskLevel | null;
  confidence: number | null;
  /** True when a government or scientific source backs this visit. */
  hasAuthoritativeSource: boolean;
  /** Strongest health pathway strength at this visit, if any. */
  maxPathwayStrength: number | null;
};

const RISK_ORDER: Record<Exclude<RiskLevel, "INSUFFICIENT_DATA">, number> = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
};

function isOrdered(
  level: RiskLevel | null,
): level is Exclude<RiskLevel, "INSUFFICIENT_DATA"> {
  return level === "LOW" || level === "MEDIUM" || level === "HIGH";
}

const byTime = (a: AlertInvestigation, b: AlertInvestigation) =>
  a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0;

/**
 * Evaluates every rule against a site's visits, oldest first.
 * At most one alert per rule per site: the latest firing wins.
 */
export function evaluateSiteAlerts(
  siteGeohash: string,
  investigations: readonly AlertInvestigation[],
): Alert[] {
  const visits = [...investigations].sort(byTime);
  const assessed = visits.filter(
    (visit) => visit.riskLevel !== null && visit.confidence !== null,
  );
  const alerts: Alert[] = [];

  // Rule 1 — escalation: risk increased across two consecutive visits, and the
  // later visit reports confidence >= 0.5.
  for (let index = 1; index < assessed.length; index += 1) {
    const previous = assessed[index - 1];
    const current = assessed[index];
    if (
      previous &&
      current &&
      isOrdered(previous.riskLevel) &&
      isOrdered(current.riskLevel) &&
      RISK_ORDER[current.riskLevel] > RISK_ORDER[previous.riskLevel] &&
      (current.confidence ?? 0) >= 0.5
    ) {
      alerts.push({
        siteGeohash,
        severity: "concern",
        reason: `Risk rose from ${previous.riskLevel} to ${current.riskLevel} between consecutive visits (confidence ${Math.round((current.confidence ?? 0) * 100)}%).`,
        basis: [previous.id, current.id],
        triggeredAt: current.createdAt,
      });
    }
  }

  // Rule 2 — persistence: three or more consecutive visits at MEDIUM or above.
  let streak: AlertInvestigation[] = [];
  const streaks: AlertInvestigation[][] = [];
  for (const visit of assessed) {
    if (
      visit.riskLevel === "MEDIUM" ||
      visit.riskLevel === "HIGH"
    ) {
      streak.push(visit);
    } else {
      if (streak.length >= 3) streaks.push(streak);
      streak = [];
    }
  }
  if (streak.length >= 3) streaks.push(streak);
  const longest = streaks.sort((a, b) => b.length - a.length)[0];
  if (longest && longest.length >= 3) {
    const last = longest[longest.length - 1];
    if (last) {
      alerts.push({
        siteGeohash,
        severity: "watch",
        reason: `${longest.length} consecutive visits at MEDIUM or above — a persistent pattern, not a one-off.`,
        basis: longest.map((visit) => visit.id),
        triggeredAt: last.createdAt,
      });
    }
  }

  // Rule 3 — new authoritative evidence: a government or scientific source
  // appeared for a site previously LOW or INSUFFICIENT_DATA.
  for (let index = 0; index < assessed.length; index += 1) {
    const visit = assessed[index];
    if (!visit || !visit.hasAuthoritativeSource) continue;
    const earlier = assessed.slice(0, index);
    const hadAuthoritative = earlier.some((v) => v.hasAuthoritativeSource);
    const wasCalm = earlier.every(
      (v) => v.riskLevel === "LOW" || v.riskLevel === "INSUFFICIENT_DATA",
    );
    if (!hadAuthoritative && earlier.length > 0 && wasCalm) {
      alerts.push({
        siteGeohash,
        severity: "watch",
        reason:
          "A new government or scientific source appeared for a site previously assessed LOW or without data.",
        basis: [visit.id],
        triggeredAt: visit.createdAt,
      });
      break;
    }
  }

  // Rule 4 — new strong pathway: strength >= 0.7 where none existed before.
  for (let index = 0; index < assessed.length; index += 1) {
    const visit = assessed[index];
    if (
      !visit ||
      visit.maxPathwayStrength === null ||
      visit.maxPathwayStrength < 0.7
    ) {
      continue;
    }
    const earlierMax = Math.max(
      0,
      ...assessed
        .slice(0, index)
        .map((v) => v.maxPathwayStrength ?? 0),
    );
    if (earlierMax < 0.7) {
      alerts.push({
        siteGeohash,
        severity: "concern",
        reason: `A health pathway of strength ${visit.maxPathwayStrength.toFixed(2)} appeared where none reached 0.70 before.`,
        basis: [visit.id],
        triggeredAt: visit.createdAt,
      });
      break;
    }
  }

  return alerts.sort((a, b) => (a.triggeredAt < b.triggeredAt ? -1 : 1));
}
