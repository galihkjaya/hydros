"use client";

import { Logo } from "@/components/layout/Logo";
import { SourceFavicon } from "./SourceFavicon";
import type { SourceView } from "./view-model";

/**
 * Discovered sources gathering toward the WaterLens mark.
 *
 * Each icon is a real discovered URL — nothing is invented to fill the ring.
 * Motion is refined in a later commit; this establishes the layout and the
 * reduced-motion behaviour (the global stylesheet neutralises the animation
 * duration, leaving the icons in their final gathered position).
 */
export function SourceGathering({
  sources,
  searching,
}: {
  sources: readonly SourceView[];
  searching: boolean;
}) {
  if (sources.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <Logo className="size-9 text-line-strong" />
        <p className="mt-3 text-[0.875rem] text-muted">
          {searching ? "Searching for relevant sources…" : "No sources yet."}
        </p>
      </div>
    );
  }

  return (
    <div className="py-4">
      <div className="flex flex-wrap items-center justify-center gap-2">
        {sources.map((source) => (
          <span
            key={source.url}
            title={source.domain}
            className="animate-rise flex size-9 items-center justify-center rounded-full border border-line bg-surface"
          >
            <SourceFavicon url={source.url} size={18} />
          </span>
        ))}
      </div>

      <div className="mt-4 flex flex-col items-center">
        <span aria-hidden="true" className="h-6 w-px bg-line" />
        <Logo className="size-8 text-accent" />
        <p className="mt-2 text-[0.8125rem] text-muted">
          {sources.length === 1
            ? "1 source gathered"
            : `${sources.length} sources gathered`}
        </p>
      </div>
    </div>
  );
}
