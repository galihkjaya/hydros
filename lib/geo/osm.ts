/**
 * OSM element interpretation.
 *
 * Turns raw Overpass tags into the `GeographicSource` shape: a category, a
 * readable name, and a distance. Everything here is descriptive — the wording is
 * chosen so that nothing implies a feature affects the water.
 */
import {
  elementCoordinate,
  elementId,
  type OverpassElement,
} from "./overpass";
import { distanceMetres, projectOntoPolyline } from "@/lib/utils/distance";
import type {
  GeographicCategory,
  GeographicSource,
  Location,
} from "@/types/investigation";

/** Tag patterns mapped to a category, in priority order. */
const CATEGORY_RULES: ReadonlyArray<{
  key: string;
  values?: readonly string[];
  category: GeographicCategory;
  label: string;
}> = [
  { key: "waterway", category: "waterway", label: "Waterway" },
  { key: "natural", values: ["water"], category: "waterway", label: "Water body" },
  {
    key: "man_made",
    values: ["wastewater_plant"],
    category: "wastewater",
    label: "Wastewater plant",
  },
  {
    key: "amenity",
    values: ["waste_transfer_station"],
    category: "wastewater",
    label: "Waste transfer station",
  },
  {
    key: "man_made",
    values: ["water_works"],
    category: "water_treatment",
    label: "Water works",
  },
  { key: "landuse", values: ["landfill"], category: "landfill", label: "Landfill" },
  { key: "man_made", values: ["works"], category: "factory", label: "Industrial works" },
  {
    key: "landuse",
    values: ["industrial"],
    category: "industrial",
    label: "Industrial area",
  },
  { key: "landuse", values: ["quarry"], category: "mine", label: "Quarry" },
  { key: "man_made", values: ["mineshaft"], category: "mine", label: "Mine shaft" },
  {
    key: "landuse",
    values: ["farmland", "orchard", "plantation", "animal_keeping", "farmyard"],
    category: "farm",
    label: "Agricultural land",
  },
];

type Classification = {
  category: GeographicCategory;
  label: string;
  osmTag: string;
};

/** Matches an element's tags against the rules above. */
function classify(tags: Record<string, string>): Classification | null {
  for (const rule of CATEGORY_RULES) {
    const value = tags[rule.key];
    if (!value) continue;
    if (rule.values && !rule.values.includes(value)) continue;
    return {
      category: rule.category,
      label: rule.label,
      osmTag: `${rule.key}=${value}`,
    };
  }
  return null;
}

/**
 * Best available human name.
 *
 * Falls back to the category label rather than the raw tag, because "Industrial
 * area" reads better than "landuse=industrial" and carries the same information.
 */
function readName(tags: Record<string, string>, label: string): string {
  return (
    tags["name:en"] ||
    tags.name ||
    tags.operator ||
    tags.brand ||
    (tags.waterway === "stream"
      ? "Unnamed stream"
      : tags.waterway === "drain" || tags.waterway === "ditch"
        ? "Unnamed drainage channel"
        : label)
  );
}

/** Converts one element into a GeographicSource, or null if it is unusable. */
export function toGeographicSource(
  element: OverpassElement,
  origin: Location,
): GeographicSource | null {
  const tags = element.tags;
  if (!tags) return null;

  const classification = classify(tags);
  if (!classification) return null;

  // For a linear waterway, the relevant distance is to its nearest point, not
  // to its midpoint: a river passing 20 m away should not read as 800 m because
  // its centre lies further upstream. Perpendicular projection, not nearest
  // vertex — long rivers are mapped with very sparse vertices.
  const projection = element.geometry?.length
    ? projectOntoPolyline(
        element.geometry.map((vertex) => ({
          latitude: vertex.lat,
          longitude: vertex.lon,
        })),
        origin,
      )
    : null;
  const coordinate = projection?.closest ?? elementCoordinate(element);
  if (!coordinate) return null;

  return {
    id: elementId(element),
    name: readName(tags, classification.label),
    category: classification.category,
    osmTag: classification.osmTag,
    latitude: coordinate.latitude,
    longitude: coordinate.longitude,
    distanceMetres: Math.round(
      projection?.distanceMetres ?? distanceMetres(origin, coordinate),
    ),
    // Flow relationships are decided later, by the upstream analysis.
    relation: "unknown",
  };
}

/** Named waterways near the point, most relevant first, deduplicated. */
export function extractWaterwayNames(
  sources: readonly GeographicSource[],
): string[] {
  const names = new Set<string>();

  for (const source of [...sources].sort(
    (a, b) => a.distanceMetres - b.distanceMetres,
  )) {
    if (source.category !== "waterway") continue;
    // Unnamed features cannot help a web search.
    if (source.name.startsWith("Unnamed") || source.name === "Waterway") continue;
    if (source.name === "Water body") continue;
    names.add(source.name);
    if (names.size >= 4) break;
  }

  return [...names];
}
