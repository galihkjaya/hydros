/**
 * FHIR R4 bundle self-check.
 *
 * Structural validation: every resource the bundle claims is present, every
 * reference resolves inside the bundle, and the three-layer separation
 * survives the mapping (observations describe, only RiskAssessment infers).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildFhirBundle } from "../lib/fhir/bundle.js";
import type { Investigation } from "../types/investigation.js";

const agents = {
  vision: "nvidia/test-vision",
  research: "cerebras/test",
  evidence: "cerebras/test",
  oneHealth: "cerebras/test",
  reasoning: "groq/test",
};

const investigation: Investigation = {
  id: "123e4567-e89b-12d3-a456-426614174000",
  status: "completed",
  createdAt: "2026-09-19T00:00:00.000Z",
  location: {
    latitude: 40.2033,
    longitude: -8.4103,
    displayName: "Coimbra",
    countryCode: "PT",
  },
  userNote: "",
  imageUrl: "https://example.supabase.co/hydros-images/id/source.jpg",
  visual: {
    isWaterVisible: true,
    summary: "Green water.",
    observations: [
      {
        attribute: "color",
        description: "The water appears green.",
        confidence: 0.8,
        provenance: "user_confirmed",
      },
      {
        attribute: "algae",
        description: "Algal patches near the bank.",
        confidence: 0.6,
        provenance: "model",
      },
    ],
    limitations: ["No lab test."],
  },
  geographic: {
    location: { latitude: 40.2033, longitude: -8.4103, displayName: "Coimbra" },
    radiusMetres: 2000,
    waterways: ["Mondego River"],
    potentialRiskSources: [],
  },
  sources: [
    {
      title: "Report",
      url: "https://example.gov/report",
      domain: "example.gov",
      snippet: "s",
      sourceType: "government",
      faviconUrl: null,
      relevance: 0.9,
    },
  ],
  evidence: [
    {
      claim: "A report recorded algal blooms in the Mondego basin.",
      sourceUrl: "https://example.gov/report",
      uncertainty: "Basin-wide.",
      relevance: 0.8,
    },
  ],
  healthPathways: [
    {
      domain: "ecosystem",
      route: "habitat",
      description:
        "If the mats persist, they could shade submerged plants that fish rely on.",
      affectedGroup: "Submerged plants and fish",
      basis: ["observation:algae", "https://example.gov/report"],
      strength: 0.65,
      confirmationRequired: "Dissolved oxygen sampling at this point.",
    },
  ],
  assessment: {
    riskLevel: "MEDIUM",
    confidence: 0.6,
    summary: "Some indicators warrant caution.",
    riskFactors: ["Algal patches"],
    evidence: [],
    recommendation: "Treat as untested.",
    limitations: ["No lab test."],
  },
};

test("bundle is a collection with every layer represented", () => {
  const bundle = buildFhirBundle(investigation, agents);

  assert.equal(bundle.resourceType, "Bundle");
  assert.equal(bundle.type, "collection");
  assert.equal(bundle.identifier.value, investigation.id);

  const types = bundle.entry.map((entry) => entry.resource.resourceType);
  for (const expected of [
    "Location",
    "Observation",
    "RiskAssessment",
    "DocumentReference",
    "Provenance",
  ]) {
    assert.ok(types.includes(expected), `bundle contains ${expected}`);
  }

  // Two survey observations plus one exposure observation.
  const observations = bundle.entry.filter(
    (entry) => entry.resource.resourceType === "Observation",
  );
  assert.equal(observations.length, 3);
});

test("every reference resolves inside the bundle", () => {
  const bundle = buildFhirBundle(investigation, agents);
  const known = new Set(
    bundle.entry.map(
      (entry) => `${entry.resource.resourceType}/${entry.resource.id}`,
    ),
  );

  const refs: string[] = [];
  const collect = (value: unknown) => {
    if (Array.isArray(value)) {
      for (const item of value) collect(item);
    } else if (typeof value === "object" && value !== null) {
      const record = value as Record<string, unknown>;
      if (typeof record.reference === "string") refs.push(record.reference);
      for (const item of Object.values(record)) collect(item);
    }
  };
  for (const entry of bundle.entry) collect(entry.resource);

  assert.ok(refs.length > 0, "bundle contains references");
  for (const ref of refs) {
    assert.ok(known.has(ref), `reference resolves: ${ref}`);
  }
});

test("provenance records models and the human reviewer", () => {
  const bundle = buildFhirBundle(investigation, agents);
  const provenance = bundle.entry.find(
    (entry) => entry.resource.resourceType === "Provenance",
  )?.resource as unknown as {
    agent: { type: { text: string }; who: { display: string } }[];
    target: { reference: string }[];
  };

  const displays = provenance.agent.map((agent) => agent.who.display);
  assert.ok(displays.includes("groq/test"));
  assert.ok(displays.includes("nvidia/test-vision"));
  // One observation is user_confirmed: a person entry must exist.
  assert.ok(
    provenance.agent.some((agent) => agent.type.text === "person"),
    "human reviewer is recorded",
  );
  assert.ok(provenance.target.length >= 5, "provenance covers the bundle");
});

test("model-only runs record no person, and photo is URL-only", () => {
  const modelOnly: Investigation = {
    ...investigation,
    imageUrl: undefined,
    visual: {
      ...investigation.visual!,
      observations: investigation.visual!.observations.map((o) => ({
        ...o,
        provenance: "model" as const,
      })),
    },
  };
  const bundle = buildFhirBundle(modelOnly, agents);
  const provenance = bundle.entry.find(
    (entry) => entry.resource.resourceType === "Provenance",
  )?.resource as unknown as { agent: { type: { text: string } }[] };

  assert.ok(
    provenance.agent.every((agent) => agent.type.text !== "person"),
    "no person entry without human review",
  );
  assert.ok(
    !bundle.entry.some(
      (entry) => entry.resource.resourceType === "DocumentReference",
    ),
    "no photo reference without an image URL",
  );
});

test("INSUFFICIENT_DATA carries no qualitative risk code", () => {
  const bundle = buildFhirBundle(
    {
      ...investigation,
      assessment: {
        ...investigation.assessment!,
        riskLevel: "INSUFFICIENT_DATA",
        confidence: 0.1,
      },
    },
    agents,
  );
  const risk = bundle.entry.find(
    (entry) => entry.resource.resourceType === "RiskAssessment",
  )?.resource as unknown as {
    prediction: { outcome: { text: string }; qualitativeRisk?: unknown }[];
  };
  assert.equal(risk.prediction[0]?.outcome.text, "Insufficient data");
  assert.equal(risk.prediction[0]?.qualitativeRisk, undefined);
});
