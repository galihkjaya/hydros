import { GuidedAssessmentForm } from "@/components/investigation/GuidedAssessmentForm";
import { DisplayHeading, Eyebrow, Rule } from "@/components/ui/primitives";
import { validateLatitude, validateLongitude } from "@/lib/utils/validation";

export const metadata = { title: "Guided assessment" };

/**
 * Guided stream assessment: a structured checklist instead of a free-form
 * photo upload. Accepts the same ?lat=&lon= prefills as /investigate.
 */
export default async function GuidedPage({
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
        <Eyebrow>Guided assessment</Eyebrow>
        <DisplayHeading level={1} className="mt-2 text-3xl sm:text-5xl">
          Read the stream, <em>item by item</em>
        </DisplayHeading>
        <p className="mt-3 text-ink-muted">
          Ten plain-language observations, no jargon and no photograph
          required. Your answers become structured observations attributed to
          you.
        </p>
      </header>

      <Rule strong className="mt-8" />

      <div className="mt-8">
        <GuidedAssessmentForm initialLocation={prefilled} />
      </div>
    </main>
  );
}
