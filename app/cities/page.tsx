import Link from "next/link";
import {
  DisplayHeading,
  Eyebrow,
  Rule,
} from "@/components/ui/primitives";
import { RESEARCH_CITIES, cityInvestigateHref } from "@/lib/geo/cities";

export const metadata = { title: "Research cities" };

/**
 * OneAquaHealth research city hubs. Each city page pre-filters to that
 * city's sites and investigations, with a one-click prefilled entry.
 */
export default function CitiesPage() {
  return (
    <main className="mx-auto w-full max-w-[1180px] px-6 py-10 sm:px-10 sm:py-14">
      <header className="hydros-prose">
        <Eyebrow>OneAquaHealth network</Eyebrow>
        <DisplayHeading level={1} className="mt-2 text-3xl sm:text-5xl">
          Research <em>cities</em>
        </DisplayHeading>
        <p className="mt-3 text-ink-muted">
          Five urban waterways, five living laboratories. Each hub gathers the
          sites and investigations recorded near its river.
        </p>
      </header>

      <Rule strong className="mt-8" />

      <ul className="mt-8 grid gap-x-10 gap-y-10 sm:grid-cols-2">
        {RESEARCH_CITIES.map((city) => (
          <li key={city.slug} className="border-t-2 border-ink pt-4">
            <p className="font-mono text-[0.6875rem] tracking-widest text-ink-muted uppercase">
              {city.country}
            </p>
            <h2 className="mt-1 font-serif text-3xl">
              <Link href={`/cities/${city.slug}`} className="hover:underline">
                {city.name}
              </Link>
            </h2>
            <p className="mt-1 font-serif text-lg text-ink-muted italic">
              {city.waterway}
            </p>
            <p className="mt-2 font-mono text-[0.8125rem] text-ink-faint">
              {city.latitude.toFixed(4)}, {city.longitude.toFixed(4)}
            </p>
            <p className="hydros-prose mt-3 text-[0.9375rem] text-ink-muted">
              {city.note}
            </p>
            <div className="mt-4 flex flex-wrap gap-4">
              <Link
                href={`/cities/${city.slug}`}
                className="font-mono text-[0.8125rem] tracking-wider uppercase underline underline-offset-4 hover:text-ink"
              >
                City hub →
              </Link>
              <Link
                href={cityInvestigateHref(city.slug)}
                className="font-mono text-[0.8125rem] tracking-wider uppercase underline underline-offset-4 hover:text-ink"
              >
                Investigate this city →
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
