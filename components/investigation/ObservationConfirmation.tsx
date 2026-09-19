"use client";

import { useState } from "react";
import { Button, Callout, Chip, Eyebrow } from "@/components/ui/primitives";
import { ATTRIBUTE_LABELS } from "./view-model";
import { formatConfidence } from "@/lib/utils/format";
import type {
  ConfirmationInput,
  GeographicContext,
  VisualAnalysis,
  VisualAttribute,
  VisualObservation,
} from "@/types/investigation";

const ATTRIBUTES: VisualAttribute[] = [
  "color",
  "clarity",
  "turbidity",
  "particles",
  "foam",
  "algae",
  "debris",
  "surface",
  "surroundings",
  "other",
];

type Row = {
  key: string;
  attribute: VisualAttribute;
  description: string;
  confidence: number;
  provenance: VisualObservation["provenance"];
  /** Original model text, to detect user edits. */
  original: string;
  removed: boolean;
};

/**
 * Human-in-the-loop confirmation.
 *
 * Phase A pauses here: the user sees every model observation with its
 * confidence and can confirm, correct, remove, or add observations before
 * research begins. Provenance travels into the final report, so the
 * human-in-the-loop claim stays visible rather than cosmetic.
 */
export function ObservationConfirmation({
  visual,
  geographic,
  onConfirm,
  confirming,
}: {
  visual: VisualAnalysis;
  geographic: GeographicContext;
  onConfirm: (confirmation: ConfirmationInput) => void;
  confirming: boolean;
}) {
  const [rows, setRows] = useState<Row[]>(() =>
    visual.observations.map((observation, index) => ({
      key: `obs-${index}`,
      attribute: observation.attribute,
      description: observation.description,
      confidence: observation.confidence,
      provenance: observation.provenance,
      original: observation.description,
      removed: false,
    })),
  );
  const [newAttribute, setNewAttribute] = useState<VisualAttribute>("other");
  const [newDescription, setNewDescription] = useState("");
  const [placeName, setPlaceName] = useState(
    geographic.location.displayName ?? "",
  );
  const [notWaterBody, setNotWaterBody] = useState(false);

  const active = rows.filter((row) => !row.removed);

  function setRow(key: string, patch: Partial<Row>) {
    setRows((prev) =>
      prev.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );
  }

  function addObservation() {
    const description = newDescription.trim();
    if (!description) return;
    setRows((prev) => [
      ...prev,
      {
        key: `user-${Date.now()}`,
        attribute: newAttribute,
        description,
        confidence: 1.0,
        provenance: "user_added",
        original: "",
        removed: false,
      },
    ]);
    setNewDescription("");
  }

  function submit(skip: boolean) {
    const observations = skip
      ? visual.observations
      : active.map((row) => ({
          attribute: row.attribute,
          description: row.description.trim(),
          confidence: row.confidence,
          provenance:
            row.provenance === "user_added"
              ? row.provenance
              : row.description.trim() !== row.original
                ? ("user_corrected" as const)
                : ("user_confirmed" as const),
        }));
    onConfirm({
      observations,
      ...(placeName.trim() &&
      placeName.trim() !== (geographic.location.displayName ?? "")
        ? { displayName: placeName.trim() }
        : {}),
      ...(notWaterBody ? { notWaterBody: true } : {}),
    });
  }

  return (
    <div className="border-t-2 border-ink pt-5">
      <Eyebrow>Check the AI&apos;s work</Eyebrow>
      <h2 className="mt-1 font-serif text-2xl">
        Confirm what was <em>observed</em>
      </h2>
      <p className="hydros-prose mt-2 text-[0.9375rem] text-ink-muted">
        The model reported what it sees. Correct it before research begins —
        removed observations never reach the search, and your edits stay
        labelled in the final report.
      </p>

      {!visual.isWaterVisible ? (
        <Callout eyebrow="No water detected" tone="signal" className="mt-4">
          <p className="text-[0.9375rem]">
            The model does not think this photograph shows a water body. If it
            is wrong, correct the observations below; if it is right, tick
            “not a water body” to stop here honestly.
          </p>
        </Callout>
      ) : null}

      <ul className="mt-6 space-y-4">
        {rows.map((row) =>
          row.removed ? null : (
            <li key={row.key} className="border-t border-rule pt-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label
                  htmlFor={`${row.key}-attr`}
                  className="hydros-eyebrow"
                >
                  {ATTRIBUTE_LABELS[row.attribute]}
                </label>
                <span className="flex items-center gap-2">
                  <span className="hydros-mono text-ink-faint">
                    {formatConfidence(row.confidence)}
                  </span>
                  {row.provenance === "user_added" ? (
                    <Chip tone="neutral">Added by you</Chip>
                  ) : null}
                  <Button
                    type="button"
                    variant="tertiary"
                    size="sm"
                    disabled={confirming}
                    onClick={() => setRow(row.key, { removed: true })}
                    aria-label={`Remove observation: ${row.description}`}
                  >
                    Remove
                  </Button>
                </span>
              </div>
              <label htmlFor={`${row.key}-desc`} className="sr-only">
                Observation description
              </label>
              <textarea
                id={`${row.key}-desc`}
                value={row.description}
                disabled={confirming}
                rows={2}
                onChange={(event) =>
                  setRow(row.key, { description: event.target.value })
                }
                className="mt-2 w-full resize-y border border-ink bg-paper px-3 py-2 text-[0.9375rem] disabled:opacity-60"
              />
              <select
                id={`${row.key}-attr`}
                value={row.attribute}
                disabled={confirming}
                aria-label="Observation attribute"
                onChange={(event) =>
                  setRow(row.key, {
                    attribute: event.target.value as VisualAttribute,
                  })
                }
                className="mt-2 h-9 border border-rule bg-paper px-2 font-mono text-[0.8125rem] disabled:opacity-60"
              >
                {ATTRIBUTES.map((attribute) => (
                  <option key={attribute} value={attribute}>
                    {ATTRIBUTE_LABELS[attribute]}
                  </option>
                ))}
              </select>
            </li>
          ),
        )}
      </ul>

      <div className="mt-6 border border-ink p-4">
        <Eyebrow>Add your own observation</Eyebrow>
        <div className="mt-3 grid gap-3 sm:grid-cols-[180px_1fr]">
          <label className="block">
            <span className="sr-only">Attribute</span>
            <select
              value={newAttribute}
              disabled={confirming}
              onChange={(event) =>
                setNewAttribute(event.target.value as VisualAttribute)
              }
              className="h-10 w-full border border-rule bg-paper px-2 font-mono text-[0.8125rem] disabled:opacity-60"
            >
              {ATTRIBUTES.map((attribute) => (
                <option key={attribute} value={attribute}>
                  {ATTRIBUTE_LABELS[attribute]}
                </option>
              ))}
            </select>
          </label>
          <div className="flex gap-2">
            <label className="flex-1">
              <span className="sr-only">Your observation</span>
              <input
                type="text"
                value={newDescription}
                disabled={confirming}
                placeholder="What do you see that the model missed?"
                onChange={(event) => setNewDescription(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addObservation();
                  }
                }}
                className="h-10 w-full border border-ink bg-paper px-3 text-[0.9375rem] placeholder:text-ink-faint disabled:opacity-60"
              />
            </label>
            <Button
              type="button"
              variant="secondary"
              disabled={confirming || !newDescription.trim()}
              onClick={addObservation}
            >
              Add
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="confirm-place" className="hydros-eyebrow">
            Place name
          </label>
          <input
            id="confirm-place"
            type="text"
            value={placeName}
            disabled={confirming}
            placeholder={geographic.location.displayName ?? "Unresolved location"}
            onChange={(event) => setPlaceName(event.target.value)}
            className="mt-2 h-10 w-full border border-ink bg-paper px-3 font-mono text-[0.8125rem] placeholder:text-ink-faint disabled:opacity-60"
          />
        </div>
        <label className="flex cursor-pointer items-start gap-2 self-end border border-rule p-3 text-[0.875rem]">
          <input
            type="checkbox"
            checked={notWaterBody}
            disabled={confirming}
            onChange={(event) => setNotWaterBody(event.target.checked)}
            className="mt-1 size-4 accent-black"
          />
          This is not a water body — stop here with an honest no-result.
        </label>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Button
          type="button"
          disabled={confirming}
          onClick={() => submit(false)}
        >
          {confirming ? "Continuing…" : `Continue with ${active.length} observation${active.length === 1 ? "" : "s"}`}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={confirming}
          onClick={() => submit(true)}
        >
          Skip and continue
        </Button>
      </div>
    </div>
  );
}
