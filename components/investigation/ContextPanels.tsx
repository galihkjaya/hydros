import { Badge } from "@/components/ui/primitives";
import { formatConfidence, formatDistance } from "@/lib/utils/format";
import { ATTRIBUTE_LABELS } from "./view-model";
import type {
  FlowRelation,
  GeographicSource,
  VisualObservation,
} from "@/types/investigation";

/**
 * Visible characteristics reported by the vision model.
 * Labelled OBSERVATION throughout: these are descriptions, not verdicts.
 */
export function VisualObservations({
  observations,
}: {
  observations: readonly VisualObservation[];
}) {
  if (observations.length === 0) {
    return <EmptyPanel>Waiting for the visual analysis.</EmptyPanel>;
  }

  return (
    <ul className="space-y-3">
      {observations.map((observation, index) => (
        <li
          key={`${observation.attribute}-${index}`}
          className="animate-rise border-l-2 border-ink pl-3"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <p className="wl-label">
              {ATTRIBUTE_LABELS[observation.attribute]}
              {observation.provenance === "user_corrected" ? (
                <span className="ml-2 border border-ink px-1 font-mono text-[0.625rem] tracking-widest">
                  Corrected
                </span>
              ) : observation.provenance === "user_added" ? (
                <span className="ml-2 font-mono text-[0.625rem] tracking-widest text-ink-faint">
                  Added by you
                </span>
              ) : observation.provenance === "user_confirmed" ? (
                <span className="ml-2 font-mono text-[0.625rem] tracking-widest text-ink-faint">
                  Confirmed
                </span>
              ) : null}
            </p>
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

const RELATION_LABEL: Record<FlowRelation, string> = {
  upstream: "Potentially upstream",
  downstream: "Downstream",
  adjacent: "Adjacent",
  unknown: "Relation unclear",
};

const CATEGORY_LABEL: Record<GeographicSource["category"], string> = {
  waterway: "Waterway",
  industrial: "Industrial area",
  factory: "Factory",
  farm: "Agriculture",
  mine: "Mine or quarry",
  wastewater: "Wastewater",
  water_treatment: "Water treatment",
  landfill: "Landfill",
  other: "Other feature",
};

/**
 * Nearby features from OpenStreetMap.
 *
 * Wording is deliberately hedged — proximity is context, not causation. Nothing
 * here asserts that a listed feature affects the water.
 */
export function GeographicContextPanel({
  sources,
}: {
  sources: readonly GeographicSource[];
}) {
  if (sources.length === 0) {
    return (
      <EmptyPanel>No mapped features of interest were found nearby.</EmptyPanel>
    );
  }

  return (
    <>
      <ul className="space-y-2">
        {sources.map((source) => (
          <li
            key={source.id}
            className="animate-rise flex items-start justify-between gap-3 border border-line bg-surface px-3 py-2.5"
          >
            <span className="min-w-0">
              <span className="block truncate text-[0.875rem] font-medium">
                {source.name}
              </span>
              <span className="mt-0.5 flex flex-wrap items-center gap-2">
                <span className="text-[0.8125rem] text-muted">
                  {CATEGORY_LABEL[source.category]}
                </span>
                {source.relation !== "unknown" ? (
                  <Badge tone="neutral">{RELATION_LABEL[source.relation]}</Badge>
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
    <p className="border border-dashed border-line-strong px-4 py-6 text-center text-[0.875rem] text-muted">
      {children}
    </p>
  );
}
