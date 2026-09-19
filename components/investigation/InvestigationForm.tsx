"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, SectionHeading } from "@/components/ui/primitives";
import { FieldError, ImageUploader } from "@/components/upload/ImageUploader";
import {
  LocationInput,
  type LocationDraft,
} from "@/components/upload/LocationInput";
import { prepareImage } from "@/lib/utils/image";
import {
  MAX_NOTE_LENGTH,
  sanitizeText,
  validateLatitude,
  validateLongitude,
} from "@/lib/utils/validation";
import {
  newInvestigationId,
  saveDraft,
} from "@/lib/investigation/draft";

const EMPTY_LOCATION: LocationDraft = { latitude: "", longitude: "" };

/**
 * Investigation input form.
 *
 * Validates locally, downscales the image in the browser, stores the draft for
 * the workspace route, then navigates. The actual provider calls happen
 * server-side once the workspace opens the investigation stream.
 */
export function InvestigationForm({
  initialLocation = EMPTY_LOCATION,
}: {
  initialLocation?: LocationDraft;
}) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [location, setLocation] =
    useState<LocationDraft>(initialLocation);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | undefined>(undefined);
  const previewUrlRef = useRef<string | null>(null);

  // Revoke the blob URL when the component unmounts.
  useEffect(
    () => () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    },
    [],
  );

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

  const latitude = Number(location.latitude);
  const longitude = Number(location.longitude);
  const hasLocation =
    location.latitude.trim() !== "" &&
    location.longitude.trim() !== "" &&
    validateLatitude(latitude).ok &&
    validateLongitude(longitude).ok;
  const canSubmit = !!file && hasLocation && !submitting;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setFormError("Add a photo of the water source.");
      return;
    }
    if (!hasLocation) {
      setFormError("Enter a valid latitude and longitude.");
      return;
    }

    setSubmitting(true);
    setFormError(undefined);
    try {
      const prepared = await prepareImage(file);
      const id = newInvestigationId();
      saveDraft(id, {
        imageDataUrl: prepared.dataUrl,
        imageWidth: prepared.width,
        imageHeight: prepared.height,
        latitude,
        longitude,
        note: sanitizeText(note, MAX_NOTE_LENGTH),
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
    <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-5">
      <div className="space-y-6 lg:col-span-3">
        <Card className="p-5 sm:p-6">
          <SectionHeading label="Step 1" title="Photograph" />
          <p className="mt-2 mb-4 text-[0.875rem] text-muted">
            The vision model reports only what is visible — colour, clarity,
            particles, foam, debris. It will not judge whether the water is safe.
          </p>
          <ImageUploader
            file={file}
            previewUrl={previewUrl}
            onSelect={selectFile}
            onClear={clearFile}
            disabled={submitting}
          />
        </Card>

        <Card className="p-5 sm:p-6">
          <SectionHeading label="Step 2" title="Location" />
          <p className="mt-2 mb-4 text-[0.875rem] text-muted">
            Coordinates drive the geographic lookup: nearby waterways, industry,
            agriculture and treatment facilities.
          </p>
          <LocationInput
            value={location}
            onChange={setLocation}
            disabled={submitting}
          />
        </Card>

        <Card className="p-5 sm:p-6">
          <SectionHeading label="Step 3" title="Observations (optional)" />
          <p className="mt-2 mb-4 text-[0.875rem] text-muted">
            Anything you noticed that a photo cannot capture — smell, recent
            changes, local reports — or a specific question.
          </p>
          <label htmlFor="observation" className="wl-label">
            Your notes
          </label>
          <textarea
            id="observation"
            value={note}
            onChange={(event) => setNote(event.target.value.slice(0, MAX_NOTE_LENGTH))}
            maxLength={MAX_NOTE_LENGTH}
            rows={4}
            disabled={submitting}
            placeholder="Strong smell after heavy rain. Neighbours say the colour changed last month."
            className="mt-1.5 w-full resize-y border border-ink bg-paper px-3 py-2 text-[0.9375rem] placeholder:text-ink-faint disabled:opacity-60"
          />
          <p className="mt-1.5 text-right wl-mono text-subtle">
            {note.length}/{MAX_NOTE_LENGTH}
          </p>
        </Card>
      </div>

      {/* Summary / submit rail */}
      <div className="lg:col-span-2">
        <Card className="p-5 sm:p-6 lg:sticky lg:top-20">
          <SectionHeading label="Ready to investigate" />
          <ul className="mt-4 space-y-2.5">
            <Requirement met={!!file}>Photograph selected</Requirement>
            <Requirement met={hasLocation}>Valid coordinates</Requirement>
            <Requirement met={note.trim().length > 0} optional>
              Observations added
            </Requirement>
          </ul>

          <Button
            type="submit"
            size="lg"
            className="mt-6 w-full"
            disabled={!canSubmit}
          >
            {submitting ? "Preparing…" : "Start investigation"}
          </Button>

          {formError ? (
            <div className="mt-3">
              <FieldError>{formError}</FieldError>
            </div>
          ) : null}

          <p className="mt-4 text-[0.8125rem] text-subtle">
            Images are downscaled in your browser before upload. Hydros cannot
            measure chemistry or bacteria; results describe evidence, not test
            outcomes.
          </p>
        </Card>
      </div>
    </form>
  );
}

function Requirement({
  met,
  optional,
  children,
}: {
  met: boolean;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-center gap-2.5 text-[0.875rem]">
      <span
        aria-hidden="true"
        className={
          met
            ? "flex size-5 items-center justify-center bg-ink text-paper"
            : "flex size-5 items-center justify-center border border-ink text-transparent"
        }
      >
        <svg viewBox="0 0 16 16" className="size-3" fill="none">
          <path
            d="M3.5 8.5l3 3 6-6.5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span className={met ? "text-foreground" : "text-muted"}>
        {children}
        {optional ? (
          <span className="text-subtle"> — optional</span>
        ) : null}
      </span>
      <span className="sr-only">{met ? "complete" : "not yet provided"}</span>
    </li>
  );
}
