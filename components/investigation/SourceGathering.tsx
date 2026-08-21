"use client";

import { useEffect, useRef, useState } from "react";
import { Logo } from "@/components/layout/Logo";
import { SourceFavicon } from "./SourceFavicon";
import { cn } from "@/components/ui/primitives";
import type { Source } from "@/types/investigation";

/**
 * Discovered sources gathering toward the WaterLens mark.
 *
 * Every icon is a real discovered URL — nothing is invented to fill the cluster.
 * A newly arrived source animates inward from its position in the ring toward
 * the mark, then settles; already-seen sources do not re-animate, so the motion
 * corresponds to actual discovery events.
 *
 * Reduced motion: the global stylesheet collapses animation durations, which
 * leaves every icon in its settled position — the layout is the same, only the
 * travel is removed.
 */
export function SourceGathering({
  sources,
  searching,
}: {
  sources: readonly Source[];
  searching: boolean;
}) {
  // Tracks which URLs have already played their arrival, so a re-render caused
  // by an unrelated event does not restart the animation.
  const seenRef = useRef<Set<string>>(new Set());
  const [arrived, setArrived] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fresh = sources.filter((source) => !seenRef.current.has(source.url));
    if (fresh.length === 0) return;
    for (const source of fresh) seenRef.current.add(source.url);

    // Let the entry animation run, then mark them settled.
    const timer = setTimeout(() => {
      setArrived(new Set(seenRef.current));
    }, 700);
    return () => clearTimeout(timer);
  }, [sources]);

  if (sources.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <Logo
          className={cn(
            "size-9 text-line-strong",
            searching && "animate-pulse text-accent/50",
          )}
        />
        <p className="mt-3 text-[0.875rem] text-muted">
          {searching
            ? "Searching for relevant sources…"
            : "No sources gathered yet."}
        </p>
      </div>
    );
  }

  return (
    <div className="py-2">
      {/*
        Fan layout: icons sit on an arc above the mark and are connected to it by
        hairlines, so the visual reads as convergence rather than decoration.
      */}
      <div className="relative mx-auto h-[132px] w-full max-w-sm sm:h-[148px]">
        {sources.map((source, index) => {
          const settled = arrived.has(source.url);
          const { left, top } = arcPosition(index, sources.length);
          return (
            <span
              key={source.url}
              // Title gives non-hover devices the domain via long-press, and
              // the source list below carries the same information as text.
              title={source.domain}
              style={{
                left: `${left}%`,
                top: `${top}%`,
                // Stagger only within a batch, capped so a burst of 6 results
                // does not feel sluggish.
                animationDelay: settled ? undefined : `${(index % 6) * 60}ms`,
              }}
              className={cn(
                "absolute flex size-9 -translate-x-1/2 items-center justify-center rounded-full border border-line bg-surface shadow-[var(--shadow-subtle)]",
                settled ? "animate-none" : "animate-gather",
              )}
            >
              <SourceFavicon url={source.url} size={18} />
            </span>
          );
        })}

        {/* Connecting hairlines, drawn behind the icons. */}
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 size-full"
          preserveAspectRatio="none"
          viewBox="0 0 100 100"
        >
          {sources.map((source, index) => {
            const { left, top } = arcPosition(index, sources.length);
            return (
              <line
                key={source.url}
                x1={left}
                y1={top + 7}
                x2="50"
                y2="86"
                stroke="currentColor"
                strokeWidth="0.4"
                className="text-line"
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
        </svg>

        {/* The mark: destination of the gathering. */}
        <span className="absolute bottom-0 left-1/2 flex -translate-x-1/2 flex-col items-center">
          <Logo className="size-8 text-accent" />
        </span>
      </div>

      <p className="mt-1 text-center text-[0.8125rem] text-muted" aria-live="polite">
        {sources.length === 1
          ? "1 source gathered"
          : `${sources.length} sources gathered`}
        {searching ? " so far…" : ""}
      </p>
    </div>
  );
}

/**
 * Position on the gathering arc, in percentages of the container.
 *
 * Icons spread across an arc whose width shrinks as the count grows, so 12
 * sources still fit on a narrow phone without overlapping the mark.
 */
function arcPosition(index: number, total: number): { left: number; top: number } {
  if (total === 1) return { left: 50, top: 4 };

  // Narrower spread for larger counts keeps everything inside the container.
  const spread = total <= 4 ? 62 : total <= 8 ? 76 : 86;
  const step = spread / (total - 1);
  const left = 50 - spread / 2 + index * step;

  // Shallow parabola: outer icons sit slightly higher than central ones.
  const normalized = (left - 50) / (spread / 2);
  const top = 4 + (1 - normalized * normalized) * 26;

  return { left, top };
}
