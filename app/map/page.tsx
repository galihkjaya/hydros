import Link from "next/link";
import { MapLoader } from "@/components/map/MapLoader";
import { Chip, Eyebrow, DisplayHeading, Rule, riskChipTone } from "@/components/ui/primitives";
import { formatConfidence } from "@/lib/utils/format";
import { formatCoordinate } from "@/lib/utils/validation";
import { evaluateSiteAlerts } from "@/lib/investigation/alerts";
import {
  isPersistenceEnabled,
  listRecentInvestigations,
  listVisits,
} from "@/lib/supabase/store";

export const metadata = { title: "Map" };

/**
 * Investigation map and index.
 *
 * Server component: reads Supabase directly and serializes the point set for
 * the client map. `?view=index` keeps the editorial list alongside the map.
 */
export const dynamic = "force-dynamic";

export default async function MapPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await searchParams;
  const showIndex = view === "index";
  const configured = isPersistenceEnabled();
  const visits = configured ? await listVisits(undefined, 200) : [];

  const bySite = new Map<string, typeof visits>();
  for (const visit of visits) {
    if (!visit.siteGeohash) continue;
    const list = bySite.get(visit.siteGeohash) ?? [];
    list.push(visit);
    bySite.set(visit.siteGeohash, list);
  }
  const alertSites: Record<string, "watch" | "concern"> = {};
  for (const [geohash, siteVisits] of bySite) {
    const alerts = evaluateSiteAlerts(geohash, siteVisits);
    const top = alerts.sort((a, b) => (a.severity === "concern" ? -1 : 1))[0];
    if (top) alertSites[geohash] = top.severity;
  }

  const points = visits.map((visit) => ({
    id: visit.id,
    createdAt: visit.createdAt,
    placeName: visit.placeName,
    latitude: visit.latitude,
    longitude: visit.longitude,
    imageUrl: visit.imageUrl,
    riskLevel: visit.riskLevel,
    siteGeohash: visit.siteGeohash,
    guidedMode: visit.guidedMode,
    sourceCount: visit.sourceUrls.length,
    assessmentSummary: visit.assessmentSummary,
  }));

  const investigations = configured ? await listRecentInvestigations(24) : [];

  return (
    <main className="mx-auto w-full max-w-[1180px] px-6 py-10 sm:px-10 sm:py-14">
      <header className="hydros-prose">
        <Eyebrow>History</Eyebrow>
        <DisplayHeading level={1} className="mt-2 text-3xl sm:text-5xl">
          The waters <em>on record</em>
        </DisplayHeading>
        <p className="mt-3 text-ink-muted">
          Every investigation as a marker on a printed map — or as an index,
          if you prefer reading.
        </p>
      </header>

      <nav aria-label="Map views" className="mt-6 flex gap-2">
        <Link
          href="/map"
          aria-current={!showIndex ? "page" : undefined}
          className={
            !showIndex
              ? "bg-ink px-3 py-1.5 font-mono text-[0.8125rem] tracking-wider text-paper uppercase"
              : "border border-ink px-3 py-1.5 font-mono text-[0.8125rem] tracking-wider uppercase hover:bg-paper-sunk"
          }
        >
          Map
        </Link>
        <Link
          href="/map?view=index"
          aria-current={showIndex ? "page" : undefined}
          className={
            showIndex
              ? "bg-ink px-3 py-1.5 font-mono text-[0.8125rem] tracking-wider text-paper uppercase"
              : "border border-ink px-3 py-1.5 font-mono text-[0.8125rem] tracking-wider uppercase hover:bg-paper-sunk"
          }
        >
          Index
        </Link>
      </nav>

      <Rule strong className="mt-6" />

      {!configured ? (
        <div className="mt-8 border-t border-rule pt-5">
          <h2 className="font-serif text-2xl">History is not configured</h2>
          <p className="hydros-prose mt-2 text-ink-muted">
            Investigations run normally, but they are not being stored. Set{" "}
            <span className="font-mono text-[0.8125rem]">NEXT_PUBLIC_SUPABASE_URL</span> and{" "}
            <span className="font-mono text-[0.8125rem]">SUPABASE_SERVICE_ROLE_KEY</span>, then apply
            the migration in{" "}
            <span className="font-mono text-[0.8125rem]">supabase/migrations</span> to enable it.
          </p>
          <Link
            href="/investigate"
            className="mt-5 inline-flex h-10 items-center justify-center bg-ink px-4 text-sm font-medium text-paper"
          >
            Start an investigation
          </Link>
        </div>
      ) : showIndex ? (
        <ul className="mt-8 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {investigations.map((investigation) => (
            <li key={investigation.id} className="border-t-2 border-ink pt-4">
              <div className="flex items-start justify-between gap-3">
                <p className="font-mono text-[0.8125rem] text-ink-faint">
                  {formatCoordinate(investigation.latitude)},{" "}
                  {formatCoordinate(investigation.longitude)}
                </p>
                {investigation.riskLevel ? (
                  <Chip tone={riskChipTone(investigation.riskLevel)}>
                    {investigation.riskLevel.replace("_", " ")}
                  </Chip>
                ) : (
                  <Chip tone="neutral">{investigation.status}</Chip>
                )}
              </div>
              <p className="mt-2 font-serif text-xl">
                <Link href={`/investigations/${investigation.id}`} className="hover:underline">
                  {investigation.placeName ?? "Unresolved location"}
                </Link>
              </p>
              <p className="mt-1 font-mono text-[0.8125rem] text-ink-muted">
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
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-8">
          {points.length === 0 ? (
            <div className="border-t border-rule pt-5">
              <h2 className="font-serif text-2xl">No investigations yet</h2>
              <p className="mt-2 text-ink-muted">
                Completed investigations will appear here as markers.
              </p>
              <Link
                href="/investigate"
                className="mt-5 inline-flex h-10 items-center justify-center bg-ink px-4 text-sm font-medium text-paper"
              >
                Start an investigation
              </Link>
            </div>
          ) : (
            <MapLoader points={points} alertSites={alertSites} />
          )}
        </div>
      )}
    </main>
  );
}
