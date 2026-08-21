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
