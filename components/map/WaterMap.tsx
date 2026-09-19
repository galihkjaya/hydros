"use client";

import { useState } from "react";
import { Card } from "@/components/ui/primitives";
import { formatCoordinate } from "@/lib/utils/validation";
import { formatDistance } from "@/lib/utils/format";
import type { GeographicSource, Location } from "@/types/investigation";

/**
 * Map of the sampling point and nearby mapped features.
 *
 * Uses OpenStreetMap's own embed in an iframe rather than a mapping library.
 * Leaflet plus tile handling is ~45 KB of JavaScript to render a single
 * read-only view, and the embed is keyboard-accessible, works on mobile, and
 * costs nothing on a free tier.
 *
 * ponytail: the embed supports one marker, so risk sources are listed beside the
 * map with their own OSM links instead of being plotted. Swap in Leaflet or
 * MapLibre if plotted markers, clustering, or a drawn radius become necessary.
 */
export function WaterMap({
  location,
  sources = [],
  className,
}: {
  location: Location;
  sources?: readonly GeographicSource[];
  className?: string;
}) {
  // The iframe is only mounted after an explicit action, so opening a page with
  // several maps does not fetch tiles for all of them.
  const [showEmbed, setShowEmbed] = useState(false);

  const { latitude, longitude } = location;
  // ~0.012 degrees ≈ 1.3 km, which frames the 2 km search radius.
  const span = 0.012;
  const bbox = [
    longitude - span,
    latitude - span * 0.7,
    longitude + span,
    latitude + span * 0.7,
  ]
    .map((value) => value.toFixed(5))
    .join(",");

  const embedSrc = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${latitude},${longitude}`;
  const fullMapHref = `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=15/${latitude}/${longitude}`;

  return (
    <div className={className}>
      <div className="overflow-hidden border border-ink bg-paper-sunk">
        {showEmbed ? (
          <iframe
            title={`Map of the water source at ${formatCoordinate(latitude)}, ${formatCoordinate(longitude)}`}
            src={embedSrc}
            loading="lazy"
            // Desaturated toward the printed-map look of the newspaper system.
            className="block h-64 w-full border-0 grayscale contrast-[1.05] sm:h-80"
          />
        ) : (
          <button
            type="button"
            onClick={() => setShowEmbed(true)}
            className="flex h-64 w-full flex-col items-center justify-center gap-2 text-center transition-colors hover:bg-surface sm:h-80"
          >
            <MapIcon className="size-7 text-subtle" />
            <span className="text-[0.9375rem] font-medium">Show map</span>
            <span className="wl-mono text-subtle">
              {formatCoordinate(latitude)}, {formatCoordinate(longitude)}
            </span>
          </button>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[0.8125rem] text-subtle">
          Map data © OpenStreetMap contributors
        </p>
        <a
          href={fullMapHref}
          target="_blank"
          rel="noreferrer noopener"
          className="text-[0.8125rem] underline decoration-line-strong underline-offset-2 hover:text-foreground"
        >
          Open in OpenStreetMap
        </a>
      </div>

      {sources.length > 0 ? (
        <Card className="mt-4 p-4">
          <p className="wl-label">Mapped features near this point</p>
          <ul className="mt-3 space-y-1.5">
            {sources.map((source) => (
              <li key={source.id} className="flex items-baseline gap-2 text-[0.875rem]">
                <a
                  href={`https://www.openstreetmap.org/${source.id}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="min-w-0 truncate hover:underline"
                >
                  {source.name}
                </a>
                <span className="wl-mono ml-auto shrink-0 text-subtle">
                  {formatDistance(source.distanceMetres)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}

function MapIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M9 4.5 3.5 6.5v13L9 17.5l6 2 5.5-2v-13L15 6.5Z" />
      <path d="M9 4.5v13M15 6.5v13" />
    </svg>
  );
}
