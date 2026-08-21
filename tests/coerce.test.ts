/**
 * Self-check for model-output coercion.
 *
 * These helpers are the only barrier between raw model text and the domain
 * types, so the awkward real-world shapes are pinned here.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  coerceConfidence,
  coerceEnum,
  coerceString,
  coerceStringArray,
  extractJsonObject,
} from "../lib/ai/coerce.js";

test("confidence accepts strings, percentages and clamps out-of-range", () => {
  assert.equal(coerceConfidence(0.7), 0.7);
  assert.equal(coerceConfidence("0.42"), 0.42);
  // Models frequently answer 85 when asked for 0–1.
  assert.equal(coerceConfidence(85), 0.85);
  assert.equal(coerceConfidence(-3), 0);
  assert.equal(coerceConfidence(1000), 1);
  assert.equal(coerceConfidence(undefined, 0.3), 0.3);
});

test("enum matching is case and separator insensitive", () => {
  const levels = ["LOW", "MEDIUM", "INSUFFICIENT_DATA"] as const;
  assert.equal(coerceEnum("low", levels, "LOW"), "LOW");
  assert.equal(coerceEnum("Insufficient Data", levels, "LOW"), "INSUFFICIENT_DATA");
  assert.equal(coerceEnum("insufficient-data", levels, "LOW"), "INSUFFICIENT_DATA");
  assert.equal(coerceEnum("catastrophic", levels, "LOW"), "LOW");
});

test("string coercion collapses whitespace and truncates", () => {
  assert.equal(coerceString("  a\n\tb  "), "a b");
  assert.equal(coerceString("abcdef", 3), "abc");
  assert.equal(coerceString(null), "");
});

test("string arrays drop blanks and duplicates", () => {
  assert.deepEqual(coerceStringArray(["a", "", "a", "b", null]), ["a", "b"]);
  assert.deepEqual(coerceStringArray("not an array"), []);
  assert.equal(coerceStringArray(["a", "b", "c"], 2).length, 2);
});

test("extracts JSON from fences, prose and reasoning preambles", () => {
  assert.deepEqual(extractJsonObject('{"a":1}'), { a: 1 });
  assert.deepEqual(extractJsonObject('```json\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(
    extractJsonObject('Here is the result:\n{"a":1}\nHope that helps.'),
    { a: 1 },
  );
  // Reasoning models emit thinking text containing braces before the answer.
  assert.deepEqual(
    extractJsonObject('Thinking... the answer is\n```\n{"level":"LOW"}\n```'),
    { level: "LOW" },
  );
  assert.equal(extractJsonObject("no json here"), null);
  // Arrays are not objects; callers expect an object contract.
  assert.equal(extractJsonObject("[1,2,3]"), null);
});
