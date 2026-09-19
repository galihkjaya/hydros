/**
 * FHIR R4 resource builders for a Hydros investigation.
 *
 * Maps the three-layer model onto R4 without collapsing it: observations stay
 * observations (survey + exposure), and only the RiskAssessment resource
 * infers. Plain JSON objects — no FHIR library dependency.
 */
import {
  EXPOSURE_ROUTE_DISPLAY,
  HEALTH_DOMAIN_DISPLAY,
  HYDROS_CODE_SYSTEM,
  HYDROS_CONFIDENCE_EXTENSION,
  OBSERVATION_ATTRIBUTE_DISPLAY,
} from "./code-system";
import type {
  HealthPathway,
  Investigation,
  RiskAssessment,
  VisualObservation,
} from "@/types/investigation";

export type FhirResource = Record<string, unknown>;

/** Per-stage model names plus user contributions, for Provenance. */
export type FhirAgents = {
  vision: string;
  research: string;
  evidence: string;
  oneHealth: string;
  reasoning: string;
};

export function locationId(investigationId: string): string {
  return `hydros-${investigationId}-location`;
}

function observationId(investigationId: string, index: number): string {
  return `hydros-${investigationId}-obs-${index}`;
}

function pathwayId(investigationId: string, index: number): string {
  return `hydros-${investigationId}-pathway-${index}`;
}

function riskId(investigationId: string): string {
  return `hydros-${investigationId}-risk`;
}

function photoId(investigationId: string): string {
  return `hydros-${investigationId}-photo`;
}

/** Coordinates as a FHIR Location with a site physical type. */
export function buildLocationResource(
  investigation: Investigation,
): FhirResource {
  return {
    resourceType: "Location",
    id: locationId(investigation.id),
    name: investigation.location.displayName ?? "Unresolved location",
    description: "Water investigation site.",
    physicalType: {
      coding: [
        {
          system:
            "http://terminology.hl7.org/CodeSystem/location-physical-type",
          code: "si",
          display: "Site",
        },
      ],
    },
    position: {
      latitude: investigation.location.latitude,
      longitude: investigation.location.longitude,
    },
  };
}

function provenanceStatus(
  provenance: VisualObservation["provenance"],
): "final" | "preliminary" {
  // Only human-reviewed observations are final; model-only stays preliminary.
  return provenance === "model" ? "preliminary" : "final";
}

/** One survey Observation per visual observation. Descriptive only. */
export function buildSurveyObservations(
  investigation: Investigation,
): FhirResource[] {
  const locationRef = `Location/${locationId(investigation.id)}`;
  return (investigation.visual?.observations ?? []).map(
    (observation, index) => ({
      resourceType: "Observation",
      id: observationId(investigation.id, index),
      status: provenanceStatus(observation.provenance),
      category: [
        {
          coding: [
            {
              system:
                "http://terminology.hl7.org/CodeSystem/observation-category",
              code: "survey",
              display: "Survey",
            },
          ],
        },
      ],
      code: {
        coding: [
          {
            system: HYDROS_CODE_SYSTEM,
            code: `observation-attribute:${observation.attribute}`,
            display:
              OBSERVATION_ATTRIBUTE_DISPLAY[observation.attribute] ??
              observation.attribute,
          },
        ],
        text: observation.description,
      },
      subject: { reference: locationRef },
      method: { text: `Observation provenance: ${observation.provenance}` },
      valueString: observation.description,
      extension: [
        {
          url: HYDROS_CONFIDENCE_EXTENSION,
          valueDecimal: observation.confidence,
        },
      ],
    }),
  );
}

/** One exposure Observation per health pathway. Conditional, cited, never concluding. */
export function buildExposureObservations(
  investigation: Investigation,
  pathways: readonly HealthPathway[],
): FhirResource[] {
  const locationRef = `Location/${locationId(investigation.id)}`;
  return pathways.map((pathway, index) => ({
    resourceType: "Observation",
    id: pathwayId(investigation.id, index),
    status: "preliminary",
    category: [{ text: "exposure" }],
    code: {
      coding: [
        {
          system: HYDROS_CODE_SYSTEM,
          code: `exposure-route:${pathway.route}`,
          display: EXPOSURE_ROUTE_DISPLAY[pathway.route] ?? pathway.route,
        },
      ],
      text: pathway.description,
    },
    subject: { reference: locationRef },
    component: [
      {
        code: { text: "One Health domain" },
        valueString: HEALTH_DOMAIN_DISPLAY[pathway.domain] ?? pathway.domain,
      },
      {
        code: { text: "Exposed group" },
        valueString: pathway.affectedGroup || "not stated",
      },
    ],
    note: pathway.confirmationRequired
      ? [{ text: `To confirm: ${pathway.confirmationRequired}` }]
      : undefined,
  }));
}

/** FHIR qualitative risk coding for definite levels. None for INSUFFICIENT_DATA. */
function qualitativeRiskCoding(level: RiskAssessment["riskLevel"]) {
  const display =
    level === "LOW" ? "Low" : level === "MEDIUM" ? "Moderate" : "High";
  if (level === "INSUFFICIENT_DATA") return undefined;
  return {
    coding: [
      {
        system: "http://terminology.hl7.org/CodeSystem/risk-probability",
        code: level.toLowerCase(),
        display,
      },
    ],
  };
}

/** The assessment. The only resource that infers. */
export function buildRiskAssessmentResource(
  investigation: Investigation,
  observationRefs: string[],
): FhirResource | null {
  const assessment = investigation.assessment;
  if (!assessment) return null;

  const prediction: Record<string, unknown> = {
    outcome:
      assessment.riskLevel === "INSUFFICIENT_DATA"
        ? { text: "Insufficient data" }
        : { text: assessment.summary },
    probabilityDecimal: assessment.confidence,
  };
  const qualitative = qualitativeRiskCoding(assessment.riskLevel);
  if (qualitative) prediction.qualitativeRisk = qualitative;

  return {
    resourceType: "RiskAssessment",
    id: riskId(investigation.id),
    status: "final",
    subject: { reference: `Location/${locationId(investigation.id)}` },
    prediction: [prediction],
    basis: observationRefs.map((ref) => ({ reference: ref })),
    mitigation: assessment.recommendation,
    note: assessment.limitations.map((limitation) => ({ text: limitation })),
  };
}

/** The photograph, by URL only — never inline base64. */
export function buildPhotoReference(
  investigation: Investigation,
): FhirResource | null {
  if (!investigation.imageUrl) return null;
  return {
    resourceType: "DocumentReference",
    id: photoId(investigation.id),
    status: "current",
    type: { text: "Photograph of the investigated water source" },
    subject: { reference: `Location/${locationId(investigation.id)}` },
    content: [
      {
        attachment: {
          contentType: "image/jpeg",
          url: investigation.imageUrl,
        },
      },
    ],
  };
}

/**
 * Who produced what: one agent entry per pipeline stage plus a user entry
 * when a person confirmed, corrected, or added observations. This is the
 * resource that proves the human-in-the-loop claim in machine-readable form.
 */
export function buildProvenanceResource(
  investigation: Investigation,
  agents: FhirAgents,
  resourceRefs: string[],
): FhirResource {
  const stageAgents = [
    { stage: "visual analysis", model: agents.vision },
    { stage: "research planning", model: agents.research },
    { stage: "evidence synthesis", model: agents.evidence },
    { stage: "One Health bridge", model: agents.oneHealth },
    { stage: "final reasoning", model: agents.reasoning },
  ];

  const agent = stageAgents.map(({ stage, model }) => ({
    type: { text: "model" },
    role: [{ text: stage }],
    who: { display: model },
  }));

  const observations = investigation.visual?.observations ?? [];
  if (
    observations.some((observation) => observation.provenance !== "model")
  ) {
    agent.push({
      type: { text: "person" },
      role: [{ text: "observation confirmation" }],
      who: { display: "Investigating user (human-in-the-loop review)" },
    });
  }

  return {
    resourceType: "Provenance",
    id: `hydros-${investigation.id}-provenance`,
    target: resourceRefs.map((ref) => ({ reference: ref })),
    recorded: investigation.createdAt,
    agent,
    entity: [
      {
        role: "source",
        what: { reference: `Location/${locationId(investigation.id)}` },
      },
    ],
  };
}
