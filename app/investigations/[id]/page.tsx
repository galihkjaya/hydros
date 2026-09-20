import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Callout,
  Chip,
  DisplayHeading,
  Eyebrow,
  Figure,
  Rule,
  riskChipTone,
} from "@/components/ui/primitives";
import { GeographicContextPanel, VisualObservations } from "@/components/investigation/ContextPanels";
import { EvidenceCard, SourceRow } from "@/components/investigation/EvidenceCard";
import { HealthPathways } from "@/components/investigation/HealthPathways";
import { RiskAssessment } from "@/components/investigation/RiskAssessment";
import { RISK_LEVEL_LABELS } from "@/components/investigation/view-model";
import { formatCoordinate } from "@/lib/utils/validation";
import { siteGeohashFor } from "@/lib/geo/site";
import { getInvestigation } from "@/lib/supabase/store";

export const dynamic = "force-dynamic";

/**
 * Read-only investigation report.
 *
 * The shareable, seeded counterpart to the live workspace: everything a
 * completed investigation found, with provenance, pathways, and export links.
 * Works without JavaScript — judges can read it in the video without
 * clicking anything.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const investigation = await getInvestigation(id);
  return {
    title: investigation?.location.displayName ?? "Investigation",
  };
}

export default async function InvestigationReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const investigation = await getInvestigation(id);
  if (!investigation) notFound();

  const geohash = investigation.visual
    ? siteGeohashFor(
        investigation.location.latitude,
        investigation.location.longitude,
      )
    : null;
  const byUrl = new Map(
    investigation.sources.map((source) => [source.url, source]),
  );

  return (
    <main className="mx-auto w-full max-w-[1180px] px-6 py-10 sm:px-10 sm:py-14">
      <header className="hydros-prose">
        <Eyebrow>
          Investigation ·{" "}
          <time dateTime={investigation.createdAt}>
            {new Date(investigation.createdAt).toLocaleDateString(undefined, {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </time>
        </Eyebrow>
        <DisplayHeading level={1} className="mt-2 text-3xl sm:text-5xl">
          {investigation.location.displayName ?? "Unresolved location"}
        </DisplayHeading>
        <p className="mt-3 font-mono text-[0.8125rem] text-ink-muted">
          {formatCoordinate(investigation.location.latitude)},{" "}
          {formatCoordinate(investigation.location.longitude)}
          {investigation.assessment ? (
            <span className="ml-3">
              <Chip tone={riskChipTone(investigation.assessment.riskLevel)}>
                {RISK_LEVEL_LABELS[investigation.assessment.riskLevel]}
              </Chip>
            </span>
          ) : null}
        </p>
      </header>

      <Rule strong className="mt-8" />

      <div className="mt-8 grid gap-10 lg:grid-cols-12">
        <div className="space-y-10 lg:col-span-7">
          {investigation.imageUrl ? (
            <Figure
              caption={`The water source under investigation — ${investigation.location.displayName ?? "unresolved location"}.`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={investigation.imageUrl}
                alt="The water source under investigation"
                className="aspect-[4/3] w-full object-cover"
              />
            </Figure>
          ) : (
            <Callout eyebrow="Guided assessment">
              <p className="font-serif text-lg italic">
                No photograph — observations come from the guided checklist,
                attributed to the reporter.
              </p>
            </Callout>
          )}

          <section>
            <Eyebrow>Observation</Eyebrow>
            <h2 className="mt-1 font-serif text-2xl">
              What is visible
            </h2>
            <div className="mt-4">
              <VisualObservations
                observations={investigation.visual?.observations ?? []}
              />
            </div>
          </section>

          <section>
            <Eyebrow>Evidence</Eyebrow>
            <h2 className="mt-1 font-serif text-2xl">
              What sources state
            </h2>
            <div className="mt-4 space-y-3">
              {investigation.evidence.length > 0 ? (
                investigation.evidence.map((item, index) => (
                  <EvidenceCard
                    key={`${item.sourceUrl}-${index}`}
                    evidence={item}
                    source={byUrl.get(item.sourceUrl)}
                  />
                ))
              ) : (
                <p className="text-[0.875rem] text-ink-muted">
                  No sourced claims were extracted for this investigation.
                </p>
              )}
            </div>
          </section>

          {investigation.healthPathways.length > 0 ? (
            <HealthPathways
              pathways={investigation.healthPathways}
              sources={investigation.sources}
            />
          ) : null}

          {investigation.assessment ? (
            <RiskAssessment
              assessment={investigation.assessment}
              sources={investigation.sources}
              investigationId={investigation.id}
            />
          ) : null}
        </div>

        <div className="space-y-8 lg:col-span-5">
          <section>
            <Eyebrow>Context</Eyebrow>
            <h2 className="mt-1 font-serif text-2xl">Nearby mapped features</h2>
            <div className="mt-4">
              <GeographicContextPanel
                sources={investigation.geographic?.potentialRiskSources ?? []}
              />
            </div>
          </section>

          <section>
            <Eyebrow>Sources</Eyebrow>
            <h2 className="mt-1 font-serif text-2xl">
              Where the information came from
            </h2>
            <div className="mt-4 space-y-2">
              {investigation.sources.map((source) => (
                <SourceRow key={source.url} source={source} />
              ))}
            </div>
          </section>

          <section className="border-t border-rule pt-5">
            <Eyebrow>Exports</Eyebrow>
            <ul className="mt-3 space-y-2 font-mono text-[0.8125rem] tracking-wider uppercase">
              <li>
                <a
                  href={`/api/investigate/${investigation.id}/fhir`}
                  className="underline underline-offset-4 hover:text-ink"
                >
                  FHIR R4 bundle ↓
                </a>
              </li>
              <li>
                <a
                  href={`/api/investigate/${investigation.id}/jsonld`}
                  className="underline underline-offset-4 hover:text-ink"
                >
                  JSON-LD dataset ↓
                </a>
              </li>
              {geohash ? (
                <li>
                  <Link
                    href={`/site/${geohash}`}
                    className="underline underline-offset-4 hover:text-ink"
                  >
                    Site profile →
                  </Link>
                </li>
              ) : null}
            </ul>
          </section>
        </div>
      </div>
    </main>
  );
}
