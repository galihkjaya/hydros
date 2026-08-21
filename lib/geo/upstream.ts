/**
 * Hydrological relationship analysis.
 *
 * The honest scope of this module: OSM digitises a waterway's vertices in the
 * direction of flow, so for a mapped waterway we can say whether a feature sits
 * toward its source or toward its mouth relative to the sampling point. That is
 * a geometric statement about a map, not a hydrological model.
 *
 * What this deliberately does NOT do:
 * - claim that an upstream feature affects the water
 * - model catchments, groundwater, tributaries or discharge points
 * - infer flow for features that are not near a mapped waterway
 *
 * ponytail: vertex-order geometry only. Add a real flow network (HydroSHEDS or
 * OSM waterway relation traversal) if upstream attribution ever needs to be
 * more than context.
 */
import { distanceMetres, projectOntoPolyline, type Point } from "@/lib/utils/distance";
import type { LatLon } from "./overpass";
import type {
  FlowRelation,
  GeographicCategory,
  GeographicSource,
  Location,
} from "@/types/investigation";

/**
 * The sampling point must be this close to a mapped channel for that channel to
 * be the water being investigated at all.
 *
 * 500 m rather than something tighter because OSM maps a river as its
 * centreline: on a wide river the bank you photograph from can be several
 * hundred metres from that line. Measured 364 m on the Thames at Bermondsey.
 */
const ORIGIN_PROXIMITY_METRES = 500;

/**
 * A feature must be this close to the channel for its position along it to mean
 * anything. Generous compared to the origin limit, since a discharge can be
 * piped some distance, but still bounded — a factory 2 km from any water has no
 * defensible flow relation.
 */
const FEATURE_PROXIMITY_METRES = 800;

/** Along-channel separation below which two points are the same stretch. */
const ADJACENT_POSITION_TOLERANCE = 0.25;

/**
 * Minimum along-channel separation, in metres, before calling something up or
 * downstream.
 *
 * Position alone is not enough: vertex spacing varies enormously (3 vertices for
 * one Thames segment, 380 for the Ciliwung), so one position unit can be a
 * kilometre or ten metres. Requiring a real distance keeps the label meaningful
 * on both.
 */
const MIN_FLOW_SEPARATION_METRES = 150;

/** Waterway geometry, retained from the Overpass response for flow reasoning. */
export type WaterwayGeometry = {
  id: string;
  name: string;
  /** Ordered vertices, in OSM's digitisation direction (source to mouth). */
  vertices: readonly LatLon[];
};

const toPoints = (vertices: readonly LatLon[]): Point[] =>
  vertices.map((vertex) => ({ latitude: vertex.lat, longitude: vertex.lon }));

/**
 * Determines whether `feature` lies toward the source of the waterway relative
 * to `origin`.
 *
 * Both points are projected perpendicularly onto the channel; comparing the
 * fractional positions gives along-channel order. Returns "unknown" when either
 * point is too far from the channel for the comparison to mean anything.
 */
export function relationAlongWaterway(
  waterway: WaterwayGeometry,
  origin: Point,
  feature: Point,
): FlowRelation {
  const polyline = toPoints(waterway.vertices);
  const originProjection = projectOntoPolyline(polyline, origin);
  const featureProjection = projectOntoPolyline(polyline, feature);

  if (!originProjection || !featureProjection) return "unknown";
  if (originProjection.distanceMetres > ORIGIN_PROXIMITY_METRES) return "unknown";
  if (featureProjection.distanceMetres > FEATURE_PROXIMITY_METRES) {
    return "unknown";
  }

  const separation = featureProjection.position - originProjection.position;

  // Same stretch of channel: not meaningfully up or down stream.
  if (Math.abs(separation) <= ADJACENT_POSITION_TOLERANCE) return "adjacent";

  // Convert the along-channel separation into metres before judging it, since
  // vertex density varies by two orders of magnitude between waterways.
  const alongChannelMetres = distanceMetres(
    originProjection.closest,
    featureProjection.closest,
  );
  if (alongChannelMetres < MIN_FLOW_SEPARATION_METRES) return "adjacent";

  // OSM digitises from source toward mouth, so a lower position is upstream.
  return separation < 0 ? "upstream" : "downstream";
}

/**
 * Assigns a flow relation to each feature.
 *
 * Only channels that actually pass close to the sampling point are considered —
 * those are the ones plausibly carrying the water in the photograph. Each
 * feature is judged against the nearest such channel; where none is close
 * enough, the relation stays "unknown" rather than being guessed from compass
 * direction.
 */
export function assignFlowRelations(
  sources: readonly GeographicSource[],
  waterways: readonly WaterwayGeometry[],
  origin: Location,
): GeographicSource[] {
  const relevant = waterways.filter((waterway) => {
    const projection = projectOntoPolyline(toPoints(waterway.vertices), origin);
    return (
      projection !== null &&
      projection.distanceMetres <= ORIGIN_PROXIMITY_METRES
    );
  });

  if (relevant.length === 0) return [...sources];

  return sources.map((source) => {
    // The waterways themselves are context, not features draining into water.
    if (source.category === "waterway") return source;

    const feature = { latitude: source.latitude, longitude: source.longitude };
    let relation: FlowRelation = "unknown";
    let closest = Infinity;

    for (const waterway of relevant) {
      const projection = projectOntoPolyline(
        toPoints(waterway.vertices),
        feature,
      );
      if (!projection || projection.distanceMetres >= closest) continue;
      closest = projection.distanceMetres;
      relation = relationAlongWaterway(waterway, origin, feature);
    }

    return relation === "unknown" ? source : { ...source, relation };
  });
}

/**
 * Concern weight per category.
 *
 * These order the list the user sees; they are not probabilities and carry no
 * claim about actual impact. A wastewater plant outranks farmland because it is
 * a point discharge, not because either is known to affect this water.
 */
const CATEGORY_WEIGHT: Record<GeographicCategory, number> = {
  wastewater: 1,
  landfill: 0.95,
  mine: 0.9,
  factory: 0.85,
  industrial: 0.8,
  farm: 0.55,
  water_treatment: 0.4,
  waterway: 0.3,
  other: 0.2,
};

/** Distance decay: full weight nearby, tapering to nothing by 3 km. */
function proximityFactor(distanceMetres: number): number {
  if (distanceMetres <= 250) return 1;
  if (distanceMetres >= 3000) return 0.05;
  return 1 - (distanceMetres - 250) / 3000;
}

/** Upstream features are more relevant to a downstream sample. */
const RELATION_FACTOR: Record<FlowRelation, number> = {
  upstream: 1,
  adjacent: 0.8,
  unknown: 0.6,
  downstream: 0.3,
};

/**
 * Ranks features by how much attention they deserve in the report.
 *
 * Ordering only — the reasoning stage decides what any of it means, and external
 * evidence is what supports a real claim.
 */
export function rankRiskSources(
  sources: readonly GeographicSource[],
): GeographicSource[] {
  return [...sources]
    .filter((source) => source.category !== "waterway")
    .sort((a, b) => concernScore(b) - concernScore(a));
}

function concernScore(source: GeographicSource): number {
  return (
    CATEGORY_WEIGHT[source.category] *
    proximityFactor(source.distanceMetres) *
    RELATION_FACTOR[source.relation]
  );
}

/** Deduplicates features that OSM maps as several overlapping elements. */
export function dedupeSources(
  sources: readonly GeographicSource[],
): GeographicSource[] {
  const byKey = new Map<string, GeographicSource>();

  for (const source of sources) {
    // Same name and category within 150 m is the same real-world thing.
    const bucket = Math.round(source.distanceMetres / 150);
    const key = `${source.category}|${source.name.toLowerCase()}|${bucket}`;
    const existing = byKey.get(key);
    if (!existing || source.distanceMetres < existing.distanceMetres) {
      byKey.set(key, source);
    }
  }

  return [...byKey.values()];
}
