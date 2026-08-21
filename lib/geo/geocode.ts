/**
 * Reverse geocoding via Nominatim.
 *
 * Gives the investigation a place name and country code. The place name makes
 * search queries far more effective than coordinates alone, and the country code
 * biases search results to the right region.
 *
 * Nominatim's usage policy requires an identifying User-Agent and low request
 * volume; one call per investigation is well inside that.
 */
import { sanitizeText } from "@/lib/utils/validation";
import type { Location } from "@/types/investigation";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse";

const TIMEOUT_MS = 10_000;

/**
 * Resolves a place name for the coordinates.
 *
 * Never throws: a missing place name degrades search quality but must not stop
 * an investigation, so failures return the coordinates unchanged.
 */
export async function resolveLocation(location: Location): Promise<Location> {
  const url = new URL(NOMINATIM_URL);
  url.searchParams.set("lat", String(location.latitude));
  url.searchParams.set("lon", String(location.longitude));
  url.searchParams.set("format", "json");
  // zoom=14 gives a suburb/village level name: specific enough to search on,
  // broad enough not to leak a street address into a web query.
  url.searchParams.set("zoom", "14");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "WaterLens/0.1 (water investigation tool)",
        "Accept-Language": "en",
      },
      signal: controller.signal,
    });
    if (!response.ok) return location;

    const payload: unknown = await response.json();
    const displayName = readString(payload, "display_name");
    const address = (payload as { address?: unknown }).address;
    const countryCode = readString(address, "country_code");

    return {
      ...location,
      ...(displayName
        ? { displayName: sanitizeText(displayName, 200) }
        : {}),
      ...(countryCode && /^[a-z]{2}$/i.test(countryCode)
        ? { countryCode: countryCode.toUpperCase() }
        : {}),
    };
  } catch {
    // Timeout or network fault: coordinates alone are still workable.
    return location;
  } finally {
    clearTimeout(timer);
  }
}

function readString(source: unknown, key: string): string | undefined {
  if (typeof source !== "object" || source === null) return undefined;
  const value = (source as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
