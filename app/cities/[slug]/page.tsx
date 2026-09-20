import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Chip,
  DisplayHeading,
  Eyebrow,
  Rule,
  riskChipTone,
} from "@/components/ui/primitives";
import { RESEARCH_CITIES, cityInvestigateHref } from "@/lib/geo/cities";
import { distanceMetres } from "@/lib/utils/distance";
import { formatCoordinate } from "@/lib/utils/validation";
import {
  isPersistenceEnabled,
  listSites,
  listVisits,
} from "@/lib/supabase/store";

export const dynamic = "force-dynamic";

/** Sites within this radius count as the city's. */
const CITY_RADIUS_METRES = 15_000;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const city = RESEARCH_CITIES.find((c) => c.slug === slug);
  return { title: city ? `${city.name} — Research city` : "Research city" };
}

export default async function CityPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const city = RESEARCH_CITIES.find((c) => c.slug === slug);
  if (!city) notFound();

  const configured = isPersistenceEnabled();
  const sites = configured ? await listSites(200) : [];
  const citySites = sites.filter(
    (site) =>
      distanceMetres(
        { latitude: city.latitude, longitude: city.longitude },
        { latitude: site.centroidLat, longitude: site.centroidLng },
      ) <= CITY_RADIUS_METRES,
  );

  const visits =
    configured && citySites.length > 0 ? await listVisits(undefined, 500) : [];
  const siteSet = new Set(citySites.map((site) => site.geohash));
  const cityVisits = visits
    .filter((visit) => visit.siteGeohash && siteSet.has(visit.siteGeohash))
    .reverse();

  return (
    <main className="mx-auto w-full max-w-[1180px] px-6 py-10 sm:px-10 sm:py-14">
      <header className="hydros-prose">
        <Eyebrow>
          Research city · {city.country}
        </Eyebrow>
        <DisplayHeading level={1} className="mt-2 text-3xl sm:text-5xl">
          {city.name} — <em>{city.waterway}</em>
        </DisplayHeading>
        <p className="mt-3 text-ink-muted">{city.note}</p>
        <p className="mt-2 font-mono text-[0.8125rem] text-ink-faint">
          {formatCoordinate(city.latitude)}, {formatCoordinate(city.longitude)}
        </p>
        <Link
          href={cityInvestigateHref(city.slug)}
          className="mt-6 inline-flex h-12 items-center justify-center bg-ink px-6 text-[0.9375rem] font-medium text-paper transition-opacity hover:opacity-85"
        >
          Investigate this city
        </Link>
      </header>

      <Rule strong className="mt-8" />

      <section className="mt-8">
        <Eyebrow>
          On record · {citySites.length} site{citySites.length === 1 ? "" : "s"} ·{" "}
          {cityVisits.length} investigation{cityVisits.length === 1 ? "" : "s"}
        </Eyebrow>
        {citySites.length === 0 ? (
          <p className="mt-3 max-w-prose text-ink-muted">
            Nothing recorded near {city.waterway} yet. Be the first to
            investigate it.
          </p>
        ) : (
          <ul className="mt-6 grid gap-x-10 gap-y-8 sm:grid-cols-2">
            {citySites.map((site) => (
              <li key={site.geohash} className="border-t-2 border-ink pt-4">
                <p className="font-mono text-[0.8125rem] text-ink-faint">
                  {site.geohash}
                </p>
                <h2 className="mt-1 font-serif text-2xl">
                  <Link
                    href={`/site/${site.geohash}`}
                    className="hover:underline"
                  >
                    {site.displayName ?? site.waterwayName ?? "Unresolved location"}
                  </Link>
                </h2>
                <p className="mt-1 font-mono text-[0.8125rem] text-ink-muted">
                  {site.investigationCount} investigation
                  {site.investigationCount === 1 ? "" : "s"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {cityVisits.length > 0 ? (
        <section className="mt-10">
          <Eyebrow>Latest investigations</Eyebrow>
          <ul className="mt-6 grid gap-x-10 gap-y-8 sm:grid-cols-2">
            {cityVisits.slice(0, 6).map((visit) => (
              <li key={visit.id} className="border-t border-rule pt-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-serif text-xl">
                    <Link
                      href={`/investigations/${visit.id}`}
                      className="hover:underline"
                    >
                      {visit.placeName ?? "Unresolved location"}
                    </Link>
                  </p>
                  {visit.riskLevel ? (
                    <Chip tone={riskChipTone(visit.riskLevel)}>
                      {visit.riskLevel.replace("_", " ")}
                    </Chip>
                  ) : null}
                </div>
                <p className="mt-1 font-mono text-[0.8125rem] text-ink-faint">
                  <time dateTime={visit.createdAt}>
                    {new Date(visit.createdAt).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </time>
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
