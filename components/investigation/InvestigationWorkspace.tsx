"use client";

import Image from "next/image";
import Link from "next/link";
import { Badge, Card, SectionHeading } from "@/components/ui/primitives";
import { InvestigationStatus } from "./InvestigationStatus";
import { InvestigationTimeline } from "./InvestigationTimeline";
import { SourceGathering } from "./SourceGathering";
import { SourceRow } from "./EvidenceCard";
import { GeographicContextPanel, VisualObservations } from "./ContextPanels";
import { RiskAssessment } from "./RiskAssessment";
import { WaterMap } from "@/components/map/WaterMap";
import { useInvestigationStream } from "./useInvestigation";
import { useDraft } from "@/lib/investigation/draft";
import { formatCoordinate } from "@/lib/utils/validation";

/**
 * Investigation workspace.
 *
 * Layout: status and timeline in a sticky rail, evidence and assessment in the
 * main column. Panels appear as their stage produces data, driven by real
 * server-sent events — nothing here is on a timer.
 */
export function InvestigationWorkspace({
  investigationId,
}: {
  investigationId: string;
}) {
  // undefined until the client has read sessionStorage; null when absent.
  const draft = useDraft(investigationId);
  const { state, connectionError } = useInvestigationStream(
    draft,
    investigationId,
  );

  if (draft === null) {
    return (
      <div className="mx-auto max-w-md border-t-2 border-ink p-6 pt-4 text-center">
        <h1 className="font-serif text-2xl">Investigation not found</h1>
        <p className="mt-2 text-ink-muted">
          This investigation is no longer in this tab&apos;s session. Start a new
          one to continue.
        </p>
        <Link
          href="/investigate"
          className="mt-5 inline-flex h-10 items-center justify-center bg-ink px-4 text-sm font-medium text-paper"
        >
          New investigation
        </Link>
      </div>
    );
  }

  const searchStage = state.stages.find((stage) => stage.id === "search");
  const searching = searchStage?.state === "active";
  const error = state.error ?? connectionError;

  return (
    <div className="grid gap-10 lg:grid-cols-12">
      {/* Rail: input recap, status, timeline */}
      <div className="space-y-6 lg:col-span-5">
        <Card className="overflow-hidden lg:sticky lg:top-20">
          {draft ? (
            <figure>
              <div className="relative aspect-[4/3] w-full border border-ink bg-paper-sunk">
                <Image
                  src={draft.imageDataUrl}
                  alt="The water source under investigation"
                  fill
                  unoptimized
                  sizes="(max-width: 1024px) 100vw, 400px"
                  className="object-cover"
                />
              </div>
              <figcaption className="mt-2 font-serif text-sm text-ink-muted italic">
                The water source under investigation.
              </figcaption>
            </figure>
          ) : null}

          <div className="space-y-5 p-5">
            {draft ? (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="wl-mono text-muted">
                  {formatCoordinate(draft.latitude)},{" "}
                  {formatCoordinate(draft.longitude)}
                </span>
                <a
                  href={`https://www.openstreetmap.org/?mlat=${draft.latitude}&mlon=${draft.longitude}#map=15/${draft.latitude}/${draft.longitude}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-[0.8125rem] underline decoration-line-strong underline-offset-2 hover:text-foreground"
                >
                  View on OpenStreetMap
                </a>
              </div>
            ) : null}

            {state.visual?.summary ? (
              <div>
                <p className="wl-label">Scene</p>
                <p className="mt-1 text-[0.875rem] leading-6 text-muted">
                  {state.visual.summary}
                </p>
              </div>
            ) : null}

            {draft?.note ? (
              <div>
                <p className="wl-label">Your observation</p>
                <p className="mt-1 text-[0.875rem] leading-6 text-muted">
                  {draft.note}
                </p>
              </div>
            ) : null}

            <div className="border-t border-line pt-5">
              <InvestigationStatus
                stages={state.stages}
                finished={state.finished}
                error={error}
                currentQuery={state.currentQuery}
              />
            </div>

            <div className="border-t border-line pt-5">
              <p className="wl-label mb-3">Progress</p>
              <InvestigationTimeline stages={state.stages} />
            </div>

            {error ? (
              <div className="border-t border-line pt-5">
                <Link
                  href="/investigate"
                  className="inline-flex h-10 items-center justify-center border border-ink px-4 text-sm font-medium transition-colors hover:bg-paper-sunk"
                >
                  Start a new investigation
                </Link>
              </div>
            ) : null}
          </div>
        </Card>
      </div>

      {/* Main column */}
      <div className="space-y-6 lg:col-span-7">
        <Card className="p-5 sm:p-6">
          <SectionHeading
            label="Observation"
            title="What is visible in the photograph"
            action={
              state.visual ? (
                <Badge tone="neutral">{state.visual.observations.length}</Badge>
              ) : null
            }
          />
          <div className="mt-4">
            <VisualObservations
              observations={state.visual?.observations ?? []}
            />
          </div>
          {state.visual && state.visual.limitations.length > 0 ? (
            <details className="mt-4 border-t border-line pt-3">
              <summary className="cursor-pointer text-[0.8125rem] text-muted">
                What this photograph cannot show
              </summary>
              <ul className="mt-2 space-y-1">
                {state.visual.limitations.map((limitation) => (
                  <li key={limitation} className="text-[0.8125rem] text-subtle">
                    {limitation}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </Card>

        <Card className="p-5 sm:p-6">
          <SectionHeading
            label="Context"
            title="Nearby mapped features"
            action={
              state.geoSources.length > 0 ? (
                <Badge tone="neutral">{state.geoSources.length}</Badge>
              ) : null
            }
          />
          <div className="mt-4">
            <GeographicContextPanel sources={state.geoSources} />
          </div>
          {draft ? (
            <div className="mt-5 border-t border-line pt-5">
              <WaterMap
                location={{
                  latitude: draft.latitude,
                  longitude: draft.longitude,
                }}
              />
            </div>
          ) : null}
        </Card>

        <Card className="p-5 sm:p-6">
          <SectionHeading
            label="Sources"
            title="Where the information came from"
            action={
              state.sources.length > 0 ? (
                <Badge tone="neutral">{state.sources.length}</Badge>
              ) : null
            }
          />
          <SourceGathering sources={state.sources} searching={searching} />
          {state.sources.length > 0 ? (
            <div className="mt-2 space-y-2">
              {state.sources.map((source) => (
                <SourceRow key={source.url} source={source} />
              ))}
            </div>
          ) : null}
        </Card>

        {state.assessment ? (
          <RiskAssessment
            assessment={state.assessment}
            sources={state.sources}
          />
        ) : (
          <Card className="p-5 sm:p-6">
            <SectionHeading
              label="Assessment"
              title={error ? "Not produced" : "Pending"}
            />
            <p className="mt-3 text-[0.875rem] text-muted">
              {error
                ? "The investigation stopped before an assessment could be produced. Anything gathered before that point is shown above."
                : "The assessment appears once the evidence has been gathered and reasoned over. It will state a risk level, its confidence, and what it cannot determine."}
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
