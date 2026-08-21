/**
 * Runtime coercion for model output.
 *
 * Model JSON is untrusted: fields go missing, confidences come back as strings,
 * enums come back capitalised differently. These helpers narrow `unknown` into
 * the domain types without throwing, so a sloppy response degrades one field
 * rather than failing a whole investigation stage.
 */

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Trimmed string, collapsed whitespace, capped. Empty string when absent. */
export function coerceString(value: unknown, maxLength = 1000): string {
  if (typeof value === "string") {
    return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

/** Clamps to 0–1. Accepts "0.7" and 70 (treated as a percentage). */
export function coerceConfidence(value: unknown, fallback = 0.5): number {
  const raw = typeof value === "string" ? Number(value) : value;
  if (typeof raw !== "number" || !Number.isFinite(raw)) return fallback;
  const normalized = raw > 1 && raw <= 100 ? raw / 100 : raw;
  return Math.min(Math.max(normalized, 0), 1);
}

/** Array of non-empty strings, deduplicated and capped in length and count. */
export function coerceStringArray(
  value: unknown,
  maxItems = 12,
  maxLength = 400,
): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  for (const item of value) {
    const text = coerceString(item, maxLength);
    if (text) seen.add(text);
    if (seen.size >= maxItems) break;
  }
  return [...seen];
}

/** Matches `value` against allowed members case-insensitively. */
export function coerceEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  if (typeof value !== "string") return fallback;
  const needle = value.trim().toLowerCase().replace(/[\s-]+/g, "_");
  return allowed.find((member) => member.toLowerCase() === needle) ?? fallback;
}

export function coerceBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const text = value.trim().toLowerCase();
    if (text === "true" || text === "yes") return true;
    if (text === "false" || text === "no") return false;
  }
  return fallback;
}

/** Objects from an array field, ignoring non-objects. */
export function coerceObjectArray(
  value: unknown,
  maxItems = 12,
): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).slice(0, maxItems);
}

/**
 * Extracts a JSON object from a model response.
 *
 * Handles the three common deviations from "JSON only": ```json fences,
 * leading prose, and reasoning models that emit thinking before the object.
 * Returns null when nothing parseable is present.
 */
export function extractJsonObject(text: string): Record<string, unknown> | null {
  if (!text) return null;

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidates = [fenced?.[1], text].filter(
    (value): value is string => typeof value === "string",
  );

  for (const candidate of candidates) {
    const direct = tryParse(candidate);
    if (direct) return direct;

    // Fall back to the outermost braced span.
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start !== -1 && end > start) {
      const braced = tryParse(candidate.slice(start, end + 1));
      if (braced) return braced;
    }
  }

  return null;
}

function tryParse(text: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(text.trim());
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
