"use client";

import Image from "next/image";
import Link from "next/link";
import { Badge, Card, SectionHeading } from "@/components/ui/primitives";
import { InvestigationStatus } from "./InvestigationStatus";
import { InvestigationTimeline } from "./InvestigationTimeline";
import { SourceGathering } from "./SourceGathering";
import { SourceRow } from "./EvidenceCard";
import { GeographicContext, VisualObservations } from "./ContextPanels";
import { RiskAssessment } from "./RiskAssessment";
import { useMockInvestigation, useWorkspaceState } from "./useInvestigation";
import { useDraft } from "@/lib/investigation/draft";
import { formatCoordinate } from "@/lib/utils/validation";

/**
 * Investigation workspace.
 *
 * Layout: status and timeline in a sticky rail, evidence and assessment in the
 * main column. Panels appear as their stage produces data rather than all at
 * once, so the screen reflects the investigation's actual progress.
 *
 * The pipeline is not connected yet — a scripted mock driver supplies the
 * events and the banner below says so plainly. Commit 22 swaps the driver for
 * the real event stream.
 */
export function InvestigationWorkspace({ investigationId }: { investigationId: string }) {
  const [state, dispatch] = useWorkspaceState();
  // undefined until the client has read sessionStorage; null when absent.
  const draft = useDraft(investigationId);

  useMockInvestigation(dispatch, !!draft);

  if (draft === null) {
    return (
      <Card className="mx-auto max-w-md p-6 text-center">
        <h1 className="text-lg font-semibold">Investigation not found</h1>
        <p className="mt-2 text-muted">
          This investigation is no longer in this tab&apos;s session. Start a new
          one to continue.
        </p>
        <Link
          href="/investigate"
          className="mt-5 inline-flex h-10 items-center justify-center rounded-lg bg-accent px-4 text-sm font-medium text-accent-foreground"
        >
          New investigation
        </Link>
      </Card>
    );
  }

  const searching = state.stages.some(
    (stage) => stage.id === "search" && stage.state === "active",
  );

  return (
    <div className="space-y-6">
      {/* Mock notice: removed with the mock driver in commit 22. */}
      <p className="rounded-lg border border-risk-medium/40 bg-risk-medium/10 px-4 py-2.5 text-[0.8125rem]">
        <span className="font-semibold">Interface preview.</span> The pipeline is
        not connected yet, so the results below are scripted placeholder data,
        not a real investigation.
      </p>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Rail: input recap, status, timeline */}
        <div className="space-y-6 lg:col-span-2">
          <Card className="overflow-hidden lg:sticky lg:top-20">
            {draft ? (
              <div className="relative aspect-[4/3] w-full bg-surface-muted">
                <Image
                  src={draft.imageDataUrl}
                  alt="The water source under investigation"
                  fill
                  unoptimized
                  sizes="(max-width: 1024px) 100vw, 400px"
                  className="object-cover"
                />
              </div>
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
                  error={state.error}
                />
              </div>

              <div className="border-t border-line pt-5">
                <p className="wl-label mb-3">Progress</p>
                <InvestigationTimeline stages={state.stages} />
              </div>
            </div>
          </Card>
        </div>

        {/* Main column */}
        <div className="space-y-6 lg:col-span-3">
          <Card className="p-5 sm:p-6">
            <SectionHeading
              label="Observation"
              title="What is visible in the photograph"
              action={
                state.observations.length > 0 ? (
                  <Badge tone="neutral">{state.observations.length}</Badge>
                ) : null
              }
            />
            <div className="mt-4">
              <VisualObservations observations={state.observations} />
            </div>
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
              <GeographicContext sources={state.geoSources} />
            </div>
          </Card>

          <Card className="p-5 sm:p-6">
            <SectionHeading
              label="Sources"
              title="Where the information came from"
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
              evidence={state.evidence}
              sources={state.sources}
            />
          ) : (
            <Card className="p-5 sm:p-6">
              <SectionHeading label="Assessment" title="Pending" />
              <p className="mt-3 text-[0.875rem] text-muted">
                The assessment appears once the evidence has been gathered and
                reasoned over. It will state a risk level, its confidence, and
                what it cannot determine.
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
