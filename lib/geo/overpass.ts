/**
 * Overpass API client.
 *
 * Server-only, no credentials — Overpass is open, which also means it is
 * frequently slow or overloaded. Every call is time-boxed and the pipeline
 * treats a geographic failure as degraded context rather than a fatal error.
 *
 * The query asks for `center` on ways and relations so a polygon (a factory
 * footprint, a landfill) collapses to a single point for distance maths without
 * fetching its full geometry.
 */
import { InvestigationError } from "@/lib/investigation/errors";

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
] as const;

/** Overpass regularly takes 5–15s; beyond this the request is not worth waiting for. */
const TIMEOUT_MS = 25_000;

/** Server-side query timeout, communicated to Overpass in the query header. */
const QUERY_TIMEOUT_SECONDS = 25;

/**
 * Per-set result caps.
 *
 * Water features and risk features are collected as separate sets with separate
 * caps. A single combined `out 80` in a dense city returns 80 streams and no
 * industry at all, which is exactly the information we need most.
 */
const MAX_WATER_FEATURES = 40;
const MAX_RISK_FEATURES = 40;

export type OverpassElement = {
  type: "node" | "way" | "relation";
  id: number;
  /** Present on nodes. */
  lat?: number;
  lon?: number;
  /** Present on ways/relations when `out center` is requested. */
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

/**
 * Builds the query.
 *
 * `nwr` matches nodes, ways and relations in one selector, which keeps the query
 * short enough that Overpass answers in a few seconds — separate per-type
 * selectors reliably timed out at 504 during testing.
 */
function buildQuery(
  latitude: number,
  longitude: number,
  radiusMetres: number,
): string {
  const around = `around:${radiusMetres},${latitude},${longitude}`;

  return `[out:json][timeout:${QUERY_TIMEOUT_SECONDS}];
(
  nwr(${around})["waterway"~"^(river|stream|canal|drain|ditch)$"];
  nwr(${around})["natural"="water"];
)->.water;
(
  nwr(${around})["landuse"~"^(industrial|quarry|landfill|farmland|orchard|plantation|farmyard|animal_keeping)$"];
  nwr(${around})["man_made"~"^(works|wastewater_plant|water_works|mineshaft)$"];
  nwr(${around})["amenity"="waste_transfer_station"];
)->.risk;
.water out tags center ${MAX_WATER_FEATURES};
.risk out tags center ${MAX_RISK_FEATURES};`;
}

/**
 * Queries Overpass, trying the mirrors in order.
 *
 * Returns the raw elements; interpretation happens in `lib/geo/analyze.ts`.
 */
export async function queryOverpass(
  latitude: number,
  longitude: number,
  radiusMetres: number,
): Promise<OverpassElement[]> {
  const query = buildQuery(latitude, longitude, radiusMetres);
  let lastFailure: unknown = null;
  // Distinguishes "every mirror failed" from "the area genuinely has nothing
  // mapped", which is a legitimate result for a remote location.
  let sawEmptyResponse = false;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          // Overpass asks clients to identify themselves.
          "User-Agent": "WaterLens/0.1 (water investigation tool)",
        },
        body: new URLSearchParams({ data: query }).toString(),
        signal: controller.signal,
      });

      // 429 (rate limited) and 504 (query timeout) are Overpass's normal
      // load-shedding responses; try the next mirror rather than giving up.
      if (!response.ok) {
        lastFailure = response.status;
        continue;
      }

      const payload: unknown = await response.json();
      const elements = (payload as { elements?: unknown }).elements;
      if (!Array.isArray(elements)) {
        lastFailure = "malformed response";
        continue;
      }

      // A mirror can answer 200 with nothing when its database is still
      // importing, so try another before concluding the area is empty.
      if (elements.length === 0) {
        sawEmptyResponse = true;
        continue;
      }

      return elements as OverpassElement[];
    } catch (error) {
      lastFailure = error;
    } finally {
      clearTimeout(timer);
    }
  }

  if (sawEmptyResponse) return [];

  throw new InvestigationError(
    "geo",
    "Geographic data could not be retrieved. The map service is unavailable.",
    { cause: lastFailure },
  );
}

/** Coordinate of an element, whether it is a node or a centred way/relation. */
export function elementCoordinate(
  element: OverpassElement,
): { latitude: number; longitude: number } | null {
  if (typeof element.lat === "number" && typeof element.lon === "number") {
    return { latitude: element.lat, longitude: element.lon };
  }
  if (element.center) {
    return { latitude: element.center.lat, longitude: element.center.lon };
  }
  return null;
}

/** Stable identifier, e.g. "way/29081044". */
export function elementId(element: OverpassElement): string {
  return `${element.type}/${element.id}`;
}
