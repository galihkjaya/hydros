/**
 * Self-check for the server-side image data URL guard.
 *
 * This is a trust boundary: the browser claims to have produced a downscaled
 * JPEG, and the server must verify that independently before spending a
 * provider call on it.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_IMAGE_BASE64_LENGTH,
  parseImageDataUrl,
} from "../lib/utils/validation.js";

test("accepts the three supported image types", () => {
  for (const mime of ["image/jpeg", "image/png", "image/webp"]) {
    const parsed = parseImageDataUrl(`data:${mime};base64,AAAA`);
    assert.equal(parsed?.mimeType, mime);
    assert.equal(parsed?.base64, "AAAA");
  }
});

test("rejects non-image, non-base64 and malformed data URLs", () => {
  assert.equal(parseImageDataUrl("data:image/gif;base64,AAAA"), null);
  assert.equal(parseImageDataUrl("data:text/html;base64,AAAA"), null);
  assert.equal(parseImageDataUrl("https://example.com/a.jpg"), null);
  assert.equal(parseImageDataUrl("data:image/jpeg;base64,"), null);
  // Non-base64 alphabet — a path traversal or script attempt would land here.
  assert.equal(parseImageDataUrl("data:image/jpeg;base64,../../etc"), null);
  // Length must be a multiple of 4.
  assert.equal(parseImageDataUrl("data:image/jpeg;base64,AAA"), null);
});

test("accepts valid padding, rejects oversized payloads", () => {
  assert.ok(parseImageDataUrl("data:image/jpeg;base64,AAA="));
  assert.ok(parseImageDataUrl("data:image/jpeg;base64,AA=="));
  const huge = "A".repeat(MAX_IMAGE_BASE64_LENGTH + 4);
  assert.equal(parseImageDataUrl(`data:image/jpeg;base64,${huge}`), null);
});
