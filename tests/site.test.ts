/**
 * Geohash self-check: a Wikipedia reference vector plus the edge cases that
 * matter for site grouping — antimeridian wrap and polar clamping.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  decodeGeohash,
  encodeGeohash,
  geohashNeighbors,
  siteGeohashFor,
} from "../lib/geo/site.js";

test("matches the Wikipedia reference vector", () => {
  // https://en.wikipedia.org/wiki/Geohash — (42.6, -5.6) → "ezs42".
  assert.equal(encodeGeohash(42.6, -5.6, 5), "ezs42");
});

test("precision-7 cells are ~150 m at the equator", () => {
  const cell = decodeGeohash(encodeGeohash(0, 0, 7));
  const lonMetres =
    (cell.longitudeMax - cell.longitudeMin) * 111_320;
  assert.ok(
    lonMetres > 100 && lonMetres < 250,
    `cell width was ${lonMetres.toFixed(0)} m`,
  );
});

test("decode-encode round-trips", () => {
  for (const [lat, lon] of [
    [40.2033, -8.4103],
    [-33.8688, 151.2093],
    [59.9235, 10.7522],
  ] as const) {
    const hash = encodeGeohash(lat, lon, 7);
    const cell = decodeGeohash(hash);
    assert.ok(lat >= cell.latitudeMin && lat <= cell.latitudeMax);
    assert.ok(lon >= cell.longitudeMin && lon <= cell.longitudeMax);
    assert.equal(encodeGeohash(cell.centerLatitude, cell.centerLongitude, 7), hash);
  }
});

test("antimeridian points group across ±180", () => {
  const east = encodeGeohash(0, 179.9999, 7);
  const west = encodeGeohash(0, -179.9999, 7);
  const neighbours = new Set([east, ...geohashNeighbors(east, 7)]);
  assert.ok(
    neighbours.has(west),
    `${east} and ${west} are not the same or adjacent cells`,
  );
});

test("poles clamp instead of throwing", () => {
  assert.equal(encodeGeohash(91, 0, 7), encodeGeohash(90, 0, 7));
  assert.equal(encodeGeohash(-91, 0, 7), encodeGeohash(-90, 0, 7));
  assert.equal(siteGeohashFor(40.2033, -8.4103).length, 7);
});

test("neighbours are eight distinct cells", () => {
  const hash = siteGeohashFor(40.2033, -8.4103);
  const neighbours = geohashNeighbors(hash);
  assert.equal(neighbours.length, 8);
  assert.equal(new Set([...neighbours, hash]).size, 9);
});
