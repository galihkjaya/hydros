import Link from "next/link";
import { Chip, Eyebrow, DisplayHeading, Rule, riskChipTone } from "@/components/ui/primitives";
import { formatConfidence } from "@/lib/utils/format";
import { formatCoordinate } from "@/lib/utils/validation";
import {
  isPersistenceEnabled,
  listRecentInvestigations,
} from "@/lib/supabase/store";

export const metadata = { title: "Map" };

/**
 * Investigation history (the "Index" view).
 *
 * Server component: reads Supabase directly, so no client JavaScript and no
 * round trip through an API route. Renders a useful empty state when
 * persistence is not configured, since the rest of the app works without it.
 *
 * Branch 4 adds the greyscale MapLibre map alongside this list.
 */
export const dynamic = "force-dynamic";

export default async function MapPage() {
  const configured = isPersistenceEnabled();
  const investigations = configured ? await listRecentInvestigations() : [];

  return (
    <main className="mx-auto w-full max-w-[1180px] px-6 py-10 sm:px-10 sm:py-14">
      <header className="hydros-prose">
        <Eyebrow>History</Eyebrow>
        <DisplayHeading level={1} className="mt-2 text-3xl sm:text-5xl">
          Past <em>investigations</em>
        </DisplayHeading>
        <p className="mt-3 text-ink-muted">
          Water sources examined with Hydros, with the location and the
          assessment each one reached.
        </p>
      </header>

      <Rule strong className="mt-8" />

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
      ) : investigations.length === 0 ? (
        <div className="mt-8 border-t border-rule pt-5">
          <h2 className="font-serif text-2xl">No investigations yet</h2>
          <p className="mt-2 text-ink-muted">
            Completed investigations will be listed here.
          </p>
          <Link
            href="/investigate"
            className="mt-5 inline-flex h-10 items-center justify-center bg-ink px-4 text-sm font-medium text-paper"
          >
            Start an investigation
          </Link>
        </div>
      ) : (
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
                {investigation.placeName ?? "Unresolved location"}
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

              <a
                href={`https://www.openstreetmap.org/?mlat=${investigation.latitude}&mlon=${investigation.longitude}#map=15/${investigation.latitude}/${investigation.longitude}`}
                target="_blank"
                rel="noreferrer noopener"
                className="mt-3 inline-block text-[0.8125rem] underline underline-offset-4 hover:text-ink"
              >
                View location on OpenStreetMap
              </a>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
