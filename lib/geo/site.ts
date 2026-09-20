/**
 * Geohash site grouping.
 *
 * Investigations at the same place must be recognised as the same place.
 * Precision 7 cells are ~150 m × ~150 m at the equator — tight enough that
 * two visits to one urban waterway share a site, loose enough that GPS wobble
 * on a phone does not scatter them. Documented choice, one constant to tune.
 *
 * Self-contained base32 implementation: no dependency for 100 lines.
 * Longitude wraps at the antimeridian, latitude clamps at the poles, so every
 * finite coordinate maps to exactly one cell.
 */

/** Site cell precision. 7 ≈ 150 m cells. */
export const SITE_GEOHASH_PRECISION = 7;

const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";

function normalizeLongitude(longitude: number): number {
  if (!Number.isFinite(longitude)) return 0;
  // Wrap into [-180, 180).
  return ((((longitude + 180) % 360) + 360) % 360) - 180;
}

function clampLatitude(latitude: number): number {
  if (!Number.isFinite(latitude)) return 0;
  return Math.min(Math.max(latitude, -90), 90);
}

/** Encodes a coordinate into a geohash of the given precision. */
export function encodeGeohash(
  latitude: number,
  longitude: number,
  precision = SITE_GEOHASH_PRECISION,
): string {
  const lat = clampLatitude(latitude);
  const lon = normalizeLongitude(longitude);

  let latMin = -90;
  let latMax = 90;
  let lonMin = -180;
  let lonMax = 180;

  let hash = "";
  let bits = 0;
  let value = 0;
  let even = true;

  while (hash.length < precision) {
    if (even) {
      const mid = (lonMin + lonMax) / 2;
      if (lon >= mid) {
        value = value * 2 + 1;
        lonMin = mid;
      } else {
        value = value * 2;
        lonMax = mid;
      }
    } else {
      const mid = (latMin + latMax) / 2;
      if (lat >= mid) {
        value = value * 2 + 1;
        latMin = mid;
      } else {
        value = value * 2;
        latMax = mid;
      }
    }
    // Keep the working latitude inside the shrinking cell.
    even = !even;
    bits += 1;
    if (bits === 5) {
      hash += BASE32[value];
      bits = 0;
      value = 0;
    }
  }

  return hash;
}

export type GeohashCell = {
  geohash: string;
  latitudeMin: number;
  latitudeMax: number;
  longitudeMin: number;
  longitudeMax: number;
  centerLatitude: number;
  centerLongitude: number;
};

/** Decodes a geohash into its cell bounds and center. */
export function decodeGeohash(geohash: string): GeohashCell {
  let latMin = -90;
  let latMax = 90;
  let lonMin = -180;
  let lonMax = 180;
  let even = true;

  for (const char of geohash.toLowerCase()) {
    const value = BASE32.indexOf(char);
    if (value === -1) {
      throw new Error(`Invalid geohash character: ${char}`);
    }
    for (let mask = 16; mask > 0; mask >>= 1) {
      if (even) {
        const mid = (lonMin + lonMax) / 2;
        if (value & mask) lonMin = mid;
        else lonMax = mid;
      } else {
        const mid = (latMin + latMax) / 2;
        if (value & mask) latMin = mid;
        else latMax = mid;
      }
      even = !even;
    }
  }

  return {
    geohash: geohash.toLowerCase(),
    latitudeMin: latMin,
    latitudeMax: latMax,
    longitudeMin: lonMin,
    longitudeMax: lonMax,
    centerLatitude: (latMin + latMax) / 2,
    centerLongitude: (lonMin + lonMax) / 2,
  };
}

const NEIGHBOR_OFFSETS = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
] as const;

/**
 * The eight cells surrounding a geohash, at the same precision.
 *
 * Computed from the decoded center plus one cell of offset, with longitude
 * wrapping (antimeridian-safe) and latitude clamping (polar-safe).
 */
export function geohashNeighbors(
  geohash: string,
  precision = geohash.length,
): string[] {
  const cell = decodeGeohash(geohash);
  const latStep = cell.latitudeMax - cell.latitudeMin;
  const lonStep = cell.longitudeMax - cell.longitudeMin;

  return NEIGHBOR_OFFSETS.map(([dLat, dLon]) =>
    encodeGeohash(
      cell.centerLatitude + dLat * latStep,
      cell.centerLongitude + dLon * lonStep,
      precision,
    ),
  );
}

/** Site key for an investigation coordinate. */
export function siteGeohashFor(
  latitude: number,
  longitude: number,
): string {
  return encodeGeohash(latitude, longitude, SITE_GEOHASH_PRECISION);
}
