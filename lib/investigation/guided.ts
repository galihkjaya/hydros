/**
 * Guided stream assessment.
 *
 * A structured, ordered checklist modelled on standard visual stream
 * assessment protocols. Plain language, no jargon. Produces structurally
 * consistent observations — which is what makes site-level trend analysis
 * meaningful — with or without a photograph.
 *
 * Mapping is deterministic: each categorical answer becomes one
 * VisualObservation with provenance "user_added" and confidence 1.0. Free
 * text is sanitized and fenced as data downstream, exactly like the photo
 * note. Nothing here infers; every description stays observational.
 */
import { sanitizeText } from "@/lib/utils/validation";
import type {
  GuidedResponses,
  VisualAttribute,
  VisualObservation,
} from "@/types/investigation";

/** Checklist item ids, in the order the form presents them. */
export const GUIDED_ITEMS = [
  "waterColour",
  "clarity",
  "surface",
  "odour",
  "algae",
  "flow",
  "bankVegetation",
  "litter",
  "wildlife",
  "humanActivity",
] as const;

export type GuidedItemId = (typeof GUIDED_ITEMS)[number];

/** Fixed options per categorical item: value → observational description. */
const OPTIONS: Record<string, Record<string, string>> = {
  waterColour: {
    clear: "The water appears clear.",
    green: "The water appears green.",
    brown: "The water appears brown.",
    grey: "The water appears grey.",
    other: "The water colour was reported as other.",
  },
  clarity: {
    bed_visible: "The bed is visible through the water.",
    partially: "The bed is partially visible.",
    not_visible: "The bed is not visible.",
  },
  surface: {
    calm: "The surface is calm.",
    foam: "Foam is present on the surface.",
    oily_sheen: "An oily sheen is visible on the surface.",
    scum: "Scum is present on the surface.",
  },
  odour: {
    none: "No odour was reported.",
    earthy: "An earthy odour was reported.",
    sewage: "A sewage-like odour was reported.",
    chemical: "A chemical odour was reported.",
    other: "An odour was reported as other.",
  },
  algae: {
    none: "No visible algae was reported.",
    patches: "Patches of algae were reported.",
    extensive: "Extensive algal mats were reported.",
  },
  flow: {
    stagnant: "The water was reported as stagnant.",
    slow: "The water was reported as slow-moving.",
    moderate: "The water was reported as moderate-flowing.",
    fast: "The water was reported as fast-flowing.",
  },
  bankVegetation: {
    dense: "Bank vegetation was reported as dense.",
    patchy: "Bank vegetation was reported as patchy.",
    bare: "The banks were reported as bare.",
    concrete: "The channel was reported as concrete-lined.",
  },
  litter: {
    none: "No litter or debris was reported.",
    some: "Some litter or debris was reported.",
    heavy: "Heavy litter or debris was reported.",
  },
};

/** Which visual attribute each checklist answer maps to. */
const ATTRIBUTE_FOR_ITEM: Record<string, VisualAttribute> = {
  waterColour: "color",
  clarity: "clarity",
  surface: "surface",
  odour: "other",
  algae: "algae",
  flow: "surface",
  bankVegetation: "surroundings",
  litter: "debris",
  wildlife: "other",
  humanActivity: "surroundings",
};

const MAX_FREE_TEXT = 300;

/**
 * Maps guided answers onto observations.
 *
 * Unknown option values are skipped (a mismatched client must not inject
 * observations); free text becomes an observation only when non-empty after
 * sanitizing. "other" selections append the user's own wording when given.
 */
export function guidedToObservations(
  responses: GuidedResponses,
): VisualObservation[] {
  const observations: VisualObservation[] = [];

  const push = (attribute: VisualAttribute, description: string) => {
    const clean = sanitizeText(description, MAX_FREE_TEXT);
    if (!clean) return;
    observations.push({
      attribute,
      description: clean,
      confidence: 1.0,
      provenance: "user_added",
    });
  };

  const categorical = (
    item: string,
    value: string,
    otherText?: string,
  ): void => {
    const options = OPTIONS[item];
    const attribute = ATTRIBUTE_FOR_ITEM[item] ?? "other";
    if (!options) return;
    const base = options[value];
    if (!base) return;
    if (value === "other" && otherText?.trim()) {
      push(
        attribute,
        `${base} Reported as: ${sanitizeText(otherText, 120)}`,
      );
    } else {
      push(attribute, base);
    }
  };

  categorical("waterColour", responses.waterColour, responses.waterColourOther);
  categorical("clarity", responses.clarity);
  categorical("surface", responses.surface);
  categorical("odour", responses.odour, responses.odourOther);
  categorical("algae", responses.algae);
  categorical("flow", responses.flow);
  categorical("bankVegetation", responses.bankVegetation);
  categorical("litter", responses.litter);

  if (responses.wildlife.trim()) {
    push(
      "other",
      `Wildlife observed: ${sanitizeText(responses.wildlife, 200)}`,
    );
  }
  if (responses.humanActivity.trim()) {
    push(
      "surroundings",
      `Human activity nearby: ${sanitizeText(responses.humanActivity, 200)}`,
    );
  }

  // A foam report is also foam, whatever the surface item said.
  if (responses.surface === "foam") {
    push("foam", "Foam is present on the surface.");
  }

  return observations;
}

/** True when at least one checklist item carries an answer. */
export function hasGuidedResponses(responses: GuidedResponses): boolean {
  return GUIDED_ITEMS.some((item) => responses[item].trim().length > 0);
}

/** Blank checklist, for form initial state. */
export function emptyGuidedResponses(): GuidedResponses {
  return {
    waterColour: "",
    waterColourOther: "",
    clarity: "",
    surface: "",
    odour: "",
    odourOther: "",
    algae: "",
    flow: "",
    bankVegetation: "",
    litter: "",
    wildlife: "",
    humanActivity: "",
  };
}
