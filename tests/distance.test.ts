/**
 * Self-check for distance and bearing maths.
 *
 * Reference values come from known coordinate pairs, so a sign error or a
 * radians/degrees mix-up fails loudly.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  bearingDegrees,
  compassLabel,
  distanceMetres,
  projectOntoPolyline,
} from "../lib/utils/distance.js";

const jakarta = { latitude: -6.2088, longitude: 106.8456 };

test("distance is zero for identical points and symmetric", () => {
  assert.equal(distanceMetres(jakarta, jakarta), 0);
  const other = { latitude: -6.19, longitude: 106.84 };
  assert.equal(
    Math.round(distanceMetres(jakarta, other)),
    Math.round(distanceMetres(other, jakarta)),
  );
});

test("one degree of latitude is about 111 km", () => {
  const north = { latitude: -5.2088, longitude: 106.8456 };
  const metres = distanceMetres(jakarta, north);
  assert.ok(metres > 110_000 && metres < 112_000, `got ${metres}`);
});

test("known city pair matches the published great-circle distance", () => {
  // London to Paris is ~344 km.
  const london = { latitude: 51.5074, longitude: -0.1278 };
  const paris = { latitude: 48.8566, longitude: 2.3522 };
  const km = distanceMetres(london, paris) / 1000;
  assert.ok(km > 340 && km < 348, `got ${km}`);
});

test("small offsets give plausible metre-scale distances", () => {
  // 0.001 degrees of latitude is ~111 m.
  const near = { latitude: -6.2098, longitude: 106.8456 };
  const metres = distanceMetres(jakarta, near);
  assert.ok(metres > 105 && metres < 118, `got ${metres}`);
});

test("bearings point the right way and stay in 0-360", () => {
  const north = { latitude: -6.1088, longitude: 106.8456 };
  const east = { latitude: -6.2088, longitude: 106.9456 };
  const south = { latitude: -6.3088, longitude: 106.8456 };
  const west = { latitude: -6.2088, longitude: 106.7456 };

  assert.ok(Math.abs(bearingDegrees(jakarta, north) - 0) < 1);
  assert.ok(Math.abs(bearingDegrees(jakarta, east) - 90) < 1);
  assert.ok(Math.abs(bearingDegrees(jakarta, south) - 180) < 1);
  assert.ok(Math.abs(bearingDegrees(jakarta, west) - 270) < 1);
});

test("compass labels wrap correctly", () => {
  assert.equal(compassLabel(0), "N");
  assert.equal(compassLabel(45), "NE");
  assert.equal(compassLabel(180), "S");
  assert.equal(compassLabel(350), "N");
  assert.equal(compassLabel(-10), "N");
});

test("projection finds the perpendicular distance, not the nearest vertex", () => {
  // A sparse north-south line: vertices 1.1 km apart.
  const line = [
    { latitude: -6.2, longitude: 106.8456 },
    { latitude: -6.21, longitude: 106.8456 },
  ];
  // A point beside the line's midpoint, ~55 m east.
  const point = { latitude: -6.205, longitude: 106.8461 };

  const projection = projectOntoPolyline(line, point);
  assert.ok(projection);
  // Nearest vertex would be ~550 m away; the channel itself is ~55 m away.
  assert.ok(
    projection.distanceMetres < 80,
    `expected perpendicular distance, got ${projection.distanceMetres}`,
  );
  // Roughly halfway along the single segment.
  assert.ok(projection.position > 0.4 && projection.position < 0.6);
});

test("projection clamps to segment ends rather than extrapolating", () => {
  const line = [
    { latitude: -6.2, longitude: 106.8456 },
    { latitude: -6.201, longitude: 106.8456 },
  ];
  // Well beyond the northern end of the line.
  const beyond = { latitude: -6.19, longitude: 106.8456 };
  const projection = projectOntoPolyline(line, beyond);
  assert.ok(projection);
  assert.equal(projection.position, 0);
  assert.ok(projection.distanceMetres > 1000);
});

test("projection position increases along a multi-segment line", () => {
  const line = [
    { latitude: -6.19, longitude: 106.8456 },
    { latitude: -6.2, longitude: 106.8456 },
    { latitude: -6.21, longitude: 106.8456 },
    { latitude: -6.22, longitude: 106.8456 },
  ];
  const upstream = projectOntoPolyline(line, {
    latitude: -6.195,
    longitude: 106.8457,
  });
  const downstream = projectOntoPolyline(line, {
    latitude: -6.215,
    longitude: 106.8457,
  });
  assert.ok(upstream && downstream);
  assert.ok(upstream.position < downstream.position);
});

test("projection handles degenerate input", () => {
  assert.equal(projectOntoPolyline([], { latitude: 0, longitude: 0 }), null);
  const single = projectOntoPolyline([{ latitude: -6.2, longitude: 106.8 }], {
    latitude: -6.2,
    longitude: 106.8,
  });
  assert.equal(single?.distanceMetres, 0);
  // Duplicate vertices must not divide by zero.
  const duplicate = projectOntoPolyline(
    [
      { latitude: -6.2, longitude: 106.8 },
      { latitude: -6.2, longitude: 106.8 },
    ],
    { latitude: -6.201, longitude: 106.8 },
  );
  assert.ok(duplicate && Number.isFinite(duplicate.distanceMetres));
});
