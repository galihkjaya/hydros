"use client";

import { useId, useRef, useState } from "react";
import { ImagePreview } from "./ImagePreview";
import { cn } from "@/components/ui/primitives";
import {
  ACCEPTED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  validateImageFile,
} from "@/lib/utils/validation";
import { formatBytes } from "@/lib/utils/format";

/**
 * Image picker with drag-and-drop.
 *
 * The native file input stays in the DOM and is the labelled control, so
 * keyboard and screen-reader users get standard behaviour; the drop zone is a
 * visual affordance layered on top rather than a replacement.
 */
export function ImageUploader({
  file,
  previewUrl,
  onSelect,
  onClear,
  error,
  disabled,
}: {
  file: File | null;
  previewUrl: string | null;
  onSelect: (file: File) => void;
  onClear: () => void;
  error?: string;
  disabled?: boolean;
}) {
  const inputId = useId();
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [localError, setLocalError] = useState<string | undefined>(undefined);

  const shownError = error ?? localError;

  function accept(candidate: File | undefined) {
    if (!candidate) return;
    const result = validateImageFile(candidate);
    if (!result.ok) {
      setLocalError(result.message);
      return;
    }
    setLocalError(undefined);
    onSelect(candidate);
  }

  if (file && previewUrl) {
    return (
      <div className="space-y-2">
        <ImagePreview
          previewUrl={previewUrl}
          fileName={file.name}
          fileSize={file.size}
          disabled={disabled}
          onClear={() => {
            setLocalError(undefined);
            if (inputRef.current) inputRef.current.value = "";
            onClear();
          }}
        />
        {shownError ? <FieldError id={errorId}>{shownError}</FieldError> : null}
        {/* Kept mounted so the file input state stays in sync after Replace. */}
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={ACCEPTED_IMAGE_TYPES.join(",")}
          className="sr-only"
          onChange={(event) => accept(event.target.files?.[0])}
          disabled={disabled}
        />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label
        htmlFor={inputId}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (disabled) return;
          accept(event.dataTransfer.files?.[0]);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-[var(--radius-card)] border border-dashed px-6 py-12 text-center transition-colors",
          dragging
            ? "border-accent bg-accent-muted"
            : "border-line-strong bg-surface-muted/50 hover:bg-surface-muted",
          disabled && "pointer-events-none opacity-60",
        )}
      >
        <CameraIcon className="size-7 text-subtle" />
        <span className="text-[0.9375rem] font-medium">
          Add a photo of the water
        </span>
        <span id={hintId} className="max-w-xs text-[0.8125rem] text-muted">
          Drop an image here or browse. JPEG, PNG or WebP, up to{" "}
          {formatBytes(MAX_IMAGE_BYTES)}. A clear, close view of the water works
          best.
        </span>
      </label>

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES.join(",")}
        className="sr-only"
        aria-describedby={shownError ? `${hintId} ${errorId}` : hintId}
        aria-invalid={shownError ? true : undefined}
        onChange={(event) => accept(event.target.files?.[0])}
        disabled={disabled}
      />

      {shownError ? <FieldError id={errorId}>{shownError}</FieldError> : null}
    </div>
  );
}

export function FieldError({
  id,
  children,
}: {
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <p id={id} role="alert" className="text-[0.8125rem] text-risk-high">
      {children}
    </p>
  );
}

function CameraIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M3.5 8.5A2 2 0 0 1 5.5 6.5h1.6a1 1 0 0 0 .83-.44l.74-1.12a1 1 0 0 1 .83-.44h4.6a1 1 0 0 1 .83.44l.74 1.12a1 1 0 0 0 .83.44h1.6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2Z" />
      <circle cx="12" cy="12.5" r="3.2" />
    </svg>
  );
}
