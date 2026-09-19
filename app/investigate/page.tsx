import Link from "next/link";
import { InvestigationForm } from "@/components/investigation/InvestigationForm";
import { Eyebrow, DisplayHeading, Rule } from "@/components/ui/primitives";
import { validateLatitude, validateLongitude } from "@/lib/utils/validation";

export const metadata = { title: "Investigate" };

/**
 * New investigation. Accepts ?lat=&lon= prefills (used by the research-city
 * entry points) — the fields stay editable so the user can always correct
 * what will be submitted.
 */
export default async function InvestigatePage({
  searchParams,
}: {
  searchParams: Promise<{ lat?: string; lon?: string }>;
}) {
  const { lat, lon } = await searchParams;
  const latNumber = lat !== undefined ? Number(lat) : NaN;
  const lonNumber = lon !== undefined ? Number(lon) : NaN;
  const prefilled =
    validateLatitude(latNumber).ok && validateLongitude(lonNumber).ok
      ? { latitude: String(latNumber), longitude: String(lonNumber) }
      : undefined;

  return (
    <main className="mx-auto w-full max-w-[1180px] px-6 py-10 sm:px-10 sm:py-14">
      <header className="hydros-prose">
        <Eyebrow>New investigation</Eyebrow>
        <DisplayHeading level={1} className="mt-2 text-3xl sm:text-5xl">
          Investigate a <em>water source</em>
        </DisplayHeading>
        <p className="mt-3 text-ink-muted">
          Provide a photograph and the location. Observations are optional but
          they sharpen the research. Prefer a checklist?{" "}
          <Link
            href="/investigate/guided"
            className="underline underline-offset-4 hover:text-ink"
          >
            Take the guided stream assessment instead — no photo needed.
          </Link>
        </p>
      </header>

      <Rule strong className="mt-8" />

      <div className="mt-8">
        <InvestigationForm initialLocation={prefilled} />
      </div>
    </main>
  );
}
