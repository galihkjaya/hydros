import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Callout,
  Chip,
  DisplayHeading,
  Eyebrow,
  Rule,
  riskChipTone,
} from "@/components/ui/primitives";
import { formatConfidence } from "@/lib/utils/format";
import { formatCoordinate } from "@/lib/utils/validation";
import { decodeGeohash } from "@/lib/geo/site";
import { evaluateSiteAlerts } from "@/lib/investigation/alerts";
import {
  evidenceAccumulation,
  observationDrift,
  riskTimeline,
} from "@/lib/investigation/trends";
import { getSite, listVisits } from "@/lib/supabase/store";
import type { RiskLevel } from "@/types/investigation";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ geohash: string }>;
}) {
  const { geohash } = await params;
  const site = await getSite(geohash.toLowerCase());
  return { title: site?.displayName ?? `Site ${geohash}` };
}

const LEVEL_Y: Record<RiskLevel, number> = {
  HIGH: 0,
  MEDIUM: 1,
  LOW: 2,
  INSUFFICIENT_DATA: 3,
};

const LEVEL_LABEL: Record<RiskLevel, string> = {
  HIGH: "HIGH",
  MEDIUM: "MED",
  LOW: "LOW",
  INSUFFICIENT_DATA: "N/A",
};

/**
 * Stepped risk timeline as inline SVG — ink strokes, hairline gridlines,
 * monospace labels. No charting library for four levels and N points.
 */
function RiskTimelineChart({
  points,
}: {
  points: { investigationId: string; at: string; riskLevel: RiskLevel }[];
}) {
  const width = 640;
  const height = 220;
  const padLeft = 48;
  const padTop = 16;
  const padBottom = 32;
  const plotWidth = width - padLeft - 16;
  const plotHeight = height - padTop - padBottom;
  const stepY = plotHeight / 3;

  const x = (index: number) =>
    points.length === 1
      ? padLeft + plotWidth / 2
      : padLeft + (index / (points.length - 1)) * plotWidth;
  const y = (level: RiskLevel) => padTop + LEVEL_Y[level] * stepY;

  const path =
    points.length === 1
      ? `M ${padLeft} ${y(points[0]!.riskLevel)} H ${padLeft + plotWidth}`
      : points
          .map((point, index) => {
            if (index === 0) return `M ${x(0)} ${y(point.riskLevel)}`;
            const prev = points[index - 1]!;
            // Step: horizontal at the previous level, then vertical.
            return `H ${x(index)} V ${y(point.riskLevel)} H ${x(index)}`;
          })
          .join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`Risk timeline across ${points.length} visits`}
      className="w-full border border-ink bg-paper"
    >
      {(Object.keys(LEVEL_Y) as RiskLevel[]).map((level) => (
        <g key={level}>
          <line
            x1={padLeft}
            x2={width - 16}
            y1={y(level)}
            y2={y(level)}
            stroke="var(--rule)"
            strokeWidth={1}
          />
          <text
            x={padLeft - 8}
            y={y(level) + 4}
            textAnchor="end"
            fontSize={11}
            fontFamily="var(--font-mono)"
            fill="var(--ink-faint)"
          >
            {LEVEL_LABEL[level]}
          </text>
        </g>
      ))}
      <path d={path} fill="none" stroke="var(--ink)" strokeWidth={2} />
      {points.map((point, index) => (
        <g key={point.investigationId}>
          <rect
            x={x(index) - 4}
            y={y(point.riskLevel) - 4}
            width={8}
            height={8}
            fill={
              point.riskLevel === "HIGH"
                ? "var(--signal)"
                : point.riskLevel === "INSUFFICIENT_DATA"
                  ? "var(--paper)"
                  : "var(--ink)"
            }
            stroke={
              point.riskLevel === "HIGH" ? "var(--signal)" : "var(--ink)"
            }
            strokeWidth={1.5}
          />
          <text
            x={x(index)}
            y={height - 8}
            textAnchor="middle"
            fontSize={10}
            fontFamily="var(--font-mono)"
            fill="var(--ink-faint)"
          >
            {new Date(point.at).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })}
          </text>
        </g>
      ))}
    </svg>
  );
}

export default async function SiteProfilePage({
  params,
}: {
  params: Promise<{ geohash: string }>;
}) {
  const { geohash: raw } = await params;
  const geohash = raw.toLowerCase();
  let cell = null;
  try {
    cell = decodeGeohash(geohash);
  } catch {
    notFound();
  }
  const site = await getSite(geohash);
  const visits = await listVisits(geohash, 100);
  if (!site && visits.length === 0) notFound();

  const timeline = riskTimeline(visits);
  const drift = observationDrift(visits);
  const accumulation = evidenceAccumulation(visits);
  const alerts = evaluateSiteAlerts(geohash, visits);
  const run = [...visits].reverse();

  return (
    <main className="mx-auto w-full max-w-[1180px] px-6 py-10 sm:px-10 sm:py-14">
      <header className="hydros-prose">
        <Eyebrow>
          Site · <span className="font-mono">{geohash}</span>
        </Eyebrow>
        <DisplayHeading level={1} className="mt-2 text-3xl sm:text-5xl">
          {site?.displayName ?? site?.waterwayName ?? "Unresolved location"}
        </DisplayHeading>
        <p className="mt-3 text-ink-muted">
          {site?.waterwayName ? `${site.waterwayName} · ` : ""}
          <span className="font-mono text-[0.8125rem]">
            {formatCoordinate(cell.centerLatitude)},{" "}
            {formatCoordinate(cell.centerLongitude)}
          </span>
          {" · "}
          {visits.length} investigation{visits.length === 1 ? "" : "s"} on
          record
        </p>
      </header>

      <Rule strong className="mt-8" />

      {alerts.length > 0 ? (
        <div className="mt-8 space-y-4">
          {alerts.map((alert, index) => (
            <Callout
              key={`${alert.triggeredAt}-${index}`}
              eyebrow={`${alert.severity === "concern" ? "Concern" : "Watch"} · rule fired`}
              tone={alert.severity === "concern" ? "signal" : "ink"}
            >
              <p className="text-[0.9375rem]">{alert.reason}</p>
              <p className="mt-2 font-mono text-[0.8125rem] text-ink-muted">
                Basis:{" "}
                {alert.basis.map((id, i) => (
                  <span key={id}>
                    {i > 0 ? ", " : ""}
                    <Link
                      href={`/investigations/${id}`}
                      className="underline underline-offset-4 hover:text-ink"
                    >
                      {id.slice(0, 8)}
                    </Link>
                  </span>
                ))}
              </p>
            </Callout>
          ))}
        </div>
      ) : null}

      {timeline.length >= 2 ? (
        <section className="mt-10">
          <Eyebrow>Risk timeline</Eyebrow>
          <h2 className="mt-1 font-serif text-2xl">How concern moved</h2>
          <div className="mt-4 max-w-3xl">
            <RiskTimelineChart points={timeline} />
          </div>
        </section>
      ) : null}

      {drift.length > 0 ? (
        <section className="mt-10">
          <Eyebrow>Observation drift</Eyebrow>
          <h2 className="mt-1 font-serif text-2xl">
            What changed between guided visits
          </h2>
          <div className="mt-4 max-w-3xl overflow-x-auto">
            <table className="w-full border-t-2 border-ink text-left text-[0.875rem]">
              <thead>
                <tr className="border-b border-rule font-mono text-[0.6875rem] tracking-wider text-ink-muted uppercase">
                  <th className="py-2 pr-4 font-medium">Item</th>
                  <th className="py-2 pr-4 font-medium">Was</th>
                  <th className="py-2 pr-4 font-medium">Now</th>
                  <th className="py-2 font-medium">Visit</th>
                </tr>
              </thead>
              <tbody>
                {drift.map((row, index) => (
                  <tr
                    key={`${row.investigationId}-${row.item}-${index}`}
                    className="border-b border-rule"
                  >
                    <td className="py-2 pr-4 font-mono">{row.item}</td>
                    <td className="py-2 pr-4 text-ink-muted">{row.from}</td>
                    <td className="py-2 pr-4">{row.to}</td>
                    <td className="py-2 font-mono text-[0.8125rem]">
                      <Link
                        href={`/investigations/${row.investigationId}`}
                        className="underline underline-offset-4 hover:text-ink"
                      >
                        {new Date(row.at).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="mt-10">
        <Eyebrow>Evidence accumulation</Eyebrow>
        <h2 className="mt-1 font-serif text-2xl">
          {accumulation.totalDistinctSources} distinct source
          {accumulation.totalDistinctSources === 1 ? "" : "s"} across{" "}
          {visits.length} visit{visits.length === 1 ? "" : "s"}
        </h2>
      </section>

      <section className="mt-10">
        <Eyebrow>Investigation run</Eyebrow>
        <h2 className="mt-1 font-serif text-2xl">Newest first</h2>
        <ul className="mt-6 grid gap-x-10 gap-y-8 sm:grid-cols-2">
          {run.map((visit) => (
            <li key={visit.id} className="border-t-2 border-ink pt-4">
              <div className="flex items-start justify-between gap-3">
                <p className="font-mono text-[0.8125rem] text-ink-faint">
                  <time dateTime={visit.createdAt}>
                    {new Date(visit.createdAt).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </time>
                  {visit.guidedMode ? " · guided" : " · photo"}
                </p>
                {visit.riskLevel ? (
                  <Chip tone={riskChipTone(visit.riskLevel)}>
                    {visit.riskLevel.replace("_", " ")}
                  </Chip>
                ) : (
                  <Chip tone="neutral">No assessment</Chip>
                )}
              </div>
              {visit.assessmentSummary ? (
                <p className="mt-2 text-[0.9375rem] leading-6">
                  {visit.assessmentSummary}
                </p>
              ) : null}
              <p className="mt-1 font-mono text-[0.8125rem] text-ink-muted">
                {visit.sourceUrls.length} source
                {visit.sourceUrls.length === 1 ? "" : "s"}
                {visit.confidence !== null
                  ? ` · confidence ${formatConfidence(visit.confidence)}`
                  : null}
              </p>
              <Link
                href={`/investigations/${visit.id}`}
                className="mt-3 inline-block font-mono text-[0.8125rem] tracking-wider uppercase underline underline-offset-4 hover:text-ink"
              >
                Read the investigation →
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
