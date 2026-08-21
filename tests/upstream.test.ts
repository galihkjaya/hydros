/**
 * Self-check for flow relations, ranking and deduplication.
 *
 * The important property: an "upstream" label is only ever produced when both
 * the sampling point and the feature are genuinely near the same mapped channel.
 * Everything else must stay "unknown" rather than being guessed.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assignFlowRelations,
  dedupeSources,
  rankRiskSources,
  relationAlongWaterway,
  type WaterwayGeometry,
} from "../lib/geo/upstream.js";
import type { GeographicSource, Location } from "../types/investigation.js";

/**
 * A north-to-south channel. OSM digitises source to mouth, so index 0 is the
 * upstream end.
 */
const channel: WaterwayGeometry = {
  id: "way/1",
  name: "Test River",
  vertices: [
    { lat: -6.19, lon: 106.8456 },
    { lat: -6.195, lon: 106.8456 },
    { lat: -6.2, lon: 106.8456 },
    { lat: -6.205, lon: 106.8456 },
    { lat: -6.2088, lon: 106.8456 },
    { lat: -6.213, lon: 106.8456 },
    { lat: -6.218, lon: 106.8456 },
  ],
};

const origin: Location = { latitude: -6.2088, longitude: 106.8456 };

const source = (patch: Partial<GeographicSource>): GeographicSource => ({
  id: "way/x",
  name: "Feature",
  category: "factory",
  osmTag: "man_made=works",
  latitude: -6.2088,
  longitude: 106.8456,
  distanceMetres: 500,
  relation: "unknown",
  ...patch,
});

test("a feature toward the channel source reads upstream", () => {
  const relation = relationAlongWaterway(channel, origin, {
    latitude: -6.195,
    longitude: 106.8457,
  });
  assert.equal(relation, "upstream");
});

test("a feature toward the channel mouth reads downstream", () => {
  const relation = relationAlongWaterway(channel, origin, {
    latitude: -6.218,
    longitude: 106.8457,
  });
  assert.equal(relation, "downstream");
});

test("a feature on the same stretch reads adjacent, not up or down", () => {
  const relation = relationAlongWaterway(channel, origin, {
    latitude: -6.2089,
    longitude: 106.846,
  });
  assert.equal(relation, "adjacent");
});

test("a feature far from the channel stays unknown", () => {
  // ~5 km east: nothing links it to this waterway.
  const relation = relationAlongWaterway(channel, origin, {
    latitude: -6.2088,
    longitude: 106.9,
  });
  assert.equal(relation, "unknown");
});

test("no upstream claim is made when the sample itself is far from the channel", () => {
  const farOrigin = { latitude: -6.2088, longitude: 106.95 };
  const relation = relationAlongWaterway(channel, farOrigin, {
    latitude: -6.195,
    longitude: 106.8456,
  });
  assert.equal(relation, "unknown");
});

test("with no mapped waterway every relation stays unknown", () => {
  const assigned = assignFlowRelations(
    [source({ latitude: -6.195, longitude: 106.8456 })],
    [],
    origin,
  );
  assert.equal(assigned[0]?.relation, "unknown");
});

test("waterways themselves are not given a flow relation", () => {
  const assigned = assignFlowRelations(
    [source({ category: "waterway", latitude: -6.195, longitude: 106.8456 })],
    [channel],
    origin,
  );
  assert.equal(assigned[0]?.relation, "unknown");
});

test("ranking favours point discharges, proximity and upstream position", () => {
  const ranked = rankRiskSources([
    source({ id: "a", name: "Distant farm", category: "farm", distanceMetres: 2800 }),
    source({
      id: "b",
      name: "Nearby wastewater plant",
      category: "wastewater",
      distanceMetres: 300,
      relation: "upstream",
    }),
    source({
      id: "c",
      name: "Downstream factory",
      category: "factory",
      distanceMetres: 300,
      relation: "downstream",
    }),
  ]);

  assert.equal(ranked[0]?.id, "b");
  assert.equal(ranked.length, 3);
  // Waterways are excluded from the risk list entirely.
  assert.equal(
    rankRiskSources([source({ category: "waterway" })]).length,
    0,
  );
});

test("deduplication keeps the nearest of overlapping duplicates", () => {
  const deduped = dedupeSources([
    source({ id: "1", name: "Textile works", distanceMetres: 820 }),
    source({ id: "2", name: "textile works", distanceMetres: 780 }),
    source({ id: "3", name: "Textile works", distanceMetres: 2400 }),
  ]);

  // The two near-identical entries collapse; the distant one is a separate site.
  assert.equal(deduped.length, 2);
  assert.ok(deduped.some((entry) => entry.distanceMetres === 780));
  assert.ok(deduped.some((entry) => entry.distanceMetres === 2400));
});
