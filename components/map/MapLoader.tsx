"use client";

import dynamic from "next/dynamic";
import type { MapPoint } from "./InvestigationMap";

/**
 * Client boundary for the MapLibre map: `ssr: false` is only legal inside a
 * Client Component, so the server page renders this loader instead.
 */
const InvestigationMap = dynamic(
  () =>
    import("@/components/map/InvestigationMap").then(
      (mod) => mod.InvestigationMap,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="border border-ink bg-paper-sunk p-10 text-center">
        <p className="hydros-eyebrow">Map</p>
        <p className="mt-2 font-serif text-xl text-ink-muted italic">
          Loading the printed map…
        </p>
      </div>
    ),
  },
);

export function MapLoader({
  points,
  alertSites,
}: {
  points: MapPoint[];
  alertSites: Record<string, "watch" | "concern">;
}) {
  return <InvestigationMap points={points} alertSites={alertSites} />;
}
