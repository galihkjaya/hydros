/**
 * Self-check for the guided assessment mapping.
 *
 * The mapping is deterministic: fixed options and free text in, attributed
 * observations out. Nothing infers; a mismatched client cannot inject
 * observations outside the checklist vocabulary.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  emptyGuidedResponses,
  guidedToObservations,
  hasGuidedResponses,
} from "../lib/investigation/guided.js";

test("maps categorical answers to user_added observations at full confidence", () => {
  const observations = guidedToObservations({
    ...emptyGuidedResponses(),
    waterColour: "brown",
    clarity: "not_visible",
    algae: "patches",
  });

  assert.equal(observations.length, 3);
  assert.ok(
    observations.every(
      (observation) =>
        observation.provenance === "user_added" &&
        observation.confidence === 1.0,
    ),
  );
  assert.equal(observations[0]?.attribute, "color");
  assert.match(observations[0]?.description ?? "", /brown/);
});

test("foam is recorded on both surface and foam", () => {
  const observations = guidedToObservations({
    ...emptyGuidedResponses(),
    surface: "foam",
  });
  const attributes = observations.map((o) => o.attribute).sort();
  assert.deepEqual(attributes, ["foam", "surface"]);
});

test("other selections carry the user's own wording", () => {
  const observations = guidedToObservations({
    ...emptyGuidedResponses(),
    odour: "other",
    odourOther: "rotten eggs after rain",
  });
  assert.equal(observations.length, 1);
  assert.match(observations[0]?.description ?? "", /rotten eggs after rain/);
});

test("free text becomes observations only when non-empty", () => {
  const observations = guidedToObservations({
    ...emptyGuidedResponses(),
    wildlife: "Herons and kingfishers.",
    humanActivity: "   ",
  });
  assert.equal(observations.length, 1);
  assert.equal(observations[0]?.attribute, "other");
});

test("unknown option values are skipped, never injected", () => {
  const observations = guidedToObservations({
    ...emptyGuidedResponses(),
    // A mismatched client inventing values must not create observations.
    waterColour: "radioactive",
    flow: "temporal",
  } as never);
  assert.equal(observations.length, 0);
});

test("blank checklist detects as empty", () => {
  assert.equal(hasGuidedResponses(emptyGuidedResponses()), false);
  assert.equal(
    hasGuidedResponses({ ...emptyGuidedResponses(), litter: "some" }),
    true,
  );
});
