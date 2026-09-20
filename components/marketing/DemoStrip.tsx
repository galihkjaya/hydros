import Link from "next/link";
import { Chip, Figure, riskChipTone } from "@/components/ui/primitives";
import {
  DEMO_INVESTIGATIONS,
  RESEARCH_CITIES,
  cityInvestigateHref,
} from "@/lib/geo/cities";
import { formatCoordinate } from "@/lib/utils/validation";
import { persistenceStatus } from "@/lib/supabase/client";
import { getInvestigation } from "@/lib/supabase/store";

/**
 * Live demo strip.
 *
 * Shows the real, completed, seeded investigations when the demo data has
 * landed, and honest prefilled entry points when it has not (fresh database,
 * persistence off). Never a placeholder: every card opens a working flow.
 */
export async function DemoStrip() {
  // Never fire failing requests: without a healthy database there is nothing
  // to look up, so every card is an honest prefilled entry point.
  const usable = persistenceStatus() === "on";
  const cards = await Promise.all(
    DEMO_INVESTIGATIONS.map(async ({ slug, id }) => {
      const city = RESEARCH_CITIES.find((c) => c.slug === slug)!;
      const investigation = usable
        ? await getInvestigation(id).catch(() => null)
        : null;
      return { city, investigation };
    }),
  );

  return (
    <ul className="mt-8 grid gap-8 sm:grid-cols-3">
      {cards.map(({ city, investigation }) =>
        investigation?.assessment ? (
          <li key={city.slug}>
            <Link
              href={`/investigations/${investigation.id}`}
              className="group block border-t-2 border-ink pt-4"
            >
              <Figure
                caption={`${city.waterway} — ${city.country}`}
              >
                {investigation.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={investigation.imageUrl}
                    alt={`Water source at ${city.waterway}, ${city.name}`}
                    className="aspect-[4/3] w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex aspect-[4/3] flex-col justify-between bg-paper-sunk p-5">
                    <p className="font-mono text-[0.6875rem] tracking-widest text-ink-muted uppercase">
                      {city.name}
                    </p>
                    <p className="font-serif text-3xl leading-none">
                      {city.waterway}
                    </p>
                  </div>
                )}
              </Figure>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <p className="font-mono text-[0.8125rem] text-ink-muted">
                  {formatCoordinate(investigation.location.latitude)},{" "}
                  {formatCoordinate(investigation.location.longitude)}
                </p>
                <Chip tone={riskChipTone(investigation.assessment.riskLevel)}>
                  {investigation.assessment.riskLevel.replace("_", " ")}
                </Chip>
              </div>
              <p className="mt-2 font-mono text-[0.8125rem] tracking-wider uppercase underline underline-offset-4 group-hover:text-ink">
                Read the investigation →
              </p>
            </Link>
          </li>
        ) : (
          <li key={city.slug}>
            <Link
              href={cityInvestigateHref(city.slug)}
              className="group block border-t-2 border-ink pt-4 transition-colors hover:bg-paper-sunk"
            >
              <Figure caption={`${city.waterway} — ${city.country}`}>
                <div className="flex aspect-[4/3] flex-col justify-between bg-paper-sunk p-5">
                  <p className="font-mono text-[0.6875rem] tracking-widest text-ink-muted uppercase">
                    {city.name}
                  </p>
                  <p className="font-serif text-3xl leading-none">
                    {city.waterway}
                  </p>
                  <p className="font-mono text-[0.8125rem] text-ink-muted">
                    {city.latitude.toFixed(4)}, {city.longitude.toFixed(4)}
                  </p>
                </div>
              </Figure>
              <p className="mt-3 text-[0.875rem] text-ink-muted">{city.note}</p>
              <p className="mt-2 font-mono text-[0.8125rem] tracking-wider uppercase underline underline-offset-4 group-hover:text-ink">
                Investigate this waterway →
              </p>
            </Link>
          </li>
        ),
      )}
    </ul>
  );
}
