/**
 * Self-check for the orchestrator's input validation and failure policy.
 *
 * Stage functions are stubbed via a seam-free approach: only `validateInput` is
 * exercised directly, since the pipeline stages are covered by their own tests
 * and a live end-to-end run is verified separately.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { validateInput } from "../lib/investigation/orchestrator.js";

const validImage = "data:image/jpeg;base64,AAAA";

test("accepts valid input and sanitizes the note", () => {
  const input = validateInput({
    imageDataUrl: validImage,
    latitude: "-6.2088",
    longitude: "106.8456",
    note: "  brown\twater\n after rain  ",
  });
  assert.equal(input.location.latitude, -6.2088);
  assert.equal(input.location.longitude, 106.8456);
  assert.equal(input.note, "brown water after rain");
});

test("rejects a missing or non-image payload", () => {
  for (const imageDataUrl of [
    undefined,
    "",
    "https://example.com/a.jpg",
    "data:text/html;base64,AAAA",
    "data:image/gif;base64,AAAA",
  ]) {
    assert.throws(
      () => validateInput({ imageDataUrl, latitude: 0, longitude: 0 }),
      { name: "InvestigationError" },
      `should reject ${String(imageDataUrl)}`,
    );
  }
});

test("rejects out-of-range and non-numeric coordinates", () => {
  const cases = [
    { latitude: 91, longitude: 0 },
    { latitude: 0, longitude: 181 },
    { latitude: "north", longitude: 0 },
    { latitude: undefined, longitude: undefined },
  ];
  for (const coords of cases) {
    assert.throws(
      () => validateInput({ imageDataUrl: validImage, ...coords }),
      { name: "InvestigationError" },
      JSON.stringify(coords),
    );
  }
});

test("coordinate 0,0 is accepted rather than treated as missing", () => {
  const input = validateInput({
    imageDataUrl: validImage,
    latitude: 0,
    longitude: 0,
  });
  assert.equal(input.location.latitude, 0);
  assert.equal(input.location.longitude, 0);
});

test("an absent note becomes an empty string, and a long note is truncated", () => {
  assert.equal(
    validateInput({ imageDataUrl: validImage, latitude: 1, longitude: 1 }).note,
    "",
  );
  const long = validateInput({
    imageDataUrl: validImage,
    latitude: 1,
    longitude: 1,
    note: "x".repeat(2000),
  });
  assert.equal(long.note.length, 600);
});

test("validation errors are tagged to the input stage", () => {
  try {
    validateInput({ imageDataUrl: "nope", latitude: 0, longitude: 0 });
    assert.fail("should have thrown");
  } catch (error) {
    assert.equal((error as { stage?: string }).stage, "input");
  }
});
