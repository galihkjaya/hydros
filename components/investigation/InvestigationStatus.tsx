import { Badge } from "@/components/ui/primitives";
import type { StageId, TimelineStage } from "./view-model";

/**
 * Headline status: the single sentence describing what is happening now, plus
 * a coarse progress indicator derived from completed stages.
 */
export function InvestigationStatus({
  stages,
  finished,
  error,
}: {
  stages: readonly TimelineStage[];
  finished: boolean;
  error?: string;
}) {
  const active = stages.find((stage) => stage.state === "active");
  const failed = stages.find((stage) => stage.state === "failed");
  const done = stages.filter((stage) => stage.state === "done").length;
  const progress = Math.round((done / stages.length) * 100);

  const headline = error
    ? "Investigation stopped"
    : failed
      ? `Stopped during ${failed.label.toLowerCase()}`
      : finished
        ? "Investigation complete"
        : (active?.activeLabel ?? "Starting investigation…");

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          {!finished && !error && !failed ? (
            <Spinner />
          ) : null}
          <p
            aria-live="polite"
            className="text-[0.9375rem] font-medium text-foreground"
          >
            {headline}
          </p>
        </div>
        <Badge tone={error || failed ? "high" : finished ? "low" : "accent"}>
          {error || failed ? "Incomplete" : finished ? "Done" : `${progress}%`}
        </Badge>
      </div>

      {/* Progress rail. aria-hidden: the text above already conveys state. */}
      <div
        aria-hidden="true"
        className="mt-3 h-1 w-full overflow-hidden rounded-full bg-surface-muted"
      >
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-500 ease-out"
          style={{ width: `${Math.max(progress, finished ? 100 : 4)}%` }}
        />
      </div>

      {error ? (
        <p role="alert" className="mt-3 text-[0.875rem] text-risk-high">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="size-4 shrink-0 animate-spin rounded-full border-2 border-line-strong border-t-accent"
    />
  );
}

/** Stage ids whose panels are only meaningful once the stage has run. */
export function isStageReached(
  stages: readonly TimelineStage[],
  id: StageId,
): boolean {
  const stage = stages.find((candidate) => candidate.id === id);
  return stage ? stage.state === "done" || stage.state === "active" : false;
}
