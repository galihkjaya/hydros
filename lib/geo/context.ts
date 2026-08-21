/**
 * Geographic context assembly.
 *
 * Runs the full geo stage: reverse geocode, Overpass query, classification,
 * flow relations, ranking. This is the only module the orchestrator needs.
 */
import { resolveLocation } from "./geocode";
import { extractWaterwayNames, toGeographicSource } from "./osm";
import { elementId, queryOverpass, type OverpassElement } from "./overpass";
import {
  assignFlowRelations,
  dedupeSources,
  rankRiskSources,
  type WaterwayGeometry,
} from "./upstream";
import type {
  GeographicContext,
  GeographicSource,
  Location,
} from "@/types/investigation";

/**
 * Search radius. 2 km covers the neighbourhood scale that matters for a surface
 * water sample while keeping the Overpass query fast enough for serverless.
 */
export const SEARCH_RADIUS_METRES = 2000;

/** Features reported to the user. Beyond this the list stops being readable. */
const MAX_REPORTED_SOURCES = 12;

/**
 * Builds the geographic context for a sampling point.
 *
 * `onSourceFound` is called for each ranked feature so the UI can grow the list
 * as results arrive rather than waiting for the whole stage.
 */
export async function buildGeographicContext(
  location: Location,
  onSourceFound?: (source: GeographicSource) => void,
): Promise<GeographicContext> {
  // Reverse geocoding never throws, so this cannot fail the stage.
  const resolved = await resolveLocation(location);

  const elements = await queryOverpass(
    resolved.latitude,
    resolved.longitude,
    SEARCH_RADIUS_METRES,
  );

  const classified = elements
    .map((element) => toGeographicSource(element, resolved))
    .filter((source): source is GeographicSource => source !== null);

  const withRelations = assignFlowRelations(
    dedupeSources(classified),
    collectWaterwayGeometry(elements),
    resolved,
  );

  const potentialRiskSources = rankRiskSources(withRelations).slice(
    0,
    MAX_REPORTED_SOURCES,
  );

  for (const source of potentialRiskSources) onSourceFound?.(source);

  return {
    location: resolved,
    radiusMetres: SEARCH_RADIUS_METRES,
    waterways: extractWaterwayNames(withRelations),
    potentialRiskSources,
  };
}

/** Waterway vertex lists, needed for the flow-relation comparison. */
function collectWaterwayGeometry(
  elements: readonly OverpassElement[],
): WaterwayGeometry[] {
  const waterways: WaterwayGeometry[] = [];

  for (const element of elements) {
    // Two or fewer vertices cannot express a direction of flow.
    if (!element.tags?.waterway || !element.geometry || element.geometry.length < 3) {
      continue;
    }
    waterways.push({
      id: elementId(element),
      name: element.tags["name:en"] || element.tags.name || "Unnamed waterway",
      vertices: element.geometry,
    });
  }

  return waterways;
}
