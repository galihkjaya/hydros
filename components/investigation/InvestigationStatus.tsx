import { Badge } from "@/components/ui/primitives";
import type { TimelineStage } from "./view-model";

/**
 * Headline status: the single sentence describing what is happening now, plus
 * a coarse progress indicator derived from completed stages.
 */
export function InvestigationStatus({
  stages,
  finished,
  error,
  currentQuery,
}: {
  stages: readonly TimelineStage[];
  finished: boolean;
  error?: string;
  /** Shown while the search stage is running, so progress is visibly real. */
  currentQuery?: string;
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
          {!finished && !error && !failed ? <Spinner /> : null}
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

      {/* The live query makes it obvious the work is real, not a canned animation. */}
      {currentQuery && !finished && !error ? (
        <p className="wl-mono mt-1.5 truncate text-subtle">
          “{currentQuery}”
        </p>
      ) : null}

      {/* Progress rail. aria-hidden: the text above already conveys state. */}
      <div
        aria-hidden="true"
        className="mt-3 h-px w-full overflow-hidden bg-rule"
      >
        <div
          className="h-full bg-ink transition-[width] duration-500 ease-out"
          style={{ width: `${Math.max(progress, finished ? 100 : 4)}%` }}
        />
      </div>

      {error ? (
        <p role="alert" className="mt-3 text-[0.875rem] text-signal">
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
      className="size-4 shrink-0 animate-spin border-2 border-ink-faint border-t-ink"
    />
  );
}
