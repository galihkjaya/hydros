/**
 * Evidence integrity self-check: weighting, staleness, and claim–source
 * matching. The ranking must be legible — authority first, stale acute
 * claims discounted, orphans dropped.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  findOrphanedEvidence,
  formatSourceAge,
  isStaleSource,
  sourceAgeYears,
  weightEvidenceBySourceType,
} from "../lib/ai/integrity.js";
import { finalizeEvidence } from "../lib/ai/evidence.js";
import type { Evidence, Source } from "../types/investigation.js";

const source = (patch: Partial<Source> = {}): Source => ({
  title: "Report",
  url: "https://example.gov/report",
  domain: "example.gov",
  snippet: "s",
  sourceType: "government",
  faviconUrl: null,
  relevance: 0.9,
  ...patch,
});

const claim = (patch: Partial<Evidence> = {}): Evidence => ({
  claim: "A monitoring report recorded elevated turbidity in the basin.",
  sourceUrl: "https://example.gov/report",
  uncertainty: "Basin-wide.",
  relevance: 0.9,
  ...patch,
});

test("government outranks unverified at equal model relevance", () => {
  const gov = source({ url: "https://agency.gov/a", sourceType: "government" });
  const forum = source({
    url: "https://forum.example/b",
    domain: "forum.example",
    sourceType: "unverified",
  });
  const weighted = weightEvidenceBySourceType(
    [
      claim({ sourceUrl: forum.url, relevance: 0.9 }),
      claim({ sourceUrl: gov.url, relevance: 0.9 }),
    ],
    [gov, forum],
  );
  assert.equal(weighted[0]?.sourceUrl, gov.url);
  assert.ok(
    (weighted[0]?.relevance ?? 0) > (weighted[1]?.relevance ?? 0),
    "tier weighting separates equal claims",
  );
});

test("stale sources are discounted for acute claims only", () => {
  const old = source({
    url: "https://archive.gov/old",
    publishedAt: "2010-03-01",
    sourceType: "government",
  });
  const now = new Date("2026-09-19T00:00:00Z");
  assert.equal(isStaleSource(old, now), true);
  assert.equal(
    isStaleSource(source({ publishedAt: "2025-01-01" }), now),
    false,
  );

  const acute = claim({
    sourceUrl: old.url,
    claim: "A 2010 report recorded a chemical spill with elevated turbidity.",
    relevance: 1,
  });
  const background = claim({
    sourceUrl: old.url,
    claim: "A 2010 survey described the basin geography.",
    relevance: 1,
  });
  const [acuteOut] = weightEvidenceBySourceType([acute], [old], now);
  const [bgOut] = weightEvidenceBySourceType([background], [old], now);
  assert.ok(
    (acuteOut?.relevance ?? 1) < (bgOut?.relevance ?? 0),
    "acute stale claims are discounted",
  );
});

test("orphaned claims are found and dropped", () => {
  const sources = [source()];
  const orphans = findOrphanedEvidence(
    [claim({}), claim({ sourceUrl: "https://ghost.example/x" })],
    sources,
  );
  assert.deepEqual(orphans, ["https://ghost.example/x"]);

  const finalized = finalizeEvidence(
    [claim({}), claim({ sourceUrl: "https://ghost.example/x" })],
    sources,
  );
  assert.equal(finalized.length, 1);
  assert.equal(finalized[0]?.sourceUrl, "https://example.gov/report");
});

test("source age parsing and display", () => {
  const now = new Date("2026-09-19T00:00:00Z");
  assert.equal(sourceAgeYears("2019-06-01", now), 7);
  assert.equal(sourceAgeYears(undefined, now), null);
  assert.equal(sourceAgeYears("not a date", now), null);
  assert.equal(formatSourceAge(source({ publishedAt: "2019-06-01" }), now), "7y ago");
  assert.equal(formatSourceAge(source({}), now), "date unknown");
});
