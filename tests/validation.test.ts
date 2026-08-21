/**
 * Self-check for input validation rules.
 *
 *   npm test
 *
 * Node's built-in test runner, no framework. Covers the boundary cases the
 * server relies on, since the API routes re-run these same checks.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_IMAGE_BYTES,
  parseCoordinatePair,
  sanitizeText,
  validateImageFile,
  validateLatitude,
  validateLongitude,
  validateNote,
} from "../lib/utils/validation.js";

test("rejects non-image and oversized files", () => {
  assert.equal(validateImageFile({ type: "image/jpeg", size: 1000 }).ok, true);
  assert.equal(validateImageFile({ type: "image/gif", size: 1000 }).ok, false);
  assert.equal(validateImageFile({ type: "image/png", size: 0 }).ok, false);
  assert.equal(
    validateImageFile({ type: "image/png", size: MAX_IMAGE_BYTES + 1 }).ok,
    false,
  );
});

test("coordinate bounds are inclusive at the poles and meridian", () => {
  assert.equal(validateLatitude(90).ok, true);
  assert.equal(validateLatitude(-90).ok, true);
  assert.equal(validateLatitude(90.0001).ok, false);
  assert.equal(validateLatitude(Number.NaN).ok, false);
  assert.equal(validateLongitude(180).ok, true);
  assert.equal(validateLongitude(-180.1).ok, false);
});

test("parses comma and space separated pairs, rejects junk", () => {
  assert.deepEqual(parseCoordinatePair("-6.2088, 106.8456"), {
    latitude: -6.2088,
    longitude: 106.8456,
  });
  assert.deepEqual(parseCoordinatePair(" 51.5 -0.12 "), {
    latitude: 51.5,
    longitude: -0.12,
  });
  assert.equal(parseCoordinatePair("51.5"), null);
  assert.equal(parseCoordinatePair("north, west"), null);
  // Out-of-range pairs are rejected rather than clamped.
  assert.equal(parseCoordinatePair("100, 200"), null);
});

test("sanitizeText strips control characters, collapses space, truncates", () => {
  assert.equal(sanitizeText("  brown\twater\n\n ", 100), "brown water");
  assert.equal(sanitizeText("a\u0000b", 100), "a b");
  assert.equal(sanitizeText("abcdef", 3), "abc");
});

test("note length limit", () => {
  assert.equal(validateNote("x".repeat(600)).ok, true);
  assert.equal(validateNote("x".repeat(601)).ok, false);
});
