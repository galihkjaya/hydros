/**
 * FAIR export self-check: schema.org Dataset records and the DCAT catalogue.
 * Vague FAIR claims score nothing; these pin the concrete endpoint shapes.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  investigationsCatalogJsonLd,
  investigationJsonLd,
} from "../lib/fair/jsonld.js";
import type { Investigation } from "../types/investigation.js";

const investigation: Investigation = {
  id: "123e4567-e89b-12d3-a456-426614174000",
  status: "completed",
  createdAt: "2026-09-19T00:00:00.000Z",
  location: {
    latitude: 40.2033,
    longitude: -8.4103,
    displayName: "Coimbra",
  },
  userNote: "",
  visual: {
    isWaterVisible: true,
    summary: "Green water.",
    observations: [],
    limitations: [],
  },
  geographic: {
    location: { latitude: 40.2033, longitude: -8.4103 },
    radiusMetres: 2000,
    waterways: [],
    potentialRiskSources: [],
  },
  sources: [],
  evidence: [],
  healthPathways: [],
  assessment: {
    riskLevel: "MEDIUM",
    confidence: 0.6,
    summary: "Some indicators warrant caution.",
    riskFactors: [],
    evidence: [],
    recommendation: "Treat as untested.",
    limitations: [],
  },
};

test("dataset record is valid JSON-LD with coverage and distributions", () => {
  const record = investigationJsonLd(investigation, "https://hydros.example");

  assert.equal(record["@context"], "https://schema.org");
  assert.equal(record["@type"], "Dataset");
  assert.equal(record.identifier, investigation.id);

  const geo = (
    record.spatialCoverage as {
      geo: { latitude: number; longitude: number };
    }
  ).geo;
  assert.equal(geo.latitude, 40.2033);
  assert.equal(geo.longitude, -8.4103);

  const distributions = record.distribution as {
    encodingFormat: string;
    contentUrl: string;
  }[];
  const formats = distributions.map((d) => d.encodingFormat);
  assert.ok(formats.includes("application/fhir+json"));
  assert.ok(formats.includes("application/ld+json"));
  for (const distribution of distributions) {
    assert.match(distribution.contentUrl, new RegExp(investigation.id));
  }
});

test("catalogue lists datasets with resolvable ids", () => {
  const catalog = investigationsCatalogJsonLd(
    [
      {
        id: investigation.id,
        createdAt: investigation.createdAt,
        placeName: "Coimbra",
        latitude: 40.2033,
        longitude: -8.4103,
        riskLevel: "MEDIUM",
      },
    ],
    "https://hydros.example",
  );

  assert.equal(catalog["@type"], "DataCatalog");
  const datasets = (catalog["dcat:dataset"] ?? catalog.dataset) as {
    "@id": string;
    identifier: string;
  }[];
  assert.equal(datasets.length, 1);
  assert.match(datasets[0]?.["@id"] ?? "", new RegExp(investigation.id));
});
