/**
 * Great-circle distance helpers.
 *
 * Haversine on a spherical earth: sub-0.5% error, which is far below the
 * precision that matters when reporting "a factory roughly 800 m away".
 */

const EARTH_RADIUS_METRES = 6_371_008.8;

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;
const toDegrees = (radians: number): number => (radians * 180) / Math.PI;

export type Point = { latitude: number; longitude: number };

/** Distance between two coordinates, in metres. */
export function distanceMetres(a: Point, b: Point): number {
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  return 2 * EARTH_RADIUS_METRES * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Initial bearing from `a` to `b`, in degrees clockwise from north (0–360).
 * Used to describe where a feature sits relative to the sampling point.
 */
export function bearingDegrees(a: Point, b: Point): number {
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const dLon = toRadians(b.longitude - a.longitude);

  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);

  return (toDegrees(Math.atan2(y, x)) + 360) % 360;
}

/** Eight-point compass label for a bearing. */
export function compassLabel(bearing: number): string {
  const points = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;
  const index = Math.round((((bearing % 360) + 360) % 360) / 45) % 8;
  return points[index] ?? "N";
}

/**
 * Result of projecting a point onto a polyline.
 *
 * `position` is a fractional index along the line: 2.5 means halfway between
 * vertex 2 and vertex 3. It gives along-channel ordering at finer resolution
 * than vertex indices, which matters because OSM digitises long rivers with
 * very few vertices.
 */
export type Projection = {
  distanceMetres: number;
  position: number;
  closest: Point;
};

/**
 * Projects a point onto a polyline, returning the perpendicular distance.
 *
 * Nearest-*vertex* distance is not good enough here: a river mapped with a
 * vertex every kilometre can pass 20 m from the sampling point while its closest
 * vertex is 500 m away, which would wrongly exclude it from the analysis.
 *
 * Points are converted to a local equirectangular plane (metres) around the
 * query point first. Over the few kilometres this is used for, the distortion is
 * negligible and it makes the segment maths simple planar geometry.
 */
export function projectOntoPolyline(
  polyline: readonly Point[],
  point: Point,
): Projection | null {
  if (polyline.length === 0) return null;

  const firstVertex = polyline[0];
  if (!firstVertex) return null;
  if (polyline.length === 1) {
    return {
      distanceMetres: distanceMetres(point, firstVertex),
      position: 0,
      closest: firstVertex,
    };
  }

  // Local plane: x east, y north, in metres, centred on `point`.
  const metresPerDegreeLat = 111_132.95;
  const metresPerDegreeLon =
    111_319.49 * Math.cos(toRadians(point.latitude));
  const toLocal = (candidate: Point): [number, number] => [
    (candidate.longitude - point.longitude) * metresPerDegreeLon,
    (candidate.latitude - point.latitude) * metresPerDegreeLat,
  ];

  let best: Projection | null = null;

  for (let index = 0; index < polyline.length - 1; index += 1) {
    const start = polyline[index];
    const end = polyline[index + 1];
    if (!start || !end) continue;

    const [x1, y1] = toLocal(start);
    const [x2, y2] = toLocal(end);
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lengthSquared = dx * dx + dy * dy;

    // Degenerate segment (duplicate vertices): treat as the start point.
    const t =
      lengthSquared === 0
        ? 0
        : Math.min(1, Math.max(0, -(x1 * dx + y1 * dy) / lengthSquared));

    const closestX = x1 + t * dx;
    const closestY = y1 + t * dy;
    const distance = Math.hypot(closestX, closestY);

    if (!best || distance < best.distanceMetres) {
      best = {
        distanceMetres: distance,
        position: index + t,
        closest: {
          latitude: point.latitude + closestY / metresPerDegreeLat,
          longitude: point.longitude + closestX / metresPerDegreeLon,
        },
      };
    }
  }

  return best;
}
