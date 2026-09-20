/**
 * Minimal geohash encoder shared by the demo scripts.
 * Mirrors lib/geo/site.ts (precision 7, ~150 m cells).
 */
const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";

export function encodeGeohash(latitude, longitude, precision = 7) {
  const lat = Math.min(Math.max(latitude, -90), 90);
  const lon = ((((longitude + 180) % 360) + 360) % 360) - 180;

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
