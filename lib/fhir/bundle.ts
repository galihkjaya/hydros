/**
 * Assembles a completed investigation into an HL7 FHIR R4 Bundle of type
 * `collection`: Location, survey Observations, exposure Observations,
 * RiskAssessment, DocumentReference, and Provenance.
 */
import {
  buildExposureObservations,
  buildLocationResource,
  buildPhotoReference,
  buildProvenanceResource,
  buildRiskAssessmentResource,
  buildSurveyObservations,
  type FhirAgents,
  type FhirResource,
} from "./resources";
import type { Investigation } from "@/types/investigation";

export type FhirBundle = {
  resourceType: "Bundle";
  type: "collection";
  timestamp: string;
  identifier: { system: string; value: string };
  entry: { fullUrl: string; resource: FhirResource }[];
};

export function buildFhirBundle(
  investigation: Investigation,
  agents: FhirAgents,
): FhirBundle {
  const location = buildLocationResource(investigation);
  const survey = buildSurveyObservations(investigation);
  const exposure = buildExposureObservations(
    investigation,
    investigation.healthPathways,
  );
  const photo = buildPhotoReference(investigation);

  const observationRefs = [
    ...survey.map((resource) => `Observation/${resource.id}`),
    ...exposure.map((resource) => `Observation/${resource.id}`),
  ];
  const risk = buildRiskAssessmentResource(investigation, observationRefs);

  const resources: FhirResource[] = [
    location,
    ...survey,
    ...exposure,
    ...(risk ? [risk] : []),
    ...(photo ? [photo] : []),
  ];
  const refs = resources.map(
    (resource) => `${resource.resourceType}/${resource.id}`,
  );
  const provenance = buildProvenanceResource(investigation, agents, refs);

  const entry = [...resources, provenance].map((resource) => ({
    fullUrl: `urn:hydros:${resource.resourceType}/${resource.id}`,
    resource,
  }));

  return {
    resourceType: "Bundle",
    type: "collection",
    timestamp: new Date().toISOString(),
    identifier: {
      system: "http://hydros.local/investigation",
      value: investigation.id,
    },
    entry,
  };
}
