"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Eyebrow, SectionHeading } from "@/components/ui/primitives";
import { FieldError, ImageUploader } from "@/components/upload/ImageUploader";
import {
  LocationInput,
  type LocationDraft,
} from "@/components/upload/LocationInput";
import { emptyGuidedResponses } from "@/lib/investigation/guided";
import {
  newInvestigationId,
  saveDraft,
} from "@/lib/investigation/draft";
import { prepareImage } from "@/lib/utils/image";
import {
  validateLatitude,
  validateLongitude,
} from "@/lib/utils/validation";
import type { GuidedResponses } from "@/types/investigation";

const EMPTY_LOCATION: LocationDraft = { latitude: "", longitude: "" };

type CategoricalItem = {
  id: "waterColour" | "clarity" | "surface" | "odour" | "algae" | "flow" | "bankVegetation" | "litter";
  title: string;
  why: string;
  options: { value: string; label: string }[];
  freeText?: "waterColourOther" | "odourOther";
};

const CATEGORICAL: CategoricalItem[] = [
  {
    id: "waterColour",
    title: "Water colour",
    why: "Sudden colour change is often the first visible sign that something upstream has shifted.",
    options: [
      { value: "clear", label: "Clear" },
      { value: "green", label: "Green" },
      { value: "brown", label: "Brown" },
      { value: "grey", label: "Grey" },
      { value: "other", label: "Other" },
    ],
    freeText: "waterColourOther",
  },
  {
    id: "clarity",
    title: "Water clarity",
    why: "Whether the bed shows through says how much suspended material the water carries.",
    options: [
      { value: "bed_visible", label: "Bed visible" },
      { value: "partially", label: "Partially visible" },
      { value: "not_visible", label: "Not visible" },
    ],
  },
  {
    id: "surface",
    title: "Surface condition",
    why: "Foam, sheen, and scum each point at different possible causes worth researching.",
    options: [
      { value: "calm", label: "Calm" },
      { value: "foam", label: "Foam" },
      { value: "oily_sheen", label: "Oily sheen" },
      { value: "scum", label: "Scum" },
    ],
  },
  {
    id: "odour",
    title: "Odour",
    why: "Smell is something a photograph can never capture — your nose is the sensor here.",
    options: [
      { value: "none", label: "None" },
      { value: "earthy", label: "Earthy" },
      { value: "sewage", label: "Sewage" },
      { value: "chemical", label: "Chemical" },
      { value: "other", label: "Other" },
    ],
    freeText: "odourOther",
  },
  {
    id: "algae",
    title: "Visible algae",
    why: "Algal mats can signal excess nutrients and precede oxygen crashes that harm wildlife.",
    options: [
      { value: "none", label: "None" },
      { value: "patches", label: "Patches" },
      { value: "extensive", label: "Extensive mats" },
    ],
  },
  {
    id: "flow",
    title: "Flow",
    why: "Stagnant water behaves differently from flowing water — it warms, stratifies, and concentrates.",
    options: [
      { value: "stagnant", label: "Stagnant" },
      { value: "slow", label: "Slow" },
      { value: "moderate", label: "Moderate" },
      { value: "fast", label: "Fast" },
    ],
  },
  {
    id: "bankVegetation",
    title: "Bank vegetation",
    why: "Vegetated banks filter runoff; bare or concrete banks let it straight in.",
    options: [
      { value: "dense", label: "Dense" },
      { value: "patchy", label: "Patchy" },
      { value: "bare", label: "Bare" },
      { value: "concrete", label: "Concrete channel" },
    ],
  },
  {
    id: "litter",
    title: "Litter and debris",
    why: "Litter records how people use the site — and what washes in with rain.",
    options: [
      { value: "none", label: "None" },
      { value: "some", label: "Some" },
      { value: "heavy", label: "Heavy" },
    ],
  },
];

/**
 * Guided stream assessment form.
 *
 * Structured observations with or without a photograph. Each answer maps
 * deterministically to a user_added observation; a supplied photo adds the
 * model's observations alongside, conflicts shown rather than merged away.
 */
export function GuidedAssessmentForm({
  initialLocation,
}: {
  initialLocation?: LocationDraft;
}) {
  const router = useRouter();
  const [responses, setResponses] = useState<GuidedResponses>(emptyGuidedResponses());
  const [location, setLocation] = useState<LocationDraft>(initialLocation ?? EMPTY_LOCATION);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | undefined>(undefined);
  const previewUrlRef = useRef<string | null>(null);

  useEffect(
    () => () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    },
    [],
  );

  function set<K extends keyof GuidedResponses>(key: K, value: GuidedResponses[K]) {
    setResponses((prev) => ({ ...prev, [key]: value }));
  }

  const answeredCount = CATEGORICAL.filter((item) => responses[item.id].trim() !== "").length
    + (responses.wildlife.trim() ? 1 : 0)
    + (responses.humanActivity.trim() ? 1 : 0);

  const latitude = Number(location.latitude);
  const longitude = Number(location.longitude);
  const hasLocation =
    location.latitude.trim() !== "" &&
    location.longitude.trim() !== "" &&
    validateLatitude(latitude).ok &&
    validateLongitude(longitude).ok;
  const canSubmit = answeredCount > 0 && hasLocation && !submitting;

  function selectFile(next: File) {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const url = URL.createObjectURL(next);
    previewUrlRef.current = url;
    setPreviewUrl(url);
    setFile(next);
    setFormError(undefined);
  }

  function clearFile() {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;
    setPreviewUrl(null);
    setFile(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (answeredCount === 0) {
      setFormError("Answer at least one checklist item.");
      return;
    }
    if (!hasLocation) {
      setFormError("Enter a valid latitude and longitude.");
      return;
    }

    setSubmitting(true);
    setFormError(undefined);
    try {
      const prepared = file ? await prepareImage(file) : null;
      const id = newInvestigationId();
      saveDraft(id, {
        ...(prepared
          ? {
              imageDataUrl: prepared.dataUrl,
              imageWidth: prepared.width,
              imageHeight: prepared.height,
            }
          : { imageWidth: 0, imageHeight: 0 }),
        latitude,
        longitude,
        note: "",
        guidedResponses: responses,
        createdAt: new Date().toISOString(),
      });
      router.push(`/investigate/${id}`);
    } catch (error) {
      setSubmitting(false);
      setFormError(
        error instanceof Error
          ? error.message
          : "Could not prepare the image. Try a different photo.",
      );
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-10 lg:grid-cols-12">
      <div className="space-y-2 lg:col-span-7">
        {CATEGORICAL.map((item, index) => (
          <fieldset
            key={item.id}
            className="border-t border-rule py-5"
          >
            <legend className="hydros-eyebrow float-left pt-5 pr-4">
              {String(index + 1).padStart(2, "0")} · {item.title}
            </legend>
            <div
              role="radiogroup"
              aria-label={item.title}
              className="mt-8 flex flex-wrap gap-2"
            >
              {item.options.map((option) => {
                const selected = responses[item.id] === option.value;
                return (
                  <label
                    key={option.value}
                    className={
                      selected
                        ? "cursor-pointer border border-ink bg-ink px-3 py-1.5 text-[0.875rem] text-paper"
                        : "cursor-pointer border border-ink-faint px-3 py-1.5 text-[0.875rem] hover:border-ink"
                    }
                  >
                    <input
                      type="radio"
                      name={item.id}
                      value={option.value}
                      checked={selected}
                      disabled={submitting}
                      onChange={() => set(item.id, option.value)}
                      className="sr-only"
                    />
                    {option.label}
                  </label>
                );
              })}
            </div>
            {item.freeText && responses[item.id] === "other" ? (
              <input
                type="text"
                value={responses[item.freeText]}
                disabled={submitting}
                placeholder="Describe it in your own words"
                onChange={(event) => set(item.freeText!, event.target.value)}
                className="mt-3 h-10 w-full border border-ink bg-paper px-3 text-[0.9375rem] placeholder:text-ink-faint disabled:opacity-60"
              />
            ) : null}
            <details className="mt-2">
              <summary className="cursor-pointer text-[0.8125rem] text-ink-muted underline underline-offset-4">
                Why this matters
              </summary>
              <p className="mt-1 text-[0.8125rem] text-ink-muted">{item.why}</p>
            </details>
          </fieldset>
        ))}

        <div className="border-t border-rule py-5">
          <label htmlFor="guided-wildlife" className="hydros-eyebrow">
            09 · Wildlife observed
          </label>
          <input
            id="guided-wildlife"
            type="text"
            value={responses.wildlife}
            disabled={submitting}
            placeholder="Birds, fish, insects — or none"
            onChange={(event) => set("wildlife", event.target.value)}
            className="mt-3 h-10 w-full border border-ink bg-paper px-3 text-[0.9375rem] placeholder:text-ink-faint disabled:opacity-60"
          />
          <details className="mt-2">
            <summary className="cursor-pointer text-[0.8125rem] text-ink-muted underline underline-offset-4">
              Why this matters
            </summary>
            <p className="mt-1 text-[0.8125rem] text-ink-muted">
              Absent wildlife where it should be is itself an observation.
            </p>
          </details>
        </div>

        <div className="border-t border-rule py-5">
          <label htmlFor="guided-activity" className="hydros-eyebrow">
            10 · Human activity nearby
          </label>
          <input
            id="guided-activity"
            type="text"
            value={responses.humanActivity}
            disabled={submitting}
            placeholder="Anglers, swimmers, outfalls, construction…"
            onChange={(event) => set("humanActivity", event.target.value)}
            className="mt-3 h-10 w-full border border-ink bg-paper px-3 text-[0.9375rem] placeholder:text-ink-faint disabled:opacity-60"
          />
          <details className="mt-2">
            <summary className="cursor-pointer text-[0.8125rem] text-ink-muted underline underline-offset-4">
              Why this matters
            </summary>
            <p className="mt-1 text-[0.8125rem] text-ink-muted">
              How people use the site shapes which exposure pathways matter.
            </p>
          </details>
        </div>
      </div>

      <div className="space-y-6 lg:col-span-5">
        <Card className="p-5 sm:p-6 lg:sticky lg:top-20">
          <SectionHeading label="Location and photo" />
          <div className="mt-4">
            <LocationInput
              value={location}
              onChange={setLocation}
              disabled={submitting}
            />
          </div>
          <div className="mt-5 border-t border-rule pt-5">
            <Eyebrow>Photo — optional</Eyebrow>
            <div className="mt-3">
              <ImageUploader
                file={file}
                previewUrl={previewUrl}
                onSelect={selectFile}
                onClear={clearFile}
                disabled={submitting}
              />
            </div>
          </div>
          <div className="mt-5 border-t border-rule pt-5">
            <p className="hydros-mono text-ink-muted">
              {answeredCount}/10 answered
            </p>
            <Button
              type="submit"
              size="lg"
              className="mt-3 w-full"
              disabled={!canSubmit}
            >
              {submitting ? "Preparing…" : "Start guided investigation"}
            </Button>
            {formError ? (
              <div className="mt-3">
                <FieldError>{formError}</FieldError>
              </div>
            ) : null}
            <p className="mt-4 text-[0.8125rem] text-ink-faint">
              Your answers become observations attributed to you. Hydros
              cannot measure chemistry or bacteria; results describe
              evidence, not test outcomes.
            </p>
          </div>
        </Card>
      </div>
    </form>
  );
}
