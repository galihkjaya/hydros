/**
 * Self-check for OSM element interpretation.
 *
 * Fixtures are real shapes returned by Overpass for the Jakarta test point,
 * including the awkward ones: tunnels with no name, polygons that only have a
 * `center`, and elements with no usable tags.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  extractWaterwayNames,
  toGeographicSource,
} from "../lib/geo/osm.js";
import type { OverpassElement } from "../lib/geo/overpass.js";
import type { Location } from "../types/investigation.js";

const origin: Location = { latitude: -6.2088, longitude: 106.8456 };

const namedRiver: OverpassElement = {
  type: "way",
  id: 482170940,
  center: { lat: -6.1735263, lon: 106.8469922 },
  tags: { "name:en": "Ciliwung River", name: "Ci Liwung", waterway: "river" },
};

const unnamedTunnelCanal: OverpassElement = {
  type: "way",
  id: 29081044,
  center: { lat: -6.2086016, lon: 106.8453865 },
  tags: { layer: "-1", tunnel: "yes", waterway: "canal" },
};

test("prefers the English name and computes distance", () => {
  const source = toGeographicSource(namedRiver, origin);
  assert.equal(source?.name, "Ciliwung River");
  assert.equal(source?.category, "waterway");
  assert.equal(source?.osmTag, "waterway=river");
  assert.equal(source?.id, "way/482170940");
  assert.equal(source?.relation, "unknown");
  // ~3.9 km north of the origin.
  assert.ok((source?.distanceMetres ?? 0) > 3500);
  assert.ok((source?.distanceMetres ?? 0) < 4300);
});

test("classifies industry, waste, extraction and agriculture", () => {
  const cases: Array<[Record<string, string>, string]> = [
    [{ man_made: "wastewater_plant" }, "wastewater"],
    [{ amenity: "waste_transfer_station" }, "wastewater"],
    [{ man_made: "water_works" }, "water_treatment"],
    [{ landuse: "landfill" }, "landfill"],
    [{ man_made: "works" }, "factory"],
    [{ landuse: "industrial" }, "industrial"],
    [{ landuse: "quarry" }, "mine"],
    [{ landuse: "farmland" }, "farm"],
    [{ natural: "water" }, "waterway"],
  ];

  for (const [tags, expected] of cases) {
    const source = toGeographicSource(
      { type: "node", id: 1, lat: -6.209, lon: 106.846, tags },
      origin,
    );
    assert.equal(source?.category, expected, JSON.stringify(tags));
  }
});

test("a named operator is used when there is no name", () => {
  const source = toGeographicSource(
    {
      type: "way",
      id: 2,
      center: { lat: -6.209, lon: 106.846 },
      tags: { man_made: "works", operator: "PT Example Textiles" },
    },
    origin,
  );
  assert.equal(source?.name, "PT Example Textiles");
});

test("unnamed waterways get descriptive fallbacks, not raw tags", () => {
  assert.equal(toGeographicSource(unnamedTunnelCanal, origin)?.name, "Waterway");
  assert.equal(
    toGeographicSource(
      { type: "way", id: 3, center: { lat: -6.209, lon: 106.846 }, tags: { waterway: "stream" } },
      origin,
    )?.name,
    "Unnamed stream",
  );
  assert.equal(
    toGeographicSource(
      { type: "way", id: 4, center: { lat: -6.209, lon: 106.846 }, tags: { waterway: "drain" } },
      origin,
    )?.name,
    "Unnamed drainage channel",
  );
});

test("drops elements with no tags, no coordinate or no matching rule", () => {
  assert.equal(toGeographicSource({ type: "way", id: 5 }, origin), null);
  assert.equal(
    toGeographicSource({ type: "way", id: 6, tags: { waterway: "river" } }, origin),
    null,
  );
  assert.equal(
    toGeographicSource(
      { type: "node", id: 7, lat: -6.2, lon: 106.8, tags: { shop: "bakery" } },
      origin,
    ),
    null,
  );
});

test("waterway names exclude unnamed features and are distance ordered", () => {
  const sources = [
    toGeographicSource(namedRiver, origin),
    toGeographicSource(unnamedTunnelCanal, origin),
    toGeographicSource(
      {
        type: "way",
        id: 8,
        center: { lat: -6.2095, lon: 106.846 },
        tags: { waterway: "canal", name: "Kanal Banjir Barat" },
      },
      origin,
    ),
  ].filter((source): source is NonNullable<typeof source> => source !== null);

  const names = extractWaterwayNames(sources);
  // Nearest named waterway first; unnamed ones omitted entirely.
  assert.deepEqual(names, ["Kanal Banjir Barat", "Ciliwung River"]);
});
