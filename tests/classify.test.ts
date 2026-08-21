/**
 * Self-check for source classification and relevance scoring.
 *
 * Classification decides how much weight the reasoning stage gives a claim, so
 * the tier boundaries are pinned here. No network access.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { classifySource, scoreRelevance, toSource } from "../lib/search/classify.js";
import type { SearchResult } from "../types/investigation.js";

test("government tier covers international gov suffixes", () => {
  assert.equal(classifySource("epa.gov"), "government");
  assert.equal(classifySource("www.environment-agency.gov.uk"), "government");
  assert.equal(classifySource("klhk.go.id"), "government");
  assert.equal(classifySource("who.int"), "government");
  assert.equal(classifySource("ec.europa.eu"), "government");
});

test("scientific tier covers publishers and academic suffixes", () => {
  assert.equal(classifySource("sciencedirect.com"), "scientific");
  assert.equal(classifySource("iopscience.iop.org"), "scientific");
  assert.equal(classifySource("www.researchgate.net"), "scientific");
  assert.equal(classifySource("ipb.ac.id"), "scientific");
  assert.equal(classifySource("mit.edu"), "scientific");
});

test("news, community and unknown domains are separated", () => {
  assert.equal(classifySource("reuters.com"), "news");
  assert.equal(classifySource("thejakartapost.com"), "news");
  assert.equal(classifySource("reddit.com"), "community");
  assert.equal(classifySource("en.wikipedia.org"), "community");
  assert.equal(classifySource("some-random-blog.xyz"), "unverified");
});

test("subdomains inherit their parent classification", () => {
  assert.equal(classifySource("water.epa.gov"), "government");
  assert.equal(classifySource("news.bbc.co.uk"), "news");
});

const base: SearchResult = {
  title: "Ciliwung river water quality monitoring report",
  url: "https://epa.gov/report",
  domain: "epa.gov",
  snippet:
    "Monitoring recorded elevated turbidity and industrial wastewater discharge in the watershed during sampling.",
};

test("an on-topic government result outscores an off-topic blog", () => {
  const authoritative = scoreRelevance(base, "government", ["Ciliwung"]);
  const blog = scoreRelevance(
    {
      title: "My holiday photos",
      url: "https://blog.xyz/a",
      domain: "blog.xyz",
      snippet: "We visited a nice place last summer and had a lovely time there.",
    },
    "unverified",
    ["Ciliwung"],
  );
  assert.ok(authoritative > blog);
  assert.ok(authoritative > 0.8);
  assert.ok(blog < 0.3);
});

test("scores stay inside 0-1 and penalise empty snippets", () => {
  const withSnippet = scoreRelevance(base, "government", ["Ciliwung"]);
  const withoutSnippet = scoreRelevance(
    { ...base, snippet: "" },
    "government",
    ["Ciliwung"],
  );
  assert.ok(withoutSnippet < withSnippet);
  assert.ok(withoutSnippet >= 0);
  assert.ok(withSnippet <= 1);
});

test("entity overlap raises the score", () => {
  const matched = scoreRelevance(base, "government", ["Ciliwung"]);
  const unmatched = scoreRelevance(base, "government", ["Thames"]);
  assert.ok(matched > unmatched);
  // Single-word noise entities are ignored rather than inflating the score.
  assert.equal(
    scoreRelevance(base, "government", ["a"]),
    scoreRelevance(base, "government", []),
  );
});

test("toSource attaches tier, favicon and relevance", () => {
  const source = toSource(base, ["Ciliwung"]);
  assert.equal(source.sourceType, "government");
  assert.match(source.faviconUrl ?? "", /epa\.gov/);
  assert.ok(source.relevance > 0);
  assert.equal(source.url, base.url);
});
