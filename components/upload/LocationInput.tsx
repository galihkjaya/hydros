"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/primitives";
import { FieldError } from "@/components/upload/ImageUploader";
import {
  formatCoordinate,
  parseCoordinatePair,
  validateLatitude,
  validateLongitude,
} from "@/lib/utils/validation";

export type LocationDraft = {
  latitude: string;
  longitude: string;
};

/**
 * Coordinate entry.
 *
 * Two number fields are the source of truth. Browser geolocation and a
 * paste-a-pair helper both write into those fields, so the user can always see
 * and correct what will be submitted.
 */
export function LocationInput({
  value,
  onChange,
  error,
  disabled,
}: {
  value: LocationDraft;
  onChange: (next: LocationDraft) => void;
  error?: string;
  disabled?: boolean;
}) {
  const latId = useId();
  const lonId = useId();
  const errorId = `${latId}-error`;
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | undefined>(undefined);

  const latNumber = Number(value.latitude);
  const lonNumber = Number(value.longitude);
  const latInvalid =
    value.latitude.trim() !== "" && !validateLatitude(latNumber).ok;
  const lonInvalid =
    value.longitude.trim() !== "" && !validateLongitude(lonNumber).ok;

  function useMyLocation() {
    if (!("geolocation" in navigator)) {
      setGeoError("This browser does not provide location access.");
      return;
    }
    setGeoError(undefined);
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        onChange({
          latitude: formatCoordinate(position.coords.latitude),
          longitude: formatCoordinate(position.coords.longitude),
        });
      },
      (positionError) => {
        setLocating(false);
        setGeoError(
          positionError.code === positionError.PERMISSION_DENIED
            ? "Location permission was denied. Enter the coordinates manually."
            : "Could not determine your location. Enter the coordinates manually.",
        );
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  }

  /** Accepts a pasted "lat, lon" pair into either field. */
  function handlePaste(event: React.ClipboardEvent<HTMLInputElement>) {
    const pair = parseCoordinatePair(event.clipboardData.getData("text"));
    if (!pair) return;
    event.preventDefault();
    onChange({
      latitude: formatCoordinate(pair.latitude),
      longitude: formatCoordinate(pair.longitude),
    });
  }

  const shownError = error ?? geoError;

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          id={latId}
          label="Latitude"
          placeholder="-6.20880"
          value={value.latitude}
          invalid={latInvalid}
          disabled={disabled}
          onPaste={handlePaste}
          onChange={(latitude) => onChange({ ...value, latitude })}
        />
        <Field
          id={lonId}
          label="Longitude"
          placeholder="106.84560"
          value={value.longitude}
          invalid={lonInvalid}
          disabled={disabled}
          onPaste={handlePaste}
          onChange={(longitude) => onChange({ ...value, longitude })}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={useMyLocation}
          disabled={disabled || locating}
        >
          <PinIcon className="size-4" />
          {locating ? "Locating…" : "Use my location"}
        </Button>
        <span className="text-[0.8125rem] text-subtle">
          Or paste a “lat, lon” pair into either field.
        </span>
      </div>

      {shownError ? <FieldError id={errorId}>{shownError}</FieldError> : null}
    </div>
  );
}

function Field({
  id,
  label,
  value,
  placeholder,
  invalid,
  disabled,
  onChange,
  onPaste,
}: {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  invalid: boolean;
  disabled?: boolean;
  onChange: (value: string) => void;
  onPaste: (event: React.ClipboardEvent<HTMLInputElement>) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="wl-label">
        {label}
      </label>
      <input
        id={id}
        // `decimal` keyboard on mobile; type=text keeps "-" and "." editable.
        type="text"
        inputMode="decimal"
        autoComplete="off"
        spellCheck={false}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        onChange={(event) => onChange(event.target.value)}
        onPaste={onPaste}
        className="wl-mono mt-1.5 h-10 w-full rounded-lg border bg-surface px-3 text-foreground placeholder:text-subtle disabled:opacity-60 aria-invalid:border-risk-high"
      />
    </div>
  );
}

function PinIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 21s6.5-5.6 6.5-10.2A6.5 6.5 0 0 0 5.5 10.8C5.5 15.4 12 21 12 21Z" />
      <circle cx="12" cy="10.5" r="2.4" />
    </svg>
  );
}
