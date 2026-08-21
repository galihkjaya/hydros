import { Badge } from "@/components/ui/primitives";
import { formatConfidence, formatDistance } from "@/lib/utils/format";
import type {
  GeographicSourceView,
  VisualObservationView,
} from "./view-model";

/**
 * Visible characteristics reported by the vision model.
 * Labelled OBSERVATION throughout: these are descriptions, not verdicts.
 */
export function VisualObservations({
  observations,
}: {
  observations: readonly VisualObservationView[];
}) {
  if (observations.length === 0) {
    return <EmptyPanel>Waiting for the visual analysis.</EmptyPanel>;
  }

  return (
    <ul className="space-y-3">
      {observations.map((observation) => (
        <li
          key={observation.attribute}
          className="animate-rise border-l-2 border-accent/40 pl-3"
        >
          <div className="flex items-baseline justify-between gap-3">
            <p className="wl-label">{observation.attribute}</p>
            <span className="wl-mono shrink-0 text-subtle">
              {formatConfidence(observation.confidence)}
            </span>
          </div>
          <p className="mt-0.5 text-[0.9375rem] leading-6">
            {observation.description}
          </p>
        </li>
      ))}
    </ul>
  );
}

const RELATION_LABEL: Record<
  NonNullable<GeographicSourceView["relation"]>,
  string
> = {
  upstream: "Potentially upstream",
  downstream: "Downstream",
  adjacent: "Adjacent",
  unknown: "Relation unclear",
};

/**
 * Nearby features from OpenStreetMap.
 *
 * Wording is deliberately hedged — proximity is context, not causation. Nothing
 * here asserts that a listed feature affects the water.
 */
export function GeographicContext({
  sources,
}: {
  sources: readonly GeographicSourceView[];
}) {
  if (sources.length === 0) {
    return (
      <EmptyPanel>
        No mapped features of interest were found nearby.
      </EmptyPanel>
    );
  }

  return (
    <>
      <ul className="space-y-2">
        {sources.map((source) => (
          <li
            key={`${source.name}-${source.distanceMetres}`}
            className="animate-rise flex items-start justify-between gap-3 rounded-lg border border-line bg-surface px-3 py-2.5"
          >
            <span className="min-w-0">
              <span className="block truncate text-[0.875rem] font-medium">
                {source.name}
              </span>
              <span className="mt-0.5 flex flex-wrap items-center gap-2">
                <span className="text-[0.8125rem] text-muted">
                  {source.category}
                </span>
                {source.relation && source.relation !== "unknown" ? (
                  <Badge tone="neutral">
                    {RELATION_LABEL[source.relation]}
                  </Badge>
                ) : null}
              </span>
            </span>
            <span className="wl-mono shrink-0 text-subtle">
              {formatDistance(source.distanceMetres)}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[0.8125rem] text-subtle">
        Proximity is context only. Nothing here indicates that a listed feature
        affects this water.
      </p>
    </>
  );
}

function EmptyPanel({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-line-strong px-4 py-6 text-center text-[0.875rem] text-muted">
      {children}
    </p>
  );
}
