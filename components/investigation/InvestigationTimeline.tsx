import { cn } from "@/components/ui/primitives";
import type { TimelineStage } from "./view-model";

/**
 * Vertical stage list. Each row reflects a real pipeline stage; the active row
 * shows what the server is doing right now, completed rows show what it found.
 *
 * The whole list is a live region so screen readers hear progress without the
 * user having to poll it.
 */
export function InvestigationTimeline({
  stages,
}: {
  stages: readonly TimelineStage[];
}) {
  return (
    <ol aria-live="polite" className="space-y-0">
      {stages.map((stage, index) => (
        <li key={stage.id} className="flex gap-3">
          {/* Marker column with the connecting rail. */}
          <div className="flex flex-col items-center">
            <StageMarker state={stage.state} />
            {index < stages.length - 1 ? (
              <span
                aria-hidden="true"
                className={cn(
                  "w-px flex-1",
                  stage.state === "done" ? "bg-ink" : "bg-line",
                )}
              />
            ) : null}
          </div>

          <div className={cn("min-w-0 pb-5", index === stages.length - 1 && "pb-0")}>
            <p
              className={cn(
                "text-[0.9375rem] leading-6",
                stage.state === "pending" && "text-subtle",
                stage.state === "active" && "font-medium text-foreground",
                stage.state === "done" && "text-foreground",
                stage.state === "failed" && "font-medium text-signal",
                stage.state === "skipped" && "text-subtle",
              )}
            >
              {stage.state === "active" ? stage.activeLabel : stage.label}
              {stage.state === "skipped" ? " — skipped" : null}
            </p>
            {stage.detail ? (
              <p className="mt-0.5 text-[0.8125rem] text-muted">{stage.detail}</p>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

function StageMarker({ state }: { state: TimelineStage["state"] }) {
  if (state === "done") {
    return (
      <span
        aria-hidden="true"
        className="flex size-5 shrink-0 items-center justify-center bg-ink text-paper"
      >
        <svg viewBox="0 0 16 16" className="size-3" fill="none">
          <path
            d="M3.5 8.5l3 3 6-6.5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    );
  }

  if (state === "failed") {
    return (
      <span
        aria-hidden="true"
        className="flex size-5 shrink-0 items-center justify-center bg-signal text-white"
      >
        <svg viewBox="0 0 16 16" className="size-3" fill="none">
          <path
            d="M4.5 4.5l7 7M11.5 4.5l-7 7"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </span>
    );
  }

  if (state === "active") {
    return (
      <span
        aria-hidden="true"
        className="flex size-5 shrink-0 items-center justify-center"
      >
        <span className="size-2.5 animate-pulse bg-ink" />
        <span className="absolute size-5 border border-ink-faint" />
      </span>
    );
  }

  if (state === "skipped") {
    return (
      <span
        aria-hidden="true"
        className="flex size-5 shrink-0 items-center justify-center"
      >
        <span className="size-2 border border-dashed border-ink-faint" />
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      className="flex size-5 shrink-0 items-center justify-center"
    >
      <span className="size-2 border border-ink-faint" />
    </span>
  );
}
