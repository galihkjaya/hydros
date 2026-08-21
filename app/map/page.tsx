import Link from "next/link";
import { Badge, Card } from "@/components/ui/primitives";
import { formatConfidence } from "@/lib/utils/format";
import { formatCoordinate } from "@/lib/utils/validation";
import {
  isPersistenceEnabled,
  listRecentInvestigations,
} from "@/lib/supabase/store";
import type { RiskLevel } from "@/types/investigation";

export const metadata = { title: "Map" };

/**
 * Investigation history.
 *
 * Server component: reads Supabase directly, so no client JavaScript and no
 * round trip through an API route. Renders a useful empty state when
 * persistence is not configured, since the rest of the app works without it.
 */
export const dynamic = "force-dynamic";

const LEVEL_TONE: Record<RiskLevel, "low" | "medium" | "high" | "unknown"> = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  INSUFFICIENT_DATA: "unknown",
};

export default async function MapPage() {
  const configured = isPersistenceEnabled();
  const investigations = configured ? await listRecentInvestigations() : [];

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <header className="max-w-2xl">
        <p className="wl-label">History</p>
        <h1 className="mt-1.5 text-2xl font-semibold">Past investigations</h1>
        <p className="mt-2 text-muted">
          Water sources examined with WaterLens, with the location and the
          assessment each one reached.
        </p>
      </header>

      {!configured ? (
        <Card className="mt-8 p-6">
          <h2 className="font-semibold">History is not configured</h2>
          <p className="mt-2 max-w-prose text-muted">
            Investigations run normally, but they are not being stored. Set{" "}
            <span className="wl-mono">NEXT_PUBLIC_SUPABASE_URL</span> and{" "}
            <span className="wl-mono">SUPABASE_SERVICE_ROLE_KEY</span>, then apply
            the migration in{" "}
            <span className="wl-mono">supabase/migrations</span> to enable it.
          </p>
          <Link
            href="/investigate"
            className="mt-5 inline-flex h-10 items-center justify-center rounded-lg bg-accent px-4 text-sm font-medium text-accent-foreground"
          >
            Start an investigation
          </Link>
        </Card>
      ) : investigations.length === 0 ? (
        <Card className="mt-8 p-6">
          <h2 className="font-semibold">No investigations yet</h2>
          <p className="mt-2 text-muted">
            Completed investigations will be listed here.
          </p>
          <Link
            href="/investigate"
            className="mt-5 inline-flex h-10 items-center justify-center rounded-lg bg-accent px-4 text-sm font-medium text-accent-foreground"
          >
            Start an investigation
          </Link>
        </Card>
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {investigations.map((investigation) => (
            <li key={investigation.id}>
              <Card className="flex h-full flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <p className="wl-mono text-subtle">
                    {formatCoordinate(investigation.latitude)},{" "}
                    {formatCoordinate(investigation.longitude)}
                  </p>
                  {investigation.riskLevel ? (
                    <Badge tone={LEVEL_TONE[investigation.riskLevel]}>
                      {investigation.riskLevel.replace("_", " ")}
                    </Badge>
                  ) : (
                    <Badge tone="neutral">{investigation.status}</Badge>
                  )}
                </div>

                <p className="mt-2 text-[0.9375rem] font-medium">
                  {investigation.placeName ?? "Unresolved location"}
                </p>

                <p className="mt-1 text-[0.8125rem] text-muted">
                  <time dateTime={investigation.createdAt}>
                    {new Date(investigation.createdAt).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </time>
                  {investigation.confidence !== null
                    ? ` · confidence ${formatConfidence(investigation.confidence)}`
                    : null}
                </p>

                <a
                  href={`https://www.openstreetmap.org/?mlat=${investigation.latitude}&mlon=${investigation.longitude}#map=15/${investigation.latitude}/${investigation.longitude}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="mt-auto pt-4 text-[0.8125rem] underline decoration-line-strong underline-offset-2 hover:text-foreground"
                >
                  View location on OpenStreetMap
                </a>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
