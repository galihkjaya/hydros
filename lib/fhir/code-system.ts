/**
 * Hydros local FHIR code system.
 *
 * Custom codes live under http://hydros.local/CodeSystem/… and are documented
 * here and in the README. Where no standard code genuinely applies, Hydros uses
 * `text` and says so — it does not invent LOINC codes.
 */
export const HYDROS_CODE_SYSTEM = "http://hydros.local/CodeSystem/hydros";

export const HYDROS_CONFIDENCE_EXTENSION =
  "http://hydros.local/StructureDefinition/observation-confidence";

/** Exposure routes for HealthPathway observations. */
export const EXPOSURE_ROUTE_DISPLAY: Record<string, string> = {
  ingestion: "Ingestion",
  dermal: "Dermal contact",
  inhalation: "Inhalation",
  recreational: "Recreational contact",
  food_chain: "Food chain",
  irrigation: "Irrigation",
  livestock_watering: "Livestock watering",
  habitat: "Habitat",
};

export const HEALTH_DOMAIN_DISPLAY: Record<string, string> = {
  human: "Human health",
  animal: "Animal health",
  ecosystem: "Ecosystem health",
};

/** Visual attribute labels, shared with the workspace view-model. */
export const OBSERVATION_ATTRIBUTE_DISPLAY: Record<string, string> = {
  color: "Colour",
  clarity: "Clarity",
  turbidity: "Turbidity",
  particles: "Particles",
  foam: "Foam",
  algae: "Algae",
  debris: "Debris",
  surface: "Surface",
  surroundings: "Surroundings",
  other: "Other",
};
