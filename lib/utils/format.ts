/** Small display formatters shared across components. */

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** "1.2 km" / "340 m" — metres below 1 km, one decimal above. */
export function formatDistance(metres: number): string {
  if (metres < 1000) return `${Math.round(metres)} m`;
  return `${(metres / 1000).toFixed(1)} km`;
}

/** Percentage from a 0–1 confidence value. */
export function formatConfidence(value: number): string {
  return `${Math.round(Math.min(Math.max(value, 0), 1) * 100)}%`;
}
