/**
 * Input validation shared by the client form and the server routes.
 *
 * The server must never trust the client, so every rule here is enforced again
 * inside the API route handlers. Keeping the rules in one module keeps the two
 * checks in agreement.
 */

/** 8 MB: comfortably under Vercel's serverless request body limit. */
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const MAX_NOTE_LENGTH = 600;

export type ValidationResult =
  | { ok: true }
  | { ok: false; message: string };

const OK: ValidationResult = { ok: true };

function fail(message: string): ValidationResult {
  return { ok: false, message };
}

export function validateImageFile(file: {
  type: string;
  size: number;
}): ValidationResult {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type as (typeof ACCEPTED_IMAGE_TYPES)[number])) {
    return fail("Use a JPEG, PNG or WebP image.");
  }
  if (file.size === 0) return fail("That file is empty.");
  if (file.size > MAX_IMAGE_BYTES) {
    return fail(
      `Image is larger than ${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)} MB. Try a smaller photo.`,
    );
  }
  return OK;
}

export function validateLatitude(value: number): ValidationResult {
  if (!Number.isFinite(value)) return fail("Latitude must be a number.");
  if (value < -90 || value > 90) {
    return fail("Latitude must be between -90 and 90.");
  }
  return OK;
}

export function validateLongitude(value: number): ValidationResult {
  if (!Number.isFinite(value)) return fail("Longitude must be a number.");
  if (value < -180 || value > 180) {
    return fail("Longitude must be between -180 and 180.");
  }
  return OK;
}

export function validateNote(value: string): ValidationResult {
  if (value.length > MAX_NOTE_LENGTH) {
    return fail(`Keep observations under ${MAX_NOTE_LENGTH} characters.`);
  }
  return OK;
}

/**
 * Parses "-6.2088, 106.8456" or "-6.2088 106.8456" into a coordinate pair.
 * Returns null when the text is not a coordinate pair, so callers can decide
 * whether that is an error or simply an unfinished field.
 */
export function parseCoordinatePair(
  input: string,
): { latitude: number; longitude: number } | null {
  const parts = input
    .trim()
    .split(/[,\s]+/)
    .filter(Boolean);
  if (parts.length !== 2) return null;
  const latitude = Number(parts[0]);
  const longitude = Number(parts[1]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (!validateLatitude(latitude).ok) return null;
  if (!validateLongitude(longitude).ok) return null;
  return { latitude, longitude };
}

/** Trims and collapses whitespace; strips control characters. */
export function sanitizeText(value: string, maxLength: number): string {
  return value
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

/** 5 decimal places ≈ 1 m. Enough precision, avoids noisy display. */
export function formatCoordinate(value: number): string {
  return value.toFixed(5);
}

/**
 * Base64 payload limit for an image data URL sent to a provider.
 * Below the point where providers start returning 413.
 */
export const MAX_IMAGE_BASE64_LENGTH = 5 * 1024 * 1024;

export type ParsedImageDataUrl = {
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  base64: string;
};

/**
 * Validates a `data:image/...;base64,...` URL.
 *
 * Server-side counterpart to the client file check: the server must not trust
 * that the browser actually produced what it claims. Returns null for anything
 * that is not an accepted, non-empty, in-budget image data URL.
 */
export function parseImageDataUrl(value: string): ParsedImageDataUrl | null {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(
    value,
  );
  const mimeType = match?.[1] as ParsedImageDataUrl["mimeType"] | undefined;
  const base64 = match?.[2];
  if (!mimeType || !base64) return null;
  if (base64.length > MAX_IMAGE_BASE64_LENGTH) return null;
  // Base64 length is always a multiple of 4.
  if (base64.length % 4 !== 0) return null;
  return { mimeType, base64 };
}
